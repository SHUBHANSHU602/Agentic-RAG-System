const express = require('express');
const router = express.Router();
const { embed } = require('../embedder');
const { storeVector } = require('../vectorStore');

router.post('/', async (req, res) => {
  try {
    const { documents } = req.body;
    // documents = array of { id, text }

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({ error: 'Send { documents: [{ id, text }] }' });
    }

    let stored = 0;
    for (const doc of documents) {
      const vector = await embed(doc.text);
      await storeVector(doc.id, doc.text, vector);
      stored++;
    }

    res.json({ status: 'ok', stored });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Ingestion failed' });
  }
});

module.exports = router;