const { END } = require('@langchain/langgraph');
const { chat } = require('../../llm');

async function reflectNode(state) {
  const sources = state.contextSources || [];

  if (sources.length === 0) {
    return {
      reflection: 'pass',
      reflectionFeedback: 'No reliable context was available, so the system returned an explicit limitation instead of hallucinating.'
    };
  }

  const context = sources
    .map((source, index) => `[Source ${index + 1}]\n${(source.text || '').slice(0, 2500)}`)
    .join('\n\n');

  const raw = await chat([
    {
      role: 'system',
      content: `You are the reflection node in a Self-RAG-style workflow.
Evaluate the answer on two dimensions:
1. faithfulness: every factual claim must be supported by the supplied context.
2. completeness: the answer should address the user's actual question with the important available details.
Return exactly one JSON object:
{"decision":"pass|retry","faithful":true|false,"complete":true|false,"feedback":"specific short feedback"}
Choose retry when either faithfulness or completeness is materially weak.`
    },
    {
      role: 'user',
      content: `Question:\n${state.question}\n\nContext:\n${context}\n\nAnswer:\n${state.answer}`
    }
  ]);

  let parsed;
  try {
    parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
  } catch {
    parsed = {
      decision: 'pass',
      feedback: 'Reflection output was not parseable; ending the loop to avoid uncontrolled regeneration.'
    };
  }

  return {
    reflection: parsed.decision === 'retry' ? 'retry' : 'pass',
    reflectionFeedback: parsed.feedback || 'No reflection feedback provided.'
  };
}

function routeAfterReflection(state) {
  if ((state.iterations || 0) >= 2) return END;
  return state.reflection === 'retry' ? 'generate' : END;
}

module.exports = { reflectNode, routeAfterReflection };
