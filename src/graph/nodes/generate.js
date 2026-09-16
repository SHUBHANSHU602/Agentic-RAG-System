const { chat } = require('../../llm');

function buildContext(state) {
  const documentSources = (state.documents || []).map((doc, index) => ({
    kind: 'document',
    label: doc?.payload?.source || `document-${index + 1}`,
    text: doc?.payload?.parentText || doc?.payload?.text || ''
  }));

  const webSources = (state.webResults || []).map((result, index) => ({
    kind: 'web',
    label: result.title || `web-result-${index + 1}`,
    url: result.url || null,
    text: result.content || ''
  }));

  // If CRAG decided the retrieved docs were not relevant, do not mix weak
  // document context back into generation once web correction was attempted.
  const sources = state.retrievalDecision === 'not_relevant'
    ? webSources
    : [...documentSources, ...webSources];

  return sources;
}

async function generateNode(state) {
  const sources = buildContext(state);
  const nextIteration = (state.iterations || 0) + 1;

  if (sources.length === 0) {
    return {
      answer: state.webSearchError
        ? `I could not find reliable context to answer this question, and the web fallback failed: ${state.webSearchError}`
        : 'I could not find reliable context to answer this question.',
      contextSources: [],
      iterations: nextIteration
    };
  }

  const context = sources
    .map((source, index) => {
      const urlLine = source.url ? `\nURL: ${source.url}` : '';
      return `[Source ${index + 1} | ${source.kind} | ${source.label}]${urlLine}\n${source.text.slice(0, 4000)}`;
    })
    .join('\n\n');

  const feedback = state.reflectionFeedback
    ? `\nPrevious answer feedback to address:\n${state.reflectionFeedback}\n`
    : '';

  const answer = await chat([
    {
      role: 'system',
      content: `You are the generation node in an agentic RAG system.
Answer using only the supplied context. Do not invent missing facts.
If sources conflict, say so. If the context is insufficient, explicitly state the limitation.
Prefer a concise, direct answer, but include enough explanation to fully answer the question.`
    },
    {
      role: 'user',
      content: `Question:\n${state.question}\n${feedback}\nContext:\n${context}`
    }
  ]);

  return {
    answer,
    contextSources: sources,
    iterations: nextIteration
  };
}

module.exports = { generateNode, buildContext };
