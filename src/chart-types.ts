import type { Chart as ChartJS, ChartDataset, PointElement } from "chart.js";
import type { Success } from "./models.ts";
export type Tick = { value: number; y: number; opacity: number };
export type RowDataset = ChartDataset<"line"> & {
  rows: (Success | undefined)[];
};
export type MotionChart = ChartJS<"line"> & {
  $scaleTransition?: {
    ticks: Tick[];
    positionForValue?: (value: number) => number;
  } | null;
  $scaleFrame?: number;
};
export const points = (chart: MotionChart, index: number) =>
  chart.getDatasetMeta(index).data as PointElement[];
