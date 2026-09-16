require('dotenv').config();
const { StateGraph, START, END } = require('@langchain/langgraph');
const { GraphState } = require('./state');
const { generateNode } = require('./nodes/generate');
const { reflectNode, routeAfterReflection } = require('./nodes/reflect');

const sourceText = `
Array rotation means shifting elements of an array circularly by k positions.
For a right rotation of [1,2,3,4,5] by k=2, the result is [4,5,1,2,3].
For a left rotation of [1,2,3,4,5] by k=2, the result is [3,4,5,1,2].
The effective rotation can be reduced with k = k mod n.
`;

function deliberatelyBadAnswerNode() {
  const badAnswer = 'Array rotation means sorting the array in ascending order. The value of k is ignored, and rotating [1,2,3,4,5] by 2 keeps it unchanged.';

  console.log('\n[reflection smoke] injected deliberately bad first answer:');
  console.log(badAnswer);

  return {
    answer: badAnswer,
    iterations: 1,
    contextSources: [
      {
        kind: 'document',
        label: 'reflection-smoke-source',
        text: sourceText
      }
    ]
  };
}

async function loggedReflectNode(state) {
  const result = await reflectNode(state);
  console.log(`\n[reflection smoke] reflection after generation ${state.iterations}: ${result.reflection}`);
  console.log(`[reflection smoke] feedback: ${result.reflectionFeedback}`);
  return result;
}

const reflectionWorkflow = new StateGraph(GraphState)
  .addNode('badAnswer', deliberatelyBadAnswerNode)
  .addNode('reflect', loggedReflectNode)
  .addNode('generate', generateNode)
  .addEdge(START, 'badAnswer')
  .addEdge('badAnswer', 'reflect')
  .addConditionalEdges('reflect', routeAfterReflection, ['generate', END])
  .addEdge('generate', 'reflect');

const reflectionGraph = reflectionWorkflow.compile();

async function main() {
  try {
    const result = await reflectionGraph.invoke({
      question: 'How does array rotation work?',
      queryType: 'factual',
      routeReason: 'deterministic reflection smoke test',
      documents: [
        {
          payload: {
            source: 'reflection-smoke-source',
            parentText: sourceText,
            text: sourceText,
            parentIndex: 0
          }
        }
      ],
      webResults: [],
      contextSources: [],
      retrievalDecision: 'relevant',
      gradeReason: 'test context is intentionally relevant',
      answer: '',
      reflection: null,
      reflectionFeedback: '',
      iterations: 0,
      webSearched: false,
      webSearchError: null
    });

    console.log('\n=== Reflection regeneration smoke result ===');
    console.log(`generations: ${result.iterations}`);
    console.log(`final reflection: ${result.reflection}`);
    console.log('\nFinal answer:\n', result.answer);

    if (result.iterations !== 2) {
      throw new Error(`Expected exactly 2 generations, got ${result.iterations}`);
    }

    console.log('\nPASS: bad first answer was rejected and regeneration path executed.');
  } catch (error) {
    console.error('[reflection smoke error]', error);
    process.exitCode = 1;
  }
}

main();
