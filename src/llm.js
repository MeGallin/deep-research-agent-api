const { ChatOpenAI } = require("@langchain/openai");

function createChatModel() {
  const apiKey = process.env.OPENAI_API_KEY;
  const modelName = process.env.OPENAI_MODEL;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  if (!modelName) {
    throw new Error("OPENAI_MODEL is required");
  }

  return new ChatOpenAI({
    apiKey,
    modelName
  });
}

module.exports = {
  createChatModel
};
