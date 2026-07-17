const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const seedWords = require('./seed-words');
const seedWildcards = require('./seed-wildcards');

const dbPath = path.join(__dirname, 'vocab.db');
const db = new DatabaseSync(dbPath);

// Checked before the CREATE TABLE below so we know whether word_mastery is
// brand new (and therefore needs backfilling from the old global column).
const hadWordMastery = db.prepare(
  "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'word_mastery'"
).get();

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

  CREATE TABLE IF NOT EXISTS wildcards (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    word  TEXT NOT NULL
  );

  -- Per-user mastery: a row's presence means that user has mastered that
  -- word. Replaces the old global words.mastered column, which made a word
  -- marked mastered by one visitor show as mastered for every visitor.
  CREATE TABLE IF NOT EXISTS word_mastery (
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_id  INTEGER NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, word_id)
  );

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at          TEXT NOT NULL DEFAULT (datetime('now')),
    last_activity_at    TEXT NOT NULL DEFAULT (datetime('now')),
    searched_words      INTEGER NOT NULL DEFAULT 0,
    recited_recognized  INTEGER NOT NULL DEFAULT 0,
    composed_words      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS session_searches (
    session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    query       TEXT NOT NULL,
    PRIMARY KEY (session_id, query)
  );
`);

// Migration: existing databases created before sort_order existed won't have the column yet.
const hasSortOrder = db.prepare("SELECT 1 FROM pragma_table_info('words') WHERE name = 'sort_order'").get();
if(!hasSortOrder){
  db.exec('ALTER TABLE words ADD COLUMN sort_order INTEGER');
}
db.exec('UPDATE words SET sort_order = id WHERE sort_order IS NULL');

// Migration: attribute composed entries to a user (nullable — older rows predate this column).
const hasTextsUserId = db.prepare("SELECT 1 FROM pragma_table_info('texts') WHERE name = 'user_id'").get();
if(!hasTextsUserId){
  db.exec('ALTER TABLE texts ADD COLUMN user_id TEXT REFERENCES users(id)');
}

// Migration: per-visitor admin flag, granted by entering ADMIN_PASSWORD in the name field.
const hasIsAdmin = db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name = 'is_admin'").get();
if(!hasIsAdmin){
  db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0');
}

// One-time backfill for word_mastery: carry over the old global mastered
// flags so existing visitors don't lose progress they already made. Users
// created after this point start with no mastered words, since they never
// had rows in the old shared column.
if(!hadWordMastery){
  const masteredWordIds = db.prepare('SELECT id FROM words WHERE mastered = 1').all();
  const existingUserIds = db.prepare('SELECT id FROM users').all();
  if(masteredWordIds.length && existingUserIds.length){
    const insertMastery = db.prepare('INSERT OR IGNORE INTO word_mastery (user_id, word_id) VALUES (?, ?)');
    db.exec('BEGIN');
    try {
      for(const user of existingUserIds){
        for(const word of masteredWordIds){
          insertMastery.run(user.id, word.id);
        }
      }
      db.exec('COMMIT');
    } catch(e){
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

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

const wildcardCount = db.prepare('SELECT COUNT(*) AS n FROM wildcards').get().n;
if(wildcardCount === 0){
  const insertWildcard = db.prepare('INSERT INTO wildcards (word) VALUES (?)');
  db.exec('BEGIN');
  try {
    for(const w of seedWildcards){
      insertWildcard.run(w);
    }
    db.exec('COMMIT');
  } catch(e){
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = db;
