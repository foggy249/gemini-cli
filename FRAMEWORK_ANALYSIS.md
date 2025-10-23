# Gemini CLI Framework Analysis

## Executive Summary

This document provides a comprehensive analysis of the Gemini CLI codebase with
the goal of extracting reusable components into a lightweight agent framework.
The Gemini CLI is a sophisticated AI agent system built on top of Google's
Gemini API, featuring tools, MCP (Model Context Protocol) support, and advanced
execution capabilities.

## Architecture Overview

### 1. Package Structure

The codebase is organized as a monorepo with the following key packages:

```
gemini-cli/
├── packages/
│   ├── cli/              # User-facing CLI interface (React/Ink UI)
│   ├── core/             # Backend logic, API client, tools, agents
│   ├── a2a-server/       # Agent-to-Agent communication server
│   ├── test-utils/       # Shared testing utilities
│   └── vscode-ide-companion/  # VS Code extension
├── integration-tests/    # End-to-end integration tests
└── scripts/              # Build and utility scripts
```

### 2. Core Components Deep Dive

#### 2.1 LLM Client Abstraction (`packages/core/src/core/`)

**Key Files:**

- `client.ts` - Base LLM client interface
- `geminiChat.ts` - Gemini-specific chat implementation with retry logic
- `contentGenerator.ts` - Content generation wrapper
- `loggingContentGenerator.ts` - Logging decorator for content generation
- `baseLlmClient.ts` - Base implementation with common functionality

**Capabilities:**

- Streaming and non-streaming responses
- Token counting and management
- Retry logic with exponential backoff
- Content validation
- Tool call handling
- Conversation history management
- Fallback model support

**Reusability Score: ⭐⭐⭐⭐⭐ (Excellent)**

- Well abstracted with clear interfaces
- Minimal dependencies on CLI-specific code
- Already designed for extensibility

#### 2.2 Agent System (`packages/core/src/agents/`)

**Key Files:**

- `executor.ts` - Main agent execution loop
- `types.ts` - Agent definition interfaces
- `registry.ts` - Agent registration and discovery
- `invocation.ts` - Agent invocation context
- `subagent-tool-wrapper.ts` - Wraps agents as tools for composition

**Capabilities:**

- Declarative agent definitions (config-driven)
- Input/output schema validation (Zod-based)
- Tool calling within agent context
- Timeout and max-turns constraints
- Activity event streaming
- Agent composition (agents calling agents)
- Template-based prompt construction

**Architecture Pattern:**

```typescript
AgentDefinition {
  name, description
  promptConfig: { systemPrompt, initialMessages, query }
  modelConfig: { model, temp, top_p }
  runConfig: { max_time_minutes, max_turns }
  toolConfig: { tools: [...] }
  inputConfig: { inputs: {...} }
  outputConfig: { schema, outputName }
}
```

**Reusability Score: ⭐⭐⭐⭐⭐ (Excellent)**

- Highly modular and configurable
- Zero CLI dependencies
- Clean separation of concerns

#### 2.3 Tool System (`packages/core/src/tools/`)

**Key Files:**

- `tools.ts` - Base tool interfaces and builder pattern
- `tool-registry.ts` - Tool registration and discovery
- `tool-error.ts` - Error handling for tools
- Individual tool implementations:
  - `read-file.ts`, `write-file.ts`, `edit.ts`
  - `shell.ts` - Shell command execution
  - `grep.ts`, `glob.ts`, `ripGrep.ts` - File search
  - `web-fetch.ts`, `web-search.ts` - Web operations
  - `mcp-client.ts`, `mcp-tool.ts` - MCP integration
  - `memoryTool.ts` - Conversation memory
  - `read-many-files.ts` - Batch file operations

**Tool Architecture:**

```typescript
interface ToolDefinition<TParams, TResult> {
  name: string;
  description: string;
  build(params: TParams): ToolInvocation<TParams, TResult>;
}

interface ToolInvocation<TParams, TResult> {
  params: TParams;
  getDescription(): string;
  toolLocations(): ToolLocation[];
  shouldConfirmExecute(): Promise<boolean>;
  execute(signal: AbortSignal): Promise<TResult>;
}
```

