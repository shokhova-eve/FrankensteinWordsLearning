const db = require('./app-db');

// A session is one continuous burst of activity. Any tracked action extends
// it; once the gap since the last one exceeds this, the next action starts
// a fresh session row instead of reusing the old one.
const SESSION_TIMEOUT_MINUTES = 30;

function getActiveSession(userId){
  const latest = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
  if(latest){
    const { gap } = db.prepare(
      "SELECT (julianday('now') - julianday(?)) * 24 * 60 AS gap"
    ).get(latest.last_activity_at);
    if(gap <= SESSION_TIMEOUT_MINUTES){
      db.prepare("UPDATE sessions SET last_activity_at = datetime('now') WHERE id = ?").run(latest.id);
      return latest.id;
    }
  }
  const info = db.prepare('INSERT INTO sessions (user_id) VALUES (?)').run(userId);
  return info.lastInsertRowid;
}

function recordSearch(sessionId, query){
  const trimmed = (query || '').trim();
  if(trimmed.length < 2) return;
  const info = db.prepare(
    'INSERT OR IGNORE INTO session_searches (session_id, query) VALUES (?, ?)'
  ).run(sessionId, trimmed);
  if(info.changes > 0){
    db.prepare('UPDATE sessions SET searched_words = searched_words + 1 WHERE id = ?').run(sessionId);
  }
}

function recordRecite(sessionId){
  db.prepare('UPDATE sessions SET recited_recognized = recited_recognized + 1 WHERE id = ?').run(sessionId);
}

function recordComposedWords(sessionId, count){
  if(!count) return;
  db.prepare('UPDATE sessions SET composed_words = composed_words + ? WHERE id = ?').run(count, sessionId);
}

function getProgress(sessionId){
  const row = db.prepare(
    'SELECT searched_words, recited_recognized, composed_words FROM sessions WHERE id = ?'
  ).get(sessionId);
  if(!row) return { searched: 0, recited: 0, composed: 0, total: 0 };
  const { searched_words, recited_recognized, composed_words } = row;
  return {
    searched: searched_words,
    recited: recited_recognized,
    composed: composed_words,
    total: searched_words + recited_recognized + composed_words
  };
}

module.exports = {
  SESSION_TIMEOUT_MINUTES,
  getActiveSession,
  recordSearch,
  recordRecite,
  recordComposedWords,
  getProgress
};
