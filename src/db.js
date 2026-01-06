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
          return resolve(db);
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
