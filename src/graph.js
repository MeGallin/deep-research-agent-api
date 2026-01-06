const { Annotation, END, START, StateGraph } = require("@langchain/langgraph");
const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const { renderTemplate } = require("./promptLoader");

const StateAnnotation = Annotation.Root({
  topic: Annotation(),
  tone: Annotation({
    reducer: (current, update) => (update ? update : current),
    default: () => "neutral"
  }),
  format: Annotation({
    reducer: (current, update) => (update ? update : current),
    default: () => "blog"
  }),
  tokensTotal: Annotation({
    reducer: (current, update) => (typeof update === "number" ? update : current),
    default: () => 0
  }),
  research: Annotation({
    reducer: (current, update) => (update ? update : current),
    default: () => []
  }),
  draft: Annotation({
    reducer: (current, update) => (update ? update : current),
    default: () => ""
  }),
  steps: Annotation({
    reducer: (current, update) => current.concat(update || []),
    default: () => []
  })
});

function formatSources(research) {
  if (!Array.isArray(research) || research.length === 0) {
    return "No sources found.";
  }
  return research
    .map((item, index) => {
      const number = index + 1;
      return `${number}. ${item.title}\n${item.url}\n${item.snippet}`;
    })
    .join("\n\n");
}

function buildGraph({ llm, prompts, searchService, emit, checkpointer }) {
  const workflow = new StateGraph(StateAnnotation)
    .addNode("researcher", async (state) => {
      emit("step", { step: "researcher:start" });

      const query = renderTemplate(prompts.researcher.queryTemplate, {
        topic: state.topic
      });
      const results = await searchService.search({
        query,
        maxResults: prompts.researcher.maxResults
      });

      emit("step", { step: "researcher:done", count: results.length });

      return {
        research: results,
        steps: ["researcher:done"]
      };
    })
    .addNode("writer", async (state) => {
      emit("step", { step: "writer:start" });

      const sourcesText = formatSources(state.research);
      const userPrompt = renderTemplate(prompts.writer.userTemplate, {
        topic: state.topic,
        sources: sourcesText,
        tone: state.tone,
        format: state.format
      });

      const response = await llm.invoke(
        [new SystemMessage(prompts.writer.system), new HumanMessage(userPrompt)]
      );
      const draft = response.content || "";
      const tokensTotal = extractTokenTotal(response);

      emit("step", { step: "writer:done", chars: draft.length });

      return {
        draft,
        tokensTotal,
        steps: ["writer:done"]
      };
    })
    .addEdge(START, "researcher")
    .addEdge("researcher", "writer")
    .addEdge("writer", END);

  return workflow.compile({ checkpointer });
}

function extractTokenTotal(response) {
  const usage =
    response?.usage_metadata ||
    response?.response_metadata?.token_usage ||
    response?.response_metadata?.usage;
  if (!usage) {
    return 0;
  }
  if (typeof usage.total_tokens === "number") {
    return usage.total_tokens;
  }
  if (typeof usage.total === "number") {
    return usage.total;
  }
  const prompt = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const completion = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const sum = Number(prompt) + Number(completion);
  return Number.isFinite(sum) ? sum : 0;
}

module.exports = {
  StateAnnotation,
  buildGraph
};
