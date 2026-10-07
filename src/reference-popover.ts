import type { BloatReport } from "./models.ts";
import {
  referenceState,
  symbolIndex,
  type ReferenceAudit,
  type ReportSymbol,
} from "./references.ts";
export function referencePopover(
  modal: HTMLDialogElement,
  report: BloatReport,
  audit: ReferenceAudit | null,
) {
  const index = symbolIndex(report);
  const popup = document.createElement("div");
  popup.id = "symbol-reference-popup";
  popup.className = "reference-popup";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Direct references to symbol");
  popup.hidden = true;
  modal.append(popup);
  let active: HTMLButtonElement | null = null;
  let suppressFocus = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const hide = () => {
    cancel();
    popup.hidden = true;
    active?.setAttribute("aria-expanded", "false");
    active = null;
  };
  const schedule = () => {
    cancel();
    timer = setTimeout(() => {
      if (
        !popup.matches(":hover") &&
        !popup.contains(document.activeElement) &&
        document.activeElement !== active
      )
        hide();
    }, 180);
  };
  popup.addEventListener("pointerenter", cancel);
  popup.addEventListener("pointerleave", schedule);
  popup.addEventListener("focusout", schedule);
  const onCancel = (event: Event) => {
    if (!popup.hidden) {
      event.preventDefault();
      const button = active;
      hide();
      suppressFocus = true;
      button?.focus();
      suppressFocus = false;
    }
  };
  modal.addEventListener("cancel", onCancel);
  modal.addEventListener("close", hide);
  modal.addEventListener("scroll", hide);
  const show = (button: HTMLButtonElement, symbol: ReportSymbol) => {
    cancel();
    if (active === button && !popup.hidden) return;
    active?.setAttribute("aria-expanded", "false");
    active = button;
    button.setAttribute("aria-expanded", "true");
    popup.replaceChildren();
    const close = document.createElement("button");
    close.className = "reference-close";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close symbol references");
    close.addEventListener("click", () => {
      hide();
      suppressFocus = true;
      button.focus();
      suppressFocus = false;
    });
    const heading = document.createElement("h4");
    heading.textContent = symbol.demangled;
    const state = document.createElement("p");
    state.className = "reference-state";
    state.textContent = referenceState(symbol, audit);
    popup.append(close, heading, state);
    const group = (title: string, names: string[], empty: string) => {
      const heading = document.createElement("h5");
      heading.textContent = `${title} · ${names.length}`;
      popup.append(heading);
      if (!names.length) {
        const note = document.createElement("p");
        note.textContent = empty;
        popup.append(note);
        return;
      }
      const list = document.createElement("ul");
      popup.append(list);
      let shown = 0;
      const more = document.createElement("button");
      more.className = "reference-more";
      const append = () => {
        for (const name of names.slice(shown, shown + 50)) {
          const item = document.createElement("li");
          item.textContent = name;
          list.append(item);
        }
        shown = Math.min(shown + 50, names.length);
        more.textContent = `Show ${Math.min(50, names.length - shown)} more references`;
        more.hidden = shown === names.length;
      };
      more.addEventListener("click", append);
      append();
      popup.append(more);
    };
    group(
      "Incoming symbols",
      [...new Set(symbol.called_by)].map((name) => {
        const matches = index.get(name);
        if (!matches?.length) return `${name} (not resolved in this report)`;
        return matches
          .map(
            (s) =>
              `${s.demangled} · ${s.size.toLocaleString()} B · ${s.region} · ${s.source} @ 0x${s.address.toString(16)}`,
          )
          .join(" / ");
      }),
      "No symbol-level incoming references recorded.",
    );
    group(
      "Referencing object files",
      [
        ...new Set(
          symbol.referenced_by.map(
            (ref) =>
              `${ref.archive ? ref.archive + " / " : ""}${ref.object ?? "Unknown object"}`,
          ),
        ),
      ],
      "No object-file references recorded.",
    );
    const caveat = document.createElement("p");
    caveat.className = "reference-caveat";
    caveat.textContent =
      "Level 1 only. Indirect calls, KEEP sections and other linker roots may be missing. An empty list does not prove the symbol is unused.";
    popup.append(caveat);
    popup.hidden = false;
    const box = button.getBoundingClientRect();
    const width = Math.min(520, window.innerWidth - 32);
    popup.style.width = `${width}px`;
    popup.style.left = `${Math.max(16, Math.min(box.left, window.innerWidth - width - 16))}px`;
    const height = popup.getBoundingClientRect().height;
    popup.style.top = `${Math.max(16, Math.min(box.bottom + 6, window.innerHeight - height - 16))}px`;
  };
  return {
    dispose: () => {
      hide();
      popup.remove();
      modal.removeEventListener("cancel", onCancel);
      modal.removeEventListener("close", hide);
      modal.removeEventListener("scroll", hide);
    },
    button: (symbol: ReportSymbol) => {
      const button = document.createElement("button");
      button.className = "symbol-reference";
      button.textContent = symbol.demangled;
      button.dataset.referenceState = referenceState(symbol, audit);
      button.setAttribute("aria-label", `Who references ${symbol.demangled}?`);
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", popup.id);
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("pointerenter", () => show(button, symbol));
      button.addEventListener("pointerleave", schedule);
      button.addEventListener("focus", () => {
        if (!suppressFocus) show(button, symbol);
      });
      button.addEventListener("blur", schedule);
      button.addEventListener("click", () => show(button, symbol));
      return button;
    },
  };
}
