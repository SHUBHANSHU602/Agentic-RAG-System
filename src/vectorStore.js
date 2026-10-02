require('dotenv').config();
const { QdrantClient } = require('@qdrant/js-client-rest');

const qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333';
const qdrantApiKey = process.env.QDRANT_API_KEY || undefined;

const client = new QdrantClient({
  url: qdrantUrl,
  ...(qdrantApiKey ? { apiKey: qdrantApiKey } : {})
});

const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'docs';
const VECTOR_SIZE = 384;

async function ensurePayloadIndexes() {
  const fields = ['workspaceId', 'documentId', 'source'];
  for (const field of fields) {
    try {
      await client.createPayloadIndex(COLLECTION_NAME, {
        field_name: field,
        field_schema: 'keyword'
      });
    } catch (error) {
      const message = String(error?.message || '');
      // Qdrant returns an error when an equivalent index already exists.
      if (!message.toLowerCase().includes('already')) throw error;
    }
  }
}

async function createCollection() {
  const collections = await client.getCollections();
  const exists = collections.collections.some(c => c.name === COLLECTION_NAME);

  if (!exists) {
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        dense: { size: VECTOR_SIZE, distance: 'Cosine' }
      },
      sparse_vectors: {
        sparse: { index: { on_disk: false } }
      }
    });
    console.log(`Qdrant collection created: ${COLLECTION_NAME}`);
  } else {
    console.log(`Qdrant collection already exists: ${COLLECTION_NAME}`);
  }

  await ensurePayloadIndexes();
}

async function storeBatch(points) {
  await client.upsert(COLLECTION_NAME, { points });
}

function payloadFilter({ workspaceId = null, documentId = null, source = null } = {}) {
  const must = [];

  if (workspaceId) {
    must.push({ key: 'workspaceId', match: { value: workspaceId } });
  }
  if (documentId) {
    must.push({ key: 'documentId', match: { value: documentId } });
  } else if (source) {
    must.push({ key: 'source', match: { value: source } });
  }

  return must.length ? { must } : undefined;
}

function workspaceFilter(workspaceId) {
  return payloadFilter({ workspaceId });
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

async function getDocumentParents({ workspaceId, documentId = null, source = null }) {
  if (!workspaceId) throw new Error('workspaceId is required for document scan');
  if (!documentId && !source) throw new Error('documentId or source is required for document scan');

  const filter = payloadFilter({ workspaceId, documentId, source });
  const points = [];
  let offset = undefined;

  do {
    const page = await client.scroll(COLLECTION_NAME, {
      filter,
      limit: 256,
      offset,
      with_payload: true,
      with_vector: false
    });

    points.push(...(page.points || []));
    offset = page.next_page_offset;
  } while (offset !== null && offset !== undefined);

  const parents = new Map();
  for (const point of points) {
    const payload = point.payload || {};
    const parentIndex = payload.parentIndex ?? payload.chunkIndex ?? 0;
    const key = `${payload.source || source || 'document'}::${parentIndex}`;
    const text = payload.parentText || payload.text || '';

    if (text && !parents.has(key)) {
      parents.set(key, {
        parentIndex,
        text,
        source: payload.source || source || 'document'
      });
    }
  }

  return Array.from(parents.values()).sort((a, b) => a.parentIndex - b.parentIndex);
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
  getDocumentParents,
  deleteCollection
};
