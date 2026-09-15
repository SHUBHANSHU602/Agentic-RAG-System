require('dotenv').config();
const { ChatGroq } = require('@langchain/groq');

let model;

function getModel() {
  if (model) return model;

  const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_AI_KEY;
  if (!apiKey) {
    throw new Error('Missing GROQ_API_KEY in environment.');
  }

  model = new ChatGroq({
    apiKey,
    model: 'llama-3.3-70b-versatile',
    temperature: 0.1
  });

  return model;
}

// One shared LLM wrapper for retrieval expansion, routing, grading,
// generation, and reflection. Using the LangChain integration instead of
// calling the raw Groq SDK directly lets LangSmith trace LLM calls as child
// runs of the LangGraph execution when tracing is enabled.
async function chat(messages) {
  const response = await getModel().invoke(messages);

  if (typeof response.content === 'string') {
    return response.content;
  }

  // Some providers can return structured content blocks.
  return Array.isArray(response.content)
    ? response.content.map(block => block.text || '').join('')
    : String(response.content || '');
}

module.exports = { chat, getModel };
