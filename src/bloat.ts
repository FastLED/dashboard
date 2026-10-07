import { reportSchema, type Success, type BloatReport } from "./models.ts";
import { element } from "./dom.ts";
import { platforms } from "./platforms.ts";
import { bytes, localDate, localTimestamp } from "./format.ts";
const modal = element<HTMLDialogElement>("bloat-modal");
let reportRequest = 0;
const reportCache = new Map<string, Promise<BloatReport>>();
element("close-modal").addEventListener("click", () => modal.close());
modal.addEventListener("click", (event) => {
  if (event.target === modal) modal.close();
});
export async function openBloat(row: Success | undefined) {
  if (!row) return;
  const request = ++reportRequest;
  const platform = platforms.find((p) => p.id === row.board);
  const title = element("bloat-title");
  title.textContent = `${platform?.name} · ${row.version} · fbuild bloat`;
  if (row.version === "master") {
    const date = document.createElement("span");
    date.className = "measurement-date";
    date.textContent = localDate(row.measured_at);
    title.append(date);
  }
  element("bloat-meta").textContent =
    `SHA ${row.sha.slice(0, 10)} · fbuild ${row.fbuild} · flash ${bytes(row.flash)} · static RAM ${bytes(row.ram)} · measured ${localTimestamp(row.measured_at)}`;
  const container = element("bloat-report");
  container.textContent = "Loading symbol report…";
  if (!modal.open) modal.showModal();
  try {
    if (!reportCache.has(row.bloat_report)) {
      reportCache.set(
        row.bloat_report,
        fetch(row.bloat_report)
          .then(async (response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return reportSchema.parse(await response.json());
          })
          .catch((error) => {
            reportCache.delete(row.bloat_report);
            throw error;
          }),
      );
    }
    const report = await reportCache.get(row.bloat_report)!;
    if (request !== reportRequest) return;
    container.replaceChildren();
    const summary = document.createElement("p");
    summary.textContent = `Allocated image: ${bytes(report.image_flash)} · attributed flash: ${bytes(report.total_flash)} · attributed RAM: ${bytes(report.total_ram)}. Attributed totals may overlap and differ from board totals.`;
    container.append(summary);
    const download = document.createElement("a");
    download.href = row.bloat_report;
    download.textContent = "Download full fbuild bloat JSON ↗";
    container.append(download);
    for (const [region, title] of [
      ["flash", "Flash"],
      ["ram", "RAM"],
    ] as const) {
      const symbols = report.symbols
        .filter((s) => s.size > 0 && s.region === region)
        .sort((a, b) => b.size - a.size);
      const section = document.createElement("section");
      section.className = "bloat-section";
      const heading = document.createElement("h3");
      heading.textContent = `${title} · ${symbols.length.toLocaleString("en-US")} symbols`;
      section.append(heading);
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = symbols.length
        ? "Largest symbols first. Showing the top five."
        : "No attributed symbols in this region.";
      section.append(note);
      const table = document.createElement("table");
      table.id = `bloat-${region}-symbols`;
      const caption = document.createElement("caption");
      caption.className = "sr-only";
      caption.textContent = `${title} symbols sorted by size`;
      table.append(caption);
      const head = document.createElement("thead");
      const tr = document.createElement("tr");
      ["Region", "Bytes", "Symbol", "Object"].forEach((text) => {
        const th = document.createElement("th");
        th.textContent = text;
        tr.append(th);
      });
      head.append(tr);
      table.append(head);
      const body = document.createElement("tbody");
      const renderRows = (expanded: boolean) => {
        const fragment = document.createDocumentFragment();
        (expanded ? symbols : symbols.slice(0, 5)).forEach((symbol) => {
          const tr = document.createElement("tr");
          [
            symbol.region,
            symbol.size.toLocaleString("en-US"),
            symbol.demangled,
            symbol.object || "—",
          ].forEach((text) => {
            const td = document.createElement("td");
            td.textContent = text;
            tr.append(td);
          });
          fragment.append(tr);
        });
        body.replaceChildren(fragment);
      };
      renderRows(false);
      table.append(body);
      if (symbols.length) section.append(table);
      if (symbols.length > 5) {
        const more = document.createElement("button");
        more.className = "bloat-more";
        more.textContent = `More (${(symbols.length - 5).toLocaleString("en-US")} remaining)`;
        more.setAttribute("aria-expanded", "false");
        more.setAttribute("aria-controls", table.id);
        more.addEventListener("click", () => {
          const expanded = more.getAttribute("aria-expanded") !== "true";
          renderRows(expanded);
          more.setAttribute("aria-expanded", String(expanded));
          more.textContent = expanded
            ? "Show top five"
            : `More (${(symbols.length - 5).toLocaleString("en-US")} remaining)`;
          note.textContent = expanded
            ? "Largest symbols first. Showing all symbols."
            : "Largest symbols first. Showing the top five.";
        });
        section.append(more);
      }
      container.append(section);
    }
  } catch (error) {
    if (request === reportRequest)
      container.textContent = `Report unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}
