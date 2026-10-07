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
      builtinId: 'funds-clock',
      size: 24, // px on the icon's longer side (Figma: 24)
      color: '#EB644C', // Main Colors/Solis — tints built-in icons only
      dataUrl: '',
      name: ''
    },
    title: {
      text: '', // empty → the Big number field name
      font: 'Lato',
      size: 16,
      weight: 500, // Lato Medium
      color: '#68707D', // Neutrals/Neptune Dark
      italic: false
    },
    explanation: {
      show: true,
      text: '',
      font: 'Lato',
      size: 12,
      weight: 400,
      color: '#68707D',
      italic: true
    },
    number: {
      font: 'Lato',
      size: 32,
      weight: 700,
      color: '#263244', // Main Colors/Meso
      italic: false,
      decimals: 2,
      scale: 'dynamic', // none | K | M | B | dynamic | workbook | percent | percentDynamic
      unit: '',
      unitSize: 16,
      unitPosition: 'suffix', // suffix | prefix
      shrinkToFit: true,
      pctFromRatio: true // percent formats: metric is a 0–1 ratio (0.4523 → 45.23%)
    },
    change: {
      show: true,
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
      lineStyle: 'straight', // straight (Figma) | smooth
      lineWidth: 0.9,
      fillOpacity: 35, // % opacity of the gradient at the top of the area
      points: 30, // latest N dates on the trend line (0 = all)
      showTooltip: true,
      heightPct: 44, // share of card height; Figma: 108 / 245
      textDecimals: 1,
      periodWord: 'period',
      showSign: true
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
  // Built-in icons (24×24). "fill" icons are solid shapes; "stroke" icons are
  // outlines. All are tinted with icon.color.
  // -------------------------------------------------------------------------
  var ICONS = [
    {
      id: 'funds-clock',
      label: 'Time passed (Figma default)',
      group: 'Other',
      mode: 'fill',
      d: 'M11.6299 1.99763L14.2293 1.99766L15.0212 1.99715C15.6297 1.9968 16.0965 1.97223 16.5654 2.44263C16.8466 2.72603 17.002 3.11062 16.9966 3.50982C16.9951 3.90828 16.8354 4.28982 16.5525 4.57047C16.0832 5.02957 15.6043 5.00736 15.002 5.00149C14.9997 5.21839 15.0007 5.43532 15.005 5.6522C15.2136 5.68957 15.4371 5.74964 15.6398 5.80996C17.5603 6.38434 19.1719 7.70161 20.1169 9.46929C20.9072 10.9497 21.1778 12.6526 20.8852 14.3051C20.8198 14.681 20.7334 14.9911 20.6249 15.3543C20.1718 15.0961 19.1209 14.935 18.6154 15.0243C19.0166 13.8967 19.1277 12.8454 18.8337 11.669C18.4767 10.2483 17.5699 9.02755 16.313 8.27542C15.0643 7.53385 13.5737 7.31485 12.1645 7.66599C10.7422 8.0247 9.52118 8.93488 8.77111 10.1955C8.02775 11.4499 7.81269 12.948 8.1732 14.3609C8.53218 15.7596 9.42563 16.9618 10.6615 17.7089C11.7825 18.383 13.1065 18.637 14.3973 18.426C14.6307 18.3889 14.8352 18.3368 15.0641 18.2777C15.0328 18.418 15.0176 18.6585 15.0115 18.8034C15 19.3441 15.039 19.7795 15.2196 20.2977C14.2409 20.515 13.3683 20.561 12.3691 20.4136C10.4276 20.1179 8.67975 19.0717 7.50209 17.4998C7.3 17.492 7.05933 17.4981 6.855 17.4982L5.64518 17.4995C5.40837 17.4997 5.13694 17.5095 4.90231 17.4877C4.68592 17.4676 4.50239 17.2263 4.50066 17.0075C4.50068 16.8705 4.55529 16.7392 4.6524 16.6424C4.85209 16.4439 5.34548 16.4973 5.62264 16.4973L6.86839 16.4977C6.7557 16.3321 6.48525 15.6954 6.42589 15.5016C5.71055 15.512 4.99241 15.4984 4.27683 15.5044C4.15308 15.5053 4.00921 15.5073 3.88797 15.4859C3.67957 15.4488 3.50861 15.2357 3.50026 15.0267C3.49493 14.8825 3.55042 14.7424 3.65322 14.6409C3.71427 14.5801 3.7984 14.5301 3.88336 14.5186C4.14135 14.4837 4.45176 14.4968 4.71565 14.497L6.14906 14.4973C6.09501 14.3019 6.02371 13.7085 6.02096 13.5016C5.24298 13.511 4.44599 13.5025 3.66653 13.5027L2.92692 13.5028C2.68626 13.5028 2.34394 13.5408 2.16075 13.3665C2.05942 13.2711 2.00149 13.1384 2.00038 12.9991C2.00065 12.8629 2.05673 12.7325 2.15557 12.6386C2.34263 12.4602 2.65069 12.4966 2.89403 12.4972L3.57433 12.4973C4.3884 12.4942 5.20248 12.4958 6.01654 12.5021C6.02295 12.2696 6.09645 11.7367 6.14389 11.4985L4.64379 11.4995C4.39828 11.4997 4.13438 11.5101 3.88965 11.4843C3.81124 11.476 3.71887 11.4213 3.66148 11.3678C3.5601 11.2732 3.50198 11.1411 3.50066 11.0024C3.49842 10.7942 3.66082 10.5513 3.86712 10.5226C4.15532 10.4825 4.48813 10.4972 4.78099 10.4972L6.42471 10.5005C6.54049 10.1647 6.70156 9.82046 6.86003 9.50344L5.60227 9.50462C5.33735 9.50474 4.85393 9.55396 4.65966 9.36885C4.56106 9.27349 4.50414 9.14303 4.50133 9.00588C4.49877 8.7808 4.67073 8.53974 4.89243 8.51488C5.16679 8.48409 5.48508 8.49672 5.76252 8.49681L7.50733 8.49669C7.54189 8.44176 7.59422 8.37573 7.63526 8.32434C8.54496 7.18507 9.78551 6.31855 11.173 5.8683C11.4371 5.78262 11.7268 5.70115 12.0005 5.65365C11.9971 5.43678 11.9958 5.21988 11.9966 5.00298C11.4103 5.00573 10.9415 5.03426 10.4742 4.59631C10.1846 4.32585 10.0147 3.95115 10.002 3.5551C9.98712 3.14885 10.1366 2.75375 10.4166 2.45908C10.7646 2.09503 11.151 2.00763 11.6299 1.99763Z' +
        'M13.6522 8.50118C14.7377 8.52968 15.8074 8.98658 16.5936 9.73263C17.4709 10.56 17.9767 11.7066 17.9969 12.9123C18.0098 13.637 17.8486 14.3544 17.5272 15.0041C17.4837 15.0928 17.3854 15.2905 17.3221 15.3557C17.2566 15.4227 17.0663 15.4955 16.9725 15.5539C16.7147 15.7113 16.4739 15.8952 16.2538 16.1018C16.0491 16.2949 15.8784 16.4985 15.7147 16.7268C15.6655 16.7786 15.5898 16.9584 15.537 16.9943C15.0497 17.3252 14.0952 17.4961 13.5555 17.4973C12.3887 17.5166 11.2611 17.0771 10.4139 16.2746C9.51988 15.4394 9.04327 14.3239 9.00181 13.1076C8.97202 11.9341 9.40357 10.7953 10.203 9.93575C11.0697 9.01278 12.1634 8.5414 13.4227 8.50118H13.6522ZM13.4432 9.00314C13.1649 9.05497 13.0147 9.22399 13.0057 9.50411C12.9977 9.75527 13 10.005 12.9999 10.2561V12.5598C13.0002 13.2506 12.9598 13.1673 13.4442 13.6516L14.034 14.2395L14.4676 14.674C14.6772 14.884 14.7721 15.0224 15.0946 14.9856C15.4812 14.9059 15.6307 14.4576 15.3612 14.1633C14.9274 13.6895 14.429 13.2587 13.9979 12.7844L13.9999 10.4738V9.8547C14.0001 9.70592 14.0069 9.53868 13.9823 9.39278C13.9391 9.13826 13.6919 8.97756 13.4432 9.00314Z' +
        'M18.9453 16.001C20.6024 15.9712 21.9694 17.2911 21.998 18.9482C22.0265 20.6051 20.7059 21.9717 19.0488 21.999C17.3937 22.0263 16.0288 20.707 16 19.0518C15.9715 17.3965 17.29 16.0307 18.9453 16.001ZM19.9307 17.5078L19.9111 17.5088C19.7578 17.5464 19.629 17.63 19.5596 17.7734C19.3388 18.2291 19.065 18.7018 18.8643 19.1631C18.7491 19.0503 18.3684 18.6512 18.2607 18.584C18.1821 18.5359 18.0912 18.5098 17.999 18.5088C17.8646 18.5089 17.736 18.5634 17.6416 18.6592C17.5473 18.7549 17.4964 18.8861 17.5019 19.0205C17.5069 19.1335 17.5513 19.2459 17.6269 19.3291C17.7806 19.4977 17.953 19.6559 18.1133 19.8184C18.2765 19.9825 18.4386 20.1486 18.6025 20.3115C18.7107 20.4191 18.8509 20.5006 19.0068 20.498C19.1852 20.4968 19.3575 20.388 19.4385 20.2285C19.7762 19.5701 20.1063 18.9063 20.4307 18.2412C20.6185 17.8563 20.3555 17.484 19.9307 17.5078Z' +
        'M2.46621 14.502C2.74048 14.4834 2.97807 14.6902 2.99764 14.9644C3.0172 15.2386 2.81136 15.4771 2.53723 15.4977C2.26159 15.5184 2.02156 15.3111 2.0019 15.0354C1.98222 14.7598 2.19041 14.5205 2.46621 14.502Z' +
        'M2.43774 10.5049C2.70898 10.4711 2.95689 10.6619 2.99373 10.9328C3.03056 11.2036 2.8426 11.4537 2.57219 11.4936C2.39452 11.5198 2.21647 11.4485 2.10601 11.3069C1.99553 11.1653 1.96968 10.9752 2.03833 10.8093C2.10698 10.6433 2.25952 10.5271 2.43774 10.5049Z'
    },

    // Generic filled marks, in the spirit of Tableau's default shape palette.
    { id: 'circle', label: 'Circle', mode: 'fill', d: 'M12 3a9 9 0 1 1 0 18a9 9 0 0 1 0-18Z' },
    { id: 'square', label: 'Square', mode: 'fill', d: 'M4 4h16v16H4Z' },
    { id: 'triangle-up', label: 'Triangle up', mode: 'fill', d: 'M12 3l10 18H2Z' },
    { id: 'triangle-down', label: 'Triangle down', mode: 'fill', d: 'M2 3h20L12 21Z' },
    { id: 'diamond', label: 'Diamond', mode: 'fill', d: 'M12 2l10 10l-10 10L2 12Z' },
    { id: 'plus', label: 'Plus', mode: 'fill', d: 'M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5Z' },
    { id: 'cross', label: 'Cross', mode: 'fill', d: 'M5.6 2.1L12 8.5l6.4-6.4l3.5 3.5L15.5 12l6.4 6.4l-3.5 3.5L12 15.5l-6.4 6.4l-3.5-3.5L8.5 12L2.1 5.6Z' },
    { id: 'star', label: 'Star', mode: 'fill', d: 'M12 2l2.9 6.6l7.1.6l-5.4 4.7l1.6 7l-6.2-3.7l-6.2 3.7l1.6-7L2 9.2l7.1-.6Z' },

    // Outline icons for common banking KPIs.
    { id: 'trend-up', label: 'Trend up', mode: 'stroke', d: 'M3 17l6-6l4 4l8-8M15 7h6v6' },
    { id: 'trend-down', label: 'Trend down', mode: 'stroke', d: 'M3 7l6 6l4-4l8 8M15 17h6v-6' },
    { id: 'arrow-in', label: 'Inflow', mode: 'stroke', d: 'M12 3v12M7 10l5 5l5-5M4 20h16' },
    { id: 'arrow-out', label: 'Outflow', mode: 'stroke', d: 'M12 15V3M7 8l5-5l5 5M4 20h16' },
    { id: 'transfer', label: 'Transfer', mode: 'stroke', d: 'M4 8h15M15 4l4 4l-4 4M20 16H5M9 12l-4 4l4 4' },
    { id: 'coins', label: 'Coins', mode: 'stroke', d: 'M4 6c0-1.7 3.1-3 7-3s7 1.3 7 3s-3.1 3-7 3s-7-1.3-7-3ZM4 6v4c0 1.7 3.1 3 7 3M4 10v4c0 1.7 3.1 3 7 3M4 14v4c0 1.7 3.1 3 7 3M13 15c0-1.7 1.8-3 4-3s4 1.3 4 3s-1.8 3-4 3s-4-1.3-4-3ZM13 15v3c0 1.7 1.8 3 4 3s4-1.3 4-3v-3' },
    { id: 'wallet', label: 'Wallet', mode: 'stroke', d: 'M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11v3M15 13.5h2' },
    { id: 'card', label: 'Card', mode: 'stroke', d: 'M3 6h18v12H3ZM3 10h18M7 15h4' },
    { id: 'bank', label: 'Bank', mode: 'stroke', d: 'M3 9l9-5l9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18' },
    { id: 'users', label: 'Users', mode: 'stroke', d: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7ZM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14.4c2 .8 3.5 2.8 3.5 5.6' },
    { id: 'user', label: 'User', mode: 'stroke', d: 'M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8ZM4 21c0-4 3.6-7 8-7s8 3 8 7' },
    { id: 'cart', label: 'Cart', mode: 'stroke', d: 'M3 4h2.5l2.2 11h11l2-8H6.3M9 20a1 1 0 1 0 0-2a1 1 0 0 0 0 2ZM18 20a1 1 0 1 0 0-2a1 1 0 0 0 0 2Z' },
    { id: 'bar-chart', label: 'Bar chart', mode: 'stroke', d: 'M4 20h16M6 20V11M10.5 20V5M15 20v-7M19.5 20V8' },
    { id: 'pie', label: 'Pie', mode: 'stroke', d: 'M11 3.5a8.5 8.5 0 1 0 9.5 9.5H11ZM14 2.5v7.5h7.5A7.5 7.5 0 0 0 14 2.5Z' },
    { id: 'target', label: 'Target', mode: 'stroke', d: 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9a4.5 4.5 0 0 0 0 9ZM12 12.5a.5.5 0 1 0 0-1a.5.5 0 0 0 0 1Z' },
    { id: 'clock', label: 'Clock', mode: 'stroke', d: 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18ZM12 7v5l3 2' },
    { id: 'calendar', label: 'Calendar', mode: 'stroke', d: 'M4 6h16v14H4ZM4 10h16M8 3v5M16 3v5' },
    { id: 'shield', label: 'Shield', mode: 'stroke', d: 'M12 3l8 3v6c0 4.5-3.4 8-8 9c-4.6-1-8-4.5-8-9V6ZM8.5 12l2.5 2.5l4.5-5' },
    { id: 'check', label: 'Check', mode: 'stroke', d: 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18ZM8 12.5l2.8 2.8L16.5 9.5' },
    { id: 'alert', label: 'Alert', mode: 'stroke', d: 'M12 3.5l9.5 16.5h-19ZM12 10v4.5M12 17.2v.1' },
    { id: 'globe', label: 'Globe', mode: 'stroke', d: 'M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z' },
    { id: 'phone', label: 'Mobile', mode: 'stroke', d: 'M7 2.5h10v19H7ZM11 18.5h2' }
  ];

  // Group the hand-drawn icons, then put the Figma set (icons.js) after the
  // Figma default so the picker leads with the design-system icons.
  var SHAPES = ['circle', 'square', 'triangle-up', 'triangle-down', 'diamond', 'plus', 'cross', 'star'];
  ICONS.forEach(function (ic) {
    if (!ic.group) ic.group = SHAPES.indexOf(ic.id) >= 0 ? 'Basic shapes' : 'Outline icons';
  });
  var FIGMA_ICONS = (window.KPI_CARD_FIGMA_ICONS || []).map(function (ic) {
    var o = {}; for (var k in ic) o[k] = ic[k]; o.figma = true; return o;
  });
  ICONS = [ICONS[0]].concat(FIGMA_ICONS, ICONS.slice(1));

  var ICON_GROUPS = ['Onboarding', 'Chart icons', 'Dashboard icons', 'Other', 'Logos', 'Basic shapes', 'Outline icons'];

  function findIcon (id) {
    for (var i = 0; i < ICONS.length; i++) if (ICONS[i].id === id) return ICONS[i];
    return ICONS[0];
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
