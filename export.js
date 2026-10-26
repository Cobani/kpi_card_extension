'use strict';

/**
 * Data export without libraries: CSV, and a small XLSX
 * writer (Office Open XML in an uncompressed ZIP) with fonts, fills,
 * borders, number formats, rich text, merged cells, column widths, row
 * heights and frozen panes.
 *
 *   ChartExport.csv(rows)                     rows: [[text | number]] → string
 *   ChartExport.xlsx(sheets)                  → Blob
 *     sheet: { name, cells: [[cell | null]], merges: [[r0, c0, r1, c1]],
 *              colWidths: [px], rowHeights: [px], freeze: { rows, cols },
 *              autoFilter: 'A1:D20' }
 *     cell:  { v: number | string, rich: [{ text, bold, italic, size, color }],
 *              s: { font: { name, size, bold, italic, color }, fill: '#RRGGBB',
 *                   border: { style: 'thin' | 'dashed' | 'dotted', color },
 *                   align: { h, v, wrap, rotate }, numFmt: '#,##0.0' } }
 *   ChartExport.download(blob | text, fileName, mime) → true when started
 *   ChartExport.attach(card, name) / setTable(table) / refresh(cfg): the export button + menu
 */
(function () {
  // ---------------------------------------------------------------------------
  // CSV
  // ---------------------------------------------------------------------------
  function csvField (v) {
    if (v == null) return '';
    if (typeof v === 'number') return isFinite(v) ? String(v) : '';
    var s = String(v);
    return /[",\n\r;]/.test(s) || /^\s|\s$/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function csv (rows) {
    // BOM so Excel reads UTF-8 (Arabic member names, "−", "Σ").
    return '﻿' + rows.map(function (r) { return r.map(csvField).join(','); }).join('\r\n') + '\r\n';
  }

  // ---------------------------------------------------------------------------
  // ZIP (store only)
  // ---------------------------------------------------------------------------
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32 (bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip (files) {
    var enc = new TextEncoder();
    var parts = [];
    var central = [];
    var offset = 0;
    var now = new Date();
    var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name);
      var data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      var crc = crc32(data);
      var head = new DataView(new ArrayBuffer(30));
      head.setUint32(0, 0x04034b50, true);
      head.setUint16(4, 20, true);
      head.setUint16(6, 0x0800, true);
      head.setUint16(8, 0, true);
      head.setUint16(10, dosTime, true);
      head.setUint16(12, dosDate, true);
      head.setUint32(14, crc, true);
      head.setUint32(18, data.length, true);
      head.setUint32(22, data.length, true);
      head.setUint16(26, name.length, true);
      head.setUint16(28, 0, true);
      parts.push(new Uint8Array(head.buffer), name, data);

      var cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, dosTime, true);
      cd.setUint16(14, dosDate, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var cdSize = central.reduce(function (s, a) { return s + a.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  // ---------------------------------------------------------------------------
  // XLSX
  // ---------------------------------------------------------------------------
  function xml (s) {
    return String(s == null ? '' : s)
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function argb (hex) {
    var h = String(hex || '').replace('#', '').toUpperCase();
    if (/^[0-9A-F]{3}$/.test(h)) h = h.replace(/(.)/g, '$1$1');
    return /^[0-9A-F]{6}$/.test(h) ? 'FF' + h : 'FF000000';
  }

  function colName (i) {
    var s = '';
    i += 1;
    while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
    return s;
  }

  function ref (r, c) { return colName(c) + (r + 1); }

  function Styles () {
    this.fonts = ['<font><sz val="11"/><name val="Calibri"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.numFmts = [];
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.map = {};
  }

  Styles.prototype.idx = function (list, x) {
    var i = list.indexOf(x);
    if (i < 0) { list.push(x); i = list.length - 1; }
    return i;
  };

  Styles.prototype.fontXml = function (f) {
    f = f || {};
    return '<font>' + (f.bold ? '<b/>' : '') + (f.italic ? '<i/>' : '') +
      '<sz val="' + (Number(f.size) || 11) + '"/>' + (f.color ? '<color rgb="' + argb(f.color) + '"/>' : '') +
      '<name val="' + xml(f.name || 'Calibri') + '"/></font>';
  };

  Styles.prototype.id = function (s) {
    if (!s) return 0;
    var key = JSON.stringify(s);
    if (this.map[key] != null) return this.map[key];
    var fontId = this.idx(this.fonts, this.fontXml(s.font));
    var fillId = s.fill
      ? this.idx(this.fills, '<fill><patternFill patternType="solid"><fgColor rgb="' + argb(s.fill) + '"/><bgColor indexed="64"/></patternFill></fill>')
      : 0;
    var borderId = 0;
    if (s.border) {
      var b = '<' + '%s style="' + (s.border.style || 'thin') + '"><color rgb="' + argb(s.border.color || '#D5D9DF') + '"/></%s>';
      var side = function (n) { return b.replace(/%s/g, n); };
      borderId = this.idx(this.borders, '<border>' + side('left') + side('right') + side('top') + side('bottom') + '<diagonal/></border>');
    }
    var numFmtId = 0;
    if (s.numFmt) {
      var k = this.numFmts.indexOf(s.numFmt);
      if (k < 0) { this.numFmts.push(s.numFmt); k = this.numFmts.length - 1; }
      numFmtId = 164 + k;
    }
    var a = s.align || {};
    var align = '';
    if (a.h || a.v || a.wrap || a.rotate) {
      align = '<alignment' + (a.h ? ' horizontal="' + a.h + '"' : '') +
        (a.v ? ' vertical="' + (a.v === 'middle' ? 'center' : a.v) + '"' : '') +
        (a.wrap ? ' wrapText="1"' : '') + (a.rotate ? ' textRotation="' + a.rotate + '"' : '') + '/>';
    }
    var xf = '<xf numFmtId="' + numFmtId + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + borderId + '" xfId="0"' +
      (numFmtId ? ' applyNumberFormat="1"' : '') + (fontId ? ' applyFont="1"' : '') + (fillId ? ' applyFill="1"' : '') +
      (borderId ? ' applyBorder="1"' : '') + (align ? ' applyAlignment="1">' + align + '</xf>' : '/>');
    var id = this.idx(this.xfs, xf);
    this.map[key] = id;
    return id;
  };

  Styles.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (this.numFmts.length ? '<numFmts count="' + this.numFmts.length + '">' + this.numFmts.map(function (f, i) {
        return '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + xml(f) + '"/>';
      }).join('') + '</numFmts>' : '') +
      '<fonts count="' + this.fonts.length + '">' + this.fonts.join('') + '</fonts>' +
      '<fills count="' + this.fills.length + '">' + this.fills.join('') + '</fills>' +
      '<borders count="' + this.borders.length + '">' + this.borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + this.xfs.length + '">' + this.xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  };

  function runXml (r) {
    var pr = (r.bold ? '<b/>' : '') + (r.italic ? '<i/>' : '') + '<sz val="' + (Number(r.size) || 11) + '"/>' +
      (r.color ? '<color rgb="' + argb(r.color) + '"/>' : '') + '<rFont val="' + xml(r.font || 'Calibri') + '"/>';
    return '<r><rPr>' + pr + '</rPr><t xml:space="preserve">' + xml(r.text) + '</t></r>';
  }

  function sheetXml (sh, styles) {
    var rows = sh.cells || [];
    var out = [];
    var maxC = 0;
    rows.forEach(function (r) { if (r && r.length > maxC) maxC = r.length; });
    out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
    out.push('<dimension ref="A1:' + ref(Math.max(0, rows.length - 1), Math.max(0, maxC - 1)) + '"/>');
    out.push('<sheetViews><sheetView workbookViewId="0" showGridLines="' + (sh.gridLines === false ? '0' : '1') + '">');
    var fr = sh.freeze || {};
    if (fr.rows || fr.cols) {
      out.push('<pane' + (fr.cols ? ' xSplit="' + fr.cols + '"' : '') + (fr.rows ? ' ySplit="' + fr.rows + '"' : '') +
        ' topLeftCell="' + ref(fr.rows || 0, fr.cols || 0) + '" activePane="' + (fr.rows && fr.cols ? 'bottomRight' : fr.rows ? 'bottomLeft' : 'topRight') + '" state="frozen"/>');
    }
    out.push('</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>');
    if (sh.colWidths && sh.colWidths.length) {
      out.push('<cols>' + sh.colWidths.map(function (px, i) {
        var w = Math.max(2, Math.round(((Number(px) || 64) / 7) * 100) / 100);
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>';
      }).join('') + '</cols>');
    }
    out.push('<sheetData>');
    rows.forEach(function (r, ri) {
      var hpx = sh.rowHeights && sh.rowHeights[ri];
      var cellsXml = [];
      (r || []).forEach(function (c, ci) {
        if (!c) return;
        var s = styles.id(c.s);
        var at = ' r="' + ref(ri, ci) + '"' + (s ? ' s="' + s + '"' : '');
        if (c.rich && c.rich.length) {
          cellsXml.push('<c' + at + ' t="inlineStr"><is>' + c.rich.map(runXml).join('') + '</is></c>');
        } else if (typeof c.v === 'number' && isFinite(c.v)) {
          cellsXml.push('<c' + at + '><v>' + c.v + '</v></c>');
        } else if (c.v != null && c.v !== '') {
          cellsXml.push('<c' + at + ' t="inlineStr"><is><t xml:space="preserve">' + xml(c.v) + '</t></is></c>');
        } else {
          cellsXml.push('<c' + at + '/>');
        }
      });
      out.push('<row r="' + (ri + 1) + '"' + (hpx ? ' ht="' + Math.round(hpx * 0.75 * 100) / 100 + '" customHeight="1"' : '') + '>' + cellsXml.join('') + '</row>');
    });
    out.push('</sheetData>');
    if (sh.autoFilter) out.push('<autoFilter ref="' + sh.autoFilter + '"/>');
    if (sh.merges && sh.merges.length) {
      out.push('<mergeCells count="' + sh.merges.length + '">' + sh.merges.map(function (m) {
        return '<mergeCell ref="' + ref(m[0], m[1]) + ':' + ref(m[2], m[3]) + '"/>';
      }).join('') + '</mergeCells>');
    }
    out.push('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>');
    out.push('</worksheet>');
    return out.join('');
  }

  function sheetName (n, i, used) {
    var s = String(n || 'Sheet' + (i + 1)).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet' + (i + 1);
    var base = s; var k = 2;
    while (used[s.toLowerCase()]) { s = base.slice(0, 28) + ' ' + k++; }
    used[s.toLowerCase()] = 1;
    return s;
  }

  function xlsx (sheets) {
    var styles = new Styles();
    var used = {};
    var names = sheets.map(function (s, i) { return sheetName(s.name, i, used); });
    var files = [];
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>' });
    files.push({ name: 'docProps/core.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
      '<dc:creator>Tableau extension</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</dcterms:created></cp:coreProperties>' });
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names.map(function (n, i) { return '<sheet name="' + xml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
      '</sheets></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>' });
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: sheetXml(s, styles) }); });
    files.push({ name: 'xl/styles.xml', data: styles.xml() });
    return zip(files);
  }

  // ---------------------------------------------------------------------------
  // Download (Tableau Desktop may block downloads; callers offer Copy instead)
  // ---------------------------------------------------------------------------
  function download (data, fileName, mime) {
    try {
      var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
      if (window.navigator && window.navigator.msSaveOrOpenBlob) { window.navigator.msSaveOrOpenBlob(blob, fileName); return true; }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
      return true;
    } catch (e) {
      console.warn('Export: download failed', e);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Button, menu and toast (built here, so each page only loads this file)
  // ---------------------------------------------------------------------------
  var ui = null;

  var CSS =
    '.xp-tools{position:absolute;top:8px;right:8px;z-index:5;transition:opacity .15s}' +
    '.xp-hover .xp-tools{opacity:0}.xp-hover:hover .xp-tools,.xp-hover .xp-tools:focus-within{opacity:1}' +
    '.xp-btn{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:1px solid #e2e4e8;border-radius:6px;background:#fff;color:#55606e;cursor:pointer;padding:0}' +
    '.xp-btn:hover{background:#f2f4f6;color:#263244}' +
    '.xp-menu{display:none;position:fixed;z-index:50;min-width:200px;padding:4px 0;background:#fff;border:1px solid #e2e4e8;border-radius:6px;box-shadow:0 6px 18px rgba(38,50,68,.16);font:12.5px/1.3 "Lato",-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#263244}' +
    '.xp-menu button{display:block;width:100%;padding:7px 14px;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;white-space:nowrap}' +
    '.xp-menu button:hover{background:#f2f4f6}.xp-menu hr{border:0;border-top:1px solid #eef0f2;margin:4px 0}' +
    '.xp-menu .xp-head{padding:4px 14px 2px;font-size:11px;color:#8c96a3}' +
    '.xp-toast{display:none;position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:60;max-width:86%;padding:7px 12px;border-radius:6px;background:#263244;color:#fff;font:12px/1.4 "Lato",-apple-system,"Segoe UI",Roboto,Arial,sans-serif;box-shadow:0 6px 18px rgba(38,50,68,.2)}' +
    '.xp-toast.xp-err{background:#b4431e}';

  var ICON = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8m0 0L4.8 6.8M8 10l3.2-3.2M2.5 11v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var toastTimer = null;
  function toast (text, error) {
    if (!ui) return;
    ui.toast.textContent = text;
    ui.toast.classList.toggle('xp-err', !!error);
    ui.toast.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast.style.display = 'none'; }, error ? 7000 : 4500);
  }

  function hideMenu () { if (ui) ui.menu.style.display = 'none'; }

  function showMenu (items, x, y) {
    var m = ui.menu;
    m.innerHTML = '';
    items.forEach(function (it) {
      if (!it) { m.appendChild(document.createElement('hr')); return; }
      if (it.head) { var hd = document.createElement('div'); hd.className = 'xp-head'; hd.textContent = it.head; m.appendChild(hd); return; }
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it[0];
      b.addEventListener('click', function () { hideMenu(); it[1](); });
      m.appendChild(b);
    });
    m.style.display = 'block';
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;
    m.style.left = Math.max(2, Math.min(x - m.offsetWidth, vw - m.offsetWidth - 4)) + 'px';
    m.style.top = Math.max(2, Math.min(y, vh - m.offsetHeight - 4)) + 'px';
  }

  // ---------------------------------------------------------------------------
  // The data: the worksheet's summary table, as Tableau delivers it
  // ---------------------------------------------------------------------------
  function pad (n) { return ('0' + n).slice(-2); }

  function plainValue (cell) {
    if (!cell) return null;
    var v = cell.nativeValue != null ? cell.nativeValue : cell.value;
    if (v == null || v === '%null%' || v === '') return null;
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return null;
      var utc = v.getUTCHours() === 0 && v.getUTCMinutes() === 0 && v.getUTCSeconds() === 0;
      var y = utc ? v.getUTCFullYear() : v.getFullYear();
      var mo = utc ? v.getUTCMonth() : v.getMonth();
      var d = utc ? v.getUTCDate() : v.getDate();
      return y + '-' + pad(mo + 1) + '-' + pad(d) + (utc ? '' : ' ' + pad(v.getHours()) + ':' + pad(v.getMinutes()));
    }
    if (typeof v === 'number') return isFinite(v) ? v : null;
    return String(v);
  }

  function dataTable () {
    var t = state.table;
    if (!t || !t.columns) return null;
    var head = t.columns.map(function (c) { return String(c.fieldName); });
    var rows = (t.data || []).map(function (r) {
      return t.columns.map(function (c) { return plainValue(r[c.index]); });
    });
    return { head: head, rows: rows };
  }

  function baseName () {
    var c = state.cfg || {};
    var n = (c.export && c.export.fileName) || (c.title && c.title.text) || state.name;
    n = String(n).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || state.name;
    var d = new Date();
    return n + ' ' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function saved (ok, name) {
    if (ok) toast('Downloaded ' + name + '. If nothing appeared (Tableau Desktop can block downloads), use “Copy data” and paste into Excel.');
    else toast('Download isn’t available here. Use “Copy data” and paste into Excel.', true);
  }

  function exportXlsx () {
    var d = dataTable();
    if (!d) return toast('Nothing to export yet.', true);
    var name = baseName() + '.xlsx';
    try {
      var hs = { font: { name: 'Calibri', size: 11, bold: true, color: '#FFFFFF' }, fill: '#27357E', align: { v: 'middle', wrap: true } };
      var cells = [d.head.map(function (x) { return { v: x, s: hs }; })];
      d.rows.forEach(function (r) { cells.push(r.map(function (v) { return v == null ? null : { v: v }; })); });
      var widths = d.head.map(function (h, i) {
        var w = String(h).length;
        d.rows.slice(0, 200).forEach(function (r) { if (r[i] != null) w = Math.max(w, String(r[i]).length); });
        return Math.min(360, Math.max(64, w * 7 + 18));
      });
      var sheet = { name: 'Data', cells: cells, colWidths: widths, freeze: { rows: 1, cols: 0 }, autoFilter: 'A1:' + colName(d.head.length - 1) + (d.rows.length + 1) };
      saved(download(xlsx([sheet]), name), name);
    } catch (e) {
      console.error(state.name + ': Excel export failed', e);
      toast('Excel export failed: ' + (e && e.message), true);
    }
  }

  function exportCsv () {
    var d = dataTable();
    if (!d) return toast('Nothing to export yet.', true);
    var name = baseName() + '.csv';
    try {
      saved(download(csv([d.head].concat(d.rows)), name, 'text/csv;charset=utf-8'), name);
    } catch (e) {
      console.error(state.name + ': CSV export failed', e);
      toast('CSV export failed: ' + (e && e.message), true);
    }
  }

  function esc (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function copyData () {
    var d = dataTable();
    if (!d) return toast('Nothing to copy yet.', true);
    var cell = function (v) { return v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' '); };
    var tsv = [d.head].concat(d.rows).map(function (r) { return r.map(cell).join('\t'); }).join('\n');
    var html = '<table style="border-collapse:collapse"><tr>' + d.head.map(function (h) { return '<th style="font-family:Calibri;font-size:11pt;background:#27357E;color:#fff;padding:3px 6px">' + esc(h) + '</th>'; }).join('') + '</tr>' +
      d.rows.map(function (r) { return '<tr>' + r.map(function (v) { return '<td style="font-family:Calibri;font-size:11pt;padding:3px 6px">' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</table>';
    var msg = 'Data copied. Paste it into Excel, Sheets or an email.';
    var done = false;
    var handler = function (e) {
      try { e.clipboardData.setData('text/html', html); e.clipboardData.setData('text/plain', tsv); e.preventDefault(); done = true; } catch (x) { /* fall back below */ }
    };
    document.addEventListener('copy', handler);
    try { document.execCommand('copy'); } catch (x) { /* ignore */ }
    document.removeEventListener('copy', handler);
    if (done) return toast(msg);
    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([tsv], { type: 'text/plain' }) })])
        .then(function () { toast(msg); }, function () { toast('Couldn’t copy here. Use a download instead.', true); });
    } else {
      toast('Couldn’t copy here. Use a download instead.', true);
    }
  }

  function items () {
    return [
      { head: 'Export data' },
      ['Excel (.xlsx)', exportXlsx],
      ['CSV (.csv)', exportCsv],
      null,
      ['Copy data (paste into Excel)', copyData]
    ];
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  var state = { name: 'Chart', card: null, cfg: null, table: null };

  /** attach(cardElement, 'Waterfall') once, after the page is ready. */
  function attach (card, name) {
    if (ui || !card) return;
    state.card = card;
    state.name = name || state.name;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
    var tools = document.createElement('div');
    tools.className = 'xp-tools';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'xp-btn';
    btn.title = 'Export data to Excel or CSV';
    btn.setAttribute('aria-label', 'Export data');
    btn.innerHTML = ICON;
    tools.appendChild(btn);
    card.appendChild(tools);
    var menu = document.createElement('div');
    menu.className = 'xp-menu';
    menu.setAttribute('role', 'menu');
    var tst = document.createElement('div');
    tst.className = 'xp-toast';
    tst.setAttribute('role', 'status');
    document.body.appendChild(menu);
    document.body.appendChild(tst);
    ui = { tools: tools, btn: btn, menu: menu, toast: tst };
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var r = btn.getBoundingClientRect();
      showMenu(items(), r.right, r.bottom + 4);
    });
    document.addEventListener('mousedown', function (e) { if (!menu.contains(e.target) && e.target !== btn) hideMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideMenu(); });
    window.addEventListener('blur', hideMenu);
  }

  /** setTable(summaryDataTable) after each read of the worksheet data. */
  function setTable (table) { state.table = table; }

  /** refresh(cfg) after each paint: button visibility (cfg.export.button) and file name. */
  function refresh (cfg) {
    state.cfg = cfg;
    if (!ui) return;
    var mode = (cfg && cfg.export && cfg.export.button) || 'hover';
    ui.tools.style.display = mode === 'never' || !state.table ? 'none' : '';
    state.card.classList.toggle('xp-hover', mode === 'hover');
    if (mode === 'never') hideMenu();
  }

  window.ChartExport = { csv: csv, xlsx: xlsx, zip: zip, crc32: crc32, download: download, colName: colName, attach: attach, setTable: setTable, refresh: refresh };
})();
