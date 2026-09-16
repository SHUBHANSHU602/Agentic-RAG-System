const { chat } = require('./llm');
const { hydeEmbed } = require('./hyde');
const { searchDense } = require('./vectorStore');

// Generates N query variations using Groq, embeds each with HyDE,
// retrieves dense results for each, then merges all result sets.
// Optional workspaceId keeps UI sessions isolated in the shared Qdrant collection.
async function multiQueryRetrieve(question, n = 3, topK = 5, workspaceId = null) {
  const variations = await chat([
    {
      role: 'system',
      content: `Generate ${n} different phrasings of the user's question. Each should approach the same topic from a different angle. Return only the questions, one per line, no numbering or extra text.`
    },
    {
      role: 'user',
      content: question
    }
  ]);

  const queries = [question, ...variations.split('\n').map(q => q.trim()).filter(Boolean).slice(0, n)];
  console.log(`[multiQuery] running ${queries.length} queries`);

  const allResults = new Map();

  for (const query of queries) {
    const vec = await hydeEmbed(query);
    const results = await searchDense(vec, topK, workspaceId);
    for (const result of results) {
      if (!allResults.has(result.id) || result.score > allResults.get(result.id).score) {
        allResults.set(result.id, result);
      }
    }
  }

  return Array.from(allResults.values()).sort((a, b) => b.score - a.score);
}

module.exports = { multiQueryRetrieve };
