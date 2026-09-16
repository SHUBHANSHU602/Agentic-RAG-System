const express = require('express');
const router = express.Router();
const { ingestPdf } = require('../ingestion/ingestPdf');

router.post('/', async (req, res) => {
  try {
    const { filePath, workspaceId = null } = req.body;

    if (!filePath) {
      return res.status(400).json({ error: 'Send { filePath: "path/to/file.pdf" }' });
    }

    const result = await ingestPdf(filePath, { workspaceId });
    res.json({ status: 'ok', ...result });
  } catch (err) {
    console.error('[ingest error]', err.message);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
