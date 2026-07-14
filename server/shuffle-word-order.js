// Admin-only utility: reshuffles the display order of words in the database.
// Not wired into server.js / the HTTP API, so site visitors have no way to trigger it —
// run it by hand (or from a scheduled task) whenever you want a fresh order:
//
//   node server/shuffle-word-order.js            random order
//   node server/shuffle-word-order.js "yield"    put "yield" first, randomize the rest
//
// Only sort_order is touched; ids, mastered state, texts, etc. are untouched.
const db = require('./db');

function shuffle(arr){
  for(let i = arr.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleWordOrder(firstWord){
  const rows = db.prepare('SELECT id, word, sort_order FROM words ORDER BY sort_order, id').all();
  if(rows.length === 0) return;

  const slots = rows.map(r => r.sort_order).sort((a, b) => a - b);

  let arrangement = rows.slice();
  if(firstWord){
    const idx = arrangement.findIndex(r => r.word.toLowerCase() === firstWord.toLowerCase());
    if(idx === -1) throw new Error(`No word matching "${firstWord}" found`);
    const [pinned] = arrangement.splice(idx, 1);
    shuffle(arrangement);
    arrangement.unshift(pinned);
  } else {
    shuffle(arrangement);
  }

  const update = db.prepare('UPDATE words SET sort_order = ? WHERE id = ?');
  db.exec('BEGIN');
  try {
    arrangement.forEach((row, i) => update.run(slots[i], row.id));
    db.exec('COMMIT');
  } catch(e){
    db.exec('ROLLBACK');
    throw e;
  }
}

if(require.main === module){
  const firstWord = process.argv[2];
  shuffleWordOrder(firstWord);
  const first = db.prepare('SELECT word FROM words ORDER BY sort_order, id LIMIT 1').get();
  console.log(`Words reordered. First word is now: "${first.word}"`);
}

module.exports = { shuffleWordOrder };
