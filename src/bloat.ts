import { referencePopover } from "./reference-popover.ts";
import {
  auditUrl,
  auditMatches,
  referenceAuditSchema,
  referenceState,
  type ReferenceAudit,
} from "./references.ts";
import { reportSchema, type Success, type BloatReport } from "./models.ts";
import { element } from "./dom.ts";
import { platforms } from "./platforms.ts";
import { bytes, localDate, localTimestamp } from "./format.ts";
const modal = element<HTMLDialogElement>("bloat-modal");
let reportRequest = 0;
let referenceView: ReturnType<typeof referencePopover> | null = null;
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
  referenceView?.dispose();
  referenceView = null;
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
    let audit: ReferenceAudit | null = null;
    let auditError = "";
    try {
      const response = await fetch(auditUrl(row.bloat_report));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const parsed = referenceAuditSchema.parse(await response.json());
      if (!auditMatches(parsed, row))
        throw new Error("Reference audit provenance mismatch");
      audit = parsed;
    } catch (error) {
      auditError = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, 200);
    }
    if (request !== reportRequest) return;
    referenceView = referencePopover(modal, report, audit);
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
    const referenceNote = document.createElement("p");
    referenceNote.className = "note";
    const unexplained = report.symbols.filter(
      (symbol) =>
        symbol.region === region &&
        symbol.size > 0 &&
        referenceState(symbol, audit).includes("retention unexplained"),
    ).length;
    referenceNote.textContent = `Hover, focus or click a symbol for direct incoming references.${audit?.disassembly === "analyzed" ? ` ${unexplained.toLocaleString()} ${region === "flash" ? "Flash" : "RAM"} rows have unexplained retention.` : ` Reference analysis unavailable: ${auditError || audit?.warnings.join("; ") || "no disassembly provenance"}`}`;
    container.append(referenceNote);
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
      let shown = 0;
      const appendRows = (count: number) => {
        const fragment = document.createDocumentFragment();
        const start = shown;
        const end = Math.min(symbols.length, start + count);
        note.textContent = symbols.length
          ? `Largest symbols first · Showing ${end.toLocaleString()} of ${symbols.length.toLocaleString()}`
          : "No attributed symbols in this region.";
        symbols.slice(start, end).forEach((symbol) => {
          const tr = document.createElement("tr");
          [
            symbol.region,
            symbol.size.toLocaleString("en-US"),
            symbol.demangled,
            symbol.object || "—",
          ].forEach((text, column) => {
            const td = document.createElement("td");
            if (column === 2 && referenceView)
              td.append(referenceView.button(symbol));
            else td.textContent = text;
            tr.append(td);
          });
          fragment.append(tr);
        });
        body.append(fragment);
        shown = end;
      };
      appendRows(10);
      table.append(body);
      if (symbols.length) section.append(table);
      if (symbols.length > shown) {
        const navigation = document.createElement("div");
        navigation.className = "bloat-pagination";
        const more = document.createElement("button");
        more.setAttribute("aria-controls", table.id);
        const update = () => {
          const remaining = symbols.length - shown;
          more.textContent = remaining
            ? `Load ${Math.min(50, remaining)} more`
            : "All symbols loaded";
          more.disabled = remaining === 0;
        };
        more.addEventListener("click", () => {
          const scrollTop = modal.scrollTop;
          appendRows(50);
          update();
          modal.scrollTop = scrollTop;
        });
        note.setAttribute("role", "status");
        note.setAttribute("aria-live", "polite");
        navigation.append(more);
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
