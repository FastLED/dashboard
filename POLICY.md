# Benchmark policy and decisions

## Site and interaction

- Publish the dashboard with **GitHub Pages** at https://fastled.github.io/dashboard/.
- Use **Chart.js** for two overview line graphs: flash on the left, static RAM
  on the right. Plot one line per platform: Uno AVR, ESP32-S3, ESP32 Dev,
  Teensy4.1. Give Blink, APA102 hardware SPI, and a Feature-mix sketch
  separate sections, each with its own Flash/RAM charts and platform filters.
  Scale controls sit below each graph. Do not show a Measurements table.
- Give Flash and RAM independent Auto / Linear / Logarithmic selectors. Auto is
  the default and initially displays a linear axis. Pointer movement inside the
  bottom 7% of a chart's plotting area switches that whole axis to logarithmic;
  movement inside the top 7% switches it back to linear. The middle 86% retains
  the current scale for hysteresis. Layout updates alone never trigger switches.
- Linear and Logarithmic pin that chart's scale, disabling pointer-based switching.
  Returning to Auto retains the current scale until a trigger band is entered.
  Keep selections across platform filters, show the active scale, and animate
  changes without a destination-frame flash. Use accessible, polished segmented
  selectors with a sliding highlight and independent accents for each chart.
- Every plot point supports mouse hover with exact bytes/platform/version.
  Clicking a point opens an accessible popup for that graph’s region only
  (Flash or RAM), backed by the full **fbuild bloat**
  symbol report for that exact platform, FastLED revision and measurement run.
  Keyboard users can focus a chart, navigate its points with arrow keys and
  open the selected report with Enter or Space.
- Sort the selected region’s symbols by size. Show the top 10 on the first page,
  then append up to 50 more per “Load more” click. Preserve existing rows and
  scroll position so users can keep scrolling through accumulated symbols.
  Show loaded/total counts and disable the button when all symbols are loaded.
- Show a prominent live-site link in the README. Embed a real overview
  screenshot as a noninteractive PNG, linked to the interactive Pages site.
  Regenerate that screenshot whenever the daily data is published. Also generate
  an actual-site preview PNG for Open Graph and social link previews.
- Every master label must include a secondary measurement-date label converted
  to the viewer's local time zone and locale, including chart axes
  and report headings. Store timestamps in UTC and convert on display.
  Use the point's measurement timestamp, not the page viewing date or commit
  date. Hover details retain the exact localized timestamp, time-zone label and
  source SHA. If platforms were measured on different local dates, the shared
  master axis label shows each date; each point retains its own timestamp.

## JSON transport and typed benchmark data

- Strictly enforce a versioned JSON Schema for dashboard data, daily snapshots
  and the symbol-report transport used to render tables. The schema defines
  required fields, types, allowed regions/platforms/statuses, nullable failure
  fields and table-row structure; reject unknown fields and invalid values.
- Validate incoming JSON before accepting or rendering it and validate outgoing
  JSON before writing or publishing it. Invalid transport must produce a clear
  validation error, rather than partially populated tables or coerced values.
- At the benchmark's JSON input boundary, eagerly parse validated payloads
  into typed TypeScript models, including nested measurements, provenance and
  symbol rows. Use discriminated unions for success and failure measurements.
  Benchmark logic operates on typed attributes and collections, never arbitrary
  dictionaries or loosely typed JSON objects. Untrusted JSON stays `unknown`
  until schema validation succeeds. This supersedes the Python dataclass design.
- Serialize typed models back to the schema-defined transport at output
  boundaries. Keep model types, schema versions and table columns consistent;
  schema changes require explicit versioning and migration handling.

## Implementation and quality checks

- Implement the view, benchmark orchestration, screenshot capture and tests
  in TypeScript, run with Node.js 24 or newer. No Python application scripts;
  Python/uv is retained solely to install and invoke the external fbuild tool.
- Enable TypeScript strict checking, ESLint (including no explicit `any`) and
  Prettier checks. Run these checks and unit/schema tests before publishing.
  Keep animation, report rendering, transport models and collection separate.
- Generate the committed browser bundle and JSON Schema documents from typed
  sources. CI rejects a stale bundle/schema or invalid transport. Site publishing
  serves these artifacts directly and does not run collection or browser setup.
- Test axis transitions in a browser: labels remain attached to fixed values,
  log grid lines are evenly spaced, entering/exiting lines fade smoothly, and
  the same renderer/styles are used throughout to avoid flashes at completion.

## Recompute policy

- Separate data collection from the view. The collector owns firmware builds,
  bloat analysis and published JSON artifacts. The view consumes those artifacts
  without invoking the collector, so layouts and interactions can be iterated
  independently using the same measurements.
- Run collection and Pages publishing as separate jobs with separate concurrency
  groups. An ongoing collection run must not block a site-only deployment. The
  publisher checks out the latest view and committed data, and never installs
  collection dependencies or runs firmware builds. Only collection runs commit
  refreshed data and daily screenshots; publishing is read-only.

- Updates are incremental. HTML, CSS, JavaScript and other site-only changes
  deploy the committed site and measurement data directly. They must not
  trigger benchmark builds, toolchain cache restoration, Python dependency
  installation, browser installation or automatic screenshot regeneration.
