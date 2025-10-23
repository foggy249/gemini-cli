/**
 * Simple chat example using Gemini Framework
 */

/* eslint-env node */
/* eslint-disable no-console */

import { AgentFramework } from '@gemini-framework/core';

async function main() {
  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY environment variable is required');
    console.error('Get your API key from: https://aistudio.google.com/apikey');
    process.exit(1);
  }

  console.log('🤖 Gemini Chat Example\n');

  // Create framework
  const framework = await AgentFramework.create({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Example 1: Single message
  console.log('📝 Example 1: Single Message');
  console.log('Question: What is the capital of France?\n');
  
  const response = await framework.sendMessage(
    'What is the capital of France? Answer in one sentence.'
  );
  
  console.log('Answer:', response);
  console.log('\n---\n');

  // Example 2: Chat session with context
  console.log('📝 Example 2: Chat Session with Context');
  
  const chat = await framework.createChat({
    model: 'gemini-2.0-flash-exp',
    systemPrompt: 'You are a helpful coding assistant. Provide concise answers.',
  });

  console.log('User: Explain what a Promise is in JavaScript\n');
  const reply1 = await chat.send('Explain what a Promise is in JavaScript in 2 sentences.');
  console.log('Assistant:', reply1);
  console.log();

  console.log('User: Give me a simple example\n');
  const reply2 = await chat.send('Give me a simple code example.');
  console.log('Assistant:', reply2);
  console.log('\n---\n');

  // Example 3: Streaming response
  console.log('📝 Example 3: Streaming Response');
  console.log('Question: Tell me a short story about a robot\n');
  console.log('Assistant: ');
  
  const streamChat = await framework.createChat();
  for await (const chunk of streamChat.sendStream('Tell me a very short story about a robot in 3 sentences.')) {
    process.stdout.write(chunk);
  }
  
  console.log('\n\n✅ Examples completed!');
}

main().catch(console.error);
