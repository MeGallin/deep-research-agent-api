const express = require("express");
const cors = require("cors");
const { createRun, getRun, listRuns, updateRun, deleteRun } = require("./runStore");
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

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function requireTopic(req, res, next) {
  const rawTopic = typeof req.body?.topic === "string" ? req.body.topic : "";
  const topic = rawTopic.trim();
  if (topic.length < 3 || topic.length > 200) {
    return res.status(400).json({ error: "Topic must be 3-200 characters." });
  }
  const rawTone = typeof req.body?.tone === "string" ? req.body.tone : "";
  const tone = rawTone.trim();
  if (tone.length > 60) {
    return res.status(400).json({ error: "Tone must be 60 characters or less." });
  }
  const rawFormat = typeof req.body?.format === "string" ? req.body.format : "";
  const format = rawFormat.trim();
  if (format.length > 40) {
    return res.status(400).json({ error: "Format must be 40 characters or less." });
  }
  req.topic = topic;
  req.tone = tone || "neutral";
  req.format = format || "blog";
  return next();
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

  app.post(
    "/api/runs",
    requireTopic,
    asyncHandler(async (req, res) => {
      const run = await createRun({
        topic: req.topic,
        tone: req.tone,
        format: req.format
      });
      await updateRun(run.id, { status: "running", step: "starting" });

      res.status(202).json({ runId: run.id });

      executeRun({
        runId: run.id,
        topic: req.topic,
        tone: req.tone,
        format: req.format,
        updateRun,
        publish,
        searchService: { search }
      }).catch(async (error) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        await updateRun(run.id, {
          status: "error",
          step: "error",
          error: message
        });
        publish(run.id, "status", { status: "error", error: message });
      });
    })
  );

  app.get(
    "/api/runs/:runId",
    asyncHandler(async (req, res) => {
      const run = await getRun(req.params.runId);
      if (!run) {
        return res.status(404).json({ error: "Run not found." });
      }
      return res.json(run);
    })
  );

  app.get(
    "/api/runs",
    asyncHandler(async (req, res) => {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const limitRaw = Number(req.query.limit || 25);
      const offsetRaw = Number(req.query.offset || 0);
      const limit = Math.min(Math.max(limitRaw, 1), 200);
      const offset = Math.max(offsetRaw, 0);

      const page = await listRuns({ status, limit, offset });
      return res.json(page);
    })
  );

  app.delete(
    "/api/runs/:runId",
    asyncHandler(async (req, res) => {
      const removed = await deleteRun(req.params.runId);
      if (!removed) {
        return res.status(404).json({ error: "Run not found." });
      }
      return res.status(204).send();
    })
  );

  app.get(
    "/api/runs/:runId/events",
    asyncHandler(async (req, res) => {
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
    })
  );

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    if (err instanceof SyntaxError && err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON body." });
    }
    console.error("[api] request error", err);
    return res.status(500).json({ error: "Unexpected server error." });
  });

  return app;
}

module.exports = { createApp };
