const { StateGraph, START, END } = require('@langchain/langgraph');
const { GraphState } = require('./state');
const { routerNode, routeAfterRouter } = require('./nodes/router');
const { retrieveNode } = require('./nodes/retrieve');
const { gradeNode, routeAfterGrade } = require('./nodes/grade');
const { webSearchNode } = require('./nodes/webSearch');
const { generateNode } = require('./nodes/generate');
const { reflectNode, routeAfterReflection } = require('./nodes/reflect');

const workflow = new StateGraph(GraphState)
  .addNode('router', routerNode)
  .addNode('retrieve', retrieveNode)
  .addNode('grade', gradeNode)
  .addNode('webSearch', webSearchNode)
  .addNode('generate', generateNode)
  .addNode('reflect', reflectNode)
  .addEdge(START, 'router')
  .addConditionalEdges('router', routeAfterRouter, ['retrieve', 'webSearch'])
  .addEdge('retrieve', 'grade')
  .addConditionalEdges('grade', routeAfterGrade, ['generate', 'webSearch'])
  .addEdge('webSearch', 'generate')
  .addEdge('generate', 'reflect')
  .addConditionalEdges('reflect', routeAfterReflection, ['generate', END]);

const agenticRagGraph = workflow.compile();

async function runAgenticRag(question) {
  return agenticRagGraph.invoke({
    question,
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