**Key Features:**

- Builder pattern for type-safe tool creation
- Confirmation flow for destructive operations
- Location tracking for file system operations
- Abort signal support for cancellation
- Policy-based execution control
- Streaming output support

**Reusability Score: ⭐⭐⭐⭐⭐ (Excellent)**

- Well-designed abstraction
- Easy to extend with new tools
- Minimal coupling to CLI

#### 2.4 Configuration System (`packages/core/src/config/`)

**Key Files:**

- `config.ts` - Main configuration interface
- `storage.ts` - Persistent storage abstraction
- `models.ts` - Model selection and configuration

**Capabilities:**

- Model selection (Gemini 2.5 Pro, Flash, etc.)
- API key management (multiple auth methods)
- Directory context management
- Tool registry configuration
- Telemetry settings
- Output format configuration

**Reusability Score: ⭐⭐⭐⭐ (Good)**

- Some CLI-specific settings mixed in
- Core config interface is clean
- Would need minor refactoring for framework use

#### 2.5 MCP Integration (`packages/core/src/mcp/`)

**Key Files:**

- `mcp-client.ts` - MCP protocol client implementation
- `oauth-provider.ts` - OAuth for MCP servers
- `token-storage/` - Token persistence
- `google-auth-provider.ts` - Google auth integration

**Capabilities:**

- Full MCP (Model Context Protocol) support
- OAuth 2.0 flow for MCP servers
- Secure token storage (keychain + file fallback)
- Resource and prompt handling
- Server lifecycle management

**Reusability Score: ⭐⭐⭐⭐⭐ (Excellent)**

- Standards-based protocol implementation
- Well isolated from CLI concerns
- Production-ready OAuth handling

#### 2.6 Services (`packages/core/src/services/`)

**Key Files:**

- `fileDiscoveryService.ts` - Intelligent file discovery
- `gitService.ts` - Git operations
- `shellExecutionService.ts` - Shell command execution
- `chatRecordingService.ts` - Conversation persistence
- `fileSystemService.ts` - File system operations

**Reusability Score: ⭐⭐⭐⭐ (Good)**

- Useful utilities for agent applications
- Some have CLI-specific features
- Easy to extract core functionality

#### 2.7 Policy & Confirmation System (`packages/core/src/policy/` and `packages/core/src/confirmation-bus/`)

**Key Files:**

- `policy-engine.ts` - Policy evaluation
- `message-bus.ts` - Confirmation message bus
- `types.ts` - Policy and confirmation types

**Capabilities:**

- User-defined execution policies
- Trust levels for folders/operations
- Confirmation flow for tool execution
- Message bus for async confirmations

**Reusability Score: ⭐⭐⭐⭐ (Good)**

- Important for safe agent execution
- Clean abstraction
- Could be made more generic

### 3. CLI-Specific Components (NOT for framework)

#### 3.1 UI Layer (`packages/cli/src/ui/`)

- React/Ink-based terminal UI
- Theme system
- Keyboard shortcuts
- Interactive command processing
- Status displays and spinners

**Reusability: ❌ CLI-specific, exclude from framework**

#### 3.2 Commands (`packages/cli/src/commands/`)

- Extension management
- MCP server management
- Checkpoint operations

**Reusability: ❌ CLI-specific, exclude from framework**

### 4. Execution Flow Analysis

#### Interactive Flow:

```
User Input (CLI)
  → Parse Command
  → Initialize Config
  → Create GeminiClient
  → Load Tools into Registry
  → Execute Agent/Chat Loop
    → Send to Gemini API
    → Handle Tool Calls (with confirmation)
    → Stream Response
  → Display Result (UI)
```

#### Non-Interactive/Headless Flow:

