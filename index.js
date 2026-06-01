require('dotenv').config();
const express = require('express');
const { createCollection } = require('./src/vectorStore');

const app = express();
app.use(express.json());

// Routes
app.use('/ingest', require('./src/routes/ingest'));
app.use('/query', require('./src/routes/query'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'agentic-rag running' });
});

const PORT = process.env.PORT || 3000;

async function start() {
  await createCollection(); // ensure Qdrant collection exists on startup
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch(console.error);