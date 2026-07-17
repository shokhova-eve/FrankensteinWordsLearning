import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml, countWords } from './utils.js';
import { renderStats } from './stats.js';
import { refreshProgress } from './session.js';
import { applySingleWordMode, startSingleWordSession, saveAllSingleWordEntries } from './compose-sentences.js';
import { isEditingEntry, renderEntryEdit, startEditEntry, saveEditEntry, stopEditingEntry, attachEntryEditHandlers } from './compose-edit-mode.js';

function renderEntry(t){
  return isEditingEntry(t.id) ? renderEntryEdit(t) : renderEntryView(t);
}

function renderEntryView(t){
  const words = t.words || [];
  const bodyText = t.body;
  const titleText = t.title || '';
  const count = countWords(bodyText);

  return `
    <div class="entry" data-id="${t.id}">
      <div class="entry-head${!titleText ? ' no-title' : ''}">
        ${titleText ? `<div class="entry-title" data-action="edit">${escapeHtml(titleText)}</div>` : ''}
        <div class="entry-date">${escapeHtml(t.date)}</div>
      </div>
      ${words.length ? `
        <div class="roll-words entry-words">
          Words:
          ${words.map(w => `<b>${escapeHtml(w)}</b>`).join(', ')}
        </div>` : ''}
      <div class="entry-body" data-action="edit">${bodyText.split('\n').map(line => `<div class="entry-line">${escapeHtml(line)}</div>`).join('')}</div>
      <div class="entry-footer">
        <span class="word-counter entry-word-counter">${count} word${count === 1 ? '' : 's'}</span>
        <button class="entry-action-btn entry-edit-btn" title="Edit entry">⚡</button>
        <button class="entry-action-btn entry-delete-btn" title="Delete entry">🗑️</button>
      </div>
    </div>
  `;
}

async function deleteEntry(id){
  if(!confirm('Delete this entry?')) return;
  await api.deleteText(id);
  state.texts = state.texts.filter(t => t.id !== id);
  stopEditingEntry(id);
  renderStats();
  renderEntries();
}

function attachEntryHandlers(){
  document.querySelectorAll('#entryList .entry').forEach(entryEl => {
    const id = Number(entryEl.dataset.id);

    entryEl.querySelectorAll('[data-action="edit"]').forEach(node => {
      node.addEventListener('click', () => startEditEntry(id));
    });

    entryEl.querySelector('.entry-edit-btn')?.addEventListener('click', () => {
      if(isEditingEntry(id)) saveEditEntry(id);
      else startEditEntry(id);
    });

    entryEl.querySelector('.entry-delete-btn')?.addEventListener('click', () => deleteEntry(id));

    if(isEditingEntry(id)) attachEntryEditHandlers(entryEl);
  });
}

export function renderEntries(){
  const el = document.getElementById('entryList');
  if(state.texts.length === 0){
    el.innerHTML = `<div class="empty">No entries yet — write a short passage using your rolled words above.</div>`;
    return;
  }
  el.innerHTML = state.texts.map(t => renderEntry(t)).join('');
  attachEntryHandlers();
}

// Rolls state.rollCount words (plus a wildcard, if active) and reports which
// of the returned words is the wildcard so callers can style it differently.
export function rollWords(){
  const shuffled = [...state.words].sort(() => Math.random() - 0.5);
  const count = Math.min(state.rollCount, shuffled.length);
  const rolled = shuffled.slice(0, count).map(w => w.word);

  const useWildcard = state.wildcardActive && state.wildcards.length > 0;
  if(useWildcard){
    const wildcard = state.wildcards[Math.floor(Math.random() * state.wildcards.length)];
    rolled.push(wildcard.word);
  }
  return { words: rolled, useWildcard };
}

export function wordsToHtml({ words, useWildcard }){
  return words.map((w, i) =>
    (useWildcard && i === words.length - 1)
      ? `<b class="wildcard-word">${escapeHtml(w)}</b>`
      : `<b>${escapeHtml(w)}</b>`
  ).join(', ');
}

export function initCompose(){
  applySingleWordMode(state.rollCount);

  document.getElementById('saveAllEntries').addEventListener('click', saveAllSingleWordEntries);

  document.querySelectorAll('.roll-x-words[data-x-words]').forEach(btn => {
    btn.addEventListener('click', () => {
      const x = parseInt(btn.dataset.xWords, 10);
      if(!x) return;
      state.rollCount = x;
      document.querySelectorAll('.roll-x-words[data-x-words]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applySingleWordMode(state.rollCount);
    });
  });

  const wildcardBtn = document.querySelector('[data-wildcard]');
  if(wildcardBtn){
    wildcardBtn.addEventListener('click', () => {
      state.wildcardActive = !state.wildcardActive;
      wildcardBtn.classList.toggle('active', state.wildcardActive);
    });
  }

  document.getElementById('rollBtn').addEventListener('click', () => {
    if(state.rollCount === 1){
      startSingleWordSession();
      return;
    }
    if(state.words.length === 0){
      document.getElementById('rolledWords').textContent = 'Add some specimens first.';
      return;
    }
    const roll = rollWords();
    state.currentRoll = roll.words;
    document.getElementById('rolledWords').innerHTML = 'Use: ' + wordsToHtml(roll);
  });

  document.getElementById('entryBody').addEventListener('input', () => {
    const text = document.getElementById('entryBody').value.trim();
    const count = text.length === 0 ? 0 : text.split(/\s+/).length;
    document.getElementById('wordCounter').textContent = `${count} word${count === 1 ? '' : 's'}`;
  });

  document.getElementById('saveEntry').addEventListener('click', async () => {
    const title = document.getElementById('entryTitle').value.trim() || 'Untitled entry';
    const body = document.getElementById('entryBody').value.trim();
    if(!body){ alert('Write something before saving.'); return; }

    const created = await api.createText({ title, body, words: state.currentRoll });
    state.texts.unshift(created);

    document.getElementById('entryTitle').value = '';
    document.getElementById('entryBody').value = '';
    document.getElementById('wordCounter').textContent = '0 words';
    state.currentRoll = [];
    document.getElementById('rolledWords').textContent = 'Tap "Roll words" for a random prompt.';
    renderStats();
    renderEntries();
    refreshProgress();
  });
}
