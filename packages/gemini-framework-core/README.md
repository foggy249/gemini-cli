# @gemini-framework/core

A lightweight, type-safe framework for building AI agents with Google Gemini. Extracted from the [Gemini CLI](https://github.com/google-gemini/gemini-cli) project, this framework provides the core agent execution engine without the CLI baggage.

## Features

- 🎯 **Simple API**: Easy-to-use framework for building custom AI agents
- 🔧 **Type-Safe**: Full TypeScript support with Zod schema validation
- 🛠️ **Extensible Tools**: Create custom tools with a simple interface
- 🤖 **Agent Composition**: Define agents that can use tools and make decisions
- 💬 **Chat Interface**: Built-in chat session support
- ⚡ **Lightweight**: Core functionality without CLI dependencies

## Installation

```bash
npm install @gemini-framework/core
```

## Quick Start

### 1. Simple Chat

```typescript
import { AgentFramework } from '@gemini-framework/core';

// Create framework instance
const framework = await AgentFramework.create({
  apiKey: process.env.GEMINI_API_KEY,
});

// Send a message
const response = await framework.sendMessage(
  'Explain quantum computing in simple terms'
);
console.log(response);

// Or create a chat session
const chat = await framework.createChat({
  model: 'gemini-2.0-flash-exp',
  systemPrompt: 'You are a helpful assistant',
});

const reply = await chat.send('What is the capital of France?');
console.log(reply);
```

### 2. Define a Custom Tool

```typescript
import { defineTool } from '@gemini-framework/core';
import { z } from 'zod';

const weatherTool = defineTool({
  name: 'get-weather',
  description: 'Fetches current weather for a location',
  
  parameters: z.object({
    location: z.string().describe('City or location name'),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),
  
  execute: async ({ location, units }) => {
    // Your weather API call here
    return {
      location,
      temperature: 22,
      condition: 'Sunny',
      units,
    };
  },
});

// Register the tool
framework.registerTool(weatherTool);
```

### 3. Define and Run an Agent

```typescript
import { defineAgent } from '@gemini-framework/core';
import { z } from 'zod';

// Define an agent
const codeReviewer = defineAgent({
  name: 'code-reviewer',
  description: 'Reviews code and provides feedback',
  
  // Define inputs
  inputConfig: {
    inputs: {
      codeSnippet: {
        type: 'string',
        required: true,
        description: 'Code to review',
      },
      language: {
        type: 'string',
        required: false,
        description: 'Programming language',
      },
    },
  },
  
  // System prompt with template variables
  promptConfig: {
    systemPrompt: `You are an expert code reviewer.
      Review the ${language} code and provide constructive feedback.`,
    query: 'Review this code:\n\n${codeSnippet}',
  },
  
  // Tools available to the agent
  toolConfig: {
    tools: [], // Add tool names here
  },
  
  // Output schema
  outputConfig: {
    outputName: 'review',
    description: 'Code review results',
    schema: z.object({
      rating: z.number().min(1).max(10),
      feedback: z.string(),
      suggestions: z.array(z.string()),
    }),
  },
  
  // Model configuration
  modelConfig: {
    model: 'gemini-2.0-flash-exp',
    temp: 0.7,
    top_p: 0.95,
  },
  
  // Runtime limits
  runConfig: {
    max_time_minutes: 5,
    max_turns: 20,
  },
});

// Run the agent
const result = await framework.runAgent(codeReviewer, {
  codeSnippet: `
    function add(a, b) {
      return a + b;
    }
  `,
  language: 'JavaScript',
});

console.log('Review:', JSON.parse(result.result));
```

### 4. Agent with Activity Monitoring

```typescript
const result = await framework.runAgent(
  codeReviewer,
  { codeSnippet: '...', language: 'JavaScript' },
  {
    onActivity: (activity) => {
      switch (activity.type) {
        case 'TOOL_CALL_START':
          console.log('Tool called:', activity.data.toolName);
          break;
        case 'TOOL_CALL_END':
          console.log('Tool completed:', activity.data.toolName);
          break;
        case 'THOUGHT_CHUNK':
          console.log('Thinking:', activity.data);
          break;
        case 'ERROR':
          console.error('Error:', activity.data);
          break;
      }
    },
  }
);
```

## API Reference

### AgentFramework

Main framework class for creating and running agents.

#### `AgentFramework.create(config)`

Creates a new framework instance.

```typescript
const framework = await AgentFramework.create({
  apiKey: 'your-api-key', // Required, or use GEMINI_API_KEY env var
  model: 'gemini-2.0-flash-exp', // Default model
  tools: [tool1, tool2], // Optional: pre-register tools
});
```

#### `framework.registerTool(tool)`

Register a tool for use by agents.

#### `framework.runAgent(definition, inputs, options)`

Execute an agent with given inputs.

#### `framework.createChat(config)`

Create a chat session.

#### `framework.sendMessage(message, options)`

Send a single message (convenience method).

### defineAgent()

Helper function to define an agent with type checking.

### defineTool()

Helper function to define a tool with type checking.

### Types

#### `AgentDefinition`

Defines an agent's behavior, tools, and configuration.

```typescript
interface AgentDefinition {
  name: string;
  description: string;
  inputConfig: InputConfig;
  promptConfig: PromptConfig;
  modelConfig: ModelConfig;
  runConfig: RunConfig;
  toolConfig?: ToolConfig;
  outputConfig?: OutputConfig;
}
```

#### `ToolDefinition`

Defines a custom tool.

```typescript
interface ToolDefinition<TParams, TResult> {
  name: string;
  description: string;
  parameters: z.ZodType<TParams>;
  execute: (params: TParams, signal?: AbortSignal) => Promise<TResult>;
}
```

## Examples

See the [examples](../../examples) directory for complete working examples:

- **simple-agent**: Basic agent that performs tasks
- **code-reviewer**: Agent that reviews code
- **research-assistant**: Agent with web search capabilities

## Architecture

This framework is built on:

- **Google Gemini API** (`@google/genai`) for LLM interactions
- **Zod** for schema validation
- **TypeScript** for type safety

Key concepts:

1. **Framework**: Manages API client, tool registry, and agent execution
2. **Agents**: Autonomous entities that can use tools to accomplish tasks
3. **Tools**: Functions that agents can call (file operations, web requests, etc.)
4. **Chat**: Simple conversational interface

## Comparison with Gemini CLI

| Feature | Gemini CLI | Framework |
|---------|-----------|-----------|
| Interactive UI | ✅ | ❌ |
| Agent Execution | ✅ | ✅ |
| Custom Tools | ✅ | ✅ |
| Programmatic API | ❌ | ✅ |
| Size | ~50MB | ~5MB |
| Use Case | Terminal app | Library/SDK |

## License

Apache 2.0 - See [LICENSE](../../LICENSE)

## Contributing

Contributions are welcome! This is extracted from the [Gemini CLI](https://github.com/google-gemini/gemini-cli) project.

## Support

For issues and questions:
- GitHub Issues: [gemini-cli/issues](https://github.com/google-gemini/gemini-cli/issues)
- Documentation: [Full docs](../../FRAMEWORK_ANALYSIS.md)