- Daily scheduled runs and explicitly requested measurement runs perform the
  full latest-seven-releases-plus-master recomputation, refresh the screenshot
  and publish results. A manual publish-only run uses the same fast site path.
- When an overview layout changes, regenerate and commit its README screenshot
  locally as part of that change. Report-popup-only changes reuse the existing
  overview graphic. Reuse build and toolchain caches for measurement runs.

- Recompute the **latest seven stable FastLED release tags plus master** for
  every platform and sketch, once daily. The initial horizon is 3.10.0–3.10.6.
  Advance the horizon automatically when a new stable release tag appears.
- Use the latest stable fbuild package for the daily run, recording the actual
  version on every measurement. **Historical footprints are not immutable**:
  fbuild changes can change old releases' profiles. Recompute all seven releases
  with the same current tool, rather than mixing old-tool and new-tool results.
- Reuse SDK/framework caches and immutable source/config/tool-version project
  directories. Always run the build and bloat analysis for every row; never
  substitute a previously published number merely because the release SHA
  stayed unchanged. Tool-version changes change project identities.
- Preserve UTC daily snapshots and point-specific symbol JSONs. Latest charts
  compare versions under the current run; snapshots preserve measurement history.
- Pin master once at the start of each run. Record source SHAs, actual fbuild
  version, compiler/flags/config, protocol/source hashes and ELF hashes.

## Workload and honest metrics

- Maintain three canonical sketches: Blink (one NEOPIXEL), APA102 hardware SPI
  (one LED on default hardware SPI pins), and Features (a WS2812B strip plus
  an APA102 on hardware SPI using color correction, power limiting, palettes,
  noise, beat waves, fade, blur and EVERY_N_MILLISECONDS). Features replaced
  Rainbow, which measured nearly the same code as Blink. All fit Uno AVR and
  have no Serial calls. Measure each across every platform/version independently.
- Use one canonical Blink sketch on every version: one NEOPIXEL on pin 3,
  alternating red/black with 1000 ms delays. **No Serial.begin or prints in the
  sketch**. Keep release library source unmodified.
- If a library version retains Serial or logging dependencies itself, include
  their memory cost and label the dependency; do not silently disable features.
- Use fbuild's board-aware exact flash/static-RAM totals, not rounded KB values
  or generic GNU size totals that count ESP32 linker reservations as RAM.
  Preserve allocated image and attributed symbol metrics separately.
- Failed measurements are explicit gaps with errors, never zero-valued points.
  Validate revision/config/sketch provenance before publishing.
- Reuse a stored successful row when its FastLED SHA and protocol (sketch,
  board config, fbuild version) match; rebuild everything only when fbuild
  changes or `full_recompute` is requested.
- Run benchmarks sequentially without git worktrees. Initial validation is
  local; the dedicated daily dashboard workflow is authorized automation and
  does not invoke FastLED CI Full.

## Transport migration

- Dashboard schema 2 adds a required `sketch` identity (blink, spi, features; rainbow until replaced) to
  every measurement. Existing schema 1 snapshots are migrated explicitly as
  Blink without changing their measurements or report provenance. Collection
  keys include sketch/platform/version; focused runs retain other workloads.

## Symbol reference investigation

- Hover, focus or click any Flash/RAM symbol to inspect level-one incoming
  symbol references and object-file referencers separately. Support keyboard
  dismissal and touch activation; retain unresolved names visibly.
- Collect with explicit cross-toolchain nm/c++filt paths. Verify objdump works
  on the linked ELF and publish a strict, versioned reference-audit sidecar
  with ELF digest, analyzer version, timestamp, availability and entry address.
- Confirm ELF entry roots from binary metadata. Empty reference arrays do not
  prove unused code. Show unavailable analysis and unexplained retention
  separately; do not guess KEEP/vector/indirect roots from names.
- Preserve all same-name report rows (code, aliases, map-derived fragments) in
  reference resolution; display provenance and addresses for ambiguous matches.
- Consume the producer's strict, versioned reference analysis using the full
  name/address/source identity. Show instruction references, static pointer
  owners with offsets, and fragment owners separately from object references.
  Do not describe static pointers as runtime callers.
- Trust reference edges and roots only when the audit matches the measurement's
  ELF digest, report URL and analyzer version, and explicitly confirms successful
  ELF digest verification. Matching metadata alone cannot establish provenance.
  Show unverified analysis explicitly.
  Index each report once so symbol summaries and popups avoid repeated graph scans.
- Include allocated weak data objects such as vtables. Missing incoming evidence
  remains unexplained when indirect calls or linker retention are outside the
  analyzer's supported passes; display the producer's limitations and pass status.
- Reference-only refreshes use saved ELFs with matching digests and the same
  fbuild version, verifying symbol identities/sizes and memory totals unchanged.
  They do not rebuild firmware or alter measurement timestamps.
- Track producer and consumer fixes together in dashboard #18 and fbuild
  #1659/#1660/#1661; re-audit the whole platform/sketch/version matrix after
  upstream changes. `REFERENCE-AUDIT.md` records current candidates.
