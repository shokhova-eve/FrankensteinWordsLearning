import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderStats } from './stats.js';

function renderGreeting(){
  const el = document.getElementById('greeting');
  if(!el) return;

  if(state.userName){
    el.innerHTML = `<span class="greeting-text">Hello, ${escapeHtml(state.userName)}</span>`;
    return;
  }

  el.innerHTML = `
    <span class="greeting-prompt">
      Hello, <input type="text" id="greetingNameInput" maxlength="60" placeholder="your name">
      <button class="greeting-save-btn" id="greetingSaveBtn" title="Save name">&check;</button>
    </span>
  `;

  const input = document.getElementById('greetingNameInput');
  const save = async () => {
    const name = input.value.trim();
    if(!name) return;
    const { name: saved } = await api.setName(name);
    state.userName = saved;
    renderGreeting();
  };
  document.getElementById('greetingSaveBtn').addEventListener('click', save);
  input.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); save(); }
  });
}

// Shared by any module that just recorded a tracked action (search, recite,
// compose) — re-fetches the session's progress and repaints the stats row.
export async function refreshProgress(){
  const { progress } = await api.getSession();
  state.progress = progress;
  renderStats();
}

export async function initSession(){
  const { name, progress } = await api.getSession();
  state.userName = name;
  state.progress = progress;
  renderGreeting();
  renderStats();
}
