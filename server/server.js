try { process.loadEnvFile(); } catch { /* no .env file present — fine outside dev */ }

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const db = require('./db');
const cookies = require('./cookies');
const users = require('./users');
const sessions = require('./sessions');

const app = express();
const PORT = process.env.PORT || 3000;
const UID_COOKIE = 'uid';
const UID_MAX_AGE_SECONDS = 400 * 24 * 60 * 60; // 400 days — the browser-enforced cap
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

app.use(express.json());

users.backfillMissingNames();

// Resolves the anonymous visitor on every request: reads (or mints) the uid
// cookie, ensures a users row exists, and attaches the active session so
// routes can record progress against req.userId / req.sessionId.
app.use((req, res, next) => {
  let userId = cookies.parseCookies(req)[UID_COOKIE];
  if(!userId){
    userId = crypto.randomUUID();
    cookies.setCookie(res, UID_COOKIE, userId, { maxAgeSeconds: UID_MAX_AGE_SECONDS });
  }
  users.getOrCreateUser(userId);
  users.touchLastSeen(userId);
  req.userId = userId;
  req.sessionId = sessions.getActiveSession(userId);
  next();
});

app.use(express.static(path.join(__dirname, '..')));

function formatDate(isoUtc){
  return new Date(isoUtc + 'Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateOnly(isoDate){
  return new Date(isoDate + 'T00:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function serializeWord(row, masteredIds){
  return {
    id: row.id,
    word: row.word,
    definition: row.definition,
    etymology: row.etymology,
    example: row.example,
    mastered: masteredIds.has(row.id)
  };
}

function getMasteredIds(userId){
  const rows = db.prepare('SELECT word_id FROM word_mastery WHERE user_id = ?').all(userId);
  return new Set(rows.map(r => r.word_id));
}

// ---------- Words ----------

app.get('/api/words', (req, res) => {
  const rows = db.prepare('SELECT * FROM words ORDER BY sort_order, id').all();
  const masteredIds = getMasteredIds(req.userId);
  res.json(rows.map(row => serializeWord(row, masteredIds)));
});

app.post('/api/words', (req, res) => {
  const { word, definition, etymology, example } = req.body || {};
  if(!word || !definition){
    return res.status(400).json({ error: 'word and definition are required' });
  }
  const info = db.prepare(
    'INSERT INTO words (word, definition, etymology, example) VALUES (?, ?, ?, ?)'
  ).run(word, definition, etymology || null, example || null);
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(serializeWord(row, getMasteredIds(req.userId)));
});

app.patch('/api/words/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM words WHERE id = ?').get(id);
  if(!existing) return res.status(404).json({ error: 'word not found' });

  if(typeof req.body?.mastered === 'boolean'){
    if(req.body.mastered){
      db.prepare('INSERT OR IGNORE INTO word_mastery (user_id, word_id) VALUES (?, ?)').run(req.userId, id);
    } else {
      db.prepare('DELETE FROM word_mastery WHERE user_id = ? AND word_id = ?').run(req.userId, id);
    }
  }

  const { word, definition, etymology, example } = req.body || {};
  if(word !== undefined || definition !== undefined || etymology !== undefined || example !== undefined){
    if(!users.isAdmin(req.userId)) return res.status(403).json({ error: 'admin only' });
    if(!word || !definition){
      return res.status(400).json({ error: 'word and definition are required' });
    }
    db.prepare(
      'UPDATE words SET word = ?, definition = ?, etymology = ?, example = ? WHERE id = ?'
    ).run(word, definition, etymology || null, example || null, id);
  }

  const updated = db.prepare('SELECT * FROM words WHERE id = ?').get(id);
  res.json(serializeWord(updated, getMasteredIds(req.userId)));
});

app.delete('/api/words/:id', (req, res) => {
  if(!users.isAdmin(req.userId)) return res.status(403).json({ error: 'admin only' });
  const id = Number(req.params.id);
  db.prepare('DELETE FROM words WHERE id = ?').run(id);
  res.status(204).end();
});

// ---------- Wildcards ----------

app.get('/api/wildcards', (req, res) => {
  const rows = db.prepare('SELECT * FROM wildcards ORDER BY id').all();
  res.json(rows.map(r => ({ id: r.id, word: r.word })));
});

// ---------- Session (anonymous visitor + progress) ----------

app.get('/api/session', (req, res) => {
  const user = db.prepare('SELECT name, is_admin FROM users WHERE id = ?').get(req.userId);
  res.json({ name: user?.name || null, isAdmin: !!user?.is_admin, progress: sessions.getProgress(req.sessionId) });
});

