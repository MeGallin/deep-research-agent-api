const { SystemMessage, HumanMessage } = require("@langchain/core/messages");
const { createChatModel } = require("./llm");
const { loadPromptConfig, renderTemplate } = require("./promptLoader");
const { createVariant } = require("./runVariantStore");
const { getTokenTotal } = require("./tokenUsage");

async function rewriteRun({ run, tone, format }) {
  if (!run) {
    throw new Error("Run not found");
  }
  if (!run.draft) {
    throw new Error("Run has no draft to rewrite");
  }

  const prompts = loadPromptConfig();
  const llm = createChatModel();
  const rewriteTone = tone || run.tone || "neutral";
  const rewriteFormat = format || run.format || "blog";

  const userPrompt = renderTemplate(prompts.rewriter.userTemplate, {
    draft: run.draft,
    tone: rewriteTone,
    format: rewriteFormat,
    topic: run.topic
  });

  const response = await llm.invoke(
    [new SystemMessage(prompts.rewriter.system), new HumanMessage(userPrompt)],
    { configurable: { thread_id: `${run.id}:rewrite` } }
  );

  const draft = response.content || "";
  const tokensTotal = getTokenTotal(response);

  return createVariant({
    runId: run.id,
    tone: rewriteTone,
    format: rewriteFormat,
    draft,
    tokensTotal
  });
}

module.exports = {
  rewriteRun
};
