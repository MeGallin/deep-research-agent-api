const express = require("express");
const cors = require("cors");
const { createRun, getRun, listRuns, updateRun } = require("./runStore");
const { publish, subscribe, writeEvent } = require("./sse");
const { executeRun } = require("./runExecutor");
const { search } = require("./searchService");

function parseAllowedOrigins(value) {
  if (!value) {
    return ["http://localhost:5173"];
  }
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isTruthy(value) {
  if (!value) {
    return false;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function createApp() {
  const app = express();

  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS);
  const allowAllOrigins = allowedOrigins.includes("*");
  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin || allowAllOrigins || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: isTruthy(process.env.CORS_CREDENTIALS),
    maxAge: 86400
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(express.json());

  app.post("/api/runs", async (req, res) => {
    const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
    if (topic.length < 3 || topic.length > 200) {
      return res.status(400).json({ error: "Topic must be 3-200 characters." });
    }

    try {
      const run = await createRun({ topic });
      await updateRun(run.id, { status: "running", step: "starting" });

      res.status(202).json({ runId: run.id });

      executeRun({
        runId: run.id,
        topic,
        updateRun,
        publish,
        searchService: { search }
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create run." });
    }
  });

  app.get("/api/runs/:runId", async (req, res) => {
    try {
      const run = await getRun(req.params.runId);
      if (!run) {
        return res.status(404).json({ error: "Run not found." });
      }
      return res.json(run);
    } catch (error) {
      return res.status(500).json({ error: "Failed to load run." });
    }
  });

  app.get("/api/runs", async (req, res) => {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limitRaw = Number(req.query.limit || 25);
    const offsetRaw = Number(req.query.offset || 0);
    const limit = Math.min(Math.max(limitRaw, 1), 200);
    const offset = Math.max(offsetRaw, 0);

    try {
      const page = await listRuns({ status, limit, offset });
      return res.json(page);
    } catch (error) {
      return res.status(500).json({ error: "Failed to list runs." });
    }
  });

  app.get("/api/runs/:runId/events", async (req, res) => {
    try {
      const run = await getRun(req.params.runId);
      if (!run) {
        return res.status(404).json({ error: "Run not found." });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      writeEvent(res, "snapshot", run);

      const unsubscribe = subscribe(req.params.runId, res);
      req.on("close", () => {
        unsubscribe();
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to open event stream." });
    }
  });

  return app;
}

module.exports = { createApp };
