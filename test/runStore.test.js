const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const dbPath = path.join(
  os.tmpdir(),
  `ai-research-agent-runstore-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.sqlite`
);

process.env.SQLITE_DB_PATH = dbPath;

const { initDb, getDb } = require("../src/db");
const { createRun, getRun, updateRun, listRuns, deleteRun } = require("../src/runStore");

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

test("createRun stores queued run and returns snapshot", async () => {
  const run = await createRun({ topic: "Test topic" });
  assert.equal(run.status, "queued");
  assert.equal(run.step, "init");
  assert.equal(run.topic, "Test topic");
  assert.equal(run.tone, "neutral");
  assert.equal(run.format, "blog");
  assert.deepEqual(run.research, []);
  assert.equal(run.draft, "");
});

test("updateRun persists status and step changes", async () => {
  const run = await createRun({ topic: "Update test" });
  await updateRun(run.id, { status: "running", step: "starting" });
  const updated = await getRun(run.id);
  assert.equal(updated.status, "running");
  assert.equal(updated.step, "starting");
});

test("listRuns filters by status", async () => {
  const queuedRun = await createRun({ topic: "Queued run" });
  const completeRun = await createRun({ topic: "Complete run" });
  await updateRun(completeRun.id, { status: "complete", step: "complete" });

  const page = await listRuns({ status: "complete", limit: 10, offset: 0 });
  assert.equal(page.total, 1);
  assert.equal(page.items.length, 1);
  assert.equal(page.items[0].id, completeRun.id);

  const queuedSnapshot = await getRun(queuedRun.id);
  assert.equal(queuedSnapshot.status, "queued");
});

test("deleteRun removes a run", async () => {
  const run = await createRun({ topic: "Delete me" });
  const removed = await deleteRun(run.id);
  assert.equal(removed, true);
  const missing = await getRun(run.id);
  assert.equal(missing, null);
});
