require('dotenv').config();
const { runAgenticRag } = require('./graph');

async function main() {
  const question = process.argv.slice(2).join(' ').trim();

  if (!question) {
    console.error('Usage: npm run graph:smoke -- "your question"');
    process.exitCode = 1;
    return;
  }

  const result = await runAgenticRag(question);

  console.log('\n=== Agentic RAG smoke result ===');
  console.log('queryType:', result.queryType);
  console.log('retrievalDecision:', result.retrievalDecision);
  console.log('webSearched:', result.webSearched);
  console.log('generations:', result.iterations);
  console.log('reflection:', result.reflection);
  console.log('\nAnswer:\n', result.answer);
}

main().catch(error => {
  console.error('[graph smoke error]', error);
  process.exitCode = 1;
});
