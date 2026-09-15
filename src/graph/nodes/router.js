const { chat } = require('../../llm');

async function routerNode(state) {
  const question = state.question;

  const raw = await chat([
    {
      role: 'system',
      content: `Classify the user's query for a document/web RAG system.
Return exactly one JSON object with this shape:
{"type":"factual|analytical|web_current","reason":"short reason"}

Definitions:
- factual: asks for a concrete fact/explanation that may be answered from indexed documents.
- analytical: asks to compare, reason across, synthesize, or explain multiple ideas.
- web_current: explicitly asks for current/latest/live/recent information that indexed documents may be stale for.
Do not reject a query merely because it may not exist in the indexed documents. Retrieval grading handles that later.`
    },
    { role: 'user', content: question }
  ]);

  let parsed;
  try {
    parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
  } catch {
    parsed = { type: 'factual', reason: 'Router output was not parseable; defaulting to document retrieval.' };
  }

  const allowed = new Set(['factual', 'analytical', 'web_current']);
  const queryType = allowed.has(parsed.type) ? parsed.type : 'factual';

  return {
    queryType,
    routeReason: parsed.reason || 'No reason provided.'
  };
}

function routeAfterRouter(state) {
  return state.queryType === 'web_current' ? 'webSearch' : 'retrieve';
}

module.exports = { routerNode, routeAfterRouter };
