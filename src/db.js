const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const defaultDbPath = path.join(__dirname, "..", "data", "runs.sqlite");
const dbPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : defaultDbPath;

let dbInstance;

function ensureDbDirectory(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getDb() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(dbPath);
  }
  return dbInstance;
}

function initDb() {
  ensureDbDirectory(dbPath);
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("PRAGMA foreign_keys = ON");
      db.run(
        `CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY,
          topic TEXT NOT NULL,
          tone TEXT NOT NULL DEFAULT 'neutral',
          format TEXT NOT NULL DEFAULT 'blog',
          status TEXT NOT NULL,
          step TEXT NOT NULL,
          research_json TEXT NOT NULL DEFAULT '[]',
          draft TEXT NOT NULL DEFAULT '',
          error TEXT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )`,
        (error) => {
          if (error) {
            return reject(error);
          }
          return ensureToneColumn(db)
            .then(() => ensureFormatColumn(db))
            .then(() => resolve(db))
            .catch(reject);
        }
      );
    });
  });
}

function ensureToneColumn(db) {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(runs)", (error, rows) => {
      if (error) {
        return reject(error);
      }
      const hasTone = rows.some((row) => row.name === "tone");
      if (hasTone) {
        return resolve();
      }
      return db.run(
        "ALTER TABLE runs ADD COLUMN tone TEXT NOT NULL DEFAULT 'neutral'",
        (alterError) => {
          if (alterError) {
            return reject(alterError);
          }
          return resolve();
        }
      );
    });
  });
}

function ensureFormatColumn(db) {
  return new Promise((resolve, reject) => {
    db.all("PRAGMA table_info(runs)", (error, rows) => {
      if (error) {
        return reject(error);
      }
      const hasFormat = rows.some((row) => row.name === "format");
      if (hasFormat) {
        return resolve();
      }
      return db.run(
        "ALTER TABLE runs ADD COLUMN format TEXT NOT NULL DEFAULT 'blog'",
        (alterError) => {
          if (alterError) {
            return reject(alterError);
          }
          return resolve();
        }
      );
    });
  });
}

module.exports = {
  dbPath,
  getDb,
  initDb
};
