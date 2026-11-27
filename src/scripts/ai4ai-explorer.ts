const root = document.querySelector<HTMLElement>("[data-ai4ai-explorer]");

if (root) {
  const controls = Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-filter]"));
  const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-case-card]"));
  const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-case-row]"));
  const count = root.querySelector<HTMLElement>("[data-result-count]");
  const cardsView = root.querySelector<HTMLElement>("[data-view-panel='cards']");
  const matrixView = root.querySelector<HTMLElement>("[data-view-panel='matrix']");
  const viewButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-view]"));
  const reset = root.querySelector<HTMLButtonElement>("[data-reset]");
  const empty = root.querySelector<HTMLElement>("[data-empty]");

  const auditMatch = (element: HTMLElement, requested: string) => {
    if (!requested) return true;
    const values = (element.dataset.audit || "").split(" ");
    return values.includes(requested);
  };

  const matches = (element: HTMLElement, values: Record<string, string>) => {
    if (values.q && !(element.dataset.search || "").includes(values.q.toLowerCase())) return false;
    for (const key of ["task", "model", "effort", "harness", "state"]) {
      if (values[key] && element.dataset[key] !== values[key]) return false;
    }
    return auditMatch(element, values.audit);
  };

  const update = (historyMode: 'push' | 'replace' | null = 'push') => {
    const values = Object.fromEntries(controls.map((control) => [control.dataset.filter || "", control.value.trim()]));
    let visible = 0;
    for (const card of cards) {
      const show = matches(card, values);
      card.hidden = !show;
      if (show) visible += 1;
    }
    for (const row of rows) row.hidden = !matches(row, values);
    if (count) count.textContent = `${visible} of ${cards.length} configurations`;
    if (empty) empty.hidden = visible !== 0;

    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value) next.set(key, value);
    const view = root.dataset.activeView || "cards";
    if (view !== "cards") next.set("view", view);
    const url = `${window.location.pathname}${next.size ? `?${next}` : ""}${window.location.hash}`;
    if (historyMode && url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history[historyMode === 'push' ? 'pushState' : 'replaceState']({}, "", url);
    }
  };

  const setView = (view: string, historyMode: 'push' | 'replace' | null = 'push') => {
    root.dataset.activeView = view;
    if (cardsView) cardsView.hidden = view !== "cards";
    if (matrixView) matrixView.hidden = view !== "matrix";
    for (const button of viewButtons) {
      const active = button.dataset.view === view;
      button.setAttribute("aria-pressed", String(active));
      button.classList.toggle("bg-ink", active);
      button.classList.toggle("text-white", active);
      button.classList.toggle("bg-paper-white", !active);
    }
    update(historyMode);
  };

  for (const control of controls) {
    control.addEventListener(control instanceof HTMLInputElement ? "input" : "change", () => update(control instanceof HTMLInputElement ? 'replace' : 'push'));
  }
  for (const button of viewButtons) button.addEventListener("click", () => setView(button.dataset.view || "cards"));
  reset?.addEventListener("click", () => {
    for (const control of controls) control.value = "";
    setView("cards");
  });

  const restore = () => {
    const params = new URLSearchParams(window.location.search);
    for (const control of controls) control.value = params.get(control.dataset.filter || '') || '';
    setView(params.get("view") === "matrix" ? "matrix" : "cards", null);
  };
  window.addEventListener('popstate', restore);
  restore();
}
