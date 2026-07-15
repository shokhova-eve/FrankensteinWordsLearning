import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderStats } from './stats.js';

export function renderEntries(){
  const el = document.getElementById('entryList');
  if(state.texts.length === 0){
    el.innerHTML = `<div class="empty">No entries yet — write a short passage using your rolled words above.</div>`;
    return;
  }
  el.innerHTML = state.texts.map(t => `
    <div class="entry">
	  <div class="entry-toolbar>
	    <span class="word-counter" id="wordCounter">0 words</span>
	    <button class="edit-btn" id="editBtn">⚡</button>
	  </div>
      <div class="entry-head">
        <div class="entry-title">${escapeHtml(t.title)}</div>
        <div class="entry-date">${escapeHtml(t.date)}</div>
      </div>
      ${t.words && t.words.length ? `<div class="roll-words" style="margin-bottom:8px;">Words: ${t.words.map(w => `<b>${escapeHtml(w)}</b>`).join(', ')}</div>` : ''}
      <div class="entry-body">${escapeHtml(t.body)}</div>
    </div>
  `).join('');
}

export function initCompose(){
  document.querySelectorAll('.roll-x-words[data-x-words]').forEach(btn => {
    btn.addEventListener('click', () => {
      const x = parseInt(btn.dataset.xWords, 10);
      if(!x) return;
      state.rollCount = x;
      document.querySelectorAll('.roll-x-words[data-x-words]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
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
    if(state.words.length === 0){
      document.getElementById('rolledWords').textContent = 'Add some specimens first.';
      return;
    }
    const shuffled = [...state.words].sort(() => Math.random() - 0.5);
    const count = Math.min(state.rollCount, shuffled.length);
    const rolled = shuffled.slice(0, count).map(w => w.word);

    const useWildcard = state.wildcardActive && state.wildcards.length > 0;
    if(useWildcard){
      const wildcard = state.wildcards[Math.floor(Math.random() * state.wildcards.length)];
      rolled.push(wildcard.word);
    }

    state.currentRoll = rolled;
    document.getElementById('rolledWords').innerHTML = 'Use: ' + rolled.map((w, i) =>
      (useWildcard && i === rolled.length - 1)
        ? `<b class="wildcard-word">${escapeHtml(w)}</b>`
        : `<b>${escapeHtml(w)}</b>`
    ).join(', ');
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
    state.currentRoll = [];
    document.getElementById('rolledWords').textContent = 'Tap "Roll words" for a random prompt.';
    renderStats();
    renderEntries();
  });
}
