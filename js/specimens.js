import { state, PAGE_SIZE } from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderStats } from './stats.js';
import { reciteState } from './reciteState.js';

function getFiltered(){
  let result = state.words;
  if(state.currentFilter === 'learning') result = result.filter(w => !w.mastered);
  if(state.currentFilter === 'mastered') result = result.filter(w => w.mastered);
  if(state.searchQuery.length >= 2) result =
  	result.filter(w => w.word.toLowerCase().includes(state.searchQuery.toLowerCase()));
  return result;
}

export function renderSpecimens(){
  const list = document.getElementById('specimenList');
  const filtered = getFiltered();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if(state.currentPage > totalPages) state.currentPage = totalPages;

  if(filtered.length === 0){
    list.innerHTML = `<div class="empty">No specimens in this category yet.</div>`;
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  const start = (state.currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  list.innerHTML = pageItems.map((w) => {
    const globalIndex = state.words.findIndex(x => x.id === w.id) + 1;
    return `
    <div class="specimen ${w.mastered ? 'mastered' : ''}" data-id="${w.id}">
      <div class="specimen-head">
        <div>
          <div class="specimen-num">No. ${String(globalIndex).padStart(3,'0')}</div>
          <div class="specimen-word">${escapeHtml(w.word)}</div>
        </div>
        <label class="mastery-toggle">
          <input type="checkbox" class="mastery-cb" ${w.mastered ? 'checked' : ''}>
          ${w.mastered ? 'Mastered' : 'Learning'}
        </label>
      </div>
      <div class="specimen-def">${escapeHtml(w.definition)}</div>
      ${w.etymology ? `<div class="specimen-etym">${escapeHtml(w.etymology)}</div>` : ''}
      ${w.example ? `<div class="specimen-example">${escapeHtml(w.example)}</div>` : ''}
      <button class="del-btn">Remove specimen</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.specimen').forEach(card => {
    const id = Number(card.dataset.id);
    card.querySelector('.mastery-cb').addEventListener('change', async (e) => {
      const w = state.words.find(x => x.id === id);
      w.mastered = e.target.checked;
      await api.setMastered(id, w.mastered);
      renderStats();
      renderSpecimens();
    });
    card.querySelector('.del-btn').addEventListener('click', async () => {
      await api.deleteWord(id);
      state.words = state.words.filter(x => x.id !== id);
      renderStats();
      renderSpecimens();
    });
  });

  renderPagination(totalPages);
}

function renderPagination(totalPages){
  const el = document.getElementById('pagination');
  if(totalPages <= 1){ el.innerHTML = ''; return; }
  let html = `<button class="page-btn" id="prevPg" ${state.currentPage === 1 ? 'disabled' : ''}>‹</button>`;
  for(let i = 1; i <= totalPages; i++){
    html += `<button class="page-btn ${i === state.currentPage ? 'active' : ''}" data-pg="${i}">${i}</button>`;
  }
  html += `<button class="page-btn" id="nextPg" ${state.currentPage === totalPages ? 'disabled' : ''}>›</button>`;
  el.innerHTML = html;
  el.querySelectorAll('[data-pg]').forEach(b => {
    b.addEventListener('click', () => { state.currentPage = parseInt(b.dataset.pg); renderSpecimens(); });
  });
  const prev = document.getElementById('prevPg');
  const next = document.getElementById('nextPg');
  if(prev) prev.addEventListener('click', () => { if(state.currentPage > 1){ state.currentPage--; renderSpecimens(); } });
  if(next) next.addEventListener('click', () => { if(state.currentPage < totalPages){ state.currentPage++; renderSpecimens(); } });
}

function clearForm(){
  document.getElementById('f-word').value = '';
  document.getElementById('f-def').value = '';
  document.getElementById('f-etym').value = '';
  document.getElementById('f-ex').value = '';
}

export function initSpecimens(){
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.currentFilter = chip.dataset.filter;
      state.currentPage = 1;
      renderSpecimens();
    });
  });

  document.getElementById('searchInput').addEventListener('input', () => {
    state.searchQuery = document.getElementById('searchInput').value;
	state.currentPage = 1;
  	renderSpecimens();
  });

  document.getElementById('showAddForm').addEventListener('click', () => {
    document.getElementById('addForm').style.display = 'block';
  });
  document.getElementById('cancelAdd').addEventListener('click', () => {
    document.getElementById('addForm').style.display = 'none';
    clearForm();
  });

  document.getElementById('saveWord').addEventListener('click', async () => {
    const word = document.getElementById('f-word').value.trim();
    const definition = document.getElementById('f-def').value.trim();
    const etymology = document.getElementById('f-etym').value.trim();
    const example = document.getElementById('f-ex').value.trim();
    if(!word || !definition){ alert('Please fill in at least the word and definition.'); return; }

    const created = await api.createWord({ word, definition, etymology, example });
    state.words.push(created);
    clearForm();
    document.getElementById('addForm').style.display = 'none';
    state.currentFilter = 'all';
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.chip[data-filter="all"]').classList.add('active');
    state.currentPage = Math.ceil(state.words.length / PAGE_SIZE);
    renderStats();
    renderSpecimens();
  });
}
