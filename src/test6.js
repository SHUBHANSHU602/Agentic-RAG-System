require('dotenv').config();
const { ChatGroq } = require('@langchain/groq');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');

const llm = new ChatGroq({
  apiKey: process.env.GROQ_AI_KEY,
  model: 'llama-3.3-70b-versatile',
  temperature: 0.1
});

const prompt = PromptTemplate.fromTemplate(
  'Answer this question in 2 sentences: {question}'
);

const parser = new StringOutputParser();

// Chain: prompt → llm → parser
const chain = prompt.pipe(llm).pipe(parser);

async function run() {
  const answer = await chain.invoke({
    question: 'What is the difference between RAG and fine-tuning?'
  });
  console.log('Answer:', answer);
}

run().catch(console.error);