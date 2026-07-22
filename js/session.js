import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml, getPreferredName } from './utils.js';
import { renderStats } from './stats.js';
import { renderSpecimens } from './specimens.js';

function renderGreeting(){
  const el = document.getElementById('greeting');
  if(!el || !state.userName) return;
  el.classList.remove('greeting--login-prompt');
  el.innerHTML = `<a class="greeting-link" href="profile.html">Greetings, ${escapeHtml(state.userName)}</a>`;
}

// If this browser previously chose a name but the server just handed back
// something else (a fresh pseudonym), offer to restore it in one click
// instead of making the visitor retype it on the profile page.
function renderLoginAsPrompt(preferredName){
  const el = document.getElementById('greeting');
  if(!el) return;
  el.classList.add('greeting--login-prompt');
  el.innerHTML = `
    <a class="greeting-link" href="profile.html">Greetings, ${escapeHtml(state.userName)}</a>
    <button type="button" class="login-as-btn" id="loginAsBtn">Login as ${escapeHtml(preferredName)}?</button>
  `;
  document.getElementById('loginAsBtn').addEventListener('click', async () => {
    // A full reload is simplest here — adopting a different identity changes
    // mastered-word flags, stats, and composed texts throughout the app, not
    // just the greeting, so every module needs to re-fetch against the newly
    // adopted user id.
    await api.loginAs(preferredName);
    window.location.reload();
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
  const { name, isAdmin, progress } = await api.getSession();
  state.userName = name;
  state.isAdmin = isAdmin;
  state.progress = progress;

  const preferredName = getPreferredName();
  if(preferredName && preferredName !== name){
    renderLoginAsPrompt(preferredName);
  } else {
    renderGreeting();
  }

  renderStats();
  renderSpecimens();
}
