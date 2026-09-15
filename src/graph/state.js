const { Annotation } = require('@langchain/langgraph');

// Shared state that moves through every LangGraph node.
// Nodes return partial updates; LangGraph merges those updates into this state.
const GraphState = Annotation.Root({
  question: Annotation(),
  queryType: Annotation(),
  routeReason: Annotation(),
  documents: Annotation(),
  webResults: Annotation(),
  contextSources: Annotation(),
  retrievalDecision: Annotation(),
  gradeReason: Annotation(),
  answer: Annotation(),
  reflection: Annotation(),
  reflectionFeedback: Annotation(),
  iterations: Annotation(),
  webSearched: Annotation(),
  webSearchError: Annotation()
});

module.exports = { GraphState };
