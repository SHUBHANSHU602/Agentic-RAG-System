const { chat } = require('../../llm');

function documentText(result) {
  return result?.payload?.parentText || result?.payload?.text || '';
}

async function gradeNode(state) {
  const docs = state.documents || [];

  if (docs.length === 0) {
    return {
      retrievalDecision: 'not_relevant',
      gradeReason: 'Retriever returned no document context.'
    };
  }

  const compactContext = docs
    .slice(0, 6)
    .map((doc, index) => `[Document ${index + 1}]\n${documentText(doc).slice(0, 1800)}`)
    .join('\n\n');

  const raw = await chat([
    {
      role: 'system',
      content: `You are a retrieval evaluator for Corrective RAG.
Judge whether the supplied document context contains enough relevant information to answer the user's question without inventing facts.
Return exactly one JSON object:
{"decision":"relevant|not_relevant","reason":"short reason"}
Use relevant only when the context materially addresses the question. Lexical overlap alone is not enough.`
    },
    {
      role: 'user',
      content: `Question:\n${state.question}\n\nRetrieved context:\n${compactContext}`
    }
  ]);

  let parsed;
  try {
    parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
  } catch {
    parsed = { decision: 'not_relevant', reason: 'Grader output was not parseable, so the system chose the safer corrective path.' };
  }

  return {
    retrievalDecision: parsed.decision === 'relevant' ? 'relevant' : 'not_relevant',
    gradeReason: parsed.reason || 'No grading reason provided.'
  };
}

function routeAfterGrade(state) {
  return state.retrievalDecision === 'relevant' ? 'generate' : 'webSearch';
}

module.exports = { gradeNode, routeAfterGrade };
