'use strict';

/**
 * KPI Card — shared configuration.
 *
 * Loaded by both the card (index.html) and the Format dialog (configure.html)
 * so the two agree on the settings shape, the Figma defaults, number
 * formatting and the built-in icon set.
 *
 * Everything is stored as one JSON string under a single settings key, which
 * Tableau persists inside the workbook.
 */
(function () {
  var STORAGE_KEY = 'kpiCard';

  var FONT_STACK_FALLBACK =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  /** Font families offered in the dialog. "Lato" ships with the extension. */
  var FONTS = [
    'Lato',
    'Tableau Book',
    'Tableau Medium',
    'Tableau Semibold',
    'Tableau Bold',
    'Benton Sans',
    'Arial',
    'Helvetica Neue',
    'Segoe UI',
    'Roboto',
    'Open Sans',
    'Georgia',
    'Times New Roman',
    'Courier New'
  ];

  /**
   * Defaults are taken directly from the Figma component "KPI Card 3"
   * (file Tableau-Dashboards, node 9:2939).
   */
  var DEFAULTS = {
    icon: {
      show: true,
      source: 'builtin', // builtin | upload | shape
      builtinId: 'fg-bar-chart-solid',
      size: 24, // px on the icon's longer side (Figma: 24)
      color: '#EB644C', // Main Colors/Solis — tints built-in icons only
      dataUrl: '',
      name: ''
    },
    title: {
      show: true,
      text: '', // empty → the Big number field name
      align: 'left', // left | center | right
      font: 'Lato',
      size: 16,
      weight: 500, // Lato Medium
      color: '#68707D', // Neutrals/Neptune Dark
      italic: false
    },
    explanation: {
      show: true,
      reserveSpace: true, // keep the line even when empty/hidden, so big numbers line up across cards
      text: '',
      font: 'Lato',
      size: 12,
      weight: 400,
      color: '#68707D',
      italic: true
    },
    number: {
      show: true,
      period: 'day', // day (latest date) | mtd (month to date) — independent of % Change
      mtdAgg: 'sum', // sum | avg — how days are rolled up into the MTD big number
      font: 'Lato',
      size: 32,
      weight: 700,
      color: '#263244', // Main Colors/Meso
      italic: false,
      decimals: 2,
      scale: 'dynamic', // none | K | M | B | dynamic | workbook | percent | percentDynamic
      unit: '',
      unitSize: 24,
      unitPosition: 'suffix', // suffix | prefix
      shrinkToFit: true,
      pctFromRatio: true // percent formats: metric is a 0–1 ratio (0.4523 → 45.23%)
    },
    change: {
      show: true,
      compareTo: 'previous', // previous (date point before) | prevMonth (same day last month)
      period: 'day', // day (single day) | mtd (month to date)
      mtdAgg: 'sum', // sum | avg — how days are rolled up into MTD
      type: 'percent', // percent | pp
      decimals: 2,
      ppFromRatio: true, // pp: metric is a 0–1 ratio, multiply the difference by 100
      higherIsBetter: true,
      positiveColor: '#2E9E6A',
      negativeColor: '#E35263', // Negative % Change
      neutralColor: '#68707D',
      font: 'Lato',
      size: 12,
      weight: 400
    },
    bottom: {
      mode: 'chart', // chart | text | none
      chartColor: '#ED8095',
      lineStyle: 'smooth', // smooth | straight (Figma)
      lineWidth: 0.9,
      fillOpacity: 35, // % opacity of the gradient at the top of the area
      points: 30, // last N days/weeks/months… (at the Date level) on the trend line (0 = all)
      showTooltip: true,
      heightPct: 44, // share of card height; Figma: 108 / 245
      textDecimals: 1,
      periodWord: 'period',
      showSign: true
    },
    export: {
      button: 'hover', // hover | always | never
      fileName: '' // empty → the title
    },
    card: {
      padding: 15, // Filter Icon Title Padding
      bgColor: '#FFFFFF',
      bgOpacity: 0,
      divider: true, // dashed right border, as in Figma
      dividerColor: '#E2E4E8' // Neutrals/Neptune Pale
    }
  };

  // -------------------------------------------------------------------------
  // Built-in icons: only the Figma "Icons for Extension" set (icons.js).
  // -------------------------------------------------------------------------
  var ICONS = (window.KPI_CARD_FIGMA_ICONS || []).map(function (ic) {
    var o = {}; for (var k in ic) o[k] = ic[k]; o.figma = true; return o;
  });

  var ICON_GROUPS = ['Chart icons', 'Others'];

  /** Icon by id. Ids of removed icons fall back to the default icon. */
  function findIcon (id) {
    var fallback = ICONS[0];
    for (var i = 0; i < ICONS.length; i++) {
      if (ICONS[i].id === id) return ICONS[i];
      if (ICONS[i].id === DEFAULTS.icon.builtinId) fallback = ICONS[i];
    }
    return fallback;
  }

  /** Display size: `target` px (default 24) on the longer side, keeping proportions. */
  function iconSize (icon, target) {
    var t = Number(target) > 0 ? Number(target) : 24;
    var w = icon.w || 24;
    var h = icon.h || 24;
    return w >= h
      ? { w: t, h: Math.max(1, Math.round(t * h / w)) }
      : { w: Math.max(1, Math.round(t * w / h)), h: t };
  }

  /**
   * Markup for any built-in icon plus its display size.
   *   path icons      inline SVG painted with `color`
   *   Figma, tint     PNG used as a mask over `color` (follows Icon color)
   *   Figma, no tint  plain <img> in its own colours (logos, multi-colour)
   */
  function iconHtml (id, color, target) {
    var icon = findIcon(id);
    var size = iconSize(icon, target);
    var html;
    if (icon.src) {
      if (icon.tint) {
        var m = 'url(' + icon.src + ') center / contain no-repeat';
        html = '<span class="kpi-card-icon-mask" style="display:block;width:' + size.w + 'px;height:' + size.h +
          'px;background-color:' + color + ';-webkit-mask:' + m + ';mask:' + m + '"></span>';
      } else {
        html = '<img src="' + icon.src + '" alt="" width="' + size.w + '" height="' + size.h +
          '" style="display:block;width:' + size.w + 'px;height:' + size.h + 'px">';
      }
    } else {
      var paint = icon.mode === 'stroke'
        ? 'fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'
        : 'fill="' + color + '"';
      html = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size.w + '" height="' + size.h + '" viewBox="0 0 24 24" style="display:block">' +
        '<path ' + paint + ' d="' + icon.d + '"/></svg>';
    }
    return { html: html, w: size.w, h: size.h, icon: icon };
  }

  /** Kept for existing callers: markup only. */
  function iconSvg (id, color) {
    return iconHtml(id, color).html;
  }

  // -------------------------------------------------------------------------
  // Settings I/O
  // -------------------------------------------------------------------------
  function clone (o) { return JSON.parse(JSON.stringify(o)); }

  /** Deep-merges stored values over the defaults so new keys get defaults. */
  function merge (base, over) {
    var out = clone(base);
    if (!over || typeof over !== 'object') return out;
    Object.keys(out).forEach(function (k) {
      if (!(k in over)) return;
      if (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
        out[k] = merge(out[k], over[k]);
      } else if (typeof over[k] === typeof out[k] || out[k] === '' || out[k] == null) {
        out[k] = over[k];
      }
    });
    return out;
  }

  function read () {
    try {
      var raw = tableau.extensions.settings.get(STORAGE_KEY);
      return merge(DEFAULTS, raw ? JSON.parse(raw) : null);
    } catch (e) {
      return clone(DEFAULTS);
    }
  }

  function write (cfg) {
    tableau.extensions.settings.set(STORAGE_KEY, JSON.stringify(cfg));
    return tableau.extensions.settings.saveAsync();
  }

  // -------------------------------------------------------------------------
  // Formatting helpers
  // -------------------------------------------------------------------------
  var SCALES = { K: 1e3, M: 1e6, B: 1e9 };

  function pickScale (value, scale) {
    if (scale === 'dynamic') {
      var a = Math.abs(value);
      return a >= 1e9 ? 'B' : a >= 1e6 ? 'M' : a >= 1e3 ? 'K' : '';
    }
    return SCALES[scale] ? scale : '';
  }

  function fixed (n, decimals) {
    var d = Math.max(0, Math.min(10, Number(decimals) || 0));
    try {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: d,
        maximumFractionDigits: d
      }).format(n);
    } catch (e) {
      return n.toFixed(d);
    }
  }

  /**
   * Formats a number with a K/M/B suffix. `forceScale` lets a companion value
   * (the change text) reuse the scale chosen for the big number.
   */
  function formatScaled (value, scale, decimals, forceScale) {
    if (!isFinite(value)) return '—';
    var suffix = forceScale != null ? forceScale : pickScale(value, scale);
    var divisor = SCALES[suffix] || 1;
    var text = fixed(value / divisor, decimals);
    // Avoid "-0.00"
    if (/^-[0.,]+$/.test(text)) text = text.slice(1);
    return text + suffix;
  }

  function fontStack (family) {
    if (!family) return FONT_STACK_FALLBACK;
    return '"' + String(family).replace(/"/g, '') + '", ' + FONT_STACK_FALLBACK;
  }

  function normalizeHex (value) {
    if (typeof value !== 'string') return null;
    var hex = value.trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.replace(/(.)/g, '$1$1');
    return /^[0-9a-f]{6}$/i.test(hex) ? '#' + hex.toUpperCase() : null;
  }

  function rgba (hex, alpha) {
    var h = normalizeHex(hex) || '#000000';
    return 'rgba(' + parseInt(h.slice(1, 3), 16) + ', ' + parseInt(h.slice(3, 5), 16) +
      ', ' + parseInt(h.slice(5, 7), 16) + ', ' + alpha + ')';
  }

  window.KpiCardConfig = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULTS: DEFAULTS,
    FONTS: FONTS,
    ICONS: ICONS,
    findIcon: findIcon,
    ICON_GROUPS: ICON_GROUPS,
    iconHtml: iconHtml,
    iconSvg: iconSvg,
    clone: clone,
    merge: merge,
    read: read,
    write: write,
    pickScale: pickScale,
    fixed: fixed,
    formatScaled: formatScaled,
    fontStack: fontStack,
    normalizeHex: normalizeHex,
    rgba: rgba
  };
})();
