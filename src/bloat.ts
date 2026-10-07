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
export async function openBloat(
  row: Success | undefined,
  region: "flash" | "ram",
) {
  if (!row) return;
  const request = ++reportRequest;
  const platform = platforms.find((p) => p.id === row.board);
  const title = element("bloat-title");
  const sketchName = { blink: "Blink", spi: "APA102", rainbow: "Rainbow" }[
    row.sketch
  ];
  title.textContent = `${sketchName} · ${platform?.name} · ${row.version} · ${region === "flash" ? "Flash" : "RAM"} bloat`;
  if (row.version === "master") {
    const date = document.createElement("span");
    date.className = "measurement-date";
    date.textContent = localDate(row.measured_at);
    title.append(date);
  }
  element("bloat-meta").textContent =
    `SHA ${row.sha.slice(0, 10)} · fbuild ${row.fbuild} · ${region === "flash" ? "flash" : "static RAM"} ${bytes(row[region])} · measured ${localTimestamp(row.measured_at)}`;
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
    summary.textContent =
      region === "flash"
        ? `Allocated image: ${bytes(report.image_flash)} · attributed flash: ${bytes(report.total_flash)}. Attributed totals may overlap and differ from board totals.`
        : `Attributed RAM: ${bytes(report.total_ram)}. Static RAM excludes runtime heap and stack; attributed totals may differ from board totals.`;
    container.append(summary);
    const download = document.createElement("a");
    download.href = row.bloat_report;
    download.textContent = "Download full fbuild bloat JSON ↗";
    container.append(download);
    {
      const title = region === "flash" ? "Flash" : "RAM";
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
        ? "Largest symbols first. Showing the top 10."
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
      let page = 0;
      const pageCount =
        symbols.length <= 10 ? 1 : 1 + Math.ceil((symbols.length - 10) / 50);
      const renderRows = () => {
        const fragment = document.createDocumentFragment();
        const start = page === 0 ? 0 : 10 + (page - 1) * 50;
        const end = Math.min(symbols.length, start + (page === 0 ? 10 : 50));
        note.textContent = symbols.length
          ? `Largest symbols first · ${start + 1}–${end} of ${symbols.length.toLocaleString()} · Page ${page + 1} of ${pageCount}`
          : "No attributed symbols in this region.";
        symbols.slice(start, end).forEach((symbol) => {
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
      renderRows();
      table.append(body);
      if (symbols.length) section.append(table);
      if (pageCount > 1) {
        const navigation = document.createElement("nav");
        navigation.className = "bloat-pagination";
        navigation.setAttribute("aria-label", `${title} symbol pages`);
        const previous = document.createElement("button");
        const next = document.createElement("button");
        previous.textContent = "Previous";
        next.textContent = "Next 50";
        for (const button of [previous, next])
          button.setAttribute("aria-controls", table.id);
        const update = () => {
          renderRows();
          previous.disabled = page === 0;
          next.disabled = page === pageCount - 1;
          next.textContent =
            page === pageCount - 1
              ? "Next"
              : `Next ${Math.min(50, symbols.length - (page === 0 ? 10 : 10 + page * 50))}`;
        };
        previous.addEventListener("click", () => {
          page--;
          update();
        });
        next.addEventListener("click", () => {
          page++;
          update();
        });
        note.setAttribute("role", "status");
        note.setAttribute("aria-live", "polite");
        navigation.append(previous, next);
        section.append(navigation);
        update();
      }
      container.append(section);
    }
  } catch (error) {
    if (request === reportRequest)
      container.textContent = `Report unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}
