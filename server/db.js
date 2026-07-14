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
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    sort_order  INTEGER
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

// Migration: existing databases created before sort_order existed won't have the column yet.
const hasSortOrder = db.prepare("SELECT 1 FROM pragma_table_info('words') WHERE name = 'sort_order'").get();
if(!hasSortOrder){
  db.exec('ALTER TABLE words ADD COLUMN sort_order INTEGER');
}
db.exec('UPDATE words SET sort_order = id WHERE sort_order IS NULL');

// Keeps sort_order populated for future inserts (e.g. via POST /api/words) without
// requiring server.js to know about it — new words simply start at the end of the order.
db.exec(`
  CREATE TRIGGER IF NOT EXISTS words_sort_order_default
  AFTER INSERT ON words
  WHEN NEW.sort_order IS NULL
  BEGIN
    UPDATE words SET sort_order = NEW.id WHERE id = NEW.id;
  END;
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