app.post('/api/session/name', (req, res) => {
  const { name } = req.body || {};
  if(!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const trimmed = name.trim();

  // The name field doubles as the admin-mode gate: matching the configured
  // password flips the flag instead of overwriting the visible name, so the
  // password is never saved or displayed.
  if(ADMIN_PASSWORD && trimmed === ADMIN_PASSWORD){
    const updated = users.setAdmin(req.userId, true);
    return res.json({ name: updated.name, isAdmin: true });
  }

  const updated = users.setName(req.userId, trimmed);
  res.json({ name: updated.name, isAdmin: !!updated.is_admin });
});

app.post('/api/session/search', (req, res) => {
  const { query } = req.body || {};
  sessions.recordSearch(req.sessionId, query);
  res.status(204).end();
});

app.post('/api/session/recite', (req, res) => {
  sessions.recordRecite(req.sessionId);
  res.status(204).end();
});

app.get('/api/profile', (req, res) => {
  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId);
  const days = db.prepare(`
    SELECT
      date(started_at) AS day,
      SUM((julianday(last_activity_at) - julianday(started_at)) * 24 * 60) AS minutes,
      SUM(searched_words) AS searched,
      SUM(recited_recognized) AS recited,
      SUM(composed_words) AS composed
    FROM sessions
    WHERE user_id = ?
    GROUP BY day
    ORDER BY day DESC
  `).all(req.userId);

  res.json({
    name: user?.name || null,
    days: days.map(d => ({
      date: formatDateOnly(d.day),
      minutes: Math.round(d.minutes),
      searched: d.searched,
      recited: d.recited,
      composed: d.composed
    }))
  });
});

// ---------- Texts (composed practice entries) ----------

app.get('/api/texts', (req, res) => {
  const texts = db.prepare('SELECT * FROM texts ORDER BY id DESC').all();
  const wordsStmt = db.prepare('SELECT word FROM text_words WHERE text_id = ? ORDER BY id');
  res.json(texts.map(t => ({
    id: t.id,
    title: t.title,
    body: t.body,
    date: formatDate(t.created_at),
    words: wordsStmt.all(t.id).map(r => r.word),
    mine: t.user_id === req.userId
  })));
});

app.post('/api/texts', (req, res) => {
  const { title, body, words } = req.body || {};
  if(!body){
    return res.status(400).json({ error: 'body is required' });
  }
  const info = db.prepare('INSERT INTO texts (title, body, user_id) VALUES (?, ?, ?)').run(title ?? '', body, req.userId);
  const textId = info.lastInsertRowid;

  const findWord = db.prepare('SELECT id FROM words WHERE word = ?');
  const insertLink = db.prepare('INSERT INTO text_words (text_id, word_id, word) VALUES (?, ?, ?)');
  for(const w of (words || [])){
    const match = findWord.get(w);
    insertLink.run(textId, match ? match.id : null, w);
  }
  sessions.recordComposedWords(req.sessionId, (words || []).length);

  const row = db.prepare('SELECT * FROM texts WHERE id = ?').get(textId);
  res.status(201).json({
    id: row.id,
    title: row.title,
    body: row.body,
    date: formatDate(row.created_at),
    words: words || [],
    mine: true
  });
});

app.patch('/api/texts/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM texts WHERE id = ?').get(id);
  if(!existing) return res.status(404).json({ error: 'text not found' });

  const { title, body, words } = req.body || {};
  if(typeof body === 'string' && !body.trim()){
    return res.status(400).json({ error: 'body is required' });
  }
  db.prepare('UPDATE texts SET title = ?, body = ? WHERE id = ?').run(
    typeof title === 'string' ? title : existing.title,
    typeof body === 'string' ? body : existing.body,
    id
  );

  if(Array.isArray(words)){
    db.prepare('DELETE FROM text_words WHERE text_id = ?').run(id);
    const findWord = db.prepare('SELECT id FROM words WHERE word = ?');
    const insertLink = db.prepare('INSERT INTO text_words (text_id, word_id, word) VALUES (?, ?, ?)');
    for(const w of words){
      const match = findWord.get(w);
      insertLink.run(id, match ? match.id : null, w);
    }
  }

  const row = db.prepare('SELECT * FROM texts WHERE id = ?').get(id);
  const wordRows = db.prepare('SELECT word FROM text_words WHERE text_id = ? ORDER BY id').all(id);
  res.json({
    id: row.id,
    title: row.title,
    body: row.body,
    date: formatDate(row.created_at),
    words: wordRows.map(r => r.word)
  });
});

app.delete('/api/texts/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM texts WHERE id = ?').run(id);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Specimen Journal running at http://localhost:${PORT}`);
});
