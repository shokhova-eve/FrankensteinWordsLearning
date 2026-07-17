import { state } from './state.js';

export function renderStats(){
  const mastered = state.words.filter(w => w.mastered).length;
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-item"><b>${state.progress.total}</b><span>This session</span></div>
    <div class="stat-item"><b>${mastered}</b><span>Mastered</span></div>
    <div class="stat-item"><b>${state.texts.filter(t => t.mine).length}</b><span>Entries written</span></div>
  `;
}
