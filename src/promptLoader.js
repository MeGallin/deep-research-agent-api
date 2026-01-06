const fs = require("fs");
const path = require("path");

const defaultPromptDir = path.join(__dirname, "prompts");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function loadPromptConfig() {
  const promptDir = process.env.PROMPT_CONFIG_DIR
    ? path.resolve(process.env.PROMPT_CONFIG_DIR)
    : defaultPromptDir;

  const researcherPath = path.join(promptDir, "researcher.json");
  const writerPath = path.join(promptDir, "writer.json");

  const researcher = readJson(researcherPath);
  const writer = readJson(writerPath);

  return { researcher, writer };
}

function renderTemplate(template, variables = {}) {
  if (typeof template !== "string") {
    return "";
  }
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key]);
    }
    return "";
  });
}

module.exports = {
  loadPromptConfig,
  renderTemplate
};
