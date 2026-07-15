import { state, PAGE_SIZE } from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderStats } from './stats.js';
import { reciteState } from './reciteState.js';
import { refreshProgress } from './session.js';

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

function shuffleWords(){
  const arr = state.words;
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
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

  let searchTrackTimer = null;
  document.getElementById('searchInput').addEventListener('input', () => {
    const value = document.getElementById('searchInput').value;
    state.searchQuery = value;
	state.currentPage = 1;
  	renderSpecimens();

    clearTimeout(searchTrackTimer);
    searchTrackTimer = setTimeout(() => {
      if(value.trim().length >= 2) api.recordSearch(value.trim()).then(refreshProgress);
    }, 500);
  });

  document.getElementById('shuffleWords').addEventListener('click', () => {
    shuffleWords();
    state.currentPage = 1;
    renderSpecimens();
  });
}
