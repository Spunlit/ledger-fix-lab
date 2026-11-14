import './style.css';
import './workbench.css';
import './paywall.css';
import './theme.css';
import { initWorkbenchEvents } from './ui/workbench-events';
import { isCategoryId } from './core/categories';
import { applyAction, checkAll, createSession, initialState, reset, undo } from './core/engine';
import { actionFeedback } from './core/feedback';
import { cleanupReport, reportText } from './core/report';
import { skillOutcomes } from './core/skills';
import type { Action } from './core/types';
import { newDrill, nextDrill, renderDrill, tapDrill, type DrillState } from './ui/drill';
import { renderGuide } from './ui/guide';
import { renderDesk } from './ui/landing';
import { resolve } from './ui/routes';
import { loadTheme, saveTheme, themeButton } from './ui/util';
import { canOpenPractice, dailyStreak, loadCompleted, loadHistory, loadOpenedPractice, loadPlan, parseDollarsToCents, saveCompleted, saveHistory, saveOpenedPractice, savePlan } from './ui/util';
import { renderPaywall, type PaywallState } from './ui/paywall';
import { todaySeed } from './core/generator';
import { isGuided, newCaseUI, renderWorkbench, shareText, type CaseUI } from './ui/workbench';

const app = document.querySelector<HTMLDivElement>('#app')!;
let theme = loadTheme();
document.documentElement.dataset.theme = theme;
// The theme switch lives in page headers; one listener handles it everywhere.
document.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-theme-toggle]');
  if (!b) return;
  theme = theme === 'dark' ? 'light' : 'dark';
  saveTheme(theme);
  document.documentElement.dataset.theme = theme;
  b.outerHTML = themeButton(theme);
});
const cases = new Map<string, CaseUI>();
let completed = loadCompleted();
let history = loadHistory();
let currentId: string | null = null;
function current(): CaseUI | null {
  return currentId ? cases.get(currentId) ?? null : null;
}

let plan = loadPlan();
let openedPractice = loadOpenedPractice();
let paywall: PaywallState = { returnTo: null, step: 'plans', billing: 'monthly' };

/** The warm-up drill (#/drill): five one-tap rounds. A new visit starts a new set. */
let drill: DrillState | null = null;
function renderDrillPage(): void {
  currentId = null;
  drill ??= newDrill();
  document.body.dataset.page = 'drill';
  document.title = 'Warm-up drill | Ledger Fix Lab';
  app.innerHTML = renderDrill(drill);
}

function renderUpgrade(): void {
  currentId = null;
  document.body.dataset.page = 'upgrade';
  document.title = 'Practice plan | Ledger Fix Lab';
  app.innerHTML = renderPaywall(paywall, plan);
}
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The app's home (app.html#/): the practice path and skill record. The marketing page is index.html. */
function renderHome(): void {
  document.body.dataset.page = 'home';
  document.title = 'Your practice desk | Ledger Fix Lab';
  app.innerHTML = renderDesk(completed, history);
}

function route(): void {
  let resolved = null;
  try {
    resolved = resolve(location.hash);
  } catch {
    resolved = null; // an unusable seed falls back to the home page
  }
  const g = /^#\/guide(?:\/([a-z]+))?$/.exec(location.hash);
  if (g) {
    currentId = null;
    document.body.dataset.page = 'guide';
    document.title = 'Field guide | Ledger Fix Lab';
    app.innerHTML = renderGuide();
    const target = g[1] ? document.getElementById(`g-${g[1]}`) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else window.scrollTo(0, 0);
    return;
  }
  if (/^#\/drill/.test(location.hash)) {
    renderDrillPage();
    window.scrollTo(0, 0);
    return;
  }
  if (/^#\/upgrade/.test(location.hash)) {
    renderUpgrade();
    window.scrollTo(0, 0);
    return;
  }
  if (resolved && resolved.scenario.kind === 'practice') {
    const id = resolved.scenario.id;
    if (!canOpenPractice(id, openedPractice, plan)) {
      // Free practice used up: show the paywall, then come back to this exact file.
      paywall = { returnTo: location.hash, step: 'plans', billing: paywall.billing };
      renderUpgrade();
      window.scrollTo(0, 0);
      return;
    }
    if (!openedPractice.includes(id)) {
      openedPractice = [...openedPractice, id];
      saveOpenedPractice(openedPractice);
    }
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
    renderHome();
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
  document.body.dataset.page = 'case';
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
  const dr = (ev.target as HTMLElement).closest<HTMLElement>('[data-drill-row], [data-drill]');
  if (dr && drill) {
    if (dr.dataset.drillRow) drill = tapDrill(drill, dr.dataset.drillRow);
    else if (dr.dataset.drill === 'next') drill = nextDrill(drill);
    else if (dr.dataset.drill === 'again') drill = newDrill();
    renderDrillPage();
    if (dr.dataset.drill) window.scrollTo(0, 0);
    return;
  }
  const ui = current();
  if (!ui) {
    const pw = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-pw]');
    if (pw) {
      const a = pw.dataset.pw;
      if (a === 'monthly' || a === 'yearly') paywall = { ...paywall, billing: a };
      else if (a === 'checkout') paywall = { ...paywall, step: 'checkout' };
      else if (a === 'back') paywall = { ...paywall, step: 'plans' };
      else if (a === 'confirm') {
        plan = { plan: 'practice', billing: paywall.billing, since: new Date().toISOString(), demo: true };
        savePlan(plan);
      } else if (a === 'open' && paywall.returnTo) {
        // The paywall is shown at the practice file's own URL, so re-route instead of navigating.
        const target = paywall.returnTo;
        paywall = { ...paywall, returnTo: null, step: 'plans' };
        if (location.hash === target) route();
        else location.hash = target;
        return;
      } else if (a === 'cancel') {
        plan = null;
        savePlan(null);
        paywall = { returnTo: null, step: 'plans', billing: paywall.billing };
      }
      renderUpgrade();
      return;
    }
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
    case 'show-target': {
      const row = app.querySelector<HTMLElement>('tr.co-t');
      if (row) {
        row.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
        row.classList.remove('co-look');
        void row.offsetWidth; // restart the pulse
        row.classList.add('co-look');
      }
      return;
    }
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

initWorkbenchEvents(app);
window.addEventListener('hashchange', route);
route();
