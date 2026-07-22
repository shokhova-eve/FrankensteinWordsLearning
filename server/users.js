const db = require('./app-db');

// Assigned automatically so a visitor never has to type anything to get a
// clickable "Greetings, ___" — they can still replace it with their own name
// later from the profile page (setName below).
const PSEUDONYMS = [
  'Seeker of Knowledge',
  'Wretched Wanderer',
  'Spark of Being'
];

function randomPseudonym(){
  return PSEUDONYMS[Math.floor(Math.random() * PSEUDONYMS.length)];
}

function getOrCreateUser(id){
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if(existing) return existing;
  db.prepare('INSERT INTO users (id, name) VALUES (?, ?)').run(id, randomPseudonym());
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function touchLastSeen(id){
  db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(id);
}

function setName(id, name){
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function isAdmin(id){
  const row = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(id);
  return !!row?.is_admin;
}

function setAdmin(id, value){
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(value ? 1 : 0, id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// One-time cleanup for rows created before pseudonyms existed.
function backfillMissingNames(){
  const rows = db.prepare('SELECT id FROM users WHERE name IS NULL').all();
  const update = db.prepare('UPDATE users SET name = ? WHERE id = ?');
  for(const row of rows) update.run(randomPseudonym(), row.id);
}

module.exports = { getOrCreateUser, touchLastSeen, setName, backfillMissingNames, isAdmin, setAdmin };
