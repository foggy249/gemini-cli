# Gemini Framework - Complete Usage Guide

## Overview

The Gemini Agent Framework (`@gemini-framework/core`) provides a lightweight, type-safe way to build AI agents and chat applications using Google's Gemini API. This guide covers everything you need to get started and build sophisticated AI applications.

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Quick Start Examples](#quick-start-examples)
3. [Core Concepts](#core-concepts)
4. [API Reference](#api-reference)
5. [Building Agents](#building-agents)
6. [Custom Tools](#custom-tools)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Installation & Setup

### Prerequisites

- Node.js 20 or higher
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Installation

```bash
# From the repository root
cd packages/gemini-framework-core
npm install
npm run build
```

### Set Up API Key

```bash
export GEMINI_API_KEY="your-api-key-here"
```

Or pass it programmatically:

```typescript
const framework = await AgentFramework.create({
  apiKey: 'your-api-key-here'
});
```

---

## Quick Start Examples

### 1. Simple Chat

```typescript
import { AgentFramework } from '@gemini-framework/core';

async function simpleChat() {
  // Create framework instance
  const framework = await AgentFramework.create({
    apiKey: process.env.GEMINI_API_KEY
  });

  // Send a single message
  const response = await framework.sendMessage(
    'Explain quantum computing in one paragraph'
  );
  
  console.log(response);
}

simpleChat();
```

### 2. Chat with Context

```typescript
import { AgentFramework } from '@gemini-framework/core';

async function chatWithContext() {
  const framework = await AgentFramework.create({
    apiKey: process.env.GEMINI_API_KEY
  });

  // Create a chat session
  const chat = await framework.createChat({
    model: 'gemini-2.0-flash-exp',
    systemPrompt: 'You are a helpful coding tutor who explains concepts clearly',
    temperature: 0.7
  });

  // Have a conversation
  const q1 = await chat.send('What is a closure in JavaScript?');
  console.log('Q1:', q1);

  const q2 = await chat.send('Can you give me a practical example?');
  console.log('Q2:', q2);

  // View conversation history
  console.log('History:', chat.getHistory());
}

chatWithContext();
```

### 3. Streaming Responses

```typescript
import { AgentFramework } from '@gemini-framework/core';

async function streamingChat() {
  const framework = await AgentFramework.create({
    apiKey: process.env.GEMINI_API_KEY
  });

  const chat = await framework.createChat();

  console.log('Streaming response:');
  for await (const chunk of chat.sendStream('Write a short poem about AI')) {
    process.stdout.write(chunk);
  }
  console.log('\n');
}

streamingChat();
```

---

## Core Concepts

### 1. Framework Instance

The `AgentFramework` is the main entry point. It manages:
- API client configuration
- Tool registry
- Agent execution

```typescript
const framework = await AgentFramework.create({
  apiKey: string,           // Required (or via env var)
  model?: string,          // Default model
  tools?: ToolDefinition[], // Pre-register tools
});
```

### 2. Chat Sessions

Chat sessions maintain conversation history and context:

```typescript
const chat = await framework.createChat({
  model?: string,          // Model to use
  systemPrompt?: string,   // System instructions
  temperature?: number,    // Randomness (0-1)
  topP?: number,          // Nucleus sampling
});
```

### 3. Agents

Agents are autonomous entities that:
- Follow system instructions
- Use tools to accomplish tasks
- Return structured output

```typescript
const agent = defineAgent({
  name: string,            // Unique identifier
  description: string,     // What the agent does
  inputConfig: {...},      // Expected inputs
  promptConfig: {...},     // Instructions & prompts
  toolConfig?: {...},      // Available tools
  outputConfig?: {...},    // Structured output schema
  modelConfig: {...},      // Model parameters
  runConfig: {...}         // Runtime limits
});
```

### 4. Tools

Tools extend agent capabilities:

```typescript
const tool = defineTool({
  name: string,
  description: string,
  parameters: ZodSchema,   // Input validation
  execute: async (params) => {...}  // Implementation
});
```

---

## API Reference

### AgentFramework

#### Static Methods

**`AgentFramework.create(config)`**
- Creates and initializes a framework instance
- Returns: `Promise<AgentFramework>`

#### Instance Methods

**`framework.sendMessage(message, options?)`**
- Send a one-off message
- Returns: `Promise<string>`

**`framework.createChat(config)`**
- Create a new chat session
- Returns: `Promise<Chat>`

**`framework.runAgent(definition, inputs, options?)`**
- Execute an agent
- Returns: `Promise<OutputObject>`

**`framework.registerTool(tool)`**
- Register a tool for use by agents
- Returns: `void`

**`framework.getTool(name)`**
- Get a registered tool by name
- Returns: `ToolDefinition | undefined`

**`framework.listTools()`**
- List all registered tool names
- Returns: `string[]`

### Chat

**`chat.send(message)`**
- Send a message and get response
- Returns: `Promise<string>`

**`chat.sendStream(message)`**
- Send a message and stream response
- Returns: `AsyncIterable<string>`

**`chat.getHistory()`**
- Get conversation history
- Returns: `ChatMessage[]`

### Types

```typescript
interface FrameworkConfig {
  apiKey?: string;
  model?: string;
  tools?: ToolDefinition[];
}

interface ChatConfig {
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
}

interface AgentDefinition<TOutput> {
  name: string;
  description: string;
  inputConfig: InputConfig;
  promptConfig: PromptConfig;
  modelConfig: ModelConfig;
  runConfig: RunConfig;
  toolConfig?: ToolConfig;
  outputConfig?: OutputConfig<TOutput>;
  processOutput?: (output: TOutput) => string;
}

interface ToolDefinition<TParams, TResult> {
  name: string;
  description: string;
  parameters: z.ZodType<TParams>;
  execute: (params: TParams, signal?: AbortSignal) => Promise<TResult>;
}
```

---

## Building Agents

### Basic Agent

```typescript
import { AgentFramework, defineAgent } from '@gemini-framework/core';
import { z } from 'zod';

const summarizer = defineAgent({
  name: 'text-summarizer',
  description: 'Summarizes long text into key points',
  
  inputConfig: {
    inputs: {
      text: {
        type: 'string',
        required: true,
        description: 'Text to summarize'
      },
      maxPoints: {
        type: 'number',
        required: false,
        description: 'Maximum number of points'
      }
    }
  },
  
  promptConfig: {
    systemPrompt: 'You are an expert at extracting key points from text.',
    query: 'Summarize this text into ${maxPoints} key points:\n\n${text}'
  },
  
  outputConfig: {
    outputName: 'summary',
    description: 'Summary with key points',
    schema: z.object({
      points: z.array(z.string()),
      mainTheme: z.string()
    })
  },
  
  modelConfig: {
    model: 'gemini-2.0-flash-exp',
    temp: 0.3,  // Lower for more focused output
    top_p: 0.9
  },
  
  runConfig: {
    max_time_minutes: 2,
    max_turns: 10
  }
});

// Run the agent
const framework = await AgentFramework.create({
  apiKey: process.env.GEMINI_API_KEY
});

const result = await framework.runAgent(summarizer, {
  text: 'Long text here...',
  maxPoints: 5
});

console.log(result);
```

### Agent with Tools

```typescript
import { defineTool } from '@gemini-framework/core';
import { z } from 'zod';

// Define a calculator tool
const calculator = defineTool({
  name: 'calculate',
  description: 'Performs arithmetic calculations',
  parameters: z.object({
    expression: z.string().describe('Mathematical expression to evaluate')
  }),
  execute: async ({ expression }) => {
    // Safe evaluation (in production, use a proper math library)
    try {
      const result = eval(expression);
      return { result, expression };
    } catch (error) {
      throw new Error(`Invalid expression: ${expression}`);
    }
  }
});

// Register the tool
framework.registerTool(calculator);

// Define agent that uses the tool
const mathAgent = defineAgent({
  name: 'math-helper',
  description: 'Solves math problems',
  
  inputConfig: {
    inputs: {
      problem: { type: 'string', required: true, description: 'Math problem' }
    }
  },
  
  promptConfig: {
    systemPrompt: 'You are a math tutor. Use the calculator tool for computations.',
    query: 'Solve: ${problem}'
  },
  
  toolConfig: {
    tools: ['calculate']  // Reference registered tool
  },
  
  outputConfig: {
    outputName: 'solution',
    schema: z.object({
      answer: z.string(),
      steps: z.array(z.string())
    })
  },
  
  modelConfig: { model: 'gemini-2.0-flash-exp', temp: 0.2, top_p: 0.9 },
  runConfig: { max_time_minutes: 3, max_turns: 15 }
});

// Run with monitoring
const result = await framework.runAgent(mathAgent, 
  { problem: 'What is 15 * 23 + 47?' },
  {
    onActivity: (activity) => {
      console.log(`[${activity.type}]`, activity.data);
    }
  }
);
```

---

## Custom Tools

### File Reader Tool

```typescript
import { defineTool } from '@gemini-framework/core';
import { z } from 'zod';
import { readFile } from 'fs/promises';

const fileReader = defineTool({
  name: 'read-file',
  description: 'Reads content from a file',
  
  parameters: z.object({
    path: z.string().describe('File path to read'),
    encoding: z.enum(['utf8', 'base64']).default('utf8')
  }),
  
  execute: async ({ path, encoding }) => {
    try {
      const content = await readFile(path, encoding);
      return {
        path,
        content,
        size: content.length
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }
});
```

### HTTP Request Tool

```typescript
const httpGet = defineTool({
  name: 'http-get',
  description: 'Makes HTTP GET request',
  
  parameters: z.object({
    url: z.string().url(),
    headers: z.record(z.string()).optional()
  }),
  
  execute: async ({ url, headers }) => {
    const response = await fetch(url, { headers });
    const data = await response.text();
    
    return {
      status: response.status,
      data,
      headers: Object.fromEntries(response.headers)
    };
  }
});
```

### Database Query Tool

```typescript
const dbQuery = defineTool({
  name: 'query-database',
  description: 'Executes SQL query (read-only)',
  
  parameters: z.object({
    query: z.string().describe('SELECT query to execute'),
    params: z.array(z.any()).optional()
  }),
  
  execute: async ({ query, params }) => {
    // Validate it's a SELECT query
    if (!query.trim().toUpperCase().startsWith('SELECT')) {
      throw new Error('Only SELECT queries allowed');
    }
    
    // Execute query (pseudo-code)
    const results = await db.execute(query, params);
    return {
      rows: results,
      count: results.length
    };
  }
});
```

---

## Best Practices

### 1. API Key Management

✅ **DO**:
- Use environment variables
- Use secure key storage (e.g., AWS Secrets Manager)
- Rotate keys regularly

❌ **DON'T**:
- Hard-code keys in source
- Commit keys to version control
- Share keys in plain text

### 2. Error Handling

```typescript
async function robustAgentCall() {
  try {
    const result = await framework.runAgent(agent, inputs, {
      signal: AbortSignal.timeout(30000)  // 30 second timeout
    });
    
    if (result.terminate_reason !== AgentTerminateMode.GOAL) {
      console.warn(`Agent didn't complete normally: ${result.terminate_reason}`);
    }
    
    return result;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Request timed out');
    } else if (error.message.includes('quota')) {
      console.error('API quota exceeded');
    } else {
      console.error('Unexpected error:', error);
    }
    throw error;
  }
}
```

### 3. Tool Safety

- Validate all inputs thoroughly
- Implement rate limiting
- Add timeouts
- Log tool usage
- Use AbortSignal for cancellation

```typescript
const safeTool = defineTool({
  name: 'safe-tool',
  description: 'Example of safe tool implementation',
  
  parameters: z.object({
    input: z.string().max(1000)  // Limit input size
  }),
  
  execute: async ({ input }, signal) => {
    // Check if cancelled
    if (signal?.aborted) {
      throw new Error('Operation cancelled');
    }
    
    // Implement timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 5000)
    );
    
    const workPromise = doWork(input);
    
    return Promise.race([workPromise, timeoutPromise]);
  }
});
```

### 4. Token Management

- Use appropriate models (Flash for speed, Pro for quality)
- Keep system prompts concise
- Limit conversation history length
- Monitor token usage

### 5. Agent Design

- Give clear, specific instructions
- Provide examples in system prompt
- Use structured output for parsing
- Test with various inputs
- Monitor agent behavior

---

## Troubleshooting

### Issue: "API key is required"

**Solution**: Set the `GEMINI_API_KEY` environment variable or pass it in config.

```bash
export GEMINI_API_KEY="your-key"
```

### Issue: "Model not found"

**Solution**: Use a valid model name like `gemini-2.0-flash-exp` or `gemini-2.0-pro-exp`.

### Issue: Agent times out

**Solutions**:
- Increase `max_time_minutes` in `runConfig`
- Simplify the task
- Add more specific instructions
- Use a faster model (Flash instead of Pro)

### Issue: Tool not found

**Solution**: Ensure tool is registered before running agent:

```typescript
framework.registerTool(myTool);
console.log('Registered tools:', framework.listTools());
```

### Issue: Type errors

**Solution**: Ensure TypeScript dependencies are installed:

```bash
npm install --save-dev @types/node typescript
```

### Issue: Rate limiting

**Solution**: Implement exponential backoff:

```typescript
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      if (error.message.includes('rate limit')) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      } else {
        throw error;
      }
    }
  }
}
```

---

## Advanced Topics

### Custom Agent Processing

```typescript
const agent = defineAgent({
  // ... configuration ...
  
  processOutput: (output) => {
    // Transform structured output to string
    return `Summary: ${output.summary}\nPoints: ${output.points.join(', ')}`;
  }
});
```

### Activity Monitoring

```typescript
await framework.runAgent(agent, inputs, {
  onActivity: (activity) => {
    switch (activity.type) {
      case 'TOOL_CALL_START':
        console.log(`Calling ${activity.data.toolName}`);
        break;
      case 'TOOL_CALL_END':
        console.log(`Completed ${activity.data.toolName}`);
        break;
      case 'ERROR':
        console.error(`Error: ${activity.data.error}`);
        break;
    }
  }
});
```

### Streaming with Agents

Currently, agents return final output. For streaming, use chat interface:

```typescript
const chat = await framework.createChat({
  systemPrompt: 'Act as the agent would...'
});

for await (const chunk of chat.sendStream(query)) {
  process.stdout.write(chunk);
}
```

---

## Examples Repository

Find complete working examples in the `examples/` directory:

- `examples/simple-agent/chat-example.js` - Basic chat
- `examples/simple-agent/tool-example.js` - Custom tools
- `examples/simple-agent/agent-example.js` - Full agent

---

## Getting Help

- **Documentation**: See `FRAMEWORK_ANALYSIS.md` for architecture
- **API Issues**: Check `TEST_RESULTS.md` and `GAPS_ANALYSIS.md`
- **Code Examples**: Browse `examples/` directory
- **Issues**: Report bugs on GitHub

---

## Next Steps

1. **Try the examples**: Run the provided examples to see the framework in action
2. **Build a simple agent**: Start with a basic agent and gradually add complexity
3. **Create custom tools**: Extend functionality with tools specific to your domain
4. **Read the source**: The codebase is well-documented and easy to understand

Happy building with Gemini! 🚀
