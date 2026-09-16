async function webSearchNode(state) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    return {
      webSearched: false,
      webSearchError: 'TAVILY_API_KEY is not configured.',
      webResults: []
    };
  }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: state.question,
        search_depth: 'advanced',
        max_results: 5,
        include_answer: false,
        include_raw_content: false
      })
    });

    if (!response.ok) {
      throw new Error(`Tavily request failed with status ${response.status}`);
    }

    const data = await response.json();
    const webResults = (data.results || []).map(result => ({
      title: result.title || 'Untitled result',
      url: result.url || null,
      content: result.content || '',
      score: result.score ?? null
    }));

    return {
      webSearched: true,
      webSearchError: null,
      webResults
    };
  } catch (error) {
    return {
      webSearched: false,
      webSearchError: error.message,
      webResults: []
    };
  }
}

module.exports = { webSearchNode };
