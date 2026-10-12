'use strict';

/**
 * Load-time measurements for debugging slow dashboards. Always collected
 * (it costs nothing), printed only in debug mode:
 *
 *   - add ?debug to the page URL (dev preview), or
 *   - in DevTools, pick this extension's frame in the Console's context
 *     dropdown and run  localStorage.setItem('extDebug', '1')  then reload.
 *     localStorage.removeItem('extDebug') turns it off again.
 *
 * In the same console, extTimings() prints the table at any time.
 * Times are milliseconds since the extension's frame started loading.
 */
(function () {
  var steps = [];
  var on = false;
  try { on = /[?&]debug\b/.test(location.search) || window.localStorage.getItem('extDebug') === '1'; } catch (e) { /* ignore */ }

  function now () { return Math.round(performance.now()); }

  function mark (step, info) {
    steps.push({ step: step, at: now(), info: info == null ? '' : String(info) });
  }

  function resources () {
    var list = [];
    try {
      performance.getEntriesByType('resource').forEach(function (r) {
        var name = r.name.split('?')[0].replace(/^.*\/(?=[^/]+\/[^/]+$)/, '');
        list.push({
          file: name,
          ms: Math.round(r.duration),
          kb: r.transferSize ? Math.round(r.transferSize / 102.4) / 10 : 0,
          from: r.transferSize === 0 && r.decodedBodySize > 0 ? 'browser cache' : (r.transferSize ? 'network' : 'unknown')
        });
      });
    } catch (e) { /* ignore */ }
    return list.sort(function (a, b) { return b.ms - a.ms; });
  }

  function report (title) {
    var nav = null;
    try { nav = performance.getEntriesByType('navigation')[0]; } catch (e) { /* ignore */ }
    var rows = [];
    if (nav) {
      rows.push({ step: 'page HTML received', at: Math.round(nav.responseEnd), info: '' });
      rows.push({ step: 'scripts parsed (DOMContentLoaded)', at: Math.round(nav.domContentLoadedEventEnd), info: '' });
    }
    rows = rows.concat(steps).sort(function (a, b) { return a.at - b.at; });
    var prev = 0;
    var table = rows.map(function (r) {
      var o = { step: r.step, 'at (ms)': r.at, '+ms': r.at - prev, info: r.info };
      prev = r.at;
      return o;
    });
    var res = resources();
    var kb = res.reduce(function (s, r) { return s + r.kb; }, 0);
    console.groupCollapsed('%c' + (title || 'Extension load timings') + '  ·  ' + (rows.length ? rows[rows.length - 1].at : 0) +
      ' ms  ·  ' + res.length + ' files, ' + Math.round(kb) + ' KB over the network', 'font-weight:bold');
    console.table(table);
    console.log('Files (slowest first):');
    console.table(res);
    console.groupEnd();
    return table;
  }

  var reported = false;
  window.ExtTiming = {
    debug: on,
    mark: mark,
    /** Prints the full table once, after the first live render (debug mode only). */
    done: function (title) {
      if (reported) return;
      reported = true;
      if (on) setTimeout(function () { report(title); }, 0);
    },
    /** One line per later refresh (filter changes etc.), debug mode only. */
    line: function (text) { if (on) console.info('[timing] ' + text); }
  };
  window.extTimings = function () { return report(); };

  mark('timing.js running');
})();
