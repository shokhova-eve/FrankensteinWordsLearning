import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { renderStats } from './stats.js';
import { renderSpecimens } from './specimens.js';

function renderGreeting(){
  const el = document.getElementById('greeting');
  if(!el || !state.userName) return;
  el.innerHTML = `<a class="greeting-link" href="profile.html">Greetings, ${escapeHtml(state.userName)}</a>`;
}

// Shared by any module that just recorded a tracked action (search, recite,
// compose) — re-fetches the session's progress and repaints the stats row.
export async function refreshProgress(){
  const { progress } = await api.getSession();
  state.progress = progress;
  renderStats();
}

export async function initSession(){
  const { name, isAdmin, progress } = await api.getSession();
  state.userName = name;
  state.isAdmin = isAdmin;
  state.progress = progress;
  renderGreeting();
  renderStats();
  renderSpecimens();
}
