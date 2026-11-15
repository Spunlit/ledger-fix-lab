import './style.css';
import './workbench.css';
import './paywall.css';
import './theme.css';
import { initWorkbenchEvents } from './ui/workbench-events';
import { isCategoryId } from './core/categories';
import { applyAction, checkAll, createSession, initialState, reset, undo } from './core/engine';
import { coachAction, coachStep } from './core/coach';
import { actionFeedback } from './core/feedback';
import { cleanupReport, reportText } from './core/report';
import { skillOutcomes } from './core/skills';
import type { Action } from './core/types';
import { newBasics, nextBasics, renderBasics, tapBasics, type BasicsState } from './ui/basics';
import { newDrill, nextDrill, renderDrill, tapDrill, type DrillState } from './ui/drill';
import { GUIDE, type GuideId } from './core/guide';
import { renderGuide } from './ui/guide';
import { loadProfile, renderAccount, signIn, signOut, type AccountState } from './ui/account';
import { SAMPLE_BANK, SAMPLE_BOOKS } from './core/checker';
import { findingsText, newCheck, rememberCheck, renderCheck, type CheckState } from './ui/check';
import { renderDesk } from './ui/landing';
import { renderTerms } from './ui/legal';
import { renderRecord, saveRecordName } from './ui/record';
import { resolve } from './ui/routes';
import { initTerms } from './ui/terms';
import { startTour, tourSeen, type TourStep } from './ui/tour';
import { loadTheme, saveTheme, themeButton } from './ui/util';
import { FREE_TOPIC_DRILLS, saveDrillRun } from './ui/util';
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
initTerms('#/guide/words');
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

/** Start from zero (#/basics): five ideas, one tap each. */
let basics: BasicsState | null = null;
function renderBasicsPage(): void {
  currentId = null;
  basics ??= newBasics();
  document.body.dataset.page = 'drill';
  document.title = 'Start from zero | Ledger Fix Lab';
  app.innerHTML = renderBasics(basics);
}

