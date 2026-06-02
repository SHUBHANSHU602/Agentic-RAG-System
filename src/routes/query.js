const express = require('express');
const router = express.Router();
const { embed } = require('../embedder');
const { searchVectors } = require('../vectorStore');
const { chat } = require('../llm');

router.post('/', async (req, res) => {
  try {
    const { question } = req.body;

    if (!question || question.trim().length < 3) {
      return res.status(400).json({ error: 'Question must be at least 3 characters' });
    }

    // Step 1: embed the question
    const queryVec = await embed(question);

    // Step 2: search Qdrant for relevant docs
    const results = await searchVectors(queryVec, 4);
    const filteredResults = results.filter(r => r.score > 0.2);

   if (filteredResults.length === 0) {
   return res.json({ 
    answer: 'I could not find relevant information to answer your question.',
    sources: [] 
  });
}

    if (results.length === 0) {
      return res.json({ answer: 'No relevant documents found.', sources: [] });
    }

    // Step 3: build context from retrieved docs
    const context = filteredResults.map(r => r.payload.text).join('\n\n');

    // Step 4: generate answer with Groq
    const answer = await chat([
      { role: 'system', content: 'You are a helpful assistant. Answer the question using only the provided context. If the answer is not in the context, say you do not know.' },
      { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
    ]);

    res.json({
      answer,
      sources: filteredResults.map(r => ({
        text: r.payload.text,
        score: r.score.toFixed(4)
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;