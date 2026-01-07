const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const dbPath = path.join(
  os.tmpdir(),
  `ai-research-agent-variants-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
);

process.env.SQLITE_DB_PATH = dbPath;

const { initDb, getDb } = require("../src/db");
const { createRun } = require("../src/runStore");
const { createVariant, getVariant, listVariants } = require("../src/runVariantStore");

test.before(async () => {
  await initDb();
});

test.after(async () => {
  const db = getDb();
  await new Promise((resolve) => db.close(resolve));
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

test("createVariant stores a rewrite variant", async () => {
  const run = await createRun({ topic: "Variant test" });
  const variant = await createVariant({
    runId: run.id,
    tone: "analytical",
    format: "email",
    draft: "Rewritten draft",
    tokensTotal: 123
  });

  assert.equal(variant.runId, run.id);
  assert.equal(variant.tone, "analytical");
  assert.equal(variant.format, "email");
  assert.equal(variant.tokensTotal, 123);
});

test("listVariants returns variants for a run", async () => {
  const run = await createRun({ topic: "Variant list" });
  await createVariant({
    runId: run.id,
    tone: "neutral",
    format: "blog",
    draft: "Draft one",
    tokensTotal: 10
  });

  const variants = await listVariants(run.id);
  assert.equal(Array.isArray(variants), true);
  assert.equal(variants.length, 1);
  assert.equal(variants[0].runId, run.id);
});

test("getVariant returns full variant details", async () => {
  const run = await createRun({ topic: "Variant get" });
  const variant = await createVariant({
    runId: run.id,
    tone: "persuasive",
    format: "memo",
    draft: "Draft two",
    tokensTotal: 55
  });

  const fetched = await getVariant({ runId: run.id, variantId: variant.id });
  assert.equal(fetched.id, variant.id);
  assert.equal(fetched.draft, "Draft two");
});