/** The warm-up drill (#/drill): five one-tap rounds. A new visit starts a new set. */
let drill: DrillState | null = null;
function drillTopic(): GuideId | null {
  const m = /^#\/drill\/([a-z]+)$/.exec(location.hash);
  return m && GUIDE.some((t) => t.id === m[1]) ? (m[1] as GuideId) : null;
}
function renderDrillPage(): void {
  currentId = null;
  const topic = drillTopic();
  if (!drill || drill.topic !== topic) drill = newDrill(topic);
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

/** Check your own books (#/check): two CSV files paired in the browser. The texts live here, never in storage. */
let check: CheckState = newCheck();
function renderCheckPage(): void {
  currentId = null;
  document.body.dataset.page = 'guide';
  document.title = 'Check your own books | Ledger Fix Lab';
  app.innerHTML = renderCheck(check, plan);
}
/** Keeps what was typed in the two boxes across a re-render. */
function readCheckBoxes(): void {
  const v = (id: string) => app.querySelector<HTMLTextAreaElement>(`[data-check-text=${id}]`)?.value;
  const bank = v('bank');
  const books = v('books');
  if (bank === undefined || books === undefined) return;
  if (bank !== check.bank || books !== check.books) check = { ...check, bank, books, sample: false };
}

/** Sign in (#/signin): an email names the profile on this device; nothing leaves the browser. */
let account: AccountState = { tried: null };
function renderAccountPage(): void {
  currentId = null;
  document.body.dataset.page = 'guide';
  document.title = 'Sign in | Ledger Fix Lab';
  app.innerHTML = renderAccount(loadProfile(), account, completed);
}

/** The route shown before the current one. */
let cameFrom = '';
let shownHash = '';

function route(): void {
  cameFrom = shownHash;
  shownHash = location.hash;
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
  if (/^#\/basics/.test(location.hash)) {
    if (basics?.done) basics = newBasics();
    renderBasicsPage();
    window.scrollTo(0, 0);
    return;
  }
  if (/^#\/check/.test(location.hash)) {
    renderCheckPage();
    window.scrollTo(0, 0);
    return;
  }
  if (/^#\/signin/.test(location.hash)) {
    account = { tried: null };
    renderAccountPage();
    window.scrollTo(0, 0);
    return;
  }
  if (/^#\/record/.test(location.hash)) {
    currentId = null;
    document.body.dataset.page = 'guide';
    document.title = 'Practice record | Ledger Fix Lab';
    app.innerHTML = renderRecord(completed, history);
    window.scrollTo(0, 0);
    return;
  }
  if (/^#\/terms/.test(location.hash)) {
    currentId = null;
    document.body.dataset.page = 'guide';
    document.title = 'Terms and Conditions | Ledger Fix Lab';
    app.innerHTML = renderTerms();
    window.scrollTo(0, 0);
    return;
  }
  const lockedTopic = drillTopic();
  if (lockedTopic && !plan && GUIDE.findIndex((t) => t.id === lockedTopic) >= FREE_TOPIC_DRILLS) {
    // Practice rounds for the later topics come with the plan; the theory itself stays open in the guide.
    paywall = { returnTo: location.hash, step: 'plans', billing: paywall.billing };
    renderUpgrade();
    window.scrollTo(0, 0);
    return;
  }
  if (/^#\/drill/.test(location.hash)) {
    renderDrillPage();
    window.scrollTo(0, 0);
    return;
  }
  if (/^#\/upgrade/.test(location.hash)) {
    // Coming from the lock in "Check your own books": the plan page leads back to the same files.
    if (cameFrom === '#/check') paywall = { ...paywall, returnTo: '#/check' };
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
    // First time in a guided case: a short tour of the screen (it can be replayed from the header).
    if (changed && isGuided(scenario) && !tourSeen()) setTimeout(() => startTour(), 350);
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

/** Scroll to the row the coach means and pulse it. */
function lookAtTarget(): void {
  const row = app.querySelector<HTMLElement>('tr.co-t');
  if (!row) return;
  row.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'center' });
  row.classList.remove('co-look');
  void row.offsetWidth; // restart the pulse
  row.classList.add('co-look');
}

/**
 * "Show me how": a three-step demonstration of the current fix. It lights the line, then the tool, and
 * on the last step makes the move itself, through the same dispatch as a learner's click, so feedback
 * and progress behave as usual. Available on every problem after two asks for help; skipping it changes nothing. The file remembers how many fixes were demonstrated.
 */
function showMeHow(): void {
  const ui = current();
  if (!ui) return;
  const s = ui.session.scenario;
  const step = coachStep(s, ui.session.state);
  const action = coachAction(s, ui.session.state);
  if (!action || step.kind === 'done') return;
  const id = step.entryIds[0];
  const tool: Record<string, { sel: string; say: string }> = {
    restore: { sel: '[data-act=undo]', say: 'Undo takes back the last move. It is always safe to press.' },
    record: { sel: `[data-record="${step.txnIds[0]}"]`, say: 'This button copies the bank line into the books and asks for its category.' },
    duplicate: { sel: `[data-del="${action !== 'undo' && action.type === 'delete' ? action.entryId : id}"]`, say: 'The bin deletes this copy. The other copy stays, matched to its bank line.' },
    amount: { sel: `[data-edit="${id}"]`, say: 'Click the amount to retype it. The bank line shows the right figure.' },
    tick: { sel: `[data-clear="${id}"]`, say: 'The tick says: I found this payment on the bank statement.' },
    untick: { sel: `[data-clear="${id}"]`, say: 'No tick means the bank has not processed it yet. The line stays in the books.' },
    category: { sel: `select[data-cat="${id}"]`, say: "This menu sets what kind of money the line is. The client's note tells you which one is true." },
  };
  const t = tool[step.kind];
  const steps: TourStep[] = [
    { target: 'tr.co-t', title: 'First, find the line', text: step.title },
    { target: `${t.sel}, tr.co-t`, title: 'Then, the tool', text: t.say },
    { target: 'tr.co-t, .status .figs', title: 'Watch this one', text: `${step.action} I will make this move for you now. Read what changes, then do the next problem yourself.` },
  ];
  startTour(steps, {
    demo: true,
    finish: 'Do it for me',
    onDone: () => {
      const now = current();
      if (!now) return;
      now.demoUsed = true;
      now.demos += 1;
      now.helpLevel = 0;
      now.hintOpen = false;
      if (action === 'undo') {
        now.session = undo(now.session);
        now.editing = now.recording = null;
        now.feedback = null;
        render();
      } else dispatch(action);
    },
  });
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
  if (ui.feedback?.tone === 'good') {
    ui.helpLevel = 0;
  }
  render();
}

app.addEventListener('click', (ev) => {
  if ((ev.target as HTMLElement).closest('[data-act-print]')) return window.print();
  const ck = (ev.target as HTMLElement).closest<HTMLElement>('[data-check]');
  if (ck) {
    if (ck.dataset.check === 'copy') {
      const done = (label: string) => (ck.textContent = label);
      if (!navigator.clipboard) return void done('Copy failed: select the text instead');
      navigator.clipboard.writeText(findingsText(check, plan)).then(() => done('Copied'), () => done('Copy failed: select the text instead'));
      return;
    }
    if (ck.dataset.check === 'sample') check = { bank: SAMPLE_BANK, books: SAMPLE_BOOKS, sample: true, ran: true };
    else if (ck.dataset.check === 'clear') check = newCheck();
    else {
      readCheckBoxes();
      check = { ...check, ran: true };
      rememberCheck(check);
    }
    renderCheckPage();
    if (check.ran) app.querySelector('.ck-out')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    return;
  }
  if ((ev.target as HTMLElement).closest('[data-account=out]')) {
    signOut();
    account = { tried: null };
    return renderAccountPage();
  }
  const bs = (ev.target as HTMLElement).closest<HTMLElement>('[data-basics-pick], [data-basics]');
  if (bs && basics) {
    basics = bs.dataset.basicsPick ? tapBasics(basics, bs.dataset.basicsPick) : nextBasics(basics);
    renderBasicsPage();
    if (bs.dataset.basics) window.scrollTo(0, 0);
    return;
  }
  const dr = (ev.target as HTMLElement).closest<HTMLElement>('[data-drill-row], [data-drill]');
  if (dr && drill) {
    if (dr.dataset.drillRow) drill = tapDrill(drill, dr.dataset.drillRow);
    else if (dr.dataset.drill === 'next') {
      drill = nextDrill(drill);
      if (drill.done && !drill.topic) saveDrillRun(drill.firstTry);
    } else if (dr.dataset.drill === 'again') drill = newDrill(drill.topic);
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
    case 'tour':
      window.scrollTo(0, 0);
      return startTour();
    case 'tab-books':
    case 'tab-bank':
      ui.tab = d.act === 'tab-bank' ? 'bank' : 'books';
      return render();
    case 'toggle-math':
      ui.mathOpen = !ui.mathOpen;
      return render();
    case 'show-target':
      return lookAtTarget();
    case 'toggle-hint': {
      // Help climbs with each press on the same problem: a clue, then the row, then a demonstration (once per file).
      ui.helpLevel += 1;
      ui.hintOpen = true;
      render();
      if (ui.helpLevel === 2) return lookAtTarget();
      if (ui.helpLevel >= 3) return showMeHow();
      return;
    }
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
  const file = ev.target as HTMLInputElement;
  if (file.matches?.('[data-check-file]') && file.files?.[0]) {
    const which = file.dataset.checkFile === 'bank' ? 'bank' : 'books';
    const f = file.files[0];
    if (f.size > 1_000_000) {
      window.alert('That file is larger than 1 MB. Export one month of one account as CSV and try again.');
      return;
    }
    readCheckBoxes();
    f.text().then((text) => {
      check = { ...check, [which]: text, sample: false, ran: false };
      if (/^#\/check/.test(location.hash)) renderCheckPage();
    });
    return;
  }
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
  const acct = (ev.target as HTMLElement).closest<HTMLFormElement>('[data-account-form]');
  if (acct) {
    ev.preventDefault();
    const typed = (acct.elements.namedItem('email') as HTMLInputElement).value;
    account = { tried: signIn(typed) ? null : typed };
    renderAccountPage();
    if (account.tried !== null) app.querySelector<HTMLInputElement>('#acct-email')?.focus();
    else window.scrollTo(0, 0);
    return;
  }
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

// The optional name on the practice record is remembered in this browser only.
app.addEventListener('input', (ev) => {
  const el = ev.target as HTMLInputElement;
  if (el.matches?.('[data-record-name]')) saveRecordName(el.value);
});
