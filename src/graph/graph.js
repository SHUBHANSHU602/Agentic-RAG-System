const { StateGraph, START, END } = require('@langchain/langgraph');
const { GraphState } = require('./state');
const { routerNode, routeAfterRouter } = require('./nodes/router');
const { retrieveNode } = require('./nodes/retrieve');
const { gradeNode, routeAfterGrade } = require('./nodes/grade');
const { webSearchNode } = require('./nodes/webSearch');
const { generateNode } = require('./nodes/generate');
const { summarizeNode } = require('./nodes/summarize');
const { reflectNode, routeAfterReflection } = require('./nodes/reflect');

const workflow = new StateGraph(GraphState)
  .addNode('router', routerNode)
  .addNode('retrieve', retrieveNode)
  .addNode('grade', gradeNode)
  .addNode('webSearch', webSearchNode)
  .addNode('generate', generateNode)
  .addNode('summarize', summarizeNode)
  .addNode('reflect', reflectNode)
  .addEdge(START, 'router')
  .addConditionalEdges('router', routeAfterRouter, ['retrieve', 'summarize', 'webSearch'])
  .addEdge('retrieve', 'grade')
  .addConditionalEdges('grade', routeAfterGrade, ['generate', 'webSearch'])
  .addEdge('webSearch', 'generate')
  .addEdge('generate', 'reflect')
  .addEdge('summarize', 'reflect')
  .addConditionalEdges('reflect', routeAfterReflection, ['generate', 'summarize', END]);

const agenticRagGraph = workflow.compile();

async function runAgenticRag(question, options = {}) {
  return agenticRagGraph.invoke({
    question,
    workspaceId: options.workspaceId || null,
    documentId: options.documentId || null,
    documentSource: options.documentSource || null,
    queryType: 'factual',
    routeReason: '',
    documents: [],
    webResults: [],
    contextSources: [],
    retrievalDecision: null,
    gradeReason: '',
    answer: '',
    reflection: null,
    reflectionFeedback: '',
    iterations: 0,
    webSearched: false,
    webSearchError: null
  });
}

module.exports = { agenticRagGraph, runAgenticRag };
