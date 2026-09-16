const express = require('express');
const router = express.Router();
const { runAgenticRag } = require('../graph/graph');

router.post('/', async (req, res) => {
  try {
    const {
      question,
      workspaceId = null,
      documentId = null,
      documentSource = null
    } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question must be a non-empty string' });
    }

    const trimmed = question.trim();
    if (trimmed.length < 3) {
      return res.status(400).json({ error: 'question must be at least 3 characters' });
    }
    if (trimmed.length > 1000) {
      return res.status(400).json({ error: 'question too long — max 1000 characters' });
    }

    for (const [name, value] of Object.entries({ workspaceId, documentId, documentSource })) {
      if (value !== null && typeof value !== 'string') {
        return res.status(400).json({ error: `${name} must be a string when provided` });
      }
    }

    const state = await runAgenticRag(trimmed, {
      workspaceId: workspaceId || null,
      documentId: documentId || null,
      documentSource: documentSource || null
    });

    const documentSources = (state.documents || []).map(result => ({
      type: 'document',
      childText: result?.payload?.text || null,
      parentText: result?.payload?.parentText?.slice(0, 250) || null,
      rerankScore: Number((result.rerankScore ?? result.rrfScore ?? result.score ?? 0).toFixed(4)),
      parentIndex: result?.payload?.parentIndex ?? null,
      source: result?.payload?.source ?? null
    }));

    const summarySources = state.queryType === 'document_summary'
      ? (state.contextSources || []).slice(0, 8).map(source => ({
          type: 'document',
          source: source.label || documentSource || 'Selected document',
          parentText: (source.text || '').slice(0, 250)
        }))
      : [];

    const webSources = (state.webResults || []).map(result => ({
      type: 'web',
      title: result.title,
      url: result.url,
      score: result.score,
      preview: result.content?.slice(0, 250) || null
    }));

    const usedSources = state.queryType === 'document_summary'
      ? summarySources
      : state.retrievalDecision === 'not_relevant'
        ? webSources
        : state.queryType === 'web_current'
          ? webSources
          : [...documentSources, ...webSources];

    return res.status(200).json({
      answer: state.answer,
      route: {
        queryType: state.queryType,
        reason: state.routeReason,
        retrievalDecision: state.retrievalDecision,
        gradeReason: state.gradeReason,
        webSearched: state.webSearched,
        webSearchError: state.webSearchError,
        generations: state.iterations,
        reflection: state.reflection,
        reflectionFeedback: state.reflectionFeedback
      },
      retrieved: state.queryType === 'document_summary' ? summarySources.length : documentSources.length,
      sources: usedSources
    });
  } catch (err) {
    console.error('[query error]', err);

    const message = String(err?.message || '');
    if (message.includes('429')) {
      return res.status(429).json({ error: 'An upstream AI service is rate-limited. Please retry shortly.' });
    }

    return res.status(500).json({ error: 'Agentic query pipeline failed. Check server logs.' });
  }
});

module.exports = router;
