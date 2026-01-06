# BACKEND-SPEC.md

## 1. Purpose

Provide a Node/ExpressJS backend that runs a LangGraphJS multi-agent workflow:

- **Researcher node**: gathers sources for a topic (tool/search integration).
- **Writer node**: generates a blog post draft using the gathered sources.

POC persistence requirements:

- Use **SQLite** to persist run records for listing/history and retrieval.
- Stream progress and results to the front-end via **Server-Sent Events (SSE)**.
- Prompts must be configuration-driven (JSON under `src/prompts/...`), not hard-coded inside agent nodes.

Implementation must align with Context7 references for:
- LangGraphJS state via **Annotation.Root**
- Graph wiring with **START/END**
- LangChain.js `ChatOpenAI` initialization using **modelName**
- Runtime args passed as the **second argument** to `.invoke` / `.stream` (e.g., `configurable.thread_id`)

---

## 2. End-to-End Workflow (Step-by-step)

### 2.1 Run creation and execution

1. Client calls `POST /api/runs` with `{ topic }`.
2. Server validates topic (trim, length 3–200).
3. Server creates a run record in SQLite:
   - `status="queued"`, `step="init"`
4. Server responds immediately with `202 { runId }`.
5. Server starts async execution:
   - update run: `status="running"`, `step="starting"`
   - publish SSE event: `status=running`
6. Server builds/compiles the LangGraph workflow:
   - State shape defined via `Annotation.Root`
   - Edges: `START -> researcher -> writer -> END`
7. Server invokes the compiled app:
   - `finalState = await app.invoke(initialState, config)`
   - Where `config = { configurable: { thread_id: runId } }` (for checkpointer/thread semantics)
8. During execution, server emits:
   - `step` events (researcher:start, researcher:done, writer:start, writer:done)
   - periodic run snapshot patches to SQLite (research/draft/step/status)
9. On success:
   - update run: `status="complete"`, `step="complete"`
   - emit SSE: `status=complete`
   - emit SSE: `result { topic, research, draft }`
10. On failure:
   - update run: `status="error"`, `step="error"`, `error=<message>`
   - emit SSE: `status=error` with message

---

## 3. Core Modules and Responsibilities

### 3.1 Express App
- JSON parsing
- CORS
- Routes under `/api`

### 3.2 SQLite Run Store (POC persistence for UI)
Responsibilities:
- `createRun({ topic }) -> run`
- `getRun(runId) -> run snapshot`
- `updateRun(runId, patch) -> updated run`
- `listRuns({ status, limit, offset }) -> paginated results`
- SSE subscriber registry (in-memory; connections cannot be persisted)

SQLite schema (POC):
- `runs`:
  - `id TEXT PRIMARY KEY`
  - `topic TEXT`
  - `status TEXT` (queued|running|complete|error)
  - `step TEXT`
  - `research_json TEXT` (JSON string)
  - `draft TEXT`
  - `error TEXT NULL`
  - `created_at TEXT`
  - `updated_at TEXT`

Optional:
- `run_events` append-only table for audits and debugging.

### 3.3 Prompt Configuration Loader
- Reads JSON configuration from `src/prompts/...`
- Supports templating (e.g., `{{topic}}`, `{{sources}}`)
- Agents/nodes must never embed full prompt text directly.

### 3.4 Search Service
- POC: stubbed deterministic results acceptable
- Contract output:
  - `[{ title, url, snippet }]`

