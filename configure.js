'use strict';

/**
 * Format dialog for KPI Card (opened by "Format Extension" on the Marks card).
 *
 * Every change is saved straight away (debounced), so the card behind the
 * modeless dialog updates live. Cancel restores what was stored on open.
 */
(function () {
  var cfg = null;
  var original = null;
  var saveTimer = null;
  var activeTab = 'icon';
  var shapeIndex = null; // { palettes: [{ name, files: [{ name, url }] }] }

  var WEIGHTS = [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [900, 'Black']];

  var TABS = [
    { id: 'icon', label: 'Icon', build: buildIconTab, keys: ['icon'] },
    { id: 'text', label: 'Title & text', build: buildTextTab, keys: ['title', 'explanation'] },
    { id: 'number', label: 'Big number', build: buildNumberTab, keys: ['number'] },
    { id: 'change', label: '% Change', build: buildChangeTab, keys: ['change'] },
    { id: 'bottom', label: 'Bottom', build: buildBottomTab, keys: ['bottom'] },
    { id: 'card', label: 'Card', build: buildCardTab, keys: ['card'] }
  ];

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init () {
    return tableau.extensions.initializeDialogAsync().then(function () {
      cfg = KpiCardConfig.read();
      original = KpiCardConfig.clone(cfg);
      buildTabs();
      document.getElementById('cancel').addEventListener('click', function () {
        cfg = original;
        flush().then(close);
      });
      document.getElementById('done').addEventListener('click', function () { flush().then(close); });
      document.getElementById('reset-tab').addEventListener('click', resetTab);
    }).catch(function (err) {
      console.error('KPI Card dialog failed to initialize:', err);
    });
  }

  function buildTabs () {
    var nav = document.getElementById('tabs');
    var panels = document.getElementById('panels');
    nav.innerHTML = '';
    panels.innerHTML = '';

    TABS.forEach(function (tab) {
      var b = h('button', { className: 'tab', type: 'button', role: 'tab', textContent: tab.label });
      b.setAttribute('aria-selected', String(tab.id === activeTab));
      b.addEventListener('click', function () { activeTab = tab.id; buildTabs(); });
      nav.appendChild(b);

      var panel = h('section', { className: 'panel', role: 'tabpanel' });
      panel.hidden = tab.id !== activeTab;
      if (!panel.hidden) tab.build(panel);
      panels.appendChild(panel);
    });
  }

  function resetTab () {
    var tab = TABS.find(function (t) { return t.id === activeTab; });
    tab.keys.forEach(function (k) { cfg[k] = KpiCardConfig.clone(KpiCardConfig.DEFAULTS[k]); });
    changed();
    buildTabs();
  }

  // ---------------------------------------------------------------------------
  // Tabs
  // ---------------------------------------------------------------------------
  function buildIconTab (p) {
    var ic = cfg.icon;

    var preview = h('div', { className: 'icon-preview' });
    var slot = h('div', { className: 'slot' });
    var name = h('div', { className: 'name' });
    preview.append(slot, name);
    var refreshPreview = function () {
      slot.innerHTML = '';
      slot.classList.remove('slot--dark');
      if (!ic.show) { name.textContent = 'Icon hidden'; return; }
      if (ic.source === 'builtin') {
        var r = KpiCardConfig.iconHtml(ic.builtinId, ic.color);
        slot.innerHTML = r.html;
        slot.classList.toggle('slot--dark', !!r.icon.light);
        name.textContent = r.icon.label;
      } else if (ic.dataUrl) {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth || 24; var hh = img.naturalHeight || 24;
          if (w >= hh) { img.style.width = '24px'; img.style.height = 'auto'; } else { img.style.height = '24px'; img.style.width = 'auto'; }
        };
        img.src = ic.dataUrl;
        slot.appendChild(img);
        name.textContent = ic.name || (ic.source === 'shape' ? 'Tableau shape' : 'Uploaded image');
      } else {
        name.textContent = 'No image chosen yet';
      }
    };
    refreshPreview();

    var g = group(p, 'Icon');
    g.appendChild(preview);
    g.appendChild(checkboxRow('Show icon', 'icon.show', function () { refreshPreview(); }));
    g.appendChild(rangeRow('Size', 'icon.size', 12, 96, 1, ' px'));
    g.appendChild(h('div', { className: 'help', textContent: 'Length of the icon\u2019s longer side. Figma default is 24 px; icons stay sharpest up to about 48 px.' }));

    var sources = [['builtin', 'Built-in'], ['shape', 'Tableau shapes'], ['upload', 'Upload']];
    var sourceRow = row('Source');
    var seg = h('div', { className: 'seg' });
    sources.forEach(function (s) {
      var b = h('button', { type: 'button', textContent: s[1] });
      b.setAttribute('aria-pressed', String(ic.source === s[0]));
      b.addEventListener('click', function () {
        ic.source = s[0];
        if (s[0] === 'builtin') ic.show = true;
        changed();
        buildTabs();
      });
      seg.appendChild(b);
    });
    sourceRow.appendChild(seg);
    g.appendChild(sourceRow);

    var body = group(p, sources.find(function (s) { return s[0] === ic.source; })[1]);

    if (ic.source === 'builtin') {
      var gridWrap = h('div');
      var fillGrid = function () {
        gridWrap.innerHTML = '';
        KpiCardConfig.ICON_GROUPS.forEach(function (groupName) {
          var icons = KpiCardConfig.ICONS.filter(function (icon) { return icon.group === groupName; });
          if (!icons.length) return;
          gridWrap.appendChild(h('div', { className: 'grid-title', textContent: groupName + ' (' + icons.length + ')' }));
          var grid = h('div', { className: 'grid' });
          icons.forEach(function (icon) {
            var cell = h('button', { type: 'button', className: 'cell', title: icon.label });
            if (icon.light) cell.classList.add('cell--dark');
            cell.innerHTML = KpiCardConfig.iconHtml(icon.id, ic.color).html;
            if (icon.id === ic.builtinId) cell.classList.add('is-active');
            cell.addEventListener('click', function () {
              ic.builtinId = icon.id;
              ic.show = true;
              Array.prototype.forEach.call(gridWrap.querySelectorAll('.cell'), function (c) { c.classList.remove('is-active'); });
              cell.classList.add('is-active');
              changed();
              refreshPreview();
            });
            grid.appendChild(cell);
          });
          gridWrap.appendChild(grid);
        });
      };
      body.appendChild(colorRow('Icon color', 'icon.color', function () { refreshPreview(); fillGrid(); }));
      body.appendChild(h('div', { className: 'help', textContent: 'Recolours single-colour icons. Logos and multi-colour icons keep their own colours.' }));
      fillGrid();
      body.appendChild(gridWrap);
    } else if (ic.source === 'shape') {
      buildShapePicker(body, refreshPreview);
    } else {
      buildUpload(body, refreshPreview);
    }
  }

  /** Lists Tableau shape palettes served by serve.py (/shapes/index.json). */
  function buildShapePicker (body, refreshPreview) {
    var note = h('p', { className: 'note', textContent: 'Loading shape palettes…' });
    body.appendChild(note);

    var loadIndex = shapeIndex ? Promise.resolve(shapeIndex)
      : fetch(baseUrl() + 'shapes/index.json', { cache: 'no-store' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (j) { shapeIndex = j; return j; });

    loadIndex.then(function (index) {
      var palettes = (index.palettes || []).filter(function (pl) { return pl.files && pl.files.length; });
      if (!palettes.length) {
        note.innerHTML = 'No shape palettes found. serve.py looked in:<br><code>' +
          (index.searched || []).map(escapeHtml).join('</code><br><code>') +
          '</code><br>Set <code>KPI_SHAPES_DIRS</code> before starting it to add folders.';
        return;
      }
      note.textContent = 'Shapes are copied into the workbook when picked, so they keep working after publishing.';

      var selRow = row('Palette');
      var sel = h('select');
      palettes.forEach(function (pl, i) { sel.appendChild(h('option', { value: String(i), textContent: pl.name + ' (' + pl.files.length + ')' })); });
      var remembered = palettes.findIndex(function (pl) { return cfg.icon.name.indexOf(pl.name + ' / ') === 0; });
      sel.value = String(remembered >= 0 ? remembered : 0);
      selRow.appendChild(sel);
      body.appendChild(selRow);

      var grid = h('div', { className: 'grid' });
      body.appendChild(grid);

      var fill = function () {
        grid.innerHTML = '';
        var pl = palettes[Number(sel.value)];
        pl.files.forEach(function (f) {
          var label = pl.name + ' / ' + f.name;
          var cell = h('button', { type: 'button', className: 'cell', title: f.name });
          cell.appendChild(h('img', { src: baseUrl() + f.url, alt: '', loading: 'lazy' }));
          if (cfg.icon.source === 'shape' && cfg.icon.name === label) cell.classList.add('is-active');
          cell.addEventListener('click', function () {
            fetch(baseUrl() + f.url).then(function (r) { return r.blob(); })
              .then(blobToIconDataUrl)
              .then(function (url) {
                cfg.icon.source = 'shape';
                cfg.icon.dataUrl = url;
                cfg.icon.name = label;
                cfg.icon.show = true;
                Array.prototype.forEach.call(grid.children, function (c) { c.classList.remove('is-active'); });
                cell.classList.add('is-active');
                changed();
                refreshPreview();
              })
              .catch(function (e) { setStatus('Could not load that shape: ' + e.message); });
          });
          grid.appendChild(cell);
        });
      };
      sel.addEventListener('change', fill);
      fill();
    }).catch(function () {
      note.innerHTML = 'Tableau shapes are listed by the local helper server. Start the extension with ' +
        '<code>./serve.sh</code> (it runs <code>serve.py</code>), then reopen this dialog. ' +
        'You can still upload a shape file from the <b>Upload</b> tab.';
    });
  }

  function buildUpload (body, refreshPreview) {
    var drop = h('label', { className: 'drop' });
    var input = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/svg+xml,image/webp,image/bmp,.ico' });
    drop.append(input,
      h('b', { textContent: 'Choose an image' }),
      h('span', { textContent: 'or drop it here — PNG, SVG, JPG, GIF. Tableau custom shapes work too.' }));
    body.appendChild(drop);
    body.appendChild(h('p', {
      className: 'note',
      textContent: 'Scaled to 24 px on its longer side. Raster images are stored at 96 px for sharp rendering on high-DPI screens.'
    }));

    var take = function (file) {
      if (!file) return;
      blobToIconDataUrl(file).then(function (url) {
        cfg.icon.source = 'upload';
        cfg.icon.dataUrl = url;
        cfg.icon.name = file.name;
        cfg.icon.show = true;
        changed();
        refreshPreview();
      }).catch(function (e) { setStatus('Could not read that image: ' + e.message); });
    };
    input.addEventListener('change', function () { take(input.files[0]); });
    ['dragenter', 'dragover'].forEach(function (t) {
      drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('is-over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('is-over'); });
    });
    drop.addEventListener('drop', function (e) { take(e.dataTransfer.files[0]); });
  }

  function buildTextTab (p) {
    var g1 = group(p, 'Title');
    g1.appendChild(textRow('Title', 'title.text', 'Defaults to the Big number field name'));
    fontRows(g1, 'title');

    var g2 = group(p, 'Explanation text');
    g2.appendChild(checkboxRow('Show explanation', 'explanation.show'));
    g2.appendChild(textRow('Text', 'explanation.text', 'e.g. % Top-Up vs Local Transfer'));
    fontRows(g2, 'explanation', true);
  }

  function buildNumberTab (p) {
    var g1 = group(p, 'Value');
    var fmtRow = selectRow('Number format', 'number.scale', [
      ['dynamic', 'Dynamic (K / M / B)'], ['K', 'Thousands (K)'], ['M', 'Millions (M)'],
      ['B', 'Billions (B)'], ['none', 'Full number'],
      ['percent', 'Percentage (%)'], ['percentDynamic', 'Percentage, dynamic (K / M / B %)'],
      ['workbook', 'Workbook format']
    ]);
    // Show or hide the ratio option as soon as the format changes.
    fmtRow.querySelector('select').addEventListener('change', function () { buildTabs(); });
    g1.appendChild(fmtRow);
    if (cfg.number.scale === 'percent' || cfg.number.scale === 'percentDynamic') {
      g1.appendChild(checkboxRow('Metric is a 0\u20131 ratio', 'number.pctFromRatio'));
      g1.appendChild(h('div', { className: 'help', textContent: 'On: 0.4523 \u2192 45.23%. Off: 45.23 \u2192 45.23%. The % sign is the same size as the number.' }));
    }
    g1.appendChild(numberRow('Decimal places', 'number.decimals', 0, 6, 1));
    g1.appendChild(textRow('Unit', 'number.unit', 'e.g. SAR, %, users'));
    g1.appendChild(selectRow('Unit position', 'number.unitPosition', [['suffix', 'After number'], ['prefix', 'Before number']]));
    g1.appendChild(numberRow('Unit size (px)', 'number.unitSize', 6, 120, 1));

    var g2 = group(p, 'Style');
    fontRows(g2, 'number', true);
    g2.appendChild(checkboxRow('Shrink to fit width', 'number.shrinkToFit'));

  }

  function buildChangeTab (p) {
    var g1 = group(p, 'Latest vs previous date');
    g1.appendChild(checkboxRow('Show change', 'change.show'));
    g1.appendChild(segRow('Type', 'change.type', [['percent', '% change'], ['pp', 'pp change']], function () { buildTabs(); }));
    var pp = checkboxRow('Metric is a 0–1 ratio', 'change.ppFromRatio');
    pp.hidden = cfg.change.type !== 'pp';
    g1.appendChild(pp);
    if (!pp.hidden) g1.appendChild(h('div', { className: 'help', textContent: 'On: 0.45 vs 0.40 → +5.00 pp. Off: 45 vs 40 → +5.00 pp.' }));
    g1.appendChild(numberRow('Decimal places', 'change.decimals', 0, 6, 1));
    g1.appendChild(checkboxRow('Increase is good', 'change.higherIsBetter'));
    g1.appendChild(h('div', { className: 'help', textContent: 'Untick for cost, churn or defect metrics so an increase shows in the negative colour.' }));

    var g2 = group(p, 'Colors');
    g2.appendChild(colorRow('Positive', 'change.positiveColor'));
    g2.appendChild(colorRow('Negative', 'change.negativeColor'));
    g2.appendChild(colorRow('No change', 'change.neutralColor'));

    var g3 = group(p, 'Font');
    g3.appendChild(fontFamilyRow('Font', 'change.font'));
    g3.appendChild(numberRow('Size (px)', 'change.size', 6, 72, 1));
    g3.appendChild(selectRow('Weight', 'change.weight', WEIGHTS));
  }

  function buildBottomTab (p) {
    var g1 = group(p, 'Bottom of card');
    g1.appendChild(segRow('Show', 'bottom.mode', [['chart', 'Trend line'], ['text', 'Change text'], ['none', 'Nothing']], function () { buildTabs(); }));

    if (cfg.bottom.mode === 'chart') {
      var g2 = group(p, 'Trend line');
      g2.appendChild(h('p', { className: 'note', textContent: 'Plots the Measure by the Date field at whatever level you use. No axes, gridlines or labels are drawn.' }));
      g2.appendChild(segRow('Line style', 'bottom.lineStyle', [['straight', 'Straight'], ['smooth', 'Smooth']]));
      g2.appendChild(colorRow('Main color', 'bottom.chartColor'));
      g2.appendChild(rangeRow('Fill at top', 'bottom.fillOpacity', 0, 100, 1, '%'));
      g2.appendChild(numberRow('Line width (px)', 'bottom.lineWidth', 0.5, 6, 0.1));
      g2.appendChild(numberRow('Points shown', 'bottom.points', 0, 5000, 1));
      g2.appendChild(h('div', { className: 'help', textContent: 'The latest N dates at the level of your Date field (30 days, 12 months, ...). 0 shows all.' }));
      g2.appendChild(checkboxRow('Tooltip on hover', 'bottom.showTooltip'));
      g2.appendChild(rangeRow('Chart height', 'bottom.heightPct', 15, 70, 1, '%'));
    } else if (cfg.bottom.mode === 'text') {
      var g3 = group(p, 'Change text');
      g3.appendChild(h('p', { className: 'note', textContent: 'Reads "-12.3M less than previous period". Uses the explanation size and the big number colour, never italic.' }));
      g3.appendChild(textRow('Period word', 'bottom.periodWord', 'period, month, week, year…'));
      g3.appendChild(numberRow('Decimal places', 'bottom.textDecimals', 0, 6, 1));
      g3.appendChild(checkboxRow('Show +/- sign', 'bottom.showSign'));
    }
  }

  function buildCardTab (p) {
    var g1 = group(p, 'Card');
    g1.appendChild(numberRow('Padding (px)', 'card.padding', 0, 60, 1));
    g1.appendChild(checkboxRow('Dashed right divider', 'card.divider'));
    g1.appendChild(colorRow('Divider color', 'card.dividerColor'));

    var g2 = group(p, 'Background');
    g2.appendChild(colorRow('Color', 'card.bgColor'));
    g2.appendChild(rangeRow('Opacity', 'card.bgOpacity', 0, 100, 1, '%'));
    g2.appendChild(h('div', { className: 'help', textContent: '0% is fully transparent. Set worksheet and container shading to None in Tableau to see through.' }));
  }

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  function fontRows (g, section, withItalic) {
    g.appendChild(fontFamilyRow('Font', section + '.font'));
    g.appendChild(numberRow('Size (px)', section + '.size', 6, 160, 1));
    g.appendChild(selectRow('Weight', section + '.weight', WEIGHTS));
    g.appendChild(colorRow('Color', section + '.color'));
    if (withItalic !== false) g.appendChild(checkboxRow('Italic', section + '.italic'));
  }

  function fontFamilyRow (label, path) {
    var r = row(label);
    var wrap = h('div', { className: 'inline' });
    var sel = h('select');
    KpiCardConfig.FONTS.forEach(function (f) { sel.appendChild(h('option', { value: f, textContent: f })); });
    sel.appendChild(h('option', { value: '__custom', textContent: 'Other…' }));
    var custom = h('input', { type: 'text', placeholder: 'Installed font name' });
    var current = get(path);
    if (KpiCardConfig.FONTS.indexOf(current) >= 0) { sel.value = current; custom.hidden = true; } else { sel.value = '__custom'; custom.value = current; }
    sel.addEventListener('change', function () {
      custom.hidden = sel.value !== '__custom';
      if (sel.value !== '__custom') { set(path, sel.value); } else { custom.focus(); }
    });
    custom.addEventListener('input', function () { if (custom.value.trim()) set(path, custom.value.trim()); });
    wrap.append(sel, custom);
    r.appendChild(wrap);
    return r;
  }

  function textRow (label, path, placeholder) {
    var r = row(label);
    var input = h('input', { type: 'text', value: get(path), placeholder: placeholder || '' });
    input.addEventListener('input', function () { set(path, input.value); });
    r.appendChild(input);
    return r;
  }

  function numberRow (label, path, min, max, step) {
    var r = row(label);
    var input = h('input', { type: 'number', min: min, max: max, step: step, value: get(path) });
    input.addEventListener('input', function () {
      var n = Number(input.value);
      if (input.value === '' || !isFinite(n)) return;
      set(path, Math.max(min, Math.min(max, n)));
    });
    r.appendChild(input);
    return r;
  }

  function rangeRow (label, path, min, max, step, unit) {
    var r = row(label);
    var wrap = h('div', { className: 'inline' });
    var input = h('input', { type: 'range', min: min, max: max, step: step, value: get(path) });
    var out = h('span', { className: 'readout', textContent: get(path) + (unit || '') });
    input.addEventListener('input', function () { set(path, Number(input.value)); out.textContent = input.value + (unit || ''); });
    wrap.append(input, out);
    r.appendChild(wrap);
    return r;
  }

  function selectRow (label, path, options, help) {
    var r = row(label);
    var sel = h('select');
    options.forEach(function (o) { sel.appendChild(h('option', { value: String(o[0]), textContent: o[1] })); });
    sel.value = String(get(path));
    sel.addEventListener('change', function () {
      var orig = options.find(function (o) { return String(o[0]) === sel.value; })[0];
      set(path, orig);
    });
    r.appendChild(sel);
    if (help) { var frag = document.createDocumentFragment(); frag.append(r, h('div', { className: 'help', textContent: help })); return wrapRows(frag); }
    return r;
  }

  function segRow (label, path, options, after) {
    var r = row(label);
    var seg = h('div', { className: 'seg' });
    options.forEach(function (o) {
      var b = h('button', { type: 'button', textContent: o[1] });
      b.setAttribute('aria-pressed', String(get(path) === o[0]));
      b.addEventListener('click', function () {
        set(path, o[0]);
        Array.prototype.forEach.call(seg.children, function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        if (after) after();
      });
      seg.appendChild(b);
    });
    r.appendChild(seg);
    return r;
  }

  function checkboxRow (label, path, after) {
    var r = row(label);
    var input = h('input', { type: 'checkbox' });
    input.checked = !!get(path);
    input.addEventListener('change', function () { set(path, input.checked); if (after) after(); });
    r.appendChild(h('div', { className: 'inline' }, [input]));
    return r;
  }

  function colorRow (label, path, after) {
    var r = row(label);
    var wrap = h('div', { className: 'inline' });
    var picker = h('input', { type: 'color', value: KpiCardConfig.normalizeHex(get(path)) || '#000000' });
    var hex = h('input', { type: 'text', className: 'hex', value: get(path), maxLength: 7, spellcheck: false });
    picker.addEventListener('input', function () {
      hex.value = picker.value.toUpperCase(); hex.classList.remove('is-invalid');
      set(path, hex.value); if (after) after();
    });
    hex.addEventListener('input', function () {
      var v = KpiCardConfig.normalizeHex(hex.value);
      hex.classList.toggle('is-invalid', !v);
      if (v) { picker.value = v; set(path, v); if (after) after(); }
    });
    hex.addEventListener('blur', function () { hex.value = get(path); hex.classList.remove('is-invalid'); });
    wrap.append(picker, hex);
    r.appendChild(wrap);
    return r;
  }

  function wrapRows (frag) { var d = h('div'); d.appendChild(frag); return d; }

  function row (label) {
    var r = h('div', { className: 'row' });
    r.appendChild(h('label', { textContent: label }));
    return r;
  }

  function group (parent, title) {
    var g = h('div', { className: 'group' });
    g.appendChild(h('h3', { className: 'group-title', textContent: title }));
    parent.appendChild(g);
    return g;
  }

  function h (tag, props, children) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'role') n.setAttribute('role', props[k]); else n[k] = props[k];
    });
    (children || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  // ---------------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------------

  /**
   * Converts an image file/blob into a compact data URL for the workbook.
   * Small SVGs are kept as vectors; everything else is rasterised so its
   * longer side is 96 px (4× the 24 px display size).
   */
  function blobToIconDataUrl (blob) {
    return readAsDataUrl(blob).then(function (url) {
      var isSvg = /svg/i.test(blob.type) || /^data:image\/svg/i.test(url);
      if (isSvg && url.length < 60000) return url;
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          var w = img.naturalWidth || 96;
          var hh = img.naturalHeight || 96;
          var k = 96 / Math.max(w, hh);
          if (k >= 1 && url.length < 60000) { resolve(url); return; }
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * Math.min(k, 1)));
          c.height = Math.max(1, Math.round(hh * Math.min(k, 1)));
          var ctx = c.getContext('2d');
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/png'));
        };
        img.onerror = function () { reject(new Error('unsupported image format')); };
        img.src = url;
      });
    });
  }

  function readAsDataUrl (blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  // ---------------------------------------------------------------------------
  // State + persistence
  // ---------------------------------------------------------------------------
  function get (path) {
    return path.split('.').reduce(function (o, k) { return o[k]; }, cfg);
  }

  function set (path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    keys.reduce(function (o, k) { return o[k]; }, cfg)[last] = value;
    changed();
  }

  function changed () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 180);
  }

  function flush () {
    clearTimeout(saveTimer);
    return persist();
  }

  function persist () {
    try {
      setStatus('Saving…');
      return KpiCardConfig.write(cfg).then(function () { setStatus('Saved'); })
        .catch(function (err) { setStatus('Could not save: ' + (err && err.message)); console.error(err); });
    } catch (err) {
      console.error(err);
      return Promise.resolve();
    }
  }

  function setStatus (text) {
    document.getElementById('status').textContent = text;
  }

  function close () {
    tableau.extensions.ui.closeDialog(' ');
  }

  function baseUrl () {
    return window.location.href.split(/[?#]/)[0].replace(/[^/]*$/, '');
  }

  function escapeHtml (s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  window.KpiCardConfigure = { init: init };
})();