```
Input String
  → Parse Arguments
  → Initialize Config
  → Execute Agent
    → Tool Calls (auto-approve or reject based on policy)
    → Collect Results
  → Output (JSON/Text/Stream-JSON)
```

#### Agent Execution Flow:

```
AgentExecutor.run(inputs)
  → Template system prompt with inputs
  → Initialize GeminiChat with tools
  → Loop:
    → Send message to Gemini
    → Handle tool calls
    → Execute tools (with policy checks)
    → Continue until complete_task called
  → Return structured output
```

### 5. Key Dependencies

**LLM Provider:**

- `@google/genai` - Google Gemini SDK (v1.16.0)

**MCP:**

- `@modelcontextprotocol/sdk` - MCP protocol implementation

**Utilities:**

- `zod` - Schema validation
- `google-auth-library` - Authentication
- Various file system, git, and shell utilities

## Framework Extraction Strategy

### Phase 1: Core Framework Package

**Package Name:** `@gemini-framework/core`

**Include:**

1. **LLM Client Abstraction**
   - `core/baseLlmClient.ts`
   - `core/client.ts`
   - `core/geminiChat.ts`
   - `core/contentGenerator.ts`
   - `core/geminiRequest.ts`
   - Token limits and management

2. **Agent System**
   - `agents/executor.ts`
   - `agents/types.ts`
   - `agents/registry.ts`
   - `agents/invocation.ts`
   - `agents/utils.ts`
   - `agents/schema-utils.ts`

3. **Tool System**
   - `tools/tools.ts` (base interfaces)
   - `tools/tool-registry.ts`
   - `tools/tool-error.ts`
   - `tools/tool-names.ts`

4. **Configuration**
   - `config/config.ts` (simplified)
   - `config/storage.ts`
   - `config/models.ts`

5. **Policy System**
   - `policy/policy-engine.ts`
   - `policy/types.ts`

6. **Utilities**
   - `utils/schemaValidator.ts`
   - `utils/retry.ts`
   - `utils/errors.ts`
   - `utils/partUtils.ts`
   - `utils/thoughtUtils.ts`

**Exclude:**

- Telemetry (make optional)
- IDE integration
- UI-specific code
- CLI-specific configuration

### Phase 2: Tool Library Package

**Package Name:** `@gemini-framework/tools`

**Include:**

- File system tools: `read-file.ts`, `write-file.ts`, `edit.ts`
- Search tools: `grep.ts`, `glob.ts`, `ripGrep.ts`
- Web tools: `web-fetch.ts`, `web-search.ts`
- Shell tools: `shell.ts`
- Memory tools: `memoryTool.ts`
- Batch operations: `read-many-files.ts`

**Supporting services:**

- `services/fileSystemService.ts`
- `services/shellExecutionService.ts`
- `utils/fileUtils.ts`
- `utils/shell-utils.ts`

### Phase 3: MCP Integration Package

**Package Name:** `@gemini-framework/mcp`

**Include:**

- `mcp/oauth-provider.ts`
- `mcp/oauth-token-storage.ts`
- `mcp/oauth-utils.ts`
- `mcp/google-auth-provider.ts`
- `mcp/token-storage/*`
- `tools/mcp-client.ts`
- `tools/mcp-tool.ts`

### Phase 4: Optional Add-ons

**Package Name:** `@gemini-framework/git`

- Git service and utilities

**Package Name:** `@gemini-framework/code-assist`

- Code Assist authentication
- Enterprise features

## Clean Framework API Design

### Configuration API:

```typescript
import { AgentFramework } from '@gemini-framework/core';

const framework = await AgentFramework.create({
  apiKey: 'your-gemini-api-key',
  model: 'gemini-2.5-pro',
  // Optional: custom tool registry
  tools: [readFile, writeFile, shell],
  // Optional: policy configuration
  policy: {
    autoApprove: ['read-file', 'list-directory'],
    requireConfirmation: ['write-file', 'execute-shell'],
  },
});
```

### Agent Definition API:

