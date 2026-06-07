# Agentic RAG System

A production-grade Retrieval-Augmented Generation (RAG) system built on a pure JavaScript stack. Ingests PDF documents, stores semantic embeddings in a vector database, and answers questions grounded strictly in document content.

## Architecture

## Tech Stack

| Layer | Tool |
|---|---|
| Backend | Express.js (port 5000) |
| Embeddings | @xenova/transformers — all-MiniLM-L6-v2 (384 dims, local, free) |
| Vector DB | Qdrant (Docker) |
| LLM | Groq Llama 3.3 70B |
| PDF Parsing | pdf2json |
| Chunking | @langchain/textsplitters RecursiveCharacterTextSplitter |

## Setup

### Prerequisites
- Node.js v18+
- Docker Desktop

### Install
```bash
git clone <your-repo-url>
cd agetic_rag
npm install
cp .env.example .env
# Add your GROQ_API_KEY to .env
```

### Run
```bash
# Terminal 1 — start Qdrant
docker run -p 6333:6333 qdrant/qdrant

# Terminal 2 — start server
nodemon index.js
```

## API Reference

### POST /ingest
Ingest a PDF file into the vector store.

**Request:**
```json
{ "filePath": "C:/path/to/document.pdf" }
```

**Response:**
```json
{ "status": "ok", "pages": 1, "chunks": 6, "pointsStored": 6 }
```

### POST /query
Ask a question against ingested documents.

**Request:**
```json
{ "question": "What is the reversal algorithm?" }
```

**Response:**
```json
{
  "answer": "The reversal algorithm works by...",
  "retrieved": 3,
  "sources": [
    { "text": "...", "score": 0.6594, "chunkIndex": 3, "source": "doc.pdf" }
  ]
}
```

### GET /debug
Inspect the current state of the vector store.

**Response:**
```json
{
  "status": "ok",
  "totalPoints": 6,
  "vectorSize": 384,
  "sampleChunks": [{ "id": 123, "preview": "..." }]
}
```

### DELETE /reset
Wipe and recreate the Qdrant collection.

## Key Design Decisions

- **Local embeddings** — @xenova/transformers runs fully locally, no OpenAI API key needed
- **pdf2json** — only PDF library that works reliably in Node.js v24 without native dependencies
- **Score threshold 0.05** — local embeddings produce lower similarity scores than cloud models; threshold tuned accordingly
- **Batch upsert** — all chunk embeddings stored in a single Qdrant upsert call for efficiency

## Roadmap

- [ ] Phase 2: Hybrid search + Cohere reranking
- [ ] Phase 3: Agentic loop with LangGraph.js (CRAG + Self-RAG)
- [ ] Phase 4: Redis caching, BullMQ queue, LangSmith observability
- [ ] Phase 5: Docker Compose + Railway deployment