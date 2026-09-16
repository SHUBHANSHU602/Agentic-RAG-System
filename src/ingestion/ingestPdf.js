const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { loadPDF } = require('./pdfParser');
const { parentChildChunk } = require('./chunker');
const { embedBatch } = require('../embedder');
const { storeBatch } = require('../vectorStore');
const { computeSparseVector } = require('../bm25');

async function ingestPdf(filePath, options = {}) {
  const { sourceLabel = null, workspaceId = null } = options;
  const resolvedPath = path.resolve(filePath);

  if (!fs.existsSync(resolvedPath)) {
    const error = new Error(`File not found: ${resolvedPath}`);
    error.statusCode = 400;
    throw error;
  }

  if (path.extname(resolvedPath).toLowerCase() !== '.pdf') {
    const error = new Error('Only PDF files are supported');
    error.statusCode = 400;
    throw error;
  }

  const docs = await loadPDF(resolvedPath);
  const chunks = await parentChildChunk(docs);

  if (chunks.length === 0) {
    const error = new Error('PDF produced no chunks');
    error.statusCode = 400;
    throw error;
  }

  const texts = chunks.map(chunk => chunk.pageContent);
  const denseVectors = await embedBatch(texts);
  const source = sourceLabel || resolvedPath;

  const points = chunks.map((chunk, index) => ({
    id: randomUUID(),
    vector: {
      dense: denseVectors[index],
      sparse: computeSparseVector(chunk.pageContent)
    },
    payload: {
      text: chunk.pageContent,
      parentText: chunk.metadata.parentText,
      parentIndex: chunk.metadata.parentIndex,
      source,
      chunkIndex: index,
      workspaceId: workspaceId || null
    }
  }));

  await storeBatch(points);

  return {
    pages: docs.length,
    chunks: chunks.length,
    pointsStored: points.length,
    source,
    workspaceId: workspaceId || null
  };
}

module.exports = { ingestPdf };
