import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml, countWords } from './utils.js';
import { renderStats } from './stats.js';
import { renderEntries } from './compose.js';

// Only one entry can be in edit mode at a time. `entryDraft` holds the
// in-progress edits so nothing is written back until "save" is pressed.
let editingEntryId = null;
let entryDraft = null; // { title, body, words: [] }

export function isEditingEntry(id){
  return editingEntryId === id;
}

export function renderEntryEdit(t){
  const words = entryDraft.words;
  const bodyText = entryDraft.body;
  const titleText = entryDraft.title;
  const count = countWords(bodyText);

  return `
    <div class="entry editing" data-id="${t.id}">
      <div class="entry-head">
        <span class="entry-title-edit-wrap"><input type="text" class="entry-title-input" maxlength="150" placeholder="Title your entry (optional)" value="${escapeHtml(titleText)}"><span class="blink-cursor">_</span></span>
        <div class="entry-date">${escapeHtml(t.date)}</div>
      </div>
      <div class="roll-words entry-words">
        Words:
        ${words.map((w, i) => `<span class="entry-word-chip"><b>${escapeHtml(w)}</b><button class="entry-word-remove" data-word-index="${i}" title="Remove word">&times;</button></span>`).join('')}
        <span class="entry-word-add"><input type="text" class="entry-word-input" placeholder="add word…"><button class="entry-word-add-btn" title="Add word">+</button></span>
      </div>
      <span class="entry-body-edit-wrap"><textarea class="entry-body-input">${escapeHtml(bodyText)}</textarea><span class="blink-cursor">_</span></span>
      <div class="entry-footer">
        <span class="word-counter entry-word-counter">${count} word${count === 1 ? '' : 's'}</span>
        <button class="entry-action-btn entry-edit-btn" title="Save entry">💾</button>
        <button class="entry-action-btn entry-delete-btn" title="Delete entry">🗑️</button>
      </div>
    </div>
  `;
}

export function startEditEntry(id){
  const entry = state.texts.find(t => t.id === id);
  if(!entry) return;
  editingEntryId = id;
  entryDraft = { title: entry.title || '', body: entry.body, words: [...(entry.words || [])] };
  renderEntries();
}

export async function saveEditEntry(id){
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

// Called when an entry is deleted, so a stale draft doesn't linger if it
// happened to be the one currently being edited.
export function stopEditingEntry(id){
  if(editingEntryId === id){ editingEntryId = null; entryDraft = null; }
}

export function attachEntryEditHandlers(entryEl){
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
}
