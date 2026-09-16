const { chat } = require('../../llm');
const { getDocumentParents } = require('../../vectorStore');

async function summarizeNode(state) {
  const nextIteration = (state.iterations || 0) + 1;

  if (!state.workspaceId || (!state.documentId && !state.documentSource)) {
    return {
      answer: 'Select an uploaded PDF before asking for a whole-document summary.',
      contextSources: [],
      iterations: nextIteration,
      retrievalDecision: 'document_summary'
    };
  }

  const parents = await getDocumentParents({
    workspaceId: state.workspaceId,
    documentId: state.documentId,
    source: state.documentSource
  });

  if (!parents.length) {
    return {
      answer: 'I could not find the selected document in this workspace. Re-upload it and try again.',
      contextSources: [],
      iterations: nextIteration,
      retrievalDecision: 'document_summary'
    };
  }

  // Map-reduce summarization keeps large PDFs within model context limits while
  // still covering the whole selected document instead of semantic top-K hits.
  const groups = [];
  let current = [];
  let currentChars = 0;
  const GROUP_CHAR_LIMIT = 12000;

  for (const parent of parents) {
    if (current.length && currentChars + parent.text.length > GROUP_CHAR_LIMIT) {
      groups.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(parent);
    currentChars += parent.text.length;
  }
  if (current.length) groups.push(current);

  const partialSummaries = [];
  for (let i = 0; i < groups.length; i++) {
    const text = groups[i].map(item => item.text).join('\n\n');
    const partial = await chat([
      {
        role: 'system',
        content: `Summarize this section of a user-uploaded PDF faithfully. Preserve the document's own terminology and important structure. Do not add outside facts. Capture key concepts, definitions, examples, procedures, warnings, and conclusions that appear in the text.`
      },
      {
        role: 'user',
        content: `Document section ${i + 1}/${groups.length}:\n\n${text}`
      }
    ]);
    partialSummaries.push(partial);
  }

  const feedback = state.reflectionFeedback
    ? `\nPrevious reflection feedback to address:\n${state.reflectionFeedback}\n`
    : '';

  const answer = await chat([
    {
      role: 'system',
      content: `Create a coherent summary of the selected PDF using only the supplied section summaries. Do not introduce outside knowledge. Organize the answer so a reader can understand the document's main topics and important details.`
    },
    {
      role: 'user',
      content: `User request: ${state.question}${feedback}\n\nSection summaries:\n\n${partialSummaries.map((s, i) => `Section ${i + 1}:\n${s}`).join('\n\n')}`
    }
  ]);

  return {
    answer,
    iterations: nextIteration,
    retrievalDecision: 'document_summary',
    gradeReason: `Whole-document summary used ${parents.length} parent chunks from the selected PDF.`,
    webSearched: false,
    webSearchError: null,
    contextSources: parents.map(parent => ({
      kind: 'document',
      label: parent.source,
      text: parent.text
    }))
  };
}

module.exports = { summarizeNode };
