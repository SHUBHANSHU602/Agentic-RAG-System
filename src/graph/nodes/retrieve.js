const { retrieve } = require('../../retrieval');

async function retrieveNode(state) {
  const documents = await retrieve(state.question, {
    useMultiQuery: true,
    useRerank: true,
    topK: state.queryType === 'analytical' ? 12 : 10,
    topN: state.queryType === 'analytical' ? 6 : 4
  });

  return {
    documents,
    webResults: [],
    webSearched: false,
    webSearchError: null
  };
}

module.exports = { retrieveNode };
