# Agentic RAG System


An intelligent document question-answering system that goes beyond standard RAG. Instead of blindly retrieving and generating, it evaluates retrieval quality at runtime, falls back to web search when documents are insufficient, and reflects on its own answers before returning them.

Built entirely on a free, open-source stack — no OpenAI, no paid embeddings.

---

## How It Works

A query enters the system and is immediately expanded into three variations by the LLM. Each variation goes through HyDE — a hypothetical answer is generated and embedded instead of the raw question, placing the query vector closer to real document chunks in embedding space.

Both dense semantic search and BM25 sparse keyword search run simultaneously against Qdrant. Results from both are fused using Reciprocal Rank Fusion, which merges ranked lists purely by position to eliminate score scale mismatch. The merged candidates pass through a Cohere cross-encoder reranker, which reads the query and each chunk together to score true relevance rather than vector geometry.

The reranked results enter the agentic layer. A grading node evaluates whether the retrieved documents actually answer the question. If they do not, the system routes to a Tavily web search fallback and retries with live results. If they do, a generation node produces an answer strictly grounded in retrieved context. A reflection node then evaluates the answer for faithfulness and completeness — if either score is low, the system regenerates with refined context before returning.

Every node in this graph is traced via LangSmith, giving full visibility into routing decisions, retrieval scores, and generation quality across every query.

```
                        ┌─────────────────────────────────┐
                        │           User Query             │
                        └────────────────┬────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │    Query Router      │
                              │ (factual/analytical/ │
                              │    out-of-scope)     │
                              └──────────┬──────────┘
                                         │
                        ┌────────────────▼────────────────┐
                        │         Retrieval Pipeline       │
                        │                                  │
                        │  Multi-Query (3 variants)        │
                        │       ↓                          │
                        │  HyDE Embedding per variant      │
                        │       ↓                          │
                        │  Dense Search  + Sparse BM25     │
                        │       ↓              ↓           │
                        │      RRF Fusion (k=60)           │
                        │       ↓                          │
                        │  Cohere Cross-Encoder Rerank     │
                        │       ↓                          │
                        │  Parent Deduplication            │
                        └────────────────┬────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │    Grading Node      │
                              │  Are docs relevant?  │
                              └────┬──────────┬─────┘
                                   │          │
                                  YES         NO
                                   │          │
                                   │    ┌─────▼──────────┐
                                   │    │  Tavily Search  │
                                   │    │  Web Fallback   │
                                   │    └─────┬──────────┘
                                   │          │
                        ┌──────────▼──────────▼──────┐
                        │       Generation Node        │
                        │   Groq LLaMA 3.3 70B        │
                        └────────────────┬────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │   Reflection Node    │
                              │ Faithful? Complete?  │
                              └────┬──────────┬─────┘
                                   │          │
                                  YES         NO
                                   │          │
                                   │    ┌─────▼──────────┐
                                   │    │   Regenerate    │
                                   │    └─────┬──────────┘
                                   │          │
                        ┌──────────▼──────────▼──────┐
                        │         Final Answer         │
                        └─────────────────────────────┘
```

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js v24 |
| API Framework | Express.js |
| LLM | Groq — LLaMA 3.3 70B Versatile |
| Embeddings | @xenova/transformers — all-MiniLM-L6-v2 (384 dimensions, local) |
| Vector Database | Qdrant (Docker) — dense + sparse vector support |
| PDF Parsing | pdf2json |
| Text Chunking | @langchain/textsplitters — RecursiveCharacterTextSplitter |
| Reranker | Cohere — rerank-english-v3.0 |
| Agentic Framework | LangGraph.js |
| Web Search | Tavily API |
| Observability | LangSmith |
| Caching | Redis + ioredis |
| Job Queue | BullMQ |
| Validation | Zod |
| Logging | Pino |
| Deployment | Railway + Docker Compose |

---

## Retrieval Techniques

**Parent-Child Chunking**
Documents are split into small child chunks (150 chars) and large parent chunks (500 chars). Qdrant matches on child chunks for precision. The LLM receives the parent chunk for full context. This eliminates the standard tradeoff between retrieval precision and generation context quality.