### 3.5 LLM Service (LangChain.js)
- Use `ChatOpenAI` from `@langchain/openai`
- Use `modelName` key (Context7 convention)
- Configuration via env:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` (mapped to `modelName`)

### 3.6 LangGraph Workflow (Context7-aligned)
- State defined via `Annotation.Root(...)`
- Graph constructed using `START`, `END`
- Compile with optional checkpointer
  - For Context7 default pattern: `MemorySaver` (in-memory)
  - Optional: `SqliteSaver` for on-disk checkpointing (separate from `runs` DB)

---

## 4. API Endpoints

Base: `/api`

### 4.1 POST /runs
Creates and starts a workflow run.

Request:
```json
{ "topic": "..." }
```

Response:
- `202`:
```json
{ "runId": "..." }
```

### 4.2 GET /runs/:runId
Returns persisted run snapshot.

Response `200`:
```json
{
  "id": "...",
  "topic": "...",
  "status": "queued|running|complete|error",
  "step": "...",
  "research": [],
  "draft": "",
  "error": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 4.3 GET /runs
Lists persisted runs for POC admin/debug.

Query params:
- `status` optional
- `limit` optional (default 25, max 200)
- `offset` optional (default 0)

Response `200`:
```json
{ "total": 0, "limit": 25, "offset": 0, "items": [] }
```

### 4.4 GET /runs/:runId/events (SSE)
Streams progress + results.

- Sends `snapshot` immediately after connect.
- Sends `step`, `status`, `result` as they occur.

---

## 5. State Definition (Context7-style)

State must be defined with `Annotation.Root`. Recommended fields:

- `topic`: string
- `research`: array of sources (default `[]`)
- `draft`: string (default `""`)
- optional `steps`: array of strings (default `[]`, reducer concat) for internal trace

---

## 6. Persistence and Streaming Rules

**Persist-first** rule for each meaningful transition:

1. Update `runs` record in SQLite (status/step/research/draft/error).
2. Emit SSE event to any subscribers.
3. Optionally append to `run_events`.

If SSE disconnects, clients can always recover using `GET /runs/:runId`.

---

## 7. Error Handling

Errors can occur in:
- prompt loading/parsing
- search service
- LLM call
- graph invocation

Rules:
- Catch at run execution wrapper
- Persist error into run record
- Emit `status` error event
- Ensure snapshot endpoint returns error

---

## 8. Pseudocode (Back-end)

### 8.1 POST /api/runs handler (non-blocking)

```pseudo
ROUTE POST /api/runs:
  topic = trim(req.body.topic)
  IF topic invalid:
    RETURN 400

  run = createRun({ topic })              // status=queued, step=init
  updateRun(run.id, status="running", step="starting")

  RESPOND 202 { runId: run.id }

  ASYNC executeRun(run.id, topic)
END ROUTE
```

### 8.2 Build graph (Context7-aligned)

```pseudo
FUNCTION buildGraph(llm, prompts, searchService, emit, checkpointer OPTIONAL):

  DEFINE State USING Annotation.Root:
    topic (string)
    research (array, default [])
    draft (string, default "")
    steps (array, default [], reducer concat)

  workflow = new StateGraph(State)
    .addNode("researcher", async (state) => {
      emit("step", { step: "researcher:start" })

      results = searchService.search(
        query=state.topic,
        maxResults=prompts.researcher.maxResults
      )

      emit("step", { step: "researcher:done", count=len(results) })
      RETURN { research: results, steps: ["researcher:done"] }
    })
    .addNode("writer", async (state) => {
      emit("step", { step: "writer:start" })

      sourcesText = formatSources(state.research)
      userPrompt = render(prompts.writer.userTemplate, { topic: state.topic, sources: sourcesText })

      response = llm.invoke([
        { role:"system", content: prompts.writer.system },
        { role:"user", content: userPrompt }
      ])

      draft = response.content

      emit("step", { step: "writer:done", chars=len(draft) })
      RETURN { draft: draft, steps: ["writer:done"] }
    })
    .addEdge(START, "researcher")
    .addEdge("researcher", "writer")
    .addEdge("writer", END)

  app = workflow.compile({ checkpointer OPTIONAL })

  RETURN app
END FUNCTION
```

### 8.3 Execute run (invoke with runtime args as 2nd param)

```pseudo
FUNCTION executeRun(runId, topic):
  TRY:
    publishSSE(runId, "status", { status:"running" })

    prompts = loadPromptConfig()
    llm = createChatOpenAI(modelName=ENV.OPENAI_MODEL, apiKey=ENV.OPENAI_API_KEY)
    checkpointer = new MemorySaver()  // Context7 default; optional

    emit = (type, data) => {
      // persist-first
      IF type == "step":
        updateRun(runId, step=data.step)
      IF type == "status":
        updateRun(runId, status=data.status, error=data.error?)

      publishSSE(runId, type, data)
    }

    app = buildGraph(llm, prompts, searchService, emit, checkpointer)

    initialState = { topic, research: [], draft: "", steps: [] }
    config = { configurable: { thread_id: runId } }

    finalState = app.invoke(initialState, config)

    updateRun(runId,
      status="complete",
      step="complete",
      research=finalState.research,
      draft=finalState.draft
    )

    publishSSE(runId, "status", { status:"complete" })
    publishSSE(runId, "result", { topic, research: finalState.research, draft: finalState.draft })

  CATCH err:
    msg = err.message
    updateRun(runId, status="error", step="error", error=msg)
    publishSSE(runId, "status", { status:"error", error: msg })
END FUNCTION
```

### 8.4 GET /api/runs/:runId

```pseudo
ROUTE GET /api/runs/:runId:
  run = getRun(runId)
  IF run missing:
    RETURN 404
  RETURN 200 run
END ROUTE
```

### 8.5 GET /api/runs

```pseudo
ROUTE GET /api/runs:
  status = req.query.status (optional)
  limit = clamp(req.query.limit, 1..200)
  offset = max(req.query.offset, 0)

  result = listRuns({ status, limit, offset })
  RETURN 200 result
END ROUTE
```

### 8.6 SSE: GET /api/runs/:runId/events

```pseudo
ROUTE GET /api/runs/:runId/events:
  run = getRun(runId)
  IF run missing:
    RETURN 404

  setHeader(Content-Type="text/event-stream")
  setHeader(Cache-Control="no-cache, no-transform")
  setHeader(Connection="keep-alive")

  writeEvent("snapshot", run)

  subscribe(runId, response)

  ON client disconnect:
    unsubscribe(runId, response)
END ROUTE
```

---

## 9. Acceptance Criteria

- `POST /api/runs` returns immediately with `runId`.
- Run status/step transitions are persisted in SQLite and retrievable via `GET /api/runs/:runId`.
- `GET /api/runs` returns paginated summaries suitable for a Runs UI.
- SSE emits `snapshot` then `step/status/result` events in order.
- Prompts can be changed by editing prompt config JSON without modifying agent/node code.
