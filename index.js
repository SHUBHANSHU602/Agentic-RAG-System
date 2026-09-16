require('dotenv').config();
const path = require('path');
const express = require('express');
const { createCollection } = require('./src/vectorStore');

const app = express();
app.use(express.json());

// Browser upload endpoint consumes raw application/pdf bodies.
app.use('/upload', require('./src/routes/upload'));

// Existing APIs.
app.use('/ingest', require('./src/routes/ingest'));
app.use('/query', require('./src/routes/query'));
app.use('/benchmark', require('./src/routes/benchmark'));
app.use('/debug', require('./src/routes/debug'));

// Same-origin UI keeps frontend/backend configuration simple and avoids CORS drift.
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'agentic-rag running' });
});

const PORT = process.env.PORT || 3000;

async function start() {
  await createCollection();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Agentic RAG UI: http://localhost:${PORT}`);
  });
}

start().catch(console.error);
