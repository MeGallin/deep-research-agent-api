const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const request = require("supertest");

const dbPath = path.join(
  os.tmpdir(),
  `ai-research-agent-api-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`
);

process.env.SQLITE_DB_PATH = dbPath;

const { initDb, getDb } = require("../src/db");
const { createRun } = require("../src/runStore");
const { createApp } = require("../src/app");

const app = createApp();

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

test("GET /api/runs/:runId returns 404 for missing run", async () => {
  await request(app).get("/api/runs/missing").expect(404);
});

test("POST /api/runs validates topic length", async () => {
  await request(app).post("/api/runs").send({ topic: "a" }).expect(400);
});

test("GET /api/runs returns stored runs", async () => {
  const run = await createRun({ topic: "List test" });
  const response = await request(app).get("/api/runs").expect(200);
  assert.equal(response.body.total >= 1, true);
  const found = response.body.items.find((item) => item.id === run.id);
  assert.ok(found);
});

test("DELETE /api/runs/:runId deletes a run", async () => {
  const run = await createRun({ topic: "Delete api" });
  await request(app).delete(`/api/runs/${run.id}`).expect(204);
  await request(app).get(`/api/runs/${run.id}`).expect(404);
});

test("GET /api/runs/:runId/rewrites lists variants", async () => {
  const run = await createRun({ topic: "Rewrite list" });
  const response = await request(app).get(`/api/runs/${run.id}/rewrites`).expect(200);
  assert.deepEqual(response.body.items, []);
});

test("SSE endpoint sends snapshot first", async () => {
  const run = await createRun({ topic: "SSE test" });
  const server = app.listen(0);

  try {
    const port = server.address().port;
    const payload = await new Promise((resolve, reject) => {
      const req = http.get(
        `http://127.0.0.1:${port}/api/runs/${run.id}/events`,
        (res) => {
          res.setEncoding("utf8");
          let buffer = "";
          res.on("data", (chunk) => {
            buffer += chunk;
            if (buffer.includes("event: snapshot")) {
              resolve(buffer);
              res.destroy();
            }
          });
          res.on("error", reject);
        }
      );
      req.on("error", reject);
    });

    assert.ok(payload.trimStart().startsWith("event: snapshot"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
