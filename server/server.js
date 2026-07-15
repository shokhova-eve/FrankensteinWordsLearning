const path = require('node:path');
const express = require('express');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

function formatDate(isoUtc){
  return new Date(isoUtc + 'Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function serializeWord(row){
  return {
    id: row.id,
    word: row.word,
    definition: row.definition,
    etymology: row.etymology,
    example: row.example,
    mastered: !!row.mastered
  };
}

// ---------- Words ----------

app.get('/api/words', (req, res) => {
  const rows = db.prepare('SELECT * FROM words ORDER BY sort_order, id').all();
  res.json(rows.map(serializeWord));
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
  res.status(201).json(serializeWord(row));
});

app.patch('/api/words/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM words WHERE id = ?').get(id);
  if(!existing) return res.status(404).json({ error: 'word not found' });

  if(typeof req.body?.mastered === 'boolean'){
    db.prepare('UPDATE words SET mastered = ? WHERE id = ?').run(req.body.mastered ? 1 : 0, id);
  }
  const row = db.prepare('SELECT * FROM words WHERE id = ?').get(id);
  res.json(serializeWord(row));
});

app.delete('/api/words/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM words WHERE id = ?').run(id);
  res.status(204).end();
});

// ---------- Wildcards ----------

app.get('/api/wildcards', (req, res) => {
  const rows = db.prepare('SELECT * FROM wildcards ORDER BY id').all();
  res.json(rows.map(r => ({ id: r.id, word: r.word })));
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
    words: wordsStmt.all(t.id).map(r => r.word)
  })));
});

app.post('/api/texts', (req, res) => {
  const { title, body, words } = req.body || {};
  if(!body){
    return res.status(400).json({ error: 'body is required' });
  }
  const info = db.prepare('INSERT INTO texts (title, body) VALUES (?, ?)').run(title || 'Untitled entry', body);
  const textId = info.lastInsertRowid;

  const findWord = db.prepare('SELECT id FROM words WHERE word = ?');
  const insertLink = db.prepare('INSERT INTO text_words (text_id, word_id, word) VALUES (?, ?, ?)');
  for(const w of (words || [])){
    const match = findWord.get(w);
    insertLink.run(textId, match ? match.id : null, w);
  }

  const row = db.prepare('SELECT * FROM texts WHERE id = ?').get(textId);
  res.status(201).json({
    id: row.id,
    title: row.title,
    body: row.body,
    date: formatDate(row.created_at),
    words: words || []
  });
});

app.listen(PORT, () => {
  console.log(`Specimen Journal running at http://localhost:${PORT}`);
});
