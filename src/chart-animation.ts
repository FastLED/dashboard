import type { Plugin, PointElement, Scale } from "chart.js";
import {
  points,
  type MotionChart,
  type Tick,
  type RowDataset,
} from "./chart-types.ts";
const axisTicks = (chart: MotionChart): Tick[] =>
  chart.scales.y.ticks
    .filter((tick) => tick.label != null)
    .map((tick) => ({
      value: tick.value,
      y: chart.scales.y.getPixelForValue(tick.value),
      opacity: 1,
    }));
export const scaleTransition: Plugin<"line"> = {
  id: "scaleTransition",
  afterUpdate(baseChart) {
    const chart = baseChart as MotionChart;
    const scale = chart.scales.y as Scale & {
      $transitionDraw?: boolean;
      drawGrid: () => void;
      drawLabels: () => void;
      drawBorder: () => void;
      drawTitle: () => void;
    };
    if (scale.$transitionDraw) return;
    for (const method of [
      "drawGrid",
      "drawLabels",
      "drawBorder",
      "drawTitle",
    ] as const) {
      scale[method] = () => {};
    }
    scale.$transitionDraw = true;
  },
  beforeDatasetsDraw(baseChart) {
    const chart = baseChart as MotionChart;
    // Use the same renderer at rest and during motion: no final-frame font,
    // alignment or grid-style switch when an animation finishes.
    const ticks = chart.$scaleTransition?.ticks || axisTicks(chart);
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const tick of ticks) {
      if (tick.opacity <= 0) continue;
      ctx.globalAlpha = tick.opacity;
      ctx.strokeStyle = "#263143";
      ctx.beginPath();
      ctx.moveTo(chartArea.left, tick.y);
      ctx.lineTo(chartArea.right, tick.y);
      ctx.stroke();
      ctx.fillStyle = "#8594aa";
      ctx.fillText(
        Math.round(tick.value).toLocaleString("en-US"),
        chartArea.left - 10,
        tick.y,
      );
    }
    ctx.restore();
  },
  resize(baseChart) {
    const chart = baseChart as MotionChart;
    cancelAnimationFrame(chart.$scaleFrame ?? 0);
    chart.$scaleTransition = null;
  },
  beforeDestroy(baseChart) {
    const chart = baseChart as MotionChart;
    cancelAnimationFrame(chart.$scaleFrame ?? 0);
  },
};

export function animateScale(
  chart: MotionChart,
  metric: "flash" | "ram",
  log: boolean,
) {
  cancelAnimationFrame(chart.$scaleFrame ?? 0);
  const fromTicks = chart.$scaleTransition?.ticks || axisTicks(chart);
  const oldScale = chart.scales.y;
  const fromPosition: (value: number) => number =
    chart.$scaleTransition?.positionForValue ||
    ((value: number) => oldScale.getPixelForValue(value));
  const fromPoints = chart.data.datasets.map((dataset, index) =>
    points(chart, index).map((point) => ({ x: point.x, y: point.y })),
  );
  chart.$scaleTransition = { ticks: fromTicks };
  chart.options.animation = false;
  chart.options.scales!.y!.type = log ? "logarithmic" : "linear";
  (chart.options.scales!.y! as { beginAtZero?: boolean }).beginAtZero = !log;
  for (const dataset of chart.data.datasets) {
    dataset.data = (dataset as RowDataset).rows.map((row) =>
      row && Number.isFinite(row[metric]) && (!log || row[metric] > 0)
        ? row[metric]
        : null,
    );
  }
  // update('none') normally renders the destination immediately. Compute its
  // layout without painting, then publish the complete zero-progress frame.
  // This prevents a destination-frame flash before entering ticks are hidden.
  const render = chart.render;
  chart.render = () => {};
  try {
    chart.update("none");
  } finally {
    chart.render = render;
  }
  const toTicks = axisTicks(chart);
  const newScale = chart.scales.y;
  const toPosition = (value: number) => newScale.getPixelForValue(value);
  const toPoints = chart.data.datasets.map((dataset, index) =>
    chart
      .getDatasetMeta(index)
      .data.map((point) => ({ x: point.x, y: point.y })),
  );
  // Match by numeric value: ticks move with their unchanged labels. New
  // ticks enter at their old-scale positions; obsolete ticks move and exit.
  const sourceTicks = new Map(fromTicks.map((tick) => [tick.value, tick]));
  const targetTicks = new Map(toTicks.map((tick) => [tick.value, tick]));
  const tickValues = [
    ...new Set([...sourceTicks.keys(), ...targetTicks.keys()]),
  ];
  const clampPosition = (pixel: number) =>
    Number.isFinite(pixel)
      ? Math.max(chart.chartArea.top, Math.min(chart.chartArea.bottom, pixel))
      : chart.chartArea.bottom;
  const tickMotion = tickValues.map((value) => ({
    value,
    fromY: sourceTicks.get(value)?.y ?? clampPosition(fromPosition(value)),
    toY: targetTicks.get(value)?.y ?? clampPosition(toPosition(value)),
    fromOpacity:
      sourceTicks.get(value)?.opacity ?? (sourceTicks.has(value) ? 1 : 0),
    toOpacity: targetTicks.has(value) ? 1 : 0,
  }));
  const started = performance.now();
  const interpolate = (a: number, b: number, progress: number) =>
    a + (b - a) * progress;
  const animate = (now: number) => {
    const elapsed = Math.min(1, (now - started) / 1000);
    const progress =
      elapsed < 0.5 ? 4 * elapsed ** 3 : 1 - (-2 * elapsed + 2) ** 3 / 2;
    chart.$scaleTransition!.positionForValue = (value: number) =>
      interpolate(
        clampPosition(fromPosition(value)),
        clampPosition(toPosition(value)),
        progress,
      );
    chart.$scaleTransition!.ticks = tickMotion.map((tick) => ({
      value: tick.value,
      y: interpolate(tick.fromY, tick.toY, progress),
      opacity: interpolate(tick.fromOpacity, tick.toOpacity, progress),
    }));
    chart.data.datasets.forEach((dataset, index) => {
      const meta = chart.getDatasetMeta(index);
      (meta.dataset as unknown as { _path?: Path2D })._path = undefined;
      (meta.data as PointElement[]).forEach((point, pointIndex) => {
        const from = fromPoints[index][pointIndex],
          to = toPoints[index][pointIndex];
        point.x = interpolate(from.x, to.x, progress);
        point.y = interpolate(from.y, to.y, progress);
      });
    });
    if (elapsed === 1) chart.$scaleTransition = null;
    chart.draw();
    if (elapsed < 1) chart.$scaleFrame = requestAnimationFrame(animate);
  };
  animate(started);
}