```typescript
import { defineAgent } from '@gemini-framework/core';
import { z } from 'zod';

const codeAnalyzer = defineAgent({
  name: 'code-analyzer',
  description: 'Analyzes code and provides insights',

  inputs: {
    codeFile: {
      type: 'string',
      required: true,
      description: 'Path to code file',
    },
    analysisType: {
      type: 'string',
      required: false,
      description: 'Type of analysis',
    },
  },

  systemPrompt: `
    You are a code analysis expert.
    Analyze the code at: \${codeFile}
    Focus on: \${analysisType}
  `,

  tools: ['read-file', 'grep', 'glob'],

  output: {
    schema: z.object({
      summary: z.string(),
      issues: z.array(z.string()),
      recommendations: z.array(z.string()),
    }),
  },

  model: { model: 'gemini-2.5-flash', temp: 0.7 },
  runtime: { maxTimeMinutes: 5, maxTurns: 20 },
});
```

### Agent Execution API:

```typescript
// Run agent
const result = await framework.runAgent(codeAnalyzer, {
  codeFile: './src/app.ts',
  analysisType: 'security',
});

console.log(result.summary);
console.log(result.issues);

// With streaming
await framework.runAgent(codeAnalyzer, inputs, {
  onThought: (thought) => console.log('Thinking:', thought),
  onToolCall: (call) => console.log('Calling tool:', call.name),
  onProgress: (activity) => console.log('Progress:', activity),
});
```

### Custom Tool API:

```typescript
import { defineTool } from '@gemini-framework/core';
import { z } from 'zod';

const fetchWeather = defineTool({
  name: 'fetch-weather',
  description: 'Fetches current weather for a location',

  parameters: z.object({
    location: z.string().describe('City or location name'),
    units: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),

  execute: async ({ location, units }) => {
    const response = await fetch(`https://api.weather.com/${location}`);
    const data = await response.json();
    return {
      temperature: data.temp,
      condition: data.condition,
      units,
    };
  },
});

framework.registerTool(fetchWeather);
```

### Chat/Conversation API:

```typescript
const chat = await framework.createChat({
  model: 'gemini-2.5-pro',
  tools: ['web-search', 'web-fetch'],
  systemPrompt: 'You are a helpful research assistant',
});

// Single message
const response = await chat.send('What are the latest AI developments?');

// Streaming
for await (const chunk of chat.sendStream('Explain quantum computing')) {
  process.stdout.write(chunk.text);
}

// History
const history = chat.getHistory();
```

## Refactoring Approach: Surgical Changes

### 1. Create Framework Package Structure

```
packages/gemini-framework/
├── core/
│   ├── src/
│   │   ├── agent/       # Copied from core/src/agents
│   │   ├── client/      # Copied from core/src/core
│   │   ├── tools/       # Base tool system
│   │   ├── config/      # Simplified config
│   │   ├── policy/      # Policy engine
│   │   └── index.ts     # Public API exports
│   └── package.json
├── tools/
│   ├── src/
│   │   ├── filesystem/
│   │   ├── shell/
│   │   ├── web/
│   │   └── index.ts
│   └── package.json
└── mcp/
    ├── src/
    └── package.json
