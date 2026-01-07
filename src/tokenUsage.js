function getTokenTotal(response) {
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
  getTokenTotal
};
