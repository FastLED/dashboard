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

## Recompute policy

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
