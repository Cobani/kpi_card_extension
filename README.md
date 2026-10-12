# KPI Card — Tableau Viz Extension

By [ilyas coban](https://www.linkedin.com/in/ilyascoban/).

A Tableau viz extension built from the Figma component **KPI Card 3**
(file *Tableau-Dashboards*, node `9:2939`): an icon, a title, optional explanation text, a big number with a unit,
a % / pp change, and a 30-day trend line or "vs previous period" text.

```
kpiCard.trex    manifest: Marks card tiles + "Format Extension" button
index.html       card page
card.css/js      card layout, data reading, rendering
configure.*      Format dialog (every option below)
config.js        shared defaults (taken from Figma), formatting helpers
icons.js         the built-in icon list (loaded before config.js)
icons/extension/ the Figma icons as 96 px transparent PNGs
serve.py/.sh     local server on :8766, also lists Tableau shape palettes
fonts/           Lato 2.0 (OFL), WOFF2 Latin subset (~38 KB per weight), so the card matches Figma without Lato installed
```

## Run it

```bash
chmod +x serve.sh && ./serve.sh
```

Then in Tableau Desktop (2024.2+): on the Marks card, open the mark type dropdown, choose **Add Extension**, then
**Access Local Extensions**, and pick `kpiCard.trex`.

| Marks card tile | What to drop | Drives |
| --- | --- | --- |
| **Measure** | the metric | everything: big number, change, trend line |
| **Date** | any date level — YEAR, QUARTER, MONTH, WEEK, DAY, exact date — or up to 4 combined (e.g. YEAR + MONTH) | ordering by date |

- **Big number** = the measure's value at the latest date, or month to date (Big number tab → Value; independent of the % Change period).
- **% / pp change** = latest date vs the date before it, or vs the same day last month — as single days or month to date.
- **Trend line** = only the last *N* days / weeks / months (30 by default) at the Date field's level, counted on the calendar, so gaps never pull in older dates. Hover a point for its date, the full (unabbreviated) value, and its change.

The Figma defaults are applied automatically. Enter the title and explanation text in the Format dialog. If you leave
the title empty, the card uses the Measure field name.

## The "context menu" → Format Extension

Viz extensions don't get a right-click menu of their own. Tableau shows the manifest's `<context-menu>` as a
**Format Extension** button at the bottom of the Marks card instead. It opens a modeless dialog with six tabs, and every
change shows on the card right away. **Cancel** undoes everything since the dialog opened. **Reset tab** restores the
Figma defaults for that tab.

| Tab | Options |
| --- | --- |
| Icon | show/hide · **14 built-in icons** from the Figma page *Icons for Extension* (chart icons, others) · **Tableau shapes** (palette picker) · upload PNG/SVG/JPG/GIF · **size** 12–96 px on the longer side (default 24, as in Figma). Larger icons sit beside both the title and the explanation. |
| Title & text | title show/hide, text, **alignment** (left / center / right), font, size, weight, colour, italic · explanation on/off, **keep space when empty** (on by default, so big numbers line up across cards), text and the same formatting |
| Big number | show/hide · value: **single day** or **month to date** (sum or average of days) · K / M / B / Dynamic / full / **Percentage** / **Percentage dynamic (K/M/B %)** / workbook format · *Metric is a 0–1 ratio* for the percentage formats · decimals · unit text, position, size (default 24 px) · font, size, weight, colour · shrink-to-fit |
| % Change | compare with **previous date** or **same day last month** · **single day** or **month to date** (sum or average of days) · on/off · % or pp · decimals · positive/negative/no-change colours · "Increase is good" (untick to swap the colours) · font |
| Bottom | Trend line / Change text / Nothing · smooth (default) or straight line · chart colour, gradient strength, line width, points shown, tooltip on/off, height · period word, decimals, sign |
| Card | padding · dashed right divider (as in Figma) · background colour and opacity (transparent by default) |

Settings are saved in the workbook, and that includes uploaded and picked icons (stored as small data URLs). They go
with the workbook when you publish it.

### Built-in icons

The built-in icons come from the Figma page *Icons for Extension* (node `87:231`). They live in `icons/extension/` as 96 px transparent PNGs (4× their 24 px display size), listed in `icons.js`. An icon id that no longer exists falls back to the default (Bar chart).
The workbook only stores the icon's id, so the `icons/` folder must be deployed with the extension.

- All of them are single-colour and follow **Icon color** (default `#EB644C`, i.e. the Figma colour).
- **To add an icon:** export it from Figma as a PNG, drop it in `icons/extension/`, and add a line to `icons.js` with its `id`, `label`, `group`, size, and `tint: true` if it should follow Icon color.

### Tableau shapes

`serve.py` looks for shape palettes in:

- `~/Documents/My Tableau Repository/Shapes/*` (your custom palettes)
- the newest Tableau Desktop install (the built-in *Default, Filled, Arrows, KPI…* palettes)
- any extra folders listed in `KPI_SHAPES_DIRS` (separated by `:` on macOS, `;` on Windows)

```bash
KPI_SHAPES_DIRS="$HOME/Shapes:/Volumes/share/Shapes" ./serve.sh
```

When it starts, the server prints the palettes it found. When you pick a shape, it's copied into the workbook. If the
extension is hosted somewhere without `serve.py`, the Tableau shapes tab shows a note. Upload still works there, and you
can upload any `.png` file from a Shapes folder.

## Number and change logic

- **Big number**: `1336040000` with format *M* and 2 decimals shows as `1,336.04M`. *Dynamic* picks K, M or B from the size of the number.
- **Percentage formats**: the % sign is part of the number, at the same size. With *Metric is a 0–1 ratio* ticked, 0.4523 shows as `45.23%`; unticked, 45.23 shows as `45.23%`. *Percentage dynamic* also abbreviates large values, so 1,336.04 (a ratio) shows as `133.60K%`. Differences between two percentages (in the tooltip and the change text) are shown in percentage points, e.g. `-11.36 pp`.
- **% change**: `(latest − previous) / |previous|`. It's hidden when previous is 0 or there's nothing to compare with.
- **Comparison base** (% Change tab):
  - *Previous date* + *Single day*: the value at the date before the latest.
  - *Same day last month* + *Single day*: 11 Oct vs 11 Sep. Days that don't exist clamp to the month end (31 Mar vs 28/29 Feb). No value on that day → no change shown.
  - *Month to date*: 1–11 Oct vs 1–11 Sep (same day last month), or vs MTD as of the previous date. Days are summed (flows) or averaged (balances, ratios).
  - Same day last month and MTD need real dates on the Date tile (exact date, or DAY/MONTH as a date), not date parts. They read the full data, so they work even when *Points shown* hides last month from the trend line.
- **pp change**: `latest − previous`. With *Metric is a 0–1 ratio* ticked, the difference is multiplied by 100, so 0.45 vs 0.40 gives `+5.00 pp`.
- **Arrows**: ↗ when the change is positive, ↘ when negative, → when zero. The colour follows *Increase is good*.
- **Change text**: `-1,135.8M less than previous period`. It uses the big number's scale and colour, the explanation text's size, and is never italic.

### How dates are ordered

The card sorts by the Date field itself, not by Tableau's row order, so any level works:

- real dates (exact date, or truncated like *May 2026*) sort by time
- date parts sort by number or name: `2026`, `Q2`, `Week 18`, `May`, `Monday`
- several date fields sort coarse to fine (YEAR, then QUARTER, then MONTH ...), whatever order you dropped them in

A date *part* on its own drops the year, so MONTH alone would merge May 2025 and May 2026 into one "May". For data that
covers more than a year, add YEAR alongside it, or use the truncated form (right-click the pill → the second MONTH, which
shows *May 2026*).

## Transparent background

The card background is transparent by default. To see the dashboard behind it:

- set **Format → Shading → Worksheet** to *None*
- set the dashboard object's and container's background to *None*

## Deploying

1. The Tableau Extensions API library is bundled in `lib/tableau.extensions.1.17.0.min.js` (no CDN). To upgrade, replace that file and update the `<script>` path in `index.html` and `configure.html`.
2. Host the folder over HTTPS and change `<source-location><url>` in `kpiCard.trex`.
3. Add the URL to the Tableau Server/Cloud extension safe list.

If you edit the `.trex`, remove the extension and add it again, because Tableau reads the manifest only when the extension is added.

### Fast reload (last-render cache)

After each successful render the extension saves its result in the browser (localStorage, per Tableau Server and worksheet name). On the next load it draws that saved result as soon as Tableau reports the fields on the Marks card, then replaces it with the live data. The cache is only used when the same fields are encoded and it is less than 30 days old; it never leaves the browser, and clearing site data removes it.