**Hybrid Search with RRF**
Dense semantic search and BM25 sparse keyword search run simultaneously. Dense search captures meaning — BM25 captures exact term matches. Results are fused using Reciprocal Rank Fusion rather than weighted score combination, because cosine similarity and TF-IDF scores live on incompatible distributions. RRF uses only rank position, making the fusion mathematically sound.

**HyDE — Hypothetical Document Embeddings**
Instead of embedding the raw question, the LLM generates a hypothetical answer and that answer is embedded. A question and a document chunk are far apart in embedding space. A hypothetical answer and a real chunk are close. This consistently improves retrieval scores on short, ambiguous queries.

**Multi-Query Retrieval**
The LLM generates three phrasings of the original question. HyDE runs on each. Results from all four queries (original + 3 variants) are merged and deduplicated. Different phrasings surface chunks that a single query misses, improving recall across diverse document structures.

**Cohere Cross-Encoder Reranking**
Standard retrieval scores query and document independently. A cross-encoder reads the query and each candidate chunk as a single concatenated input, running full transformer attention over both simultaneously. This captures query-document interaction that vector similarity cannot. The reranker reorders candidates before they reach the LLM.

---

## Agentic Behavior

**Query Router**
Classifies each incoming query as factual, analytical, or out-of-scope at runtime. Factual queries use the full retrieval pipeline. Analytical queries may trigger multi-hop retrieval. Out-of-scope queries are rejected before retrieval runs.

