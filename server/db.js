const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const seedWords = require('./seed-words');

const dbPath = path.join(__dirname, 'vocab.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS words (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    word        TEXT NOT NULL,
    definition  TEXT NOT NULL,
    etymology   TEXT,
    example     TEXT,
    mastered    INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS texts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS text_words (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    text_id  INTEGER NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
    word_id  INTEGER REFERENCES words(id) ON DELETE SET NULL,
    word     TEXT NOT NULL
  );
`);

const wordCount = db.prepare('SELECT COUNT(*) AS n FROM words').get().n;
if(wordCount === 0){
  const insert = db.prepare(
    'INSERT INTO words (word, definition, etymology, example) VALUES (?, ?, ?, ?)'
  );
  db.exec('BEGIN');
  try {
    for(const w of seedWords){
      insert.run(w.word, w.definition, w.etymology ?? null, w.example ?? null);
    }
    db.exec('COMMIT');
  } catch(e){
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = db;
