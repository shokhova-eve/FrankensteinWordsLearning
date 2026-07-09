import { state } from './state.js';
import { api } from './api.js';
import { escapeHtml } from './utils.js';
import { reciteState } from './reciteState.js';

export function initRecite(){
	document.querySelectorAll('.timer').forEach(timer => {
    timer.addEventListener('click', () => {
      document.querySelectorAll('.timer').forEach(t => t.classList.remove('active'));
      timer.classList.add('active');
      reciteState.TimerDuration = timer.dataset.seconds;
    });
  });
  document.getElementById('startRecite').addEventListener('click', () => {
	document.getElementById('startRecite').disabled = true;
	reciteState.reciteQueue = state.words.filter(w => !w.mastered);
	reciteState.reciteQueue.sort(() => Math.random() - 0.5);
	reciteState.reciteCurrentIndex = 0;
	reciteState.reciteClicked = 0;
	renderReciteSpecimens();
	startTimer(); // one clock for the whole session — advancing cards below never restarts it
	});
}

function renderReciteSpecimens() {
  const card = document.getElementById('reciteCard');

  if (reciteState.reciteQueue.length === 0) {
	stopTimer();
    card.innerHTML = `<div class="empty">No words in Learning right now — nothing to recite.</div>`;
    document.getElementById('startRecite').disabled = false;
    return;
  }

  if (reciteState.reciteCurrentIndex >= reciteState.reciteQueue.length) {
    stopTimer();
	const count = reciteState.reciteClicked;
	card.innerHTML = `<div class="empty">End of list — you've gone through every word this session.
		<p>You recognized ${count} word${count === 1 ? '' : 's'}.</p></div>`;
	document.getElementById('startRecite').disabled = false;
    return;
  }

  const w = reciteState.reciteQueue[reciteState.reciteCurrentIndex];
  card.innerHTML = `
    <div class="specimen recite">
	  <div class="timer-track"><div class="timer-fill"></div></div>
      <button class="recognized-btn" id="recognized-btn">Recognized</button>
      <button class="unknown-btn" id="unknown-btn">Unknown</button>
      <div class="specimen-word recite">${escapeHtml(w.word)}</div>
    </div>
  `;
  updateFill(); // the innerHTML swap just recreated .timer-fill at 100% — resync it to the running clock

  document.getElementById('recognized-btn').addEventListener('click', () => advanceCard(true));
  document.getElementById('unknown-btn').addEventListener('click', () => advanceCard(false));
}

function advanceCard(wasKnown){
	if (wasKnown)
		reciteState.reciteClicked += 1;
	reciteState.reciteCurrentIndex += 1;
	renderReciteSpecimens();
}

function stopTimer(){
  clearInterval(reciteState.TimerId);
  reciteState.TimerId = 0;
}

function updateFill(){
  const fillEl = document.querySelector('.timer-fill');
  if(!fillEl) return;
  const pct = Math.max(0, (reciteState.secondsLeft / reciteState.TimerDuration) * 100);
  fillEl.style.height = pct + '%';
}

function startTimer(){
  stopTimer(); // guard against a leftover interval from a previous session
  reciteState.secondsLeft = Number(reciteState.TimerDuration);
  updateFill();

  reciteState.TimerId = setInterval(() => {
    reciteState.secondsLeft -= 1;
    updateFill();

    if(reciteState.secondsLeft <= 0){
      stopTimer();
      endSession();
    }
  }, 1000);
}

function endSession(){
  const count = reciteState.reciteClicked;
  document.getElementById('reciteCard').innerHTML =
    `<div class="empty">Time's up — you recognized ${count} word${count === 1 ? '' : 's'}.</div>`;
  document.getElementById('startRecite').disabled = false;
}
