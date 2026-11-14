import './style.css';
import { isCategoryId } from './core/categories';
import { applyAction, checkAll, createSession, reset, undo } from './core/engine';
import { cleanupReport, reportText } from './core/report';
import { caseById } from './core/scenarios';
import type { Action } from './core/types';
import { renderLanding } from './ui/landing';
import { loadCompleted, parseDollarsToCents, saveCompleted } from './ui/util';
import { newCaseUI, renderWorkbench, type CaseUI } from './ui/workbench';

const app = document.querySelector<HTMLDivElement>('#app')!;
const cases = new Map<string, CaseUI>();
let completed = loadCompleted();
let currentId: string | null = null;

function current(): CaseUI | null {
  return currentId ? cases.get(currentId) ?? null : null;
}

function route(): void {
  const m = /^#\/case\/([\w-]+)/.exec(location.hash);
  const scenario = m ? caseById(m[1]) : undefined;
  if (scenario) {
    if (!cases.has(scenario.id)) cases.set(scenario.id, newCaseUI(createSession(scenario)));
    const changed = currentId !== scenario.id;
    currentId = scenario.id;
    document.title = `Case ${scenario.number}: ${scenario.title} · Ledger Fix Lab`;
    render();
    if (changed) window.scrollTo(0, 0);
  } else {
    currentId = null;
    document.title = 'Ledger Fix Lab: practice bookkeeping cleanups';
    app.innerHTML = renderLanding(completed);
    // In-page anchors (#cases) are handled by the browser; only reset scroll for the home route.
    if (location.hash === '' || location.hash === '#/') window.scrollTo(0, 0);
  }
}

/** Remember a case as completed whenever a checked case is fully correct (also when fixed after a check). */
function persistIfSolved(ui: CaseUI): void {
  const s = ui.session.scenario;
  if (ui.checked && !completed[s.id] && checkAll(s, ui.session.state).ok) {
    completed = { ...completed, [s.id]: { at: new Date().toISOString(), checksRun: ui.checksRun } };
    saveCompleted(completed);
  }
}

function render(): void {
  const ui = current();
  if (!ui) return;
  persistIfSolved(ui);
  app.innerHTML = renderWorkbench(ui);
  const input = app.querySelector<HTMLInputElement>('.amt-form input');
  if (input) {
    input.focus();
    input.select();
  }
}

function dispatch(action: Action): void {
  const ui = current()!;
  ui.session = applyAction(ui.session, action);
  ui.editing = null;
  ui.editError = null;
  ui.recording = null;
  render();
}

app.addEventListener('click', (ev) => {
  const ui = current();
  if (!ui) return;
  const t = (ev.target as HTMLElement).closest<HTMLElement>('button, [data-act]');
  if (!t || (t as HTMLButtonElement).disabled) return;
  const d = t.dataset;
  if (d.del) return dispatch({ type: 'delete', entryId: d.del });
  if (d.edit) {
    ui.editing = d.edit;
    ui.editError = null;
    return render();
  }
  if (d.record) {
    ui.recording = ui.recording === d.record ? null : d.record;
    return render();
  }
  switch (d.act) {
    case 'undo':
      ui.session = undo(ui.session);
      ui.editing = ui.recording = null;
      return render();
    case 'reset':
      cases.set(currentId!, { ...newCaseUI(reset(ui.session)), noteOpen: ui.noteOpen });
      return render();
    case 'toggle-note':
      ui.noteOpen = !ui.noteOpen;
      return render();
    case 'toggle-matches':
      ui.showMatches = !ui.showMatches;
      return render();
    case 'cancel-edit':
      ui.editing = null;
      ui.editError = null;
      return render();
    case 'cancel-record':
      ui.recording = null;
      return render();
    case 'check': {
      ui.checked = true;
      ui.checksRun += 1;
      render();
      app.querySelector('.review, .solved')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    case 'copy-report': {
      const s = ui.session.scenario;
      const text = reportText(s, cleanupReport(s, ui.session.state));
      navigator.clipboard?.writeText(text).then(
        () => (t.textContent = 'Copied'),
        () => (t.textContent = 'Copy failed: select the text instead'),
      );
      return;
    }
  }
});

app.addEventListener('change', (ev) => {
  const ui = current();
  if (!ui) return;
  const t = ev.target as HTMLInputElement | HTMLSelectElement;
  if (t instanceof HTMLSelectElement && t.dataset.cat && isCategoryId(t.value)) {
    return dispatch({ type: 'recategorize', entryId: t.dataset.cat, category: t.value });
  }
  if (t instanceof HTMLInputElement && t.dataset.clear) {
    return dispatch({ type: 'setCleared', entryId: t.dataset.clear, cleared: t.checked });
  }
});

app.addEventListener('submit', (ev) => {
  const ui = current();
  if (!ui) return;
  ev.preventDefault();
  const form = ev.target as HTMLFormElement;
  if (form.dataset.amtForm) {
    const raw = (form.elements.namedItem('amt') as HTMLInputElement).value;
    const cents = parseDollarsToCents(raw);
    if (cents === null) {
      ui.editError = 'Enter an amount like 84.37';
      return render();
    }
    return dispatch({ type: 'setAmount', entryId: form.dataset.amtForm, magnitudeCents: cents });
  }
  if (form.dataset.recordForm) {
    const cat = (form.elements.namedItem('cat') as HTMLSelectElement).value;
    if (!isCategoryId(cat)) return;
    return dispatch({ type: 'record', txnId: form.dataset.recordForm, category: cat });
  }
});

app.addEventListener('keydown', (ev) => {
  const ui = current();
  if (ui?.editing && ev.key === 'Escape') {
    ui.editing = null;
    ui.editError = null;
    render();
  }
});

// Highlighter: hovering an amount marks every row and bank line with the same amount.
let lit: Element[] = [];
app.addEventListener('mouseover', (ev) => {
  const row = (ev.target as HTMLElement).closest<HTMLElement>('tr[data-amt]');
  const amt = row?.dataset.amt;
  lit.forEach((el) => el.classList.remove('peer'));
  lit = amt ? [...app.querySelectorAll(`tr[data-amt="${CSS.escape(amt)}"]`)] : [];
  if (lit.length > 1) lit.forEach((el) => el.classList.add('peer'));
});

window.addEventListener('hashchange', route);
route();
