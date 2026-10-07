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
import { dashboardSchema, type Measurement, type Success } from "./models.ts";
import { type MotionChart, type RowDataset } from "./chart-types.ts";
import { scaleTransition, animateScale } from "./chart-animation.ts";
import { element } from "./dom.ts";
import { platforms } from "./platforms.ts";
import { bytes, localDate, localTimestamp, versionLabel } from "./format.ts";
import { openBloat } from "./bloat.ts";
ChartJS.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  Tooltip,
);
const versions = Array.from({ length: 7 }, (_, i) => `3.10.${i}`).concat(
  "master",
);
const enabled = new Set(platforms.map((p) => p.id));
let results: Measurement[] = [];
let chartVersions = [...versions];
export const charts: Partial<Record<"flash" | "ram", MotionChart>> = {};
function chart(metric: "flash" | "ram") {
  charts[metric]?.destroy();
  const container = element(metric);
  container.replaceChildren();
  const canvas = document.createElement("canvas");
  canvas.id = `${metric}-canvas`;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    `${metric === "flash" ? "Flash consumption" : "RAM usage"} line chart; point reports are also available in the measurement table`,
  );
  container.append(canvas);
  const log = element<HTMLInputElement>("log").checked;
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
                    (row) => row.version === "master" && enabled.has(row.board),
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
          type: log ? "logarithmic" : "linear",
          beginAtZero: !log,
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
}
function render() {
  chart("flash");
  chart("ram");
  const tbody =
    document.querySelector<HTMLTableSectionElement>("#results tbody")!;
  tbody.replaceChildren();
  chartVersions.forEach((version) =>
    platforms
      .filter((p) => enabled.has(p.id))
      .forEach((platform) => {
        const row = results.find(
          (r) => r.board === platform.id && r.version === version,
        );
        const tr = document.createElement("tr");
        [
          version,
          platform.name,
          row?.status === "ok" ? bytes(row.flash) : "—",
          row?.status === "ok" ? bytes(row.ram) : "—",
        ].forEach((value) => {
          const td = document.createElement("td");
          td.textContent = value;
          tr.append(td);
        });
        if (version === "master")
          versionLabel(tr.firstElementChild as HTMLElement, row || { version });
        const source = document.createElement("td");
        if (row?.sha) {
          const link = document.createElement("a");
          link.href = `https://github.com/FastLED/FastLED/commit/${row.sha}`;
          link.textContent = row.sha.slice(0, 10);
          source.append(link);
        } else source.textContent = "—";
        tr.append(source);
        const status = document.createElement("td");
        status.textContent =
          row?.status === "ok"
            ? row.serial_symbols?.length
              ? "Measured · library Serial dependency"
              : "Measured"
            : row?.status === "error"
              ? "Build failed"
              : "Pending";
        if (row?.status === "error") {
          status.className = "error";
          status.title = row.error;
        }
        tr.append(status);
        const action = document.createElement("td");
        if (row?.status === "ok") {
          const button = document.createElement("button");
          button.textContent = "View";
          button.addEventListener("click", () => openBloat(row));
          action.append(button);
        } else action.textContent = "—";
        tr.append(action);
        tbody.append(tr);
      }),
  );
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
element("log").addEventListener("change", () => {
  const log = element<HTMLInputElement>("log").checked;
  for (const metric of ["flash", "ram"] as const) {
    const chart = charts[metric];
    if (chart) animateScale(chart, metric, log);
  }
});
try {
  const response = await fetch("data/latest.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = dashboardSchema.parse(await response.json());
  if (!Array.isArray(data.results)) throw new Error("Invalid benchmark data");
  results = data.results;
  if (Array.isArray(data.versions)) chartVersions = data.versions;
  const count = results.filter((r) => r.status === "ok").length;
  element("updated").textContent = data.updated_at
    ? `Updated ${new Date(data.updated_at).toLocaleString()} · ${count}/32 measurements`
    : "Awaiting first daily benchmark";
} catch (error) {
  element("updated").textContent =
    `Results unavailable: ${error instanceof Error ? error.message : String(error)}`;
}
render();
