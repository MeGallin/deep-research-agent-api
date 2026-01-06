# API README

## Overview

This service provides the backend for the AI research agent workflow. It exposes `/api` endpoints for creating runs, streaming SSE progress, and retrieving stored results.

## Requirements

- Node.js 18+ (for `node:test` and modern runtime features)
- SQLite (bundled via `sqlite3`)
- Environment variables (see below)

## Environment

Create `api/.env` (already in this repo) and set:

- `PORT` (default `8000`)
- `OPENAI_API_KEY` (required)
- `OPENAI_MODEL` (required, mapped to `modelName`)
- `CORS_ORIGINS` (comma-separated, default `http://localhost:5173`)
- `CORS_CREDENTIALS` (`true`/`false`)
- `SQLITE_DB_PATH` (default `./data/runs.sqlite`)

## Development

```bash
cd api
npm install
npm run dev
```

## Tests

```bash
cd api
npm test
```

## Notes

- Prompts are JSON config files in `api/src/prompts/`.
- SSE is available at `/api/runs/:runId/events` and emits `snapshot`, `step`, `status`, and `result`.
- `POST /api/runs` accepts an optional `tone` string; default is `neutral`.
