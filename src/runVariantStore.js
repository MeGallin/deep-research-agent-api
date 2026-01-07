const crypto = require("crypto");
const { getDb } = require("./db");

function generateVariantId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

function toVariant(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    runId: row.run_id,
    tone: row.tone || "neutral",
    format: row.format || "blog",
    draft: row.draft,
    tokensTotal: Number.isFinite(row.tokens_total) ? row.tokens_total : 0,
    createdAt: row.created_at
  };
}

function toVariantListItem(row) {
  return {
    id: row.id,
    runId: row.run_id,
    tone: row.tone || "neutral",
    format: row.format || "blog",
    tokensTotal: Number.isFinite(row.tokens_total) ? row.tokens_total : 0,
    createdAt: row.created_at
  };
}

function createVariant({ runId, tone = "neutral", format = "blog", draft, tokensTotal = 0 }) {
  const db = getDb();
  const id = generateVariantId();
  const createdAt = new Date().toISOString();
  const safeTokens = Number.isFinite(tokensTotal) ? tokensTotal : 0;
  const safeDraft = draft || "";

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO run_variants (
        id, run_id, tone, format, draft, tokens_total, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, runId, tone, format, safeDraft, safeTokens, createdAt],
      (dbError) => {
        if (dbError) {
          return reject(dbError);
        }
        return resolve({
          id,
          runId,
          tone,
          format,
          draft: safeDraft,
          tokensTotal: safeTokens,
          createdAt
        });
      }
    );
  });
}

function listVariants(runId) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, run_id, tone, format, tokens_total, created_at
       FROM run_variants
       WHERE run_id = ?
       ORDER BY created_at DESC`,
      [runId],
      (dbError, rows) => {
        if (dbError) {
          return reject(dbError);
        }
        return resolve(rows.map(toVariantListItem));
      }
    );
  });
}

function getVariant({ runId, variantId }) {
  const db = getDb();
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, run_id, tone, format, draft, tokens_total, created_at
       FROM run_variants
       WHERE id = ? AND run_id = ?`,
      [variantId, runId],
      (dbError, row) => {
        if (dbError) {
          return reject(dbError);
        }
        return resolve(toVariant(row));
      }
    );
  });
}

module.exports = {
  createVariant,
  listVariants,
  getVariant
};
