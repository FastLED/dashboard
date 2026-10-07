export const bytes = (n: number) => `${n.toLocaleString("en-US")} B`;
export const localDate = (timestamp: string | undefined) => {
  const date = new Date(timestamp || "");
  if (!timestamp || Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
export const localTimestamp = (timestamp: string | undefined) =>
  timestamp && !Number.isNaN(new Date(timestamp).getTime())
    ? new Date(timestamp).toLocaleString(undefined, { timeZoneName: "short" })
    : "Date unavailable";
export function versionLabel(
  element: HTMLElement,
  row: { version: string; measured_at?: string },
) {
  element.textContent = row.version;
  if (row.version === "master") {
    const date = document.createElement("span");
    date.className = "measurement-date";
    date.textContent = localDate(row.measured_at);
    date.title = localTimestamp(row.measured_at);
    element.append(date);
  }
}
