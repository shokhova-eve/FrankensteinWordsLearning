const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const contentDb = require('./db');

// Visitor data — everything that must survive a deploy untouched. Kept out
// of git (see .gitignore) and out of vocab.db, which only holds shipped word
// content and gets overwritten wholesale whenever new words are pushed.
const dbPath = path.join(__dirname, 'app-data.db');
const contentDbPath = path.join(__dirname, 'vocab.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at  TEXT NOT NULL DEFAULT (datetime('now')),
    is_admin      INTEGER NOT NULL DEFAULT 0
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

  -- word_id points at a row in vocab.db's words table — a different database
  -- file, so it can't be declared as a real foreign key here (SQLite can't
  -- resolve/enforce FKs across database files). server.js deletes orphaned
  -- rows manually when a word is deleted.
  CREATE TABLE IF NOT EXISTS word_mastery (
    user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    word_id  INTEGER NOT NULL,
    PRIMARY KEY (user_id, word_id)
  );

  CREATE TABLE IF NOT EXISTS texts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    body        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    user_id     TEXT REFERENCES users(id)
  );

  -- word_id: see word_mastery comment above — same cross-database caveat.
  CREATE TABLE IF NOT EXISTS text_words (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    text_id  INTEGER NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
    word_id  INTEGER,
    word     TEXT NOT NULL
  );
`);

// One-time migration: older versions of this app kept visitor data in the
// same file as word content (vocab.db), which meant every content push
// wiped out everyone's progress. If vocab.db still has a `users` table,
// this hasn't been split yet — copy the data over here, then drop it from
// vocab.db so future word-content commits are clean content-only diffs.
const contentDbHasLegacyUsers = !!contentDb.prepare(
  "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'"
).get();

if(contentDbHasLegacyUsers){
  const escapedContentDbPath = contentDbPath.replace(/'/g, "''");
  db.exec(`ATTACH DATABASE '${escapedContentDbPath}' AS legacy`);
  db.exec('BEGIN');
  try {
    db.exec(`
      INSERT OR IGNORE INTO users (id, name, created_at, last_seen_at, is_admin)
        SELECT id, name, created_at, last_seen_at, is_admin FROM legacy.users;

      INSERT OR IGNORE INTO sessions (id, user_id, started_at, last_activity_at, searched_words, recited_recognized, composed_words)
        SELECT id, user_id, started_at, last_activity_at, searched_words, recited_recognized, composed_words FROM legacy.sessions;

      INSERT OR IGNORE INTO session_searches (session_id, query)
        SELECT session_id, query FROM legacy.session_searches;

      INSERT OR IGNORE INTO word_mastery (user_id, word_id)
        SELECT user_id, word_id FROM legacy.word_mastery;

      INSERT OR IGNORE INTO texts (id, title, body, created_at, user_id)
        SELECT id, title, body, created_at, user_id FROM legacy.texts;

      INSERT OR IGNORE INTO text_words (id, text_id, word_id, word)
        SELECT id, text_id, word_id, word FROM legacy.text_words;
    `);
    db.exec('COMMIT');
  } catch(e){
    db.exec('ROLLBACK');
    db.exec('DETACH DATABASE legacy');
    throw e;
  }
  db.exec('DETACH DATABASE legacy');

  contentDb.exec(`
    DROP TABLE IF EXISTS session_searches;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS word_mastery;
    DROP TABLE IF EXISTS text_words;
    DROP TABLE IF EXISTS texts;
    DROP TABLE IF EXISTS users;
  `);
}

module.exports = db;
