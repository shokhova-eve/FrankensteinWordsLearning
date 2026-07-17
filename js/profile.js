import { api } from './api.js';
import { escapeHtml } from './utils.js';

function formatMinutes(minutes){
  if(minutes < 1) return '<1 min';
  if(minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function renderDays(days){
  const body = document.getElementById('profileTableBody');
  if(days.length === 0){
    body.innerHTML = `<tr><td colspan="5" class="empty-row">No activity yet — go collect some words.</td></tr>`;
    return;
  }
  body.innerHTML = days.map(d => `
    <tr>
      <td>${escapeHtml(d.date)}</td>
      <td>${formatMinutes(d.minutes)}</td>
      <td>${d.searched}</td>
      <td>${d.recited}</td>
      <td>${d.composed}</td>
    </tr>
  `).join('');
}

function initNameForm(name){
  const input = document.getElementById('nameInput');
  input.value = name || '';

  const save = async () => {
    const value = input.value.trim();
    if(!value) return;
    const { name: saved } = await api.setName(value);
    document.getElementById('profileGreeting').textContent = `Greetings, ${saved}`;
  };

  document.getElementById('nameSaveBtn').addEventListener('click', save);
  input.addEventListener('keydown', (e) => {
    if(e.key === 'Enter'){ e.preventDefault(); save(); }
  });
}

async function init(){
  const { name, days } = await api.getProfile();
  document.getElementById('profileGreeting').textContent = name ? `Greetings, ${name}` : '';
  initNameForm(name);
  renderDays(days);
}

init();
