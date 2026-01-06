const DEFAULT_PROVIDER = "tavily";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for search`);
  }
  return value;
}

async function searchWithTavily({ query, maxResults }) {
  const apiKey = requireEnv("TAVILY_API_KEY");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: Math.min(maxResults || 5, 10),
      search_depth: "basic"
    })
  });

  if (!response.ok) {
    throw new Error("Search request failed");
  }

  const data = await response.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.content || item.snippet || ""
  }));
}

async function searchWithSerper({ query, maxResults }) {
  const apiKey = requireEnv("SERPER_API_KEY");
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey
    },
    body: JSON.stringify({
      q: query,
      num: Math.min(maxResults || 5, 10)
    })
  });

  if (!response.ok) {
    throw new Error("Search request failed");
  }

  const data = await response.json();
  const results = Array.isArray(data.organic) ? data.organic : [];
  return results.map((item) => ({
    title: item.title,
    url: item.link,
    snippet: item.snippet || ""
  }));
}

async function search({ query, maxResults }) {
  const trimmedQuery = (query || "").trim();
  if (!trimmedQuery) {
    return [];
  }
  const provider = (process.env.SEARCH_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
  if (provider === "serper") {
    return searchWithSerper({ query: trimmedQuery, maxResults });
  }
  if (provider === "tavily") {
    return searchWithTavily({ query: trimmedQuery, maxResults });
  }
  throw new Error("Unsupported SEARCH_PROVIDER");
}

module.exports = {
  search
};
