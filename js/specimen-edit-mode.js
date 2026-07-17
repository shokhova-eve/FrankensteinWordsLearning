import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderSpecimens } from './specimens.js';

// Only one specimen can be in edit mode at a time. `specimenDraft` holds the
// in-progress edits so nothing is written back until "save" is pressed.
let editingSpecimenId = null;
let specimenDraft = null; // { word, definition, etymology, example }

export function isEditingSpecimen(id){
  return editingSpecimenId === id;
}

export function renderSpecimenEdit(w, globalIndex){
  const d = specimenDraft;

  return `
    <div class="specimen editing" data-id="${w.id}">
      <div class="specimen-head">
        <div>
          <div class="specimen-num">No. ${String(globalIndex).padStart(3,'0')}</div>
          <span class="specimen-word-edit-wrap"><input type="text" class="specimen-word-input" maxlength="80" value="${escapeHtml(d.word)}"><span class="blink-cursor">_</span></span>
        </div>
        <label class="mastery-toggle">
          ${w.mastered ? 'Mastered' : 'Learning'}
          <input type="checkbox" class="mastery-cb" ${w.mastered ? 'checked' : ''}>
        </label>
      </div>
      <span class="specimen-field-edit-wrap"><textarea class="specimen-def-input" placeholder="Definition">${escapeHtml(d.definition)}</textarea><span class="blink-cursor">_</span></span>
      <span class="specimen-field-edit-wrap"><textarea class="specimen-etym-input" placeholder="Etymology (optional)">${escapeHtml(d.etymology)}</textarea></span>
      <span class="specimen-field-edit-wrap"><textarea class="specimen-example-input" placeholder="Example (optional)">${escapeHtml(d.example)}</textarea></span>
      <div class="specimen-actions">
        <button class="edit-btn">Save specimen</button><span class="specimen-actions-sep">|</span><button class="del-btn">Remove specimen</button>
      </div>
    </div>
  `;
}

export function startEditSpecimen(id){
  const w = state.words.find(x => x.id === id);
  if(!w) return;
  editingSpecimenId = id;
  specimenDraft = {
    word: w.word,
    definition: w.definition,
    etymology: w.etymology || '',
    example: w.example || ''
  };
  renderSpecimens();
}

export async function saveEditSpecimen(id){
  const w = state.words.find(x => x.id === id);
  if(!w || !specimenDraft) return;
  const word = specimenDraft.word.trim();
  const definition = specimenDraft.definition.trim();
  if(!word || !definition){ alert('Word and definition are required.'); return; }

  const updated = await api.updateWord(id, {
    word,
    definition,
    etymology: specimenDraft.etymology.trim(),
    example: specimenDraft.example.trim()
  });
  Object.assign(w, updated);
  editingSpecimenId = null;
  specimenDraft = null;
  renderSpecimens();
}

// Called when a specimen is deleted, so a stale draft doesn't linger if it
// happened to be the one currently being edited.
export function stopEditingSpecimen(id){
  if(editingSpecimenId === id){ editingSpecimenId = null; specimenDraft = null; }
}

export function attachSpecimenEditHandlers(cardEl){
  const wordInput = cardEl.querySelector('.specimen-word-input');
  const defInput = cardEl.querySelector('.specimen-def-input');
  const etymInput = cardEl.querySelector('.specimen-etym-input');
  const exampleInput = cardEl.querySelector('.specimen-example-input');

  wordInput?.addEventListener('input', () => { specimenDraft.word = wordInput.value; });
  defInput?.addEventListener('input', () => { specimenDraft.definition = defInput.value; });
  etymInput?.addEventListener('input', () => { specimenDraft.etymology = etymInput.value; });
  exampleInput?.addEventListener('input', () => { specimenDraft.example = exampleInput.value; });
}
