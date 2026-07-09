import { state } from './state.js';

export function renderStats(){
  const total = state.words.length;
  const mastered = state.words.filter(w => w.mastered).length;
  document.getElementById('statsRow').innerHTML = `
    <div class="stat-item"><b>${total}</b><span>Collected</span></div>
    <div class="stat-item"><b>${mastered}</b><span>Mastered</span></div>
    <div class="stat-item"><b>${state.texts.length}</b><span>Entries written</span></div>
  `;
}
