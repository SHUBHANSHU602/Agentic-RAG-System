require('dotenv').config();
const { QdrantClient } = require('@qdrant/js-client-rest');

const client = new QdrantClient({ url: 'http://localhost:6333' });
const COLLECTION_NAME = 'docs';
const VECTOR_SIZE = 384;

async function createCollection() {
  const collections = await client.getCollections();
  const exists = collections.collections.some(c => c.name === COLLECTION_NAME);
  if (exists) {
    console.log('Collection already exists — skipping creation');
    return;
  }
  await client.createCollection(COLLECTION_NAME, {
    vectors: {
      dense: { size: VECTOR_SIZE, distance: 'Cosine' }
    },
    sparse_vectors: {
      sparse: { index: { on_disk: false } }
    }
  });
  console.log('Collection created with dense + sparse vectors:', COLLECTION_NAME);
}

async function storeBatch(points) {
  await client.upsert(COLLECTION_NAME, { points });
}

function workspaceFilter(workspaceId) {
  if (!workspaceId) return undefined;
  return {
    must: [
      {
        key: 'workspaceId',
        match: { value: workspaceId }
      }
    ]
  };
}

async function searchDense(queryVector, topK = 8, workspaceId = null) {
  return client.search(COLLECTION_NAME, {
    vector: { name: 'dense', vector: queryVector },
    limit: topK,
    with_payload: true,
    filter: workspaceFilter(workspaceId)
  });
}

async function searchSparse(sparseVector, topK = 8, workspaceId = null) {
  return client.search(COLLECTION_NAME, {
    vector: { name: 'sparse', vector: sparseVector },
    limit: topK,
    with_payload: true,
    filter: workspaceFilter(workspaceId)
  });
}

async function searchVectors(queryVector, topK = 8, workspaceId = null) {
  return searchDense(queryVector, topK, workspaceId);
}

async function deleteCollection() {
  try {
    await client.deleteCollection(COLLECTION_NAME);
    console.log('Collection deleted');
  } catch (e) {
    console.log('Collection did not exist');
  }
}

module.exports = {
  createCollection,
  storeBatch,
  searchVectors,
  searchDense,
  searchSparse,
  deleteCollection
};
