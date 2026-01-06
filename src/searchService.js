function generateStubSources(topic, maxResults) {
  const count = Math.max(1, Math.min(maxResults || 5, 10));
  const items = [];
  for (let index = 0; index < count; index += 1) {
    const number = index + 1;
    items.push({
      title: `Sample source ${number} for ${topic}`,
      url: `https://example.com/${encodeURIComponent(topic)}/${number}`,
      snippet: `Stubbed summary ${number} for ${topic}.`
    });
  }
  return items;
}

function search({ query, maxResults }) {
  const trimmedQuery = (query || "").trim();
  return generateStubSources(trimmedQuery || "topic", maxResults);
}

module.exports = {
  search
};
