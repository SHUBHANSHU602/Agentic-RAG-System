const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const { randomUUID } = require('crypto');
const { ingestPdf } = require('../ingestion/ingestPdf');

const router = express.Router();
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

router.post(
  '/',
  express.raw({ type: 'application/pdf', limit: MAX_UPLOAD_BYTES }),
  async (req, res) => {
    let tempPath = null;

    try {
      const workspaceId = String(req.header('x-workspace-id') || '').trim();
      const originalName = path.basename(String(req.header('x-file-name') || 'document.pdf'));

      if (!workspaceId) {
        return res.status(400).json({ error: 'x-workspace-id header is required' });
      }

      if (!originalName.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'Only PDF files are supported' });
      }

      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Upload body is empty' });
      }

      const uploadDir = path.join(process.cwd(), '.uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      tempPath = path.join(uploadDir, `${randomUUID()}.pdf`);
      await fs.writeFile(tempPath, req.body);

      const result = await ingestPdf(tempPath, {
        sourceLabel: originalName,
        workspaceId
      });

      return res.status(201).json({
        status: 'ok',
        filename: originalName,
        ...result
      });
    } catch (err) {
      console.error('[upload error]', err.message);
      const status = err.type === 'entity.too.large' ? 413 : (err.statusCode || 500);
      return res.status(status).json({
        error: status === 413 ? 'PDF is too large. Maximum upload size is 20 MB.' : err.message
      });
    } finally {
      if (tempPath) {
        await fs.unlink(tempPath).catch(() => {});
      }
    }
  }
);

module.exports = router;
