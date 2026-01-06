const crypto = require("crypto");
const { getDb } = require("./db");

function generateRunId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

function toRunSnapshot(row) {
  if (!row) {
    return null;
  }
  let research = [];
  if (row.research_json) {
    try {
      research = JSON.parse(row.research_json);
    } catch (error) {
      research = [];
    }
  }
  return {
    id: row.id,
    topic: row.topic,
    tone: row.tone || "neutral",
    format: row.format || "blog",
    status: row.status,
    step: row.step,
    research,
    draft: row.draft,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toRunListItem(row) {
  return {
    id: row.id,
    topic: row.topic,
    tone: row.tone || "neutral",
    format: row.format || "blog",
    status: row.status,
    step: row.step,
    error: row.error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createRun({ topic, tone = "neutral", format = "blog" }) {
  const db = getDb();
  const now = new Date().toISOString();
  const id = generateRunId();
  const status = "queued";
  const step = "init";
  const research = [];
  const draft = "";
  const error = null;

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO runs (
        id, topic, tone, format, status, step, research_json, draft, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        topic,
        tone,
        format,
        status,
        step,
        JSON.stringify(research),
        draft,
        error,
        now,
        now
      ],
      (dbError) => {
        if (dbError) {
          return reject(dbError);
        }
        return resolve({
        id,
        topic,
        tone,
        format,
        status,
        step,
        research,
        draft,
        error,
          createdAt: now,
          updatedAt: now
        });
      }
    );
  });
}

function getRun(runId) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM runs WHERE id = ?", [runId], (dbError, row) => {
      if (dbError) {
        return reject(dbError);
      }
      return resolve(toRunSnapshot(row));
    });
  });
}

function updateRun(runId, patch) {
  const db = getDb();
  const fields = [];
  const values = [];

  if (typeof patch.status === "string") {
    fields.push("status = ?");
    values.push(patch.status);
  }

  if (typeof patch.step === "string") {
    fields.push("step = ?");
    values.push(patch.step);
  }

  if ("research" in patch) {
    fields.push("research_json = ?");
    values.push(JSON.stringify(patch.research || []));
  }

  if ("draft" in patch) {
    fields.push("draft = ?");
    values.push(patch.draft || "");
  }

  if ("error" in patch) {
    fields.push("error = ?");
    values.push(patch.error);
  }

  if ("topic" in patch) {
    fields.push("topic = ?");
    values.push(patch.topic);
  }

  if ("tone" in patch) {
    fields.push("tone = ?");
    values.push(patch.tone || "neutral");
  }

  if ("format" in patch) {
    fields.push("format = ?");
    values.push(patch.format || "blog");
  }

  if (!fields.length) {
    return getRun(runId);
  }

  const updatedAt = new Date().toISOString();
  fields.push("updated_at = ?");
  values.push(updatedAt);
  values.push(runId);

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE runs SET ${fields.join(", ")} WHERE id = ?`,
      values,
      (dbError) => {
        if (dbError) {
          return reject(dbError);
        }
        return getRun(runId).then(resolve).catch(reject);
      }
    );
  });
}

function listRuns({ status, limit = 25, offset = 0 } = {}) {
  const db = getDb();
  const where = status ? "WHERE status = ?" : "";
  const whereArgs = status ? [status] : [];
  const totalQuery = `SELECT COUNT(*) as total FROM runs ${where}`;
  const listQuery = `SELECT id, topic, tone, format, status, step, error, created_at, updated_at
    FROM runs
    ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`;

  return new Promise((resolve, reject) => {
    db.get(totalQuery, whereArgs, (countError, countRow) => {
      if (countError) {
        return reject(countError);
      }
      const total = countRow ? countRow.total : 0;
      db.all(
        listQuery,
        [...whereArgs, limit, offset],
        (listError, rows) => {
          if (listError) {
            return reject(listError);
          }
          const items = rows.map(toRunListItem);
          return resolve({ total, limit, offset, items });
        }
      );
    });
  });
}

function deleteRun(runId) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM runs WHERE id = ?", [runId], function (dbError) {
      if (dbError) {
        return reject(dbError);
      }
      return resolve(this.changes > 0);
    });
  });
}

module.exports = {
  createRun,
  getRun,
  updateRun,
  listRuns,
  deleteRun
};
