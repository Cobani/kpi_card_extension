'use strict';

/**
 * KPI Card — Tableau Viz Extension.
 *
 * Marks card tiles (declared in kpiCard.trex):
 *   value   Measure (required)
 *   date    One or more date fields at any level — YEAR, QUARTER, MONTH,
 *           WEEK, DAY, exact date, or a combination such as YEAR + MONTH.
 *
 * The measure is ordered by date:
 *   big number  = latest value
 *   change      = latest vs the one before it (% or pp)
 *   trend line  = the last N values, with a hover tooltip per point
 *
 * Appearance comes from the Format dialog (configure.html) and is stored in
 * the workbook through tableau.extensions.settings.
 */
(function () {
  var el = {};
  var worksheet = null;
  var cfg = null;
  var lastData = null; // { label, points: [{ label, v, fv }], hasDate, dateIssue }
  var shown = [];      // points currently drawn: [{ x, y, idx }]
  var renderToken = 0;
  var gradientSeq = 0;

  var ARROWS = {
    up: '<svg viewBox="0 0 10 10"><path d="M2 8L8 2M3.2 2H8V6.8" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 10 10"><path d="M2 2L8 8M8 3.2V8H3.2" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    flat: '<svg viewBox="0 0 10 10"><path d="M1.5 5H8.5M5.8 2.3L8.5 5L5.8 7.7" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init () {
    ['card', 'icon', 'title', 'explanation', 'metric-row', 'number', 'value',
      'unit-pre', 'unit-post', 'change', 'change-arrow', 'change-text',
      'bottom', 'chart', 'bottom-text', 'hint', 'tooltip'].forEach(function (id) {
      el[id.replace(/-(\w)/g, function (_, c) { return c.toUpperCase(); })] =
        document.getElementById(id);
    });

    el.bottom.addEventListener('mousemove', onHover);
    el.bottom.addEventListener('mouseleave', hideTooltip);

    return tableau.extensions.initializeAsync({ configure: configure }).then(function () {
      worksheet = tableau.extensions.worksheetContent.worksheet;
      cfg = KpiCardConfig.read();

      worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, refresh);
      tableau.extensions.settings.addEventListener(
        tableau.TableauEventType.SettingsChanged,
        function () { cfg = KpiCardConfig.read(); paint(); }
      );

      if (window.ResizeObserver) {
        new ResizeObserver(function () { layout(); }).observe(document.body);
      } else {
        window.addEventListener('resize', layout);
      }

      return refresh();
    }).catch(function (err) {
      console.error('KPI Card failed to initialize:', err);
      showEmpty('Could not initialize the extension. See the console for details.');
    });
  }

  /** Opens the Format dialog ("Format Extension" on the Marks card). */
  function configure () {
    var url = window.location.href.split(/[?#]/)[0].replace(/[^/]*$/, '') + 'configure.html';
    var options = { width: 520, height: 720 };
    if (tableau.DialogStyle && tableau.DialogStyle.Modeless) {
      options.dialogStyle = tableau.DialogStyle.Modeless; // live preview behind it
    }
    return tableau.extensions.ui.displayDialogAsync(url, '', options).catch(function (err) {
      var closed = tableau.ErrorCodes && err && err.errorCode === tableau.ErrorCodes.DialogClosedByUser;
      if (!closed) console.error('KPI Card dialog error:', err);
    });
  }

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------
  async function refresh () {
    var token = ++renderToken;
    try {
      var fields = await getEncodedFields();
      if (token !== renderToken) return;

      if (!fields.value.length) {
        lastData = null;
        showEmpty('Drag a measure onto the <b>Measure</b> tile and a date onto <b>Date</b>.');
        return;
      }

      var table = await readSummaryData();
      if (token !== renderToken) return;

      lastData = extract(table, fields);
      paint();
    } catch (err) {
      console.error('KPI Card render failed:', err);
      if (token === renderToken) showEmpty('Could not read the worksheet data. See the console for details.');
    }
  }

  /** { value: [field], date: [field, field, ...] } in the order they were dropped. */
  async function getEncodedFields () {
    var spec = await worksheet.getVisualSpecificationAsync();
    var marks = spec.marksSpecifications[spec.activeMarksSpecificationIndex];
    var fields = { value: [], date: [] };
    marks.encodings.forEach(function (enc) {
      if (!enc.field) return;
      (fields[enc.id] = fields[enc.id] || []).push(enc.field);
    });
    return fields;
  }

  async function readSummaryData () {
    var reader = await worksheet.getSummaryDataReaderAsync(undefined, { ignoreSelection: true });
    try {
      return await reader.getAllPagesAsync();
    } finally {
      await reader.releaseAsync();
    }
  }

  function findColumn (table, field, taken) {
    if (!field) return null;
    var cols = table.columns.filter(function (c) { return taken.indexOf(c) < 0; });
    var norm = function (s) { return String(s || '').replace(/^[A-Z_]+\((.*)\)$/i, '$1').trim().toLowerCase(); };
    return cols.find(function (c) { return c.fieldId && c.fieldId === field.id; }) ||
      cols.find(function (c) { return c.fieldName === field.name; }) ||
      cols.find(function (c) { return norm(c.fieldName) === norm(field.name); }) ||
      null;
  }

  function toNumber (cell) {
    if (!cell) return NaN;
    var v = cell.nativeValue != null ? cell.nativeValue : cell.value;
    if (v === null || v === '%null%' || v === '') return NaN;
    return typeof v === 'number' ? v : Number(v);
  }

  /**
   * How fine a date column is, so combined fields sort coarse → fine
   * (YEAR before QUARTER before MONTH ...) whatever order they were dropped in.
   */
  function granularity (fieldName) {
    var m = /^(\w+)\(/.exec(String(fieldName || ''));
    var p = m ? m[1].toUpperCase() : '';
    var rank = {
      YEAR: 1, YR: 1, TYEAR: 1,
      QUARTER: 2, QR: 2, TQUARTER: 2,
      MONTH: 3, MN: 3, MY: 3, TMONTH: 3,
      WEEK: 4, WK: 4, TWEEK: 4,
      DAY: 5, DY: 5, MDY: 5, TDAY: 5,
      WEEKDAY: 6,
      HOUR: 7, MINUTE: 8, SECOND: 9
    };
    return rank[p] || (m ? 5 : 5); // exact dates count as day level
  }

  /**
   * Turns one date cell into something sortable. Handles real dates (exact or
   * truncated), numeric date parts (YEAR 2026, MONTH 5, WEEK 18, QUARTER 2)
   * and named parts ("May", "Q2", "Monday", "May 2026").
   */
  function ordinal (cell) {
    if (!cell) return NaN;
    var v = cell.nativeValue != null ? cell.nativeValue : cell.value;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
    var strs = [v, cell.formattedValue];
    for (var i = 0; i < strs.length; i++) {
      var s = strs[i];
      if (s == null || s === '%null%') continue;
      s = String(s).trim();
      var iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
      if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] || 0), +(iso[5] || 0), +(iso[6] || 0)).getTime();
      if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
      var q = /^(?:q|quarter\s*)(\d)$/i.exec(s);
      if (q) return Number(q[1]);
      var w = /^(?:w|week\s*)(\d{1,2})$/i.exec(s);
      if (w) return Number(w[1]);
      var low = s.toLowerCase();
      if (/^[a-z]+$/.test(low)) {
        var mi = MONTHS.indexOf(low.slice(0, 3));
        if (mi >= 0 && !/^(mon|tue|wed|thu|fri|sat|sun)/.test(low)) return mi + 1;
        var wi = WEEKDAYS.indexOf(low.slice(0, 3));
        if (wi >= 0) return wi + 1;
      }
      var parsed = Date.parse(s);
      if (!isNaN(parsed)) return parsed;
    }
    return NaN;
  }

  function compareKeys (a, b) {
    for (var i = 0; i < a.key.length; i++) {
      var x = a.key[i];
      var y = b.key[i];
      var xn = isNaN(x);
      var yn = isNaN(y);
      if (xn && yn) continue;
      if (xn) return 1;
      if (yn) return -1;
      if (x !== y) return x - y;
    }
    return a.i - b.i; // Tableau's own order as the tie-breaker
  }

  /** Summary data → ordered series of { label, v, fv }. */
  function extract (table, fields) {
    var rows = table.data || [];
    var taken = [];
    var cValue = findColumn(table, fields.value[0], taken);
    if (cValue) taken.push(cValue);

    var cDates = [];
    fields.date.forEach(function (f) {
      var c = findColumn(table, f, taken);
      if (c) { taken.push(c); cDates.push(c); }
    });
    // Coarse → fine, so YEAR + MONTH sorts by year first.
    cDates = cDates
      .map(function (c, k) { return { c: c, k: k, g: granularity(c.fieldName) }; })
      .sort(function (a, b) { return a.g - b.g || a.k - b.k; })
      .map(function (o) { return o.c; });

    var label = cleanName(cValue ? cValue.fieldName : fields.value[0].name);

    if (!cValue) {
      return { label: label, points: [], hasDate: !!fields.date.length, dateIssue: 'Couldn’t find the measure in the sheet data.' };
    }

    var pts = [];
    rows.forEach(function (r, i) {
      var cell = r[cValue.index];
      var v = toNumber(cell);
      if (!isFinite(v)) return;
      pts.push({
        i: i,
        v: v,
        fv: cell.formattedValue,
        key: cDates.map(function (c) { return ordinal(r[c.index]); }),
        label: cDates.map(function (c) { return r[c.index].formattedValue; }).join(' · ')
      });
    });

    if (cDates.length) {
      pts.sort(compareKeys);
      // Merge rows that share the same date (only happens with extra detail).
      var merged = [];
      pts.forEach(function (p) {
        var prev = merged[merged.length - 1];
        if (prev && prev.label === p.label) {
          prev.v += p.v;
          prev.fv = null;
        } else {
          merged.push(p);
        }
      });
      pts = merged;
    } else if (pts.length > 1) {
      // No date: collapse to one total.
      var total = pts.reduce(function (s, p) { return s + p.v; }, 0);
      pts = [{ i: 0, v: total, fv: null, key: [], label: '' }];
    }

    var issue = '';
    if (fields.date.length && !cDates.length) {
      issue = 'Couldn’t find the date field in the sheet data. Try removing and re-adding it.';
    } else if (!fields.date.length) {
      issue = 'Drag a date field onto the Date tile to show the trend and the change.';
    } else if (pts.length < 2) {
      issue = 'Only one date in the data, so there’s no trend or change to show yet.';
    }

    return { label: label, points: pts, hasDate: cDates.length > 0, dateIssue: issue };
  }

  function cleanName (name) {
    return String(name || '').replace(/^(SUM|AVG|MIN|MAX|CNT|CNTD|COUNT|COUNTD|MEDIAN|AGG|ATTR)\((.*)\)$/i, '$2');
  }

  // ---------------------------------------------------------------------------
  // Change logic (shared by the card and the tooltip)
  // ---------------------------------------------------------------------------

  /** Latest vs previous → { dir, color, text } or null when not computable. */
  function change (cur, prev) {
    var c = cfg.change;
    if (!isFinite(cur) || !isFinite(prev)) return null;
    var diff = cur - prev;
    var amount, suffix;
    if (c.type === 'pp') {
      amount = c.ppFromRatio ? diff * 100 : diff;
      suffix = ' pp';
    } else {
      if (prev === 0) return null;
      amount = diff / Math.abs(prev) * 100;
      suffix = '%';
    }
    var isZero = Number(Math.abs(amount).toFixed(Math.max(0, c.decimals))) === 0;
    var dir = isZero ? 'flat' : amount > 0 ? 'up' : 'down';
    var good = c.higherIsBetter ? dir === 'up' : dir === 'down';
    return {
      dir: dir,
      diff: diff,
      color: dir === 'flat' ? c.neutralColor : good ? c.positiveColor : c.negativeColor,
      text: (dir === 'up' ? '+' : dir === 'down' ? '-' : '') + KpiCardConfig.fixed(Math.abs(amount), c.decimals) + suffix
    };
  }

  var currentScale = '';

  /** Formats a value the way the big number is formatted (without unit). */
  function isPercentFormat () {
    return cfg.number.scale === 'percent' || cfg.number.scale === 'percentDynamic';
  }

  /** The number as shown in percent formats: ×100 when the metric is a 0–1 ratio. */
  function percentValue (v) {
    return cfg.number.pctFromRatio ? v * 100 : v;
  }

  /**
   * Formats a value like the big number (without unit).
   * `isDiff` marks a difference between two values: in percent formats that
   * is a percentage-point change, so it gets " pp" instead of "%".
   */
  function formatValue (v, fv, decimals, forceScale, isDiff) {
    var n = cfg.number;
    var d = decimals == null ? n.decimals : decimals;
    if (isPercentFormat()) {
      var body = KpiCardConfig.formatScaled(percentValue(v), n.scale === 'percentDynamic' ? 'dynamic' : 'none', d,
        n.scale === 'percentDynamic' ? forceScale : '');
      return body + (isDiff ? ' pp' : '%');
    }
    if (n.scale === 'workbook' && fv) return fv;
    var scale = n.scale === 'workbook' ? 'dynamic' : n.scale;
    return KpiCardConfig.formatScaled(v, scale, decimals == null ? n.decimals : decimals, forceScale);
  }

  function withUnit (text) {
    var u = cfg.number.unit;
    if (!u) return text;
    return cfg.number.unitPosition === 'prefix' ? u + ' ' + text : text + ' ' + u;
  }

  // ---------------------------------------------------------------------------
  // Paint
  // ---------------------------------------------------------------------------
  function paint () {
    if (!lastData || !cfg) return;
    var pts = lastData.points;
    if (!pts.length) {
      showEmpty(lastData.dateIssue || 'No data for the measure.');
      return;
    }

    var latest = pts[pts.length - 1];
    var prev = pts.length > 1 ? pts[pts.length - 2] : null;

    el.card.classList.remove('is-empty');
    hideTooltip();
    paintCard();
    paintHeader();
    paintNumber(latest);
    paintChange(latest, prev);
    paintBottom(latest, prev);
    layout();
  }

  function applyFont (node, f) {
    node.style.fontFamily = KpiCardConfig.fontStack(f.font);
    node.style.fontSize = f.size + 'px';
    node.style.fontWeight = String(f.weight);
    node.style.fontStyle = f.italic ? 'italic' : 'normal';
    if (f.color) node.style.color = f.color;
  }

  function paintCard () {
    var c = cfg.card;
    el.card.style.padding = c.padding + 'px';
    el.card.style.backgroundColor = c.bgOpacity > 0 ? KpiCardConfig.rgba(c.bgColor, c.bgOpacity / 100) : 'transparent';
    el.card.style.borderRightColor = c.divider ? c.dividerColor : 'transparent';
    el.card.style.borderRightWidth = c.divider ? '1px' : '0';
  }

  function paintHeader () {
    var ic = cfg.icon;
    var showIcon = ic.show && (ic.source === 'builtin' || ic.dataUrl);
    el.card.classList.toggle('no-icon', !showIcon);
    el.icon.style.display = showIcon ? '' : 'none';
    el.icon.innerHTML = '';

    if (showIcon) {
      if (ic.source === 'builtin') {
        var r = KpiCardConfig.iconHtml(ic.builtinId, ic.color, iconTarget());
        el.icon.innerHTML = r.html;
        setIconBox(r.w, r.h);
      } else {
        var img = new Image();
        img.alt = '';
        img.onload = function () { sizeImageIcon(img); };
        img.src = ic.dataUrl;
        el.icon.appendChild(img);
        if (img.complete) sizeImageIcon(img);
      }
    }

    applyFont(el.title, cfg.title);
    el.title.textContent = cfg.title.text || lastData.label;

    var ex = cfg.explanation;
    applyFont(el.explanation, ex);
    el.explanation.textContent = ex.text;
    el.explanation.style.display = ex.show && ex.text ? '' : 'none';
    updateIconSpan();
  }

  /** Icons are 24px on their longer side: 24 wide if landscape, 24 tall if portrait. */
  function sizeImageIcon (img) {
    var t = iconTarget();
    var w = img.naturalWidth || t;
    var h = img.naturalHeight || t;
    var W, H;
    if (w >= h) { W = t; H = Math.max(1, Math.round(t * h / w)); } else { H = t; W = Math.max(1, Math.round(t * w / h)); }
    img.style.width = W + 'px';
    img.style.height = H + 'px';
    setIconBox(W, H);
  }

  /** Icon size from Format → Icon: px on the longer side (default 24, as in Figma). */
  function iconTarget () {
    var n = Number(cfg.icon.size);
    return isFinite(n) && n > 0 ? Math.max(8, Math.min(128, n)) : 24;
  }

  function setIconBox (w, h) {
    el.icon.style.width = w + 'px';
    el.icon.style.height = h + 'px';
    iconBoxH = h;
    updateIconSpan();
  }

  var iconBoxH = 0;

  /**
   * Figma layout (24px icon): icon centred on the title, explanation below it.
   * Once the icon is clearly taller than the title line it spans title and
   * explanation instead, so the explanation isn't pushed down.
   */
  function updateIconSpan () {
    var head = el.icon.parentNode;
    var titleH = el.title.offsetHeight || 19;
    var hasExplanation = el.explanation.style.display !== 'none';
    head.classList.toggle('icon-span', hasExplanation && iconBoxH > titleH * 1.5);
  }

  function paintNumber (latest) {
    var n = cfg.number;
    applyFont(el.number, n);
    currentScale = isPercentFormat()
      ? (n.scale === 'percentDynamic' ? KpiCardConfig.pickScale(percentValue(latest.v), 'dynamic') : '')
      : KpiCardConfig.pickScale(latest.v, n.scale === 'workbook' ? 'dynamic' : n.scale);
    el.value.textContent = formatValue(latest.v, latest.fv);
    el.value.style.fontSize = n.size + 'px';

    var unitEl = n.unitPosition === 'prefix' ? el.unitPre : el.unitPost;
    var otherEl = n.unitPosition === 'prefix' ? el.unitPost : el.unitPre;
    otherEl.textContent = '';
    unitEl.textContent = n.unit || '';
    [el.unitPre, el.unitPost].forEach(function (u) { u.style.fontSize = n.unitSize + 'px'; });
  }

  function paintChange (latest, prev) {
    var c = cfg.change;
    var ch = c.show && prev ? change(latest.v, prev.v) : null;
    if (!ch) { el.change.hidden = true; return; }
    applyFont(el.change, { font: c.font, size: c.size, weight: c.weight, italic: false, color: ch.color });
    el.changeArrow.innerHTML = ARROWS[ch.dir];
    el.changeText.textContent = ch.text;
    el.change.hidden = false;
  }

  function paintBottom (latest, prev) {
    var b = cfg.bottom;
    var mode = b.mode;
    el.bottom.className = 'bottom is-' + mode;
    el.bottom.title = '';
    shown = [];

    if (mode === 'chart') {
      var pts = windowed();
      if (pts.length < 2) {
        var msg = lastData.dateIssue || 'Not enough dates to draw a trend.';
        el.chart.innerHTML = '';
        el.bottom.classList.add('has-msg');
        applyFont(el.bottomText, { font: cfg.explanation.font, size: 11, weight: 400, italic: false, color: cfg.explanation.color });
        el.bottomText.textContent = msg;
      } else {
        drawChart();
      }
    } else if (mode === 'text') {
      var n = cfg.number;
      var ex = cfg.explanation;
      applyFont(el.bottomText, { font: ex.font, size: ex.size, weight: 400, italic: false, color: n.color });
      if (!prev) {
        el.bottomText.textContent = '';
        el.bottom.title = lastData.dateIssue;
      } else {
        var diff = latest.v - prev.v;
        var abs = formatValue(Math.abs(diff), null, b.textDecimals, currentScale, true);
        // "Same as previous" only when the two values are exactly equal.
        var zero = diff === 0;
        // A real but small change can round to "0.0M" in the big number's
        // scale; let it pick its own K/M/B scale instead (e.g. "40.0K").
        if (!zero && /^[0.,]+[KMB]?( pp)?$/.test(abs)) {
          abs = isPercentFormat()
            ? formatValue(Math.abs(diff), null, b.textDecimals, null, true)
            : KpiCardConfig.formatScaled(Math.abs(diff), 'dynamic', b.textDecimals);
        }
        var word = (b.periodWord || '').trim() || 'period';
        el.bottomText.textContent = zero
          ? 'Same as previous ' + word
          : (b.showSign ? (diff < 0 ? '-' : '+') : '') + abs + (diff < 0 ? ' less' : ' more') + ' than previous ' + word;
      }
    }
  }

  /** The last N points (N = "Points shown"; 0 = all), with their index in the full series. */
  function windowed () {
    var all = lastData.points;
    var n = Number(cfg.bottom.points);
    var start = n > 0 ? Math.max(0, all.length - n) : 0;
    return all.slice(start).map(function (p, k) { return { p: p, idx: start + k }; });
  }

  /** Area + line, no axes, gridlines or labels. Points are evenly spaced. */
  function drawChart () {
    var b = cfg.bottom;
    var pts = windowed();
    var w = Math.max(1, el.bottom.clientWidth);
    var h = Math.max(1, el.bottom.clientHeight);
    var sw = Math.max(0.5, Number(b.lineWidth) || 1);
    var pad = Math.max(sw, 3.5); // room for the hover dot

    var vmin = Infinity;
    var vmax = -Infinity;
    pts.forEach(function (o) { if (o.p.v < vmin) vmin = o.p.v; if (o.p.v > vmax) vmax = o.p.v; });
    var span = vmax - vmin;
    var last = pts.length - 1;

    var x = function (k) { return last === 0 ? w / 2 : k / last * w; };
    var y = function (v) { return span === 0 ? h / 2 : pad + (1 - (v - vmin) / span) * (h - 2 * pad); };

    shown = pts.map(function (o, k) { return { x: x(k), y: y(o.p.v), idx: o.idx }; });
    var xy = shown.map(function (s) { return [s.x, s.y]; });
    var line = b.lineStyle === 'smooth' ? smoothPath(xy) : straightPath(xy);
    var area = line + 'L' + x(last).toFixed(2) + ' ' + h + 'L0 ' + h + 'Z';

    var id = 'kpi-card-grad-' + (++gradientSeq);
    var color = b.chartColor;
    var topAlpha = Math.max(0, Math.min(100, Number(b.fillOpacity))) / 100;

    el.chart.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    el.chart.innerHTML =
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + color + '" stop-opacity="' + topAlpha + '"/>' +
      '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#' + id + ')" stroke="none"/>' +
      '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="' + sw +
      '" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      '<circle id="hover-dot" r="3.5" cx="-10" cy="-10" fill="' + color + '" stroke="#fff" stroke-width="1.5" style="display:none"/>';
  }

  function straightPath (pts) {
    return pts.map(function (p, i) {
      return (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2);
    }).join('');
  }

  /**
   * Monotone cubic interpolation (Fritsch–Carlson): smooth, passes through
   * every point, never overshoots the real highs and lows.
   */
  function smoothPath (pts) {
    var n = pts.length;
    if (n < 3) return straightPath(pts);
    var dx = [];
    var slope = [];
    var i;
    for (i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1][0] - pts[i][0];
      slope[i] = dx[i] === 0 ? 0 : (pts[i + 1][1] - pts[i][1]) / dx[i];
    }
    var m = [slope[0]];
    for (i = 1; i < n - 1; i++) m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
    m[n - 1] = slope[n - 2];
    for (i = 0; i < n - 1; i++) {
      if (slope[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / slope[i];
      var c = m[i + 1] / slope[i];
      var s = a * a + c * c;
      if (s > 9) { var t = 3 / Math.sqrt(s); m[i] = t * a * slope[i]; m[i + 1] = t * c * slope[i]; }
    }
    var d = 'M' + pts[0][0].toFixed(2) + ' ' + pts[0][1].toFixed(2);
    for (i = 0; i < n - 1; i++) {
      var h3 = dx[i] / 3;
      d += 'C' + (pts[i][0] + h3).toFixed(2) + ' ' + (pts[i][1] + m[i] * h3).toFixed(2) + ' ' +
        (pts[i + 1][0] - h3).toFixed(2) + ' ' + (pts[i + 1][1] - m[i + 1] * h3).toFixed(2) + ' ' +
        pts[i + 1][0].toFixed(2) + ' ' + pts[i + 1][1].toFixed(2);
    }
    return d;
  }

  // ---------------------------------------------------------------------------
  // Tooltip
  // ---------------------------------------------------------------------------
  function onHover (e) {
    if (!cfg || !cfg.bottom.showTooltip || cfg.bottom.mode !== 'chart' || shown.length < 2) return;
    var box = el.bottom.getBoundingClientRect();
    var mx = e.clientX - box.left;

    // Nearest point by x.
    var best = shown[0];
    shown.forEach(function (s) { if (Math.abs(s.x - mx) < Math.abs(best.x - mx)) best = s; });

    var dot = document.getElementById('hover-dot');
    if (dot) {
      dot.setAttribute('cx', best.x);
      dot.setAttribute('cy', best.y);
      dot.style.display = '';
    }

    var all = lastData.points;
    var p = all[best.idx];
    var prev = best.idx > 0 ? all[best.idx - 1] : null;
    var ch = prev ? change(p.v, prev.v) : null;

    var html = '';
    if (p.label) html += '<div class="tt-date">' + esc(p.label) + '</div>';
    html += '<div class="tt-value">' + esc(withUnit(formatValue(p.v, p.fv))) + '</div>';
    if (ch) {
      var absDiff = withUnit(formatValue(Math.abs(ch.diff), null, null, null, true));
      html += '<div class="tt-change" style="color:' + ch.color + '">' +
        '<span class="tt-arrow">' + ARROWS[ch.dir] + '</span>' + esc(ch.text) +
        ' <span class="tt-abs">(' + (ch.diff < 0 ? '-' : ch.diff > 0 ? '+' : '') + esc(absDiff) + ')</span></div>' +
        '<div class="tt-note">vs ' + esc(prev.label || 'previous') + '</div>';
    } else if (!prev) {
      html += '<div class="tt-note">First date in the data</div>';
    }

    var tt = el.tooltip;
    tt.innerHTML = html;
    tt.style.fontFamily = KpiCardConfig.fontStack(cfg.explanation.font);
    tt.style.display = 'block';

    // Place above the point, flip below if needed, keep inside the frame.
    var px = box.left + best.x;
    var py = box.top + best.y;
    var tw = tt.offsetWidth;
    var th = tt.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    var left = Math.min(Math.max(4, px - tw / 2), vw - tw - 4);
    var top = py - th - 10;
    if (top < 4) top = Math.min(py + 12, vh - th - 4);
    tt.style.left = left + 'px';
    tt.style.top = Math.max(4, top) + 'px';
  }

  function hideTooltip () {
    if (el.tooltip) el.tooltip.style.display = 'none';
    var dot = document.getElementById('hover-dot');
    if (dot) dot.style.display = 'none';
  }

  function esc (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // ---------------------------------------------------------------------------
  // Layout — runs on paint and on resize
  // ---------------------------------------------------------------------------
  var layoutQueued = false;

  function layout () {
    if (!cfg || el.card.classList.contains('is-empty')) return;

    var n = cfg.number;
    var c = cfg.change;
    el.value.style.fontSize = n.size + 'px';
    el.unitPre.style.fontSize = el.unitPost.style.fontSize = n.unitSize + 'px';
    el.change.style.fontSize = c.size + 'px';

    // Shrink the number row if it would overflow the card width.
    if (n.shrinkToFit) {
      var avail = el.metricRow.clientWidth;
      var need = el.number.scrollWidth + (el.change.hidden ? 0 : 10 + el.change.scrollWidth);
      if (avail > 0 && need > avail) {
        var k = Math.max(0.35, avail / need * 0.98);
        el.value.style.fontSize = (n.size * k) + 'px';
        el.unitPre.style.fontSize = el.unitPost.style.fontSize = (n.unitSize * k) + 'px';
        el.change.style.fontSize = Math.max(9, c.size * k) + 'px';
      }
    }

    // Chart height as a share of the card (Figma: 108 of 245 px), but never
    // so tall that it runs into the number row on small zones.
    if (cfg.bottom.mode === 'chart') {
      var cs = getComputedStyle(el.card);
      var inner = el.card.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var used = el.card.querySelector('.head').offsetHeight + el.metricRow.offsetHeight + 6;
      var want = Math.round(el.card.clientHeight * cfg.bottom.heightPct / 100);
      el.bottom.style.height = Math.max(0, Math.min(want, inner - used)) + 'px';
    } else {
      el.bottom.style.height = '';
    }

    // Redraw the chart at its new pixel size (once per frame).
    if (cfg.bottom.mode === 'chart' && lastData && lastData.points.length >= 2 && !layoutQueued) {
      layoutQueued = true;
      requestAnimationFrame(function () {
        layoutQueued = false;
        if (windowed().length >= 2) drawChart();
      });
    }
  }

  function showEmpty (html) {
    el.card.classList.add('is-empty');
    hideTooltip();
    el.hint.innerHTML = html;
  }

  window.KpiCard = { init: init, _ordinal: ordinal };
})();
