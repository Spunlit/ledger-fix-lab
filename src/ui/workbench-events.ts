/**
 * Extra event wiring for the case page. The actions themselves (data-act, data-del, data-cat, data-clear,
 * data-edit, data-record and the two forms) are handled in main.ts; this file only adds keyboard and focus
 * behaviour on top. main.ts registers its listeners first, so by the time these run the page has already
 * been re-rendered for the same event.
 */
export function initWorkbenchEvents(app: HTMLElement): void {
  // Opening "Add to the books" moves focus into the form, so the next key press picks a category.
  app.addEventListener('click', (ev) => {
    const opener = (ev.target as HTMLElement).closest<HTMLElement>('[data-record]');
    if (!opener) return;
    app.querySelector<HTMLSelectElement>('.record-form select')?.focus();
  });

  // Escape closes the "Add to the books" form (main.ts already does this for the amount form).
  app.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    app.querySelector<HTMLButtonElement>('.record-form [data-act=cancel-record]')?.click();
  });

  // The same-amount highlighter in main.ts follows the mouse; keyboard focus gets the same marks.
  let lit: Element[] = [];
  const mark = (row: HTMLElement | null) => {
    lit.forEach((el) => el.classList.remove('peer'));
    const amt = row?.dataset.amt;
    lit = amt ? [...app.querySelectorAll(`tr[data-amt="${CSS.escape(amt)}"]`)] : [];
    if (lit.length > 1) lit.forEach((el) => el.classList.add('peer'));
    else lit = [];
  };
  app.addEventListener('focusin', (ev) => mark((ev.target as HTMLElement).closest<HTMLElement>('tr[data-amt]')));
  app.addEventListener('focusout', () => mark(null));
}
