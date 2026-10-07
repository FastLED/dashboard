# Benchmark policy and decisions

## Site and interaction

- Publish the dashboard with **GitHub Pages** at https://fastled.github.io/dashboard/.
- Use **Chart.js** for two overview line graphs: flash on the left, static RAM
  on the right. Plot one line per platform: Uno AVR, ESP32-S3, ESP32 Dev,
  Teensy4.1. The only sketch is Blink.
- Every plot point supports mouse hover with exact bytes/platform/version.
  Clicking a point opens an accessible popup with the full **fbuild bloat**
  symbol report for that exact platform, FastLED revision and measurement run.
  Equivalent report buttons in the data table support keyboard users.
- Split each popup into Flash and RAM sections, independently sorted by symbol
  size. Show the top five in each section, with a separate More button to reveal
  all remaining symbols and an option to collapse back to the top five.
- Show a prominent live-site link in the README. Embed a real overview
  screenshot as a noninteractive PNG, linked to the interactive Pages site.
  Regenerate that screenshot whenever the daily data is published.
- Every master label must include a secondary measurement-date label converted
  to the viewer's local time zone and locale, including chart axes, table version
  cells and report headings. Store timestamps in UTC and convert on display.
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
- At the benchmark's JSON input boundary, eagerly convert validated payloads
  into typed Python dataclasses, including nested measurements, provenance and
  symbol rows. Benchmark logic operates on dataclass attributes and typed
  collections, never dictionaries or loosely typed JSON objects. Dictionaries
  may exist only transiently within schema validation and serialization code.
- Serialize dataclasses back to the schema-defined transport at output
  boundaries. Keep model types, schema versions and table columns consistent;
  schema changes require explicit versioning and migration handling.

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
- Run benchmarks sequentially without git worktrees. Initial validation is
  local; the dedicated daily dashboard workflow is authorized automation and
  does not invoke FastLED CI Full.
