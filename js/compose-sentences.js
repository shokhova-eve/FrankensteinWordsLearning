import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderStats } from './stats.js';
import { refreshProgress } from './session.js';
import { renderEntries, rollWords, wordsToHtml } from './compose.js';

// --- Single-word session (rollCount === 1) ---
// Rolling exactly one word switches the compose card into a stripped-down
// mode: no title, a one-line input per sentence. Locking a line (Enter, or
// its arrow button) rolls the next word into a fresh line underneath, so
// someone can knock out several sentences in a row. Nothing hits the server
// per line — "Save all" combines every line into a single entry.
let singleWordEntries = []; // { words, useWildcard, value, locked }

function renderSingleWordRows(){
  const el = document.getElementById('singleWordRows');
  el.innerHTML = singleWordEntries.map((row, i) => `
    <div class="single-word-row">
      <div class="single-word-tag">${wordsToHtml(row)}</div>
      <input type="text" class="single-word-input" data-index="${i}"
        placeholder="Write one sentence…" value="${escapeHtml(row.value)}" ${row.locked ? 'disabled' : ''}>
      ${row.locked
        ? '<span class="single-word-saved" title="Locked in">✓</span>'
        : `<button class="add-btn single-word-next" data-index="${i}" title="Next word">↵</button>`}
    </div>
  `).join('');

  el.querySelectorAll('.single-word-input').forEach(input => {
    input.addEventListener('input', () => {
      singleWordEntries[Number(input.dataset.index)].value = input.value;
    });
    input.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        lockSingleWordRow(Number(input.dataset.index));
      }
    });
  });
  el.querySelectorAll('.single-word-next').forEach(btn => {
    btn.addEventListener('click', () => lockSingleWordRow(Number(btn.dataset.index)));
  });

  const lastInput = el.querySelector('.single-word-row:last-child .single-word-input');
  if(lastInput && !lastInput.disabled) lastInput.focus();
}

export function startSingleWordSession(){
  if(state.words.length === 0){
    singleWordEntries = [];
    document.getElementById('singleWordRows').innerHTML = '';
    return;
  }
  singleWordEntries = [{ ...rollWords(), value: '', locked: false }];
  renderSingleWordRows();
}

function lockSingleWordRow(index){
  const row = singleWordEntries[index];
  const value = row.value.trim();
  if(!value) return;
  row.locked = true;
  row.value = value;

  if(state.words.length > 0){
    singleWordEntries.push({ ...rollWords(), value: '', locked: false });
  }
  renderSingleWordRows();
}

export async function saveAllSingleWordEntries(){
  const usedRows = singleWordEntries.filter(row => row.value.trim());
  if(usedRows.length === 0){ alert('Write at least one sentence before saving.'); return; }

  const body = usedRows.map(row => row.value.trim()).join('\n');
  const words = usedRows.flatMap(row => row.words);

  const created = await api.createText({ title: '', body, words });
  state.texts.unshift(created);

  startSingleWordSession();
  renderStats();
  renderEntries();
  refreshProgress();
}

export function applySingleWordMode(rollCount){
  const entryFields = document.getElementById('entryFields');
  const singleWordBlock = document.getElementById('singleWordBlock');
  const isSingleWord = rollCount === 1;

  entryFields.style.display = isSingleWord ? 'none' : '';
  singleWordBlock.style.display = isSingleWord ? '' : 'none';

  if(isSingleWord){
    startSingleWordSession();
  } else {
    singleWordEntries = [];
    document.getElementById('singleWordRows').innerHTML = '';
    document.getElementById('rolledWords').textContent = 'Tap "Roll words" for a random prompt.';
  }
}
