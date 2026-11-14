import { GLOSSARY } from '../core/glossary';
import { GUIDE, RECONCILIATION_STEPS } from '../core/guide';
import { gloss } from './terms';
import { esc, loadTheme, themeButton } from './util';

/** The field guide page (app.html#/guide): how a reconciliation works and the seven things the files test. */
export function renderGuide(): string {
  return `
  <header class="nav">
    <a class="brand" href="./" aria-label="Ledger Fix Lab, back to the main page"><span class="mark" aria-hidden="true"></span>Ledger Fix Lab</a>
    <div class="nav-right"><a class="nav-link" href="#/">Your desk</a>${themeButton(loadTheme())}</div>
  </header>
  <main class="guide-page">
    <header class="guide-head">
      <p class="drill-step">Field guide</p>
      <h1>Seven things to check in any set of books</h1>
      <p class="guide-lead">What each one looks like, how to tell it from a line that is fine, and what to do. Every case and file in the trainer is built from these.</p>
      <nav class="guide-toc" aria-label="Topics">${GUIDE.map((t, i) => `<a href="#/guide/${t.id}"><span>${i + 1}</span>${esc(t.title)}</a>`).join('')}<a href="#/guide/words"><span>A</span>Words explained</a></nav>
    </header>

    <section class="guide-recon" aria-labelledby="g-recon-h">
      <h2 id="g-recon-h">First, how a bank reconciliation works</h2>
      <ol>${RECONCILIATION_STEPS.map((s) => `<li><b>${esc(s.label)}</b><span>${gloss(s.text)}</span></li>`).join('')}</ol>
      <p class="guide-formula"><span>Statement ending balance</span><i>−</i><span>payments not cleared</span><i>+</i><span>deposits in transit</span><i>=</i><span>books balance</span></p>
    </section>

    ${GUIDE.map(
      (t, i) => `
    <article class="guide-topic" id="g-${t.id}">
      <header><span class="guide-n">${i + 1}</span><h2>${esc(t.title)}</h2><span class="guide-tag ${t.inDifference === 'no' ? 'quiet' : ''}">${t.inDifference === 'no' ? 'Does not show in the difference' : t.inDifference === 'yes' ? 'Shows in the difference' : 'Nothing to fix'}</span></header>
      <div class="guide-ex" role="img" aria-label="Example: ${esc(t.example.books)} in the books; ${esc(t.example.bank)} at the bank">
        <div><small>Books</small><span>${esc(t.example.books)}</span></div>
        <div><small>Bank</small><span>${esc(t.example.bank)}</span></div>
      </div>
      <dl>
        <div><dt>What you see</dt><dd>${gloss(t.see)}</dd></div>
        <div><dt>How to tell</dt><dd>${gloss(t.tell)}</dd></div>
        <div><dt>What to do</dt><dd>${gloss(t.fix)}</dd></div>
        <div><dt>Why it matters</dt><dd>${gloss(t.why)}${t.differenceNote ? ` ${esc(t.differenceNote)}` : ''}</dd></div>
      </dl>
      <div class="guide-do"><a class="btn primary" href="#/drill/${t.id}">Practice this: 3 quick rounds</a><a class="link" href="${t.practice.href}">or see it in ${esc(t.practice.label)}</a></div>
    </article>`,
    ).join('')}

    <section class="guide-topic guide-words" id="g-words" aria-labelledby="g-words-h">
      <header><span class="guide-n">A</span><h2 id="g-words-h">Words explained</h2></header>
      <p class="guide-lead small">Every bookkeeping word the trainer uses, in plain language. In the cases, tap any word with a dashed underline to see its meaning.</p>
      <dl>${GLOSSARY.map((t) => `<div><dt>${esc(t.term)}</dt><dd>${esc(t.plain)}</dd></div>`).join('')}</dl>
    </section>

    <section class="guide-end">
      <h2>Now try it on a file</h2>
      <div class="drill-actions">
        <a class="btn primary big" href="#/drill">60-second warm-up</a>
        <a class="btn big" href="#/case/maple-pine-oct">Start case 1</a>
      </div>
      <p class="guide-fine">The trainer models one bank account for a sole proprietor on a cash basis. It teaches the cleanup habit; it is not tax advice.</p>
    </section>
  </main>`;
}