```

### 2. Minimal Changes Strategy

**Create, Don't Modify:**

- Create new `packages/gemini-framework/*` packages
- Copy relevant files from `packages/core`
- Add new simplified entry points
- Keep original packages unchanged

**Simplifications:**

- Remove telemetry (make it optional plugin)
- Remove IDE-specific code
- Simplify Config interface
- Remove CLI-specific settings
- Create clean public API surface

**Dependencies:**

- Keep core dependencies: `@google/genai`, `zod`, `@modelcontextprotocol/sdk`
- Remove: React, Ink, CLI-specific libraries
- Make optional: telemetry, logging libraries

### 3. Example Application Structure

Create `examples/simple-agent/`:

```typescript
// examples/simple-agent/index.ts
import { AgentFramework, defineAgent } from '@gemini-framework/core';
import { readFile, writeFile } from '@gemini-framework/tools';
import { z } from 'zod';

// Configure framework
const framework = await AgentFramework.create({
  apiKey: process.env.GEMINI_API_KEY!,
  tools: [readFile, writeFile],
});

// Define agent
const codeReviewer = defineAgent({
  name: 'code-reviewer',
  description: 'Reviews code files and provides feedback',

  inputs: {
    filePath: { type: 'string', required: true },
  },

  systemPrompt: `Review the code at \${filePath}.
    Provide constructive feedback on:
    - Code quality
    - Potential bugs
    - Best practices`,

  tools: ['read-file'],

  output: {
    schema: z.object({
      rating: z.number().min(1).max(10),
      feedback: z.string(),
      suggestions: z.array(z.string()),
    }),
  },
});

// Run agent
const result = await framework.runAgent(codeReviewer, {
  filePath: './src/app.ts',
});

console.log(`Rating: ${result.rating}/10`);
console.log(`Feedback: ${result.feedback}`);
console.log('Suggestions:');
result.suggestions.forEach((s) => console.log(`  - ${s}`));
```

## Benefits of the Framework

1. **Lightweight**: Only core agent functionality, no UI baggage
2. **Modular**: Use only what you need (core, tools, mcp)
3. **Type-Safe**: Full TypeScript with Zod schemas
4. **Extensible**: Easy to add custom tools and agents
5. **Production-Ready**: Built on battle-tested Gemini CLI code
6. **Standard-Based**: MCP support for ecosystem integration
7. **Flexible**: Works in Node.js scripts, servers, or applications
8. **Well-Documented**: Clear API with examples

## Migration Path for Users

### From Gemini CLI to Framework:

**Before (CLI):**

```bash
gemini -p "Review this code"
```

**After (Framework):**

```typescript
const result = await framework.runAgent(codeReviewer, {
  codeDir: process.cwd(),
});
```

### Custom Agents Instead of CLI Commands:

Users can now programmatically define agents matching their workflow without
needing CLI-specific command structures.

## Implementation Plan

### Stage 1: Analysis Document ✅

- Complete architecture analysis
- Define framework boundaries
- Design clean APIs

### Stage 2: Core Framework Package

1. Create `packages/gemini-framework/core/`
2. Copy and adapt agent system
3. Copy and adapt LLM client
4. Copy base tool system
5. Create simplified config
6. Create public API (`index.ts`)
7. Add TypeScript types and JSDoc
8. Write README and API docs

### Stage 3: Tools Package

1. Create `packages/gemini-framework/tools/`
2. Copy file system tools
3. Copy shell tools
4. Copy web tools
5. Add tool documentation

### Stage 4: MCP Package (Optional)

1. Create `packages/gemini-framework/mcp/`
2. Copy MCP client
3. Copy OAuth handling
4. Document MCP integration

### Stage 5: Demo Application

1. Create `examples/simple-agent/`
2. Implement code review agent
3. Implement research assistant agent
4. Add comprehensive examples

### Stage 6: Documentation

1. Framework README
2. API reference
3. Tutorial guides
4. Migration guide from CLI

## Testing Strategy

1. **Unit Tests**: Test core framework components
2. **Integration Tests**: Test agent execution end-to-end
3. **Example Tests**: Ensure examples work
4. **Compatibility Tests**: Verify against Gemini API

## Conclusion

The Gemini CLI codebase contains excellent, production-ready components for
building AI agents. The agent system, tool architecture, and LLM client
abstraction are particularly well-designed and can be extracted with minimal
modifications.

By creating a clean framework package structure and maintaining the original
codebase unchanged, we can provide a lightweight, reusable foundation for
building custom AI agents without the complexity of the full CLI application.

The framework will enable developers to:

- Build custom AI agents programmatically
- Create specialized tools for their domain
- Integrate agents into existing applications
- Leverage MCP for ecosystem connectivity
- Deploy agents in various environments (scripts, servers, microservices)

This extraction preserves the power and sophistication of the Gemini CLI while
making it accessible for programmatic use cases.
