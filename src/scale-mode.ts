export type ScaleMode = "auto" | "linear" | "logarithmic";
export type ActualScale = Exclude<ScaleMode, "auto">;
/** Pointer position is measured downwards within the plotting area. */
export function autoScaleForPointer(
  current: ActualScale,
  position: number,
): ActualScale {
  if (!Number.isFinite(position) || position < 0 || position > 1)
    return current;
  if (current === "linear" && position >= 0.93) return "logarithmic";
  if (current === "logarithmic" && position <= 0.07) return "linear";
  return current;
}
