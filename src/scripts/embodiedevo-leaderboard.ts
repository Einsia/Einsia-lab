const board = document.querySelector<HTMLElement>('.evo-leaderboard');
if (board) {
  const body = board.querySelector('tbody')!;
  const rows = [...body.querySelectorAll<HTMLTableRowElement>('tr')].map(element => ({
    element,
    values: JSON.parse(element.dataset.lbValues!) as { name: string; score: number; success: number }[],
  }));
  const metricButtons = [...board.querySelectorAll<HTMLButtonElement>('[data-lb-metric]')];
  const dimensionSelect = board.querySelector<HTMLSelectElement>('#lb-dimension')!;
  const typeSelect = board.querySelector<HTMLSelectElement>('#lb-type')!;
  const sortButtons = [...board.querySelectorAll<HTMLButtonElement>('[data-lb-sort]')];
  const reset = board.querySelector<HTMLButtonElement>('#lb-reset')!;
  let metric: 'score' | 'success' = 'score';
  let dimension = 0;
  let descending = true;

  function render() {
    const direction = descending ? -1 : 1;
    let visible = 0;
    [...rows].sort((a, b) => direction * (a.values[dimension][metric] - b.values[dimension][metric]) || a.element.dataset.lbRow!.localeCompare(b.element.dataset.lbRow!)).forEach(({ element }) => {
      element.hidden = typeSelect.value !== 'all' && element.dataset.lbType !== typeSelect.value;
      if (!element.hidden) visible++;
      body.append(element);
    });
    board!.dataset.metric = metric;
    metricButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lbMetric === metric)));
    dimensionSelect.value = String(dimension);
    board!.querySelectorAll<HTMLElement>('[data-lb-column]').forEach(cell => {
      const sorted = Number(cell.dataset.lbColumn) === dimension;
      cell.classList.toggle('lb-sorted', sorted);
      if (cell.tagName === 'TH') {
        if (sorted) cell.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
        else cell.removeAttribute('aria-sort');
        cell.querySelector('.lb-sort-arrow')!.textContent = sorted ? (descending ? '↓' : '↑') : '↕';
      }
    });
    board!.querySelector('#lb-count')!.textContent = `${visible} of ${rows.length} systems`;
    reset.disabled = metric === 'score' && dimension === 0 && descending && typeSelect.value === 'all';
  }

  metricButtons.forEach(button => button.addEventListener('click', () => {
    metric = button.dataset.lbMetric as typeof metric;
    descending = true;
    render();
  }));
  dimensionSelect.addEventListener('change', () => { dimension = Number(dimensionSelect.value); descending = true; render(); });
  typeSelect.addEventListener('change', render);
  sortButtons.forEach(button => {
    button.disabled = false;
    button.addEventListener('click', () => {
      const selected = Number(button.dataset.lbSort);
      descending = selected === dimension ? !descending : true;
      dimension = selected;
      render();
    });
  });
  reset.addEventListener('click', () => { metric = 'score'; dimension = 0; descending = true; typeSelect.value = 'all'; render(); });
  board.querySelector<HTMLElement>('#lb-controls')!.hidden = false;
  render();
}
