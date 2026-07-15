const db = require('./db');

function getOrCreateUser(id){
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if(existing) return existing;
  db.prepare('INSERT INTO users (id) VALUES (?)').run(id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function touchLastSeen(id){
  db.prepare("UPDATE users SET last_seen_at = datetime('now') WHERE id = ?").run(id);
}

function setName(id, name){
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, id);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

module.exports = { getOrCreateUser, touchLastSeen, setName };
