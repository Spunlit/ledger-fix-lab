import './style.css';
import { isCategoryId } from './core/categories';
import { applyAction, checkAll, createSession, initialState, reset, undo } from './core/engine';
import { actionFeedback } from './core/feedback';
import { formatCents } from './core/money';
import { heroVerdict, type HeroState } from './ui/hero';
import { cleanupReport, reportText } from './core/report';
import { skillOutcomes } from './core/skills';
import type { Action } from './core/types';
import { renderLanding } from './ui/landing';
import { resolve } from './ui/routes';
import { dailyStreak, loadCompleted, loadHistory, parseDollarsToCents, saveCompleted, saveHistory } from './ui/util';
import { todaySeed } from './core/generator';
import { isGuided, newCaseUI, renderWorkbench, shareText, type CaseUI } from './ui/workbench';

const app = document.querySelector<HTMLDivElement>('#app')!;
const cases = new Map<string, CaseUI>();
let completed = loadCompleted();
let history = loadHistory();
let currentId: string | null = null;
function current(): CaseUI | null {
  return currentId ? cases.get(currentId) ?? null : null;
}

/** Home-page 30-second case: lines the visitor has tried, and whether the lie was caught. */
let hero: HeroState = { tried: [], caught: false };
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function renderHome(animate = false): void {
  app.innerHTML = renderLanding(completed, history, hero);
  const el = app.querySelector<HTMLElement>('[data-testid=hero-profit]');
  const box = app.querySelector<HTMLElement>('.case');
  if (!animate || !el || !box || !el.dataset.from || reducedMotion()) return;
  // Roll the profit down to the corrected figure, then reveal the verdict.
  const from = Number(el.dataset.from);
  const to = Number(el.dataset.to);
  box.classList.add('counting');
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / 900);
    el.textContent = formatCents(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
    else box.classList.remove('counting');
  };
  requestAnimationFrame(step);
}

function route(): void {
  let resolved = null;
  try {
    resolved = resolve(location.hash);
  } catch {
    resolved = null; // an unusable seed falls back to the home page
  }
  if (resolved) {
    const { scenario, day } = resolved;
    if (!cases.has(scenario.id)) cases.set(scenario.id, newCaseUI(createSession(scenario), day));
    const changed = currentId !== scenario.id;
    currentId = scenario.id;
    document.title = `${scenario.kind === 'case' ? `${scenario.badge}: ${scenario.title}` : `${scenario.badge}: ${scenario.business}`} | Ledger Fix Lab`;
    render();
    if (changed) window.scrollTo(0, 0);
  } else {
    currentId = null;
    document.title = 'Ledger Fix Lab: practice bookkeeping cleanups';
    renderHome();
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
  const before = ui.session.state;
  ui.session = applyAction(ui.session, action);
  const s = ui.session.scenario;
  // Guided cases answer every move immediately; unguided files stay silent until Check.
  ui.feedback = isGuided(s) ? actionFeedback(s, initialState(s), before, ui.session.state) : null;
  ui.editing = null;
  ui.editError = null;
  ui.recording = null;
  render();
}

app.addEventListener('click', (ev) => {
  const ui = current();
  if (!ui) {
    const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-hero-pick]');
    if (!b || b.disabled) return;
    const id = b.dataset.heroPick!;
    const v = heroVerdict(id);
    hero = v.caught ? { ...hero, caught: true } : { ...hero, tried: [...hero.tried, id] };
    renderHome(v.caught);
    return;
  }
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
      ui.feedback = null;
      return render();
    case 'reset':
      cases.set(currentId!, { ...newCaseUI(reset(ui.session), ui.day), noteOpen: ui.noteOpen, firstCheck: ui.firstCheck });
      return render();
    case 'toggle-note':
      ui.noteOpen = !ui.noteOpen;
      return render();
    case 'toggle-math':
      ui.mathOpen = !ui.mathOpen;
      return render();
    case 'toggle-hint':
      ui.hintOpen = !ui.hintOpen;
      return render();
    case 'toggle-guide':
      ui.guideOpen = !ui.guideOpen;
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
      const s = ui.session.scenario;
      ui.feedback = null;
      if (!ui.firstCheck && !isGuided(s)) {
        // The skill record keeps the first check on unguided files only: guided feedback would inflate it.
        ui.firstCheck = skillOutcomes(s, checkAll(s, ui.session.state), { worked: ui.session.history.length > 0 });
        if (!history.some((h) => h.fileId === s.id)) {
          history = [...history, { fileId: s.id, at: new Date().toISOString(), firstCheck: ui.firstCheck }];
          saveHistory(history);
        }
      }
      render();
      app.querySelector('.review, .solved')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    case 'copy-result': {
      navigator.clipboard?.writeText(shareText(ui, location.href, dailyStreak(completed, todaySeed()))).then(
        () => (t.textContent = 'Copied'),
        () => (t.textContent = 'Copy failed'),
      );
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
