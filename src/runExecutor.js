const { MemorySaver } = require("@langchain/langgraph");
const { buildGraph } = require("./graph");
const { loadPromptConfig } = require("./promptLoader");
const { createChatModel } = require("./llm");

function createEmitter({ runId, updateRun, publish }) {
  return async (type, data) => {
    if (type === "step") {
      await updateRun(runId, { step: data.step });
    }
    if (type === "status") {
      await updateRun(runId, { status: data.status, error: data.error || null });
    }
    publish(runId, type, data);
  };
}

async function executeRun({ runId, topic, updateRun, publish, searchService }) {
  const emit = createEmitter({ runId, updateRun, publish });

  try {
    await emit("status", { status: "running" });

    const prompts = loadPromptConfig();
    const llm = createChatModel();
    const checkpointer = new MemorySaver();

    const app = buildGraph({
      llm,
      prompts,
      searchService,
      emit,
      checkpointer
    });

    const initialState = {
      topic,
      research: [],
      draft: "",
      steps: []
    };
    const config = { configurable: { thread_id: runId } };
    const finalState = await app.invoke(initialState, config);

    await updateRun(runId, {
      status: "complete",
      step: "complete",
      research: finalState.research,
      draft: finalState.draft
    });

    publish(runId, "status", { status: "complete" });
    publish(runId, "result", {
      topic,
      research: finalState.research,
      draft: finalState.draft
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await updateRun(runId, {
      status: "error",
      step: "error",
      error: message
    });
    publish(runId, "status", { status: "error", error: message });
  }
}

module.exports = {
  executeRun
};
