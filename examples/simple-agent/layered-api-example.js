/**
 * Example: Using Different Layers of the Gemini Framework
 * 
 * This example demonstrates how to use the framework at different abstraction levels.
 */

import { AgentFramework, defineAgent, defineTool } from '@gemini-framework/core';
import { z } from 'zod';

async function main() {
  console.log('🚀 Gemini Framework - Layered API Examples\n');

  // Initialize framework
  const framework = await AgentFramework.create({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // ============================================
  // LAYER 0: Direct LLM Client Access
  // ============================================
  console.log('📍 Layer 0: Direct LLM Client Access');
  console.log('For advanced users who need full SDK control\n');

  const client = framework.getLLMClient();
  const models = framework.getModels();

  // Direct API call with full control
  const directResponse = await models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: [{ role: 'user', parts: [{ text: 'Say hello in one word' }] }],
    config: {
      temperature: 0.5,
      maxOutputTokens: 10,
    },
  });

  console.log('Direct API Response:', directResponse.text);
  console.log('');

  // ============================================
  // LAYER 1: Simplified LLM Operations
  // ============================================
  console.log('📍 Layer 1: Simplified LLM Operations');
  console.log('For users building custom LLM applications\n');

  // Simple generate with retry
  const simpleResponse = await framework.generate({
    prompt: 'Explain AI in exactly 10 words',
    temperature: 0.7,
    maxOutputTokens: 20,
    retries: 2,
  });
  console.log('Simple Generate:', simpleResponse);

  // Streaming generation
  console.log('\nStreaming Generate:');
  process.stdout.write('Response: ');
  for await (const chunk of framework.generateStream({
    prompt: 'Count from 1 to 5',
    temperature: 0.1,
  })) {
    process.stdout.write(chunk);
  }
  console.log('\n');

  // Token counting
  const tokenCount = await framework.countTokens({
    contents: 'This is a test prompt for token counting',
  });
  console.log('Token Count:', tokenCount);

  // Batch generation
  console.log('\nBatch Generation:');
  const batchResults = await framework.generateBatch({
    requests: [
      { prompt: 'Capital of France?', maxOutputTokens: 10 },
      { prompt: 'Capital of Germany?', maxOutputTokens: 10 },
      { prompt: 'Capital of Italy?', maxOutputTokens: 10 },
    ],
    concurrency: 2,
  });
  console.log('Batch Results:', batchResults);
  console.log('');

  // ============================================
  // LAYER 2: Conversation Management
  // ============================================
  console.log('📍 Layer 2: Conversation Management');
  console.log('For building chatbots and conversational apps\n');

  const chat = await framework.createChat({
    model: 'gemini-2.0-flash-exp',
    systemPrompt: 'You are a helpful assistant. Be concise.',
    temperature: 0.7,
  });

  const q1 = await chat.send('What is 2+2?');
  console.log('Q1: What is 2+2?');
  console.log('A1:', q1);

  const q2 = await chat.send('What about that number times 3?');
  console.log('\nQ2: What about that number times 3?');
  console.log('A2:', q2);

  console.log('\nChat History:', chat.getHistory().length, 'messages');
  console.log('');

  // ============================================
  // LAYER 3: Agent Execution (Agentic Loop)
  // ============================================
  console.log('📍 Layer 3: Agent Execution');
  console.log('For building autonomous agents with tools\n');

  // Define a simple calculator tool
  const calculator = defineTool({
    name: 'calculate',
    description: 'Performs basic arithmetic operations',
    parameters: z.object({
      operation: z.enum(['add', 'multiply']).describe('The operation to perform'),
      a: z.number().describe('First number'),
      b: z.number().describe('Second number'),
    }),
    execute: async ({ operation, a, b }) => {
      console.log(`  🔧 Tool called: ${operation}(${a}, ${b})`);
      if (operation === 'add') return { result: a + b };
      return { result: a * b };
    },
  });

  framework.registerTool(calculator);

  // Define an agent that uses tools
  const mathAgent = defineAgent({
    name: 'math-helper',
    description: 'Solves math problems using tools',

    inputConfig: {
      inputs: {
        problem: {
          type: 'string',
          required: true,
          description: 'The math problem to solve',
        },
      },
    },

    promptConfig: {
      systemPrompt:
        'You are a math helper. Use the calculate tool to solve problems. Be precise.',
      query: 'Solve this problem: ${problem}',
    },

    toolConfig: {
      tools: ['calculate'],
    },

    outputConfig: {
      outputName: 'solution',
      description: 'The solution to the problem',
      schema: z.object({
        answer: z.number().describe('The final answer'),
        explanation: z.string().describe('How you solved it'),
      }),
    },

    modelConfig: {
      model: 'gemini-2.0-flash-exp',
      temp: 0.2,
      top_p: 0.95,
    },

    runConfig: {
      max_time_minutes: 2,
      max_turns: 10,
    },
  });

  console.log('Running agent: Solve 15 + 27, then multiply by 3\n');

  const agentResult = await framework.runAgent(
    mathAgent,
    {
      problem: 'What is 15 plus 27, then multiply that result by 3?',
    },
    {
      onActivity: (activity) => {
        if (activity.type === 'TOOL_CALL_START') {
          console.log(`  📞 Calling tool: ${activity.data.toolName}`);
        }
      },
    }
  );

  console.log('\nAgent Result:');
  console.log('  Status:', agentResult.terminate_reason);
  console.log('  Output:', agentResult.result);

  try {
    const parsed = JSON.parse(agentResult.result);
    console.log('\n  Structured Output:');
    console.log('    Answer:', parsed.solution?.answer);
    console.log('    Explanation:', parsed.solution?.explanation);
  } catch (e) {
    // Raw output
  }

  console.log('');

  // ============================================
  // Summary
  // ============================================
  console.log('✅ All layers demonstrated successfully!\n');
  console.log('Key Takeaways:');
  console.log('  • Layer 0: Full control over SDK for advanced use cases');
  console.log('  • Layer 1: Simple operations for quick LLM integration');
  console.log('  • Layer 2: Conversation management for chatbots');
  console.log('  • Layer 3: Autonomous agents with tools');
  console.log('\nChoose the layer that fits your needs! 🎯');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}
