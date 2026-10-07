import {
  Chart as ChartJS,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  Tooltip,
} from "chart.js";
import {
  dashboardSchema,
  sketchSchema,
  type Measurement,
  type Success,
  type Dashboard,
  type Sketch,
} from "./models.ts";
import { type MotionChart, type RowDataset } from "./chart-types.ts";
import { scaleTransition, animateScale } from "./chart-animation.ts";
import { element } from "./dom.ts";
import { platforms } from "./platforms.ts";
import { bytes, localDate, localTimestamp } from "./format.ts";
import { openBloat } from "./bloat.ts";
import {
  autoScaleForPointer,
  type ScaleMode,
  type ActualScale,
} from "./scale-mode.ts";
ChartJS.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  Tooltip,
);
export const sectionCharts = new Map<
  Sketch,
  Partial<Record<"flash" | "ram", MotionChart>>
>();
export let charts: Partial<Record<"flash" | "ram", MotionChart>> = {};
function mountSection(root: HTMLElement, sketch: Sketch, data: Dashboard) {
  const element = <T extends HTMLElement = HTMLElement>(id: string): T => {
    const node = root.querySelector<T>(`[data-id="${id}"]`);
    if (!node) throw new Error(`Missing ${sketch} ${id}`);
    return node;
  };
  const versions = Array.from({ length: 7 }, (_, i) => `3.10.${i}`).concat(
    "master",
  );
  const enabled = new Set(platforms.map((p) => p.id));
  const results: Measurement[] = data.results.filter(
    (row) => row.sketch === sketch,
  );
  const chartVersions = data.versions.length ? data.versions : versions;
  const charts: Partial<Record<"flash" | "ram", MotionChart>> = {};
  sectionCharts.set(sketch, charts);
  const activeScales: Record<"flash" | "ram", ActualScale> = {
    flash: "linear",
    ram: "linear",
  };
  function scaleMode(metric: "flash" | "ram"): ScaleMode {
    const value = root.querySelector<HTMLInputElement>(
      `input[name="${sketch}-${metric}-scale"]:checked`,
    )?.value;
    if (value === "linear" || value === "logarithmic" || value === "auto")
      return value;
    throw new Error("Missing scale selection for " + metric);
  }
  function chart(metric: "flash" | "ram") {
    charts[metric]?.destroy();
    const container = element(metric);
    container.replaceChildren();
    const canvas = document.createElement("canvas");
    canvas.id = `${sketch}-${metric}-canvas`;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      `${metric === "flash" ? "Flash consumption" : "RAM usage"} line chart; click a point for its symbol report, or use arrow keys and Enter`,
    );
    container.append(canvas);
    const requested = scaleMode(metric);
    const mode = requested === "auto" ? activeScales[metric] : requested;
    activeScales[metric] = mode;
    const log = mode === "logarithmic";
    const datasets: RowDataset[] = platforms
      .filter((p) => enabled.has(p.id))
      .map((platform) => {
        const rows = chartVersions.map((version) =>
          results.find(
            (r): r is Success =>
              r.board === platform.id &&
              r.version === version &&
              r.status === "ok",
          ),
        );
        return {
          label: platform.name,
          borderColor: platform.color,
          backgroundColor: platform.color,
          pointRadius: 5,
          pointHoverRadius: 8,
          pointHitRadius: 12,
          borderWidth: 2.5,
          spanGaps: false,
          rows,
          data: rows.map((row) =>
            row && Number.isFinite(row[metric]) && (!log || row[metric] > 0)
              ? row[metric]
              : null,
          ),
        };
      });
    charts[metric] = new ChartJS<"line">(canvas, {
      plugins: [scaleTransition],
      type: "line",
      data: {
        labels: chartVersions.map((version) =>
          version === "master"
            ? [
                "master",
                ...new Set(
                  results
                    .filter(
                      (row) =>
                        row.version === "master" && enabled.has(row.board),
                    )
                    .map((row) => localDate(row.measured_at)),
                ),
              ]
            : version,
        ),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "nearest", intersect: true },
        onHover: (event, elements) => {
          canvas.style.cursor = elements.length ? "pointer" : "default";
        },
        onClick: (event, elements, chart) => {
          if (elements.length) {
            const p = elements[0];
            openBloat(
              (chart.data.datasets[p.datasetIndex] as RowDataset).rows[p.index],
            );
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#0c111c",
            padding: 12,
            callbacks: {
              label: (context) =>
                `${context.dataset.label}: ${bytes(context.parsed.y ?? 0)}`,
              afterLabel: (context) => {
                const row = (context.dataset as RowDataset).rows[
                  context.dataIndex
                ]!;
                return [
                  `Measured ${localTimestamp(row.measured_at)}`,
                  `SHA ${row.sha.slice(0, 10)} · click for bloat`,
                ];
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#8594aa" } },
          y: {
            afterDataLimits: (scale) => {
              if (scale.type === "logarithmic") {
                scale.min = 10 ** Math.floor(Math.log10(scale.min));
                scale.max = 10 ** Math.ceil(Math.log10(scale.max));
                if (scale.max <= scale.min) scale.max = scale.min * 10;
              }
            },
            afterBuildTicks: (scale) => {
              if (scale.type === "logarithmic") {
                const low = Math.log10(scale.min),
                  high = Math.log10(scale.max);
                scale.ticks = Array.from({ length: 7 }, (_, index) => ({
                  value: 10 ** (low + ((high - low) * index) / 6),
                }));
              }
            },
            afterFit: (scale) => {
              scale.width = 84;
            },
            type: mode,
            beginAtZero: mode === "linear",
            grid: { color: "#263143" },
            ticks: {
              autoSkip: false,
              maxTicksLimit: 8,
              color: "#8594aa",
              callback: (value) => Number(value).toLocaleString("en-US"),
            },
          },
        },
      },
    });
    updateScaleControl(metric);
    canvas.tabIndex = 0;
    let selected = 0;
    canvas.addEventListener("keydown", (event) => {
      const rows = datasets.flatMap((dataset) =>
        dataset.rows.filter((row): row is Success => !!row),
      );
      if (!rows.length) return;
      if (
        ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)
      ) {
        event.preventDefault();
        selected =
          (selected +
            (event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1) +
            rows.length) %
          rows.length;
        const row = rows[selected];
        const datasetIndex = datasets.findIndex((dataset) =>
          dataset.rows.includes(row),
        );
        const index = datasets[datasetIndex].rows.indexOf(row);
        const chart = charts[metric]!;
        chart.setActiveElements([{ datasetIndex, index }]);
        chart.draw();
        canvas.setAttribute(
          "aria-label",
          `${sketch} ${metric}: ${row.board} ${row.version}, ${bytes(row[metric])}. Enter opens symbol report. Arrow keys select points.`,
        );
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        void openBloat(rows[selected]);
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      if (scaleMode(metric) !== "auto") return;
      const chart = charts[metric];
      if (!chart) return;
      const bounds = canvas.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) * chart.width) / bounds.width;
      const y = ((event.clientY - bounds.top) * chart.height) / bounds.height;
      const area = chart.chartArea;
      if (x < area.left || x > area.right || y < area.top || y > area.bottom)
        return;
      setScale(
        metric,
        autoScaleForPointer(
          activeScales[metric],
          (y - area.top) / (area.bottom - area.top),
        ),
      );
    });
  }
  function render() {
    chart("flash");
    chart("ram");
  }

  platforms.forEach((platform) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = true;
    input.addEventListener("change", () => {
      if (input.checked) enabled.add(platform.id);
      else enabled.delete(platform.id);
      render();
    });
    const key = document.createElement("span");
    key.className = "platform-key";
    key.style.setProperty("--color", platform.color);
    label.append(input, key, document.createTextNode(platform.name));
    element("platforms").append(label);
  });
  function updateScaleControl(metric: "flash" | "ram") {
    const mode = scaleMode(metric);
    element(`${metric}-scale`).style.setProperty(
      "--selected-index",
      String(["auto", "linear", "logarithmic"].indexOf(mode)),
    );
    element(`${metric}-scale-status`).textContent =
      `${mode === "auto" ? "Auto · " : "Pinned · "}${activeScales[metric] === "linear" ? "Linear" : "Logarithmic"}`;
    element(`${metric}-scale-status`).dataset.mode = mode;
  }
  function setScale(metric: "flash" | "ram", next: ActualScale) {
    if (activeScales[metric] === next) return;
    activeScales[metric] = next;
    updateScaleControl(metric);
    const chart = charts[metric];
    if (chart) animateScale(chart, metric, next);
  }
  for (const metric of ["flash", "ram"] as const) {
    element(`${metric}-scale`).addEventListener("change", () => {
      const mode = scaleMode(metric);
      if (mode !== "auto") setScale(metric, mode);
      updateScaleControl(metric);
    });
  }
  const summary = document.createElement("p");
  summary.className = "note sketch-summary";
  const expected = chartVersions.length * platforms.length;
  const measured = results.filter((row) => row.status === "ok").length;
  const failed = results.filter((row) => row.status === "error");
  summary.textContent = `${measured}/${expected} measured · Hover for bytes; click for symbol bloat. Arrow keys and Enter work on focused charts.${failed.length ? ` ${failed.length} builds failed; gaps shown.` : measured < expected ? " Remaining points awaiting collection." : ""}`;
  if (failed.length)
    summary.title = failed
      .map((row) => `${row.board} ${row.version}: ${row.error}`)
      .join("\n");
  root.append(summary);
  render();
}
try {
  const response = await fetch("data/latest.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = dashboardSchema.parse(await response.json());
  element("updated").textContent =
    `Updated ${new Date(data.updated_at).toLocaleString()} · Recomputed daily`;
  for (const root of document.querySelectorAll<HTMLElement>("[data-sketch]")) {
    const sketch = sketchSchema.parse(root.dataset.sketch);
    mountSection(root, sketch, data);
  }
  charts = sectionCharts.get("blink") ?? {};
} catch (error) {
  element("updated").textContent =
    `Results unavailable: ${error instanceof Error ? error.message : String(error)}`;
}
