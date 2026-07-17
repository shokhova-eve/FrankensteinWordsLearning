import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderStats } from './stats.js';
import { refreshProgress } from './session.js';
import { applySingleWordMode, startSingleWordSession, saveAllSingleWordEntries } from './compose-sentences.js';

function countWords(text){
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

// --- Entry editing ---
// Only one entry can be in edit mode at a time. `entryDraft` holds the
// in-progress edits so nothing is written back until "save" is pressed.
let editingEntryId = null;
let entryDraft = null; // { title, body, words: [] }

function renderEntry(t){
  const isEditing = editingEntryId === t.id;
  const words = isEditing ? entryDraft.words : (t.words || []);
  const bodyText = isEditing ? entryDraft.body : t.body;
  const titleText = isEditing ? entryDraft.title : (t.title || '');
  const count = countWords(bodyText);

  return `
    <div class="entry${isEditing ? ' editing' : ''}" data-id="${t.id}">
      <div class="entry-head${!isEditing && !titleText ? ' no-title' : ''}">
        ${isEditing
          ? `<span class="entry-title-edit-wrap"><input type="text" class="entry-title-input" maxlength="150" placeholder="Title your entry (optional)" value="${escapeHtml(titleText)}"><span class="blink-cursor">_</span></span>`
          : (titleText ? `<div class="entry-title" data-action="edit">${escapeHtml(titleText)}</div>` : '')}
        <div class="entry-date">${escapeHtml(t.date)}</div>
      </div>
      ${(words.length || isEditing) ? `
        <div class="roll-words entry-words">
          Words:
          ${words.map((w, i) => isEditing
            ? `<span class="entry-word-chip"><b>${escapeHtml(w)}</b><button class="entry-word-remove" data-word-index="${i}" title="Remove word">&times;</button></span>`
            : `<b>${escapeHtml(w)}</b>`
          ).join(isEditing ? '' : ', ')}
          ${isEditing ? `<span class="entry-word-add"><input type="text" class="entry-word-input" placeholder="add word…"><button class="entry-word-add-btn" title="Add word">+</button></span>` : ''}
        </div>` : ''}
      ${isEditing
        ? `<span class="entry-body-edit-wrap"><textarea class="entry-body-input">${escapeHtml(bodyText)}</textarea><span class="blink-cursor">_</span></span>`
        : `<div class="entry-body" data-action="edit">${bodyText.split('\n').map(line => `<div class="entry-line">${escapeHtml(line)}</div>`).join('')}</div>`}
      <div class="entry-footer">
        <span class="word-counter entry-word-counter">${count} word${count === 1 ? '' : 's'}</span>
        <button class="entry-action-btn entry-edit-btn" title="${isEditing ? 'Save entry' : 'Edit entry'}">${isEditing ? '💾' : '⚡'}</button>
        <button class="entry-action-btn entry-delete-btn" title="Delete entry">🗑️</button>
      </div>
    </div>
  `;
}

function startEditEntry(id){
  const entry = state.texts.find(t => t.id === id);
  if(!entry) return;
  editingEntryId = id;
  entryDraft = { title: entry.title || '', body: entry.body, words: [...(entry.words || [])] };
  renderEntries();
}

async function saveEditEntry(id){
  const entry = state.texts.find(t => t.id === id);
  if(!entry || !entryDraft) return;
  const body = entryDraft.body.trim();
  if(!body){ alert('Entry cannot be empty.'); return; }

  const updated = await api.updateText(id, {
    title: entryDraft.title.trim(),
    body,
    words: entryDraft.words
  });
  Object.assign(entry, updated);
  editingEntryId = null;
  entryDraft = null;
  renderStats();
  renderEntries();
}

async function deleteEntry(id){
  if(!confirm('Delete this entry?')) return;
  await api.deleteText(id);
  state.texts = state.texts.filter(t => t.id !== id);
  if(editingEntryId === id){ editingEntryId = null; entryDraft = null; }
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
      if(editingEntryId === id) saveEditEntry(id);
      else startEditEntry(id);
    });

    entryEl.querySelector('.entry-delete-btn')?.addEventListener('click', () => deleteEntry(id));

    if(editingEntryId !== id) return;

    const titleInput = entryEl.querySelector('.entry-title-input');
    const bodyInput = entryEl.querySelector('.entry-body-input');
    const counter = entryEl.querySelector('.entry-word-counter');

    titleInput?.addEventListener('input', () => { entryDraft.title = titleInput.value; });
    bodyInput?.addEventListener('input', () => {
      entryDraft.body = bodyInput.value;
      const c = countWords(bodyInput.value);
      counter.textContent = `${c} word${c === 1 ? '' : 's'}`;
    });

    entryEl.querySelectorAll('.entry-word-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        entryDraft.words.splice(Number(btn.dataset.wordIndex), 1);
        renderEntries();
      });
    });

    const addInput = entryEl.querySelector('.entry-word-input');
    const addWord = () => {
      const val = addInput.value.trim();
      if(!val) return;
      entryDraft.words.push(val);
      renderEntries();
    };
    entryEl.querySelector('.entry-word-add-btn')?.addEventListener('click', addWord);
    addInput?.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){ e.preventDefault(); addWord(); }
    });
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
