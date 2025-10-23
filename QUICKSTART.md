# Quick Start Guide - Gemini Agent Framework

This guide shows you how to immediately start using the extracted Gemini Agent
Framework.

## Prerequisites

- Node.js 20 or higher
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Step 1: Build the Framework

```bash
# Navigate to the framework package
cd packages/gemini-framework-core

# Install dependencies
npm install

# Build the framework
npm run build
```

## Step 2: Set Your API Key

```bash
export GEMINI_API_KEY="your-api-key-here"
```

## Step 3: Create a Test File

Create `test-framework.js`:

```javascript
import { AgentFramework } from './packages/gemini-framework-core/dist/index.js';

async function main() {
  console.log('🤖 Testing Gemini Framework\n');

  // Create framework instance
  const framework = await AgentFramework.create({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Test 1: Simple message
  console.log('Test 1: Simple Message');
  const response = await framework.sendMessage(
    'Say hello and introduce yourself in one sentence',
  );
  console.log('Response:', response);
  console.log('\n---\n');

  // Test 2: Chat session
  console.log('Test 2: Chat Session');
  const chat = await framework.createChat({
    systemPrompt: 'You are a helpful math tutor',
  });

  const q1 = await chat.send('What is 15 * 23?');
  console.log('Q: What is 15 * 23?');
  console.log('A:', q1);

  const q2 = await chat.send('Can you explain how you calculated that?');
  console.log('\nQ: Can you explain how you calculated that?');
  console.log('A:', q2);
  console.log('\n---\n');

  // Test 3: Streaming
  console.log('Test 3: Streaming Response');
  const streamChat = await framework.createChat();
  console.log('Prompt: Write a haiku about programming\n');
  console.log('Response: ');

  for await (const chunk of streamChat.sendStream(
    'Write a haiku about programming',
  )) {
    process.stdout.write(chunk);
  }

  console.log('\n\n✅ All tests passed!');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
```

## Step 4: Run the Test

```bash
node test-framework.js
```

You should see output like:

```
🤖 Testing Gemini Framework

Test 1: Simple Message
Response: Hello! I'm Gemini, a large language model created by Google.

---

Test 2: Chat Session
Q: What is 15 * 23?
A: 15 * 23 = 345

Q: Can you explain how you calculated that?
A: Sure! I multiplied 15 by 23 by breaking it down: (15 × 20) + (15 × 3) = 300 + 45 = 345

---

Test 3: Streaming Response
Prompt: Write a haiku about programming

Response:
Code flows like water
Debugging tests our patience
Coffee, our fuel, strong

✅ All tests passed!
```

## Step 5: Create Your First Agent

Create `my-agent.js`:

```javascript
import {
  AgentFramework,
  defineAgent,
  defineTool,
} from './packages/gemini-framework-core/dist/index.js';
import { z } from 'zod';

// Define a custom tool
const calculatorTool = defineTool({
  name: 'calculator',
  description: 'Performs basic arithmetic',
  parameters: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    console.log(`  🔧 Using calculator: ${a} ${operation} ${b}`);
    switch (operation) {
      case 'add':
        return { result: a + b };
      case 'subtract':
        return { result: a - b };
      case 'multiply':
        return { result: a * b };
      case 'divide':
        return { result: b !== 0 ? a / b : 'Error: Division by zero' };
    }
  },
});

// Define an agent
const mathAgent = defineAgent({
  name: 'math-tutor',
  description: 'A helpful math tutor agent',

  inputConfig: {
    inputs: {
      problem: {
        type: 'string',
        required: true,
        description: 'Math problem to solve',
      },
    },
  },

  promptConfig: {
    systemPrompt: 'You are a helpful math tutor. Solve problems step by step.',
    query: 'Solve this problem: ${problem}',
  },

  toolConfig: {
    tools: ['calculator'],
  },

  outputConfig: {
    outputName: 'solution',
    description: 'Solution to the problem',
    schema: z.object({
      answer: z.string(),
      steps: z.array(z.string()),
    }),
  },

  modelConfig: {
    model: 'gemini-2.0-flash-exp',
    temp: 0.7,
    top_p: 0.95,
  },

  runConfig: {
    max_time_minutes: 2,
    max_turns: 10,
  },
});

async function main() {
  console.log('🤖 Math Tutor Agent\n');

  // Create framework and register tool
  const framework = await AgentFramework.create({
    apiKey: process.env.GEMINI_API_KEY,
    tools: [calculatorTool],
  });

  // Run the agent
  console.log(
    'Problem: If I have 15 apples and buy 23 more, how many do I have?\n',
  );

  const result = await framework.runAgent(
    mathAgent,
    {
      problem: 'If I have 15 apples and buy 23 more, how many do I have?',
    },
    {
      onActivity: (activity) => {
        if (activity.type === 'TOOL_CALL_START') {
          console.log(`  📞 Agent calling tool: ${activity.data.toolName}`);
        }
      },
    },
  );

  console.log('\n📊 Result:');
  console.log('  Status:', result.terminate_reason);
  console.log('  Output:', result.result);

  try {
    const parsed = JSON.parse(result.result);
    console.log('\n✨ Solution:');
    console.log('  Answer:', parsed.solution?.answer || 'N/A');
    console.log('  Steps:');
    (parsed.solution?.steps || []).forEach((step, i) => {
      console.log(`    ${i + 1}. ${step}`);
    });
  } catch (e) {
    console.log('  (See raw output above)');
  }
}

main().catch(console.error);
```

Run it:

```bash
node my-agent.js
```

## What's Next?

Now that you've tested the framework:

1. **Explore the API**: Read
   [Framework README](./packages/gemini-framework-core/README.md)

2. **Learn the Architecture**: Read
   [FRAMEWORK_ANALYSIS.md](./FRAMEWORK_ANALYSIS.md)

3. **Build Something**: Create your own agents and tools!

## Common Use Cases

### 1. Chat Assistant

```javascript
const assistant = await framework.createChat({
  systemPrompt: 'You are a helpful customer service agent',
});

const response = await assistant.send(userQuestion);
```

### 2. Code Analyzer

```javascript
const codeAgent = defineAgent({
  name: 'code-analyzer',
  // ... configure to analyze code
  tools: ['read-file', 'grep'],
});
```

### 3. Research Assistant

```javascript
const researcher = defineAgent({
  name: 'researcher',
  // ... configure for research
  tools: ['web-search', 'web-fetch'],
});
```

### 4. Task Automation

```javascript
const automator = defineAgent({
  name: 'task-automator',
  // ... configure for automation
  tools: ['shell', 'write-file'],
});
```

## Troubleshooting

### "API key is required" error

- Make sure `GEMINI_API_KEY` environment variable is set
- Check that your API key is valid

### "Cannot find module" error

- Ensure you've run `npm install` in the framework directory
- Verify the import path is correct

### Build errors

- Check Node.js version (must be 20+)
- Try `rm -rf node_modules && npm install`
- Ensure TypeScript is installed

## Getting Help

- Read the [Framework Analysis](./FRAMEWORK_ANALYSIS.md)
- Check the [Transformation Summary](./TRANSFORMATION_SUMMARY.md)
- Explore [examples/simple-agent/](./examples/simple-agent/)

## Ready to Build!

You now have a working AI agent framework. Start building amazing agents! 🚀
