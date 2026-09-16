const { embed } = require('./embedder');
const { searchDense, searchSparse } = require('./vectorStore');
const { computeSparseVector } = require('./bm25');
const { reciprocalRankFusion } = require('./rrf');
const { rerank } = require('./reranker');
const { multiQueryRetrieve } = require('./multiQuery');

// Single entry point for all retrieval strategies.
// Optional workspaceId restricts searches to one UI workspace while preserving
// the original global behavior for existing API callers that omit it.
async function retrieve(question, options = {}) {
  const {
    useMultiQuery = true,
    useRerank = true,
    topK = 10,
    topN = 4,
    workspaceId = null
  } = options;

  const denseResults = useMultiQuery
    ? await multiQueryRetrieve(question, 3, topK, workspaceId)
    : await searchDense(await embed(question), topK, workspaceId);

  const sparseVec = computeSparseVector(question);
  const sparseResults = sparseVec.indices.length > 0
    ? await searchSparse(sparseVec, topK, workspaceId)
    : [];

  let candidates = reciprocalRankFusion([denseResults, sparseResults])
    .slice(0, topK);

  if (useRerank && candidates.length > 0) {
    candidates = await rerank(question, candidates, topN);
  }

  const seenParents = new Map();
  for (const result of candidates) {
    const parentIndex = result.payload.parentIndex ?? result.payload.chunkIndex;
    const source = result.payload.source ?? 'unknown-source';
    const parentKey = `${source}::${parentIndex}`;
    const score = result.rerankScore ?? result.rrfScore ?? result.score ?? 0;

    if (!seenParents.has(parentKey) || score > (seenParents.get(parentKey)._score || 0)) {
      seenParents.set(parentKey, { ...result, _score: score });
    }
  }

  return Array.from(seenParents.values())
    .sort((a, b) => b._score - a._score);
}

module.exports = { retrieve };
