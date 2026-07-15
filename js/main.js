import { state } from './state.js';
import { api } from './api.js';
import { renderStats } from './stats.js';
import { initSpecimens, renderSpecimens } from './specimens.js';
import { initCompose, renderEntries } from './compose.js';
import { initRecite } from './recite.js';

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
	document.querySelector('.tabs').scrollIntoView({ block: "start" });
  });
});

async function loadData(){
  const [words, texts, wildcards] = await Promise.all([api.getWords(), api.getTexts(), api.getWildcards()]);
  state.words = words;
  state.texts = texts;
  state.wildcards = wildcards;
  renderStats();
  renderSpecimens();
  renderEntries();
}

initSpecimens();
initCompose();
initRecite();
loadData();