**CRAG — Corrective RAG**
After retrieval, a grading node evaluates whether the documents actually address the question. Irrelevant results trigger a Tavily web search and the retrieval is corrected with live data. This prevents the LLM from hallucinating answers from weak context. Based on [arxiv 2401.15884](https://arxiv.org/abs/2401.15884).

**Self-RAG Reflection**
After generation, a reflection node scores the answer for faithfulness to the retrieved context and completeness relative to the question. Low scores trigger regeneration with a refined prompt. Based on [arxiv 2310.11511](https://arxiv.org/abs/2310.11511).

**LangSmith Tracing**
Every node in the graph emits a trace — routing decision, retrieval scores, rerank scores, grading result, generation, reflection scores. Full observability into every query's path through the system.

---

## Project Structure

```
agetic_rag/
├── src/
│   ├── ingestion/
│   │   ├── pdfParser.js          PDF loading via pdf2json with encoding fallback
│   │   └── chunker.js            Naive + parent-child chunking strategies
│   │
│   ├── routes/
│   │   ├── ingest.js             POST /ingest
│   │   ├── query.js              POST /query
│   │   ├── debug.js              GET  /debug
│   │   └── benchmark.js          GET  /benchmark
│   │
│   ├── graph/
│   │   ├── nodes/
│   │   │   ├── router.js         Query classification node
│   │   │   ├── retrieve.js       Retrieval node (calls retrieval.js)
│   │   │   ├── grade.js          Document relevance grading node
│   │   │   ├── generate.js       Answer generation node
│   │   │   └── reflect.js        Self-RAG answer reflection node
│   │   └── graph.js              LangGraph state graph — nodes + edges wired
│   │
│   ├── embedder.js               Local embeddings via @xenova/transformers
│   ├── vectorStore.js            Qdrant client — dense + sparse collections
│   ├── llm.js                    Groq chat() wrapper
│   ├── retrieval.js              Unified retrieve() — single entry point
│   ├── bm25.js                   Vocabulary + sparse vector computation
│   ├── rrf.js                    Reciprocal Rank Fusion implementation
│   ├── reranker.js               Cohere cross-encoder integration
│   ├── hyde.js                   HyDE — hypothetical answer embedding
│   ├── multiQuery.js             Multi-query retrieval with deduplication
│   └── reset.js                  Wipe and recreate Qdrant collection
│
├── .env.example
├── .gitignore
├── docker-compose.yml
├── index.js
├── package.json
└── README.md
```

---

## API

### POST /ingest

Ingests a PDF. Parses, chunks into parent-child pairs, embeds child chunks with dense + sparse vectors, stores in Qdrant.

```bash
curl -X POST http://localhost:5000/ingest \
  -H "Content-Type: application/json" \
  -d '{ "filePath": "/path/to/document.pdf" }'
```

```json
{
  "status": "ok",
  "pages": 1,
  "chunks": 19,
  "pointsStored": 19
}
```

### POST /query

Runs the full pipeline — multi-query HyDE retrieval, hybrid search, RRF, rerank, agentic grading, generation, reflection.

```bash
curl -X POST http://localhost:5000/query \
  -H "Content-Type: application/json" \
  -d '{ "question": "How does the reversal algorithm work?" }'
```

```json
{
  "answer": "The reversal algorithm works by reversing the entire array, then reversing the first k elements, then reversing the rest...",
  "retrieved": 3,
  "sources": [
    {
      "childText": "void reverseArray(int arr[], int start, int end){...",
      "parentText": "4. REVERSAL ALGORITHM (OPTIMAL) — full explanation...",
      "rerankScore": 0.9241,
      "parentIndex": 3,
      "source": "notes.pdf"
    }
  ]
}
```

### GET /debug

Returns current Qdrant collection state — point count, vector size, sample chunk previews. Used to verify ingest before querying.

```json
{
  "status": "ok",
  "totalPoints": 19,
  "vectorSize": 384,
  "sampleChunks": [
    { "id": 755338925, "preview": "ARRAY ROTATION — COMPLETE NOTES..." }
  ]
}
```

### GET /benchmark

Runs five test questions through three retrieval strategies — naive dense, hybrid RRF, and full pipeline with reranking. Returns structured comparison.

```json
{
  "status": "ok",
  "benchmark": [
    {
      "question": "How does the reversal algorithm work?",
      "strategies": {
        "naive":  { "top1Score": 0.6594 },
        "hybrid": { "top1RRFScore": 0.0301 },
        "full":   { "top1RerankScore": 0.9241 }
      }
    }
  ]
}
```

### DELETE /reset

Wipes and recreates the Qdrant collection. Use before re-ingesting a document set.

---

## Setup

### Requirements

- Node.js v18+
- Docker Desktop

### Installation

```bash
git clone https://github.com/SHUBHANSHU602/agetic-rag
cd agetic_rag
npm install
cp .env.example .env
```

### Environment Variables

```bash
PORT=5000
GROQ_API_KEY=
COHERE_API_KEY=
TAVILY_API_KEY=
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=agentic-rag
```

Get keys:
- Groq — [console.groq.com](https://console.groq.com) — free
- Cohere — [dashboard.cohere.com](https://dashboard.cohere.com) — free tier
- Tavily — [app.tavily.com](https://app.tavily.com) — free tier
- LangSmith — [smith.langchain.com](https://smith.langchain.com) — free tier

### Running Locally

```bash
# Terminal 1
docker run -p 6333:6333 qdrant/qdrant

# Terminal 2
nodemon index.js
```

Always start Qdrant before the server.

### Running with Docker Compose

```bash
docker-compose up
```

---

## Key Design Decisions

**No OpenAI dependency.** @xenova/transformers runs all-MiniLM-L6-v2 fully locally — zero cost, no API key. The tradeoff is flatter embedding geometry (MiniLM is distilled from a larger teacher model), which is why the score threshold is 0.05 rather than the typical 0.3 for cloud embeddings.

**pdf2json over pdf-parse and pdfjs-dist.** Both alternatives fail on Node.js v24 due to native dependency issues. pdf2json works reliably. A try/catch fallback on decodeURIComponent handles encoding artifacts in scanned PDFs.

**RRF over weighted score fusion.** Dense cosine similarity scores and BM25 TF-IDF scores have incompatible statistical distributions. A weighted sum of the two is mathematically unsound. RRF operates purely on rank position, making cross-list fusion meaningful.

**Grading node before generation.** Without a relevance gate, the LLM receives weak or irrelevant context and generates confident but hallucinated answers. The grading node is a hard quality check — if documents fail, the system corrects retrieval via web search rather than generating from noise.
