# Layered Architecture Analysis & Design

## Overview

This document analyzes the current framework architecture and proposes enhancements to enable better customization at different abstraction layers - from low-level LLM calls to high-level agent applications.

## Current Architecture

The framework currently has a somewhat monolithic structure:

```
AgentFramework (High Level)
    ├── Chat Interface (Medium Level)
    ├── Agent Executor (Medium Level)
    └── GoogleGenAI SDK (Low Level - Hidden)
```

**Issues with Current Design:**
1. **Limited Customization**: Users can't easily customize LLM calls without modifying framework code
2. **Tight Coupling**: Chat and Agent implementations are tightly coupled to GoogleGenAI
3. **No Intermediate Layer**: Missing abstraction for LLM operations without agent loop
4. **Fixed Flow**: Agent execution loop is fixed, can't be customized
5. **Hidden Low-Level Access**: No way to make custom LLM calls with framework's client

## Proposed Layered Architecture

### Layer 0: LLM Client (Foundation)
**Purpose**: Direct access to LLM API with minimal abstraction
**Users**: Advanced users who want full control

```typescript
// Exposed GoogleGenAI client
const client = framework.getLLMClient();

// Direct API calls
const response = await client.models.generateContent({
  model: 'gemini-2.0-flash-exp',
  contents: [...],
  config: {...}
});
```

### Layer 1: LLM Operations (Utilities)
**Purpose**: Reusable LLM operations without agent complexity
**Users**: Developers building custom LLM applications

```typescript
// Generate with retry logic
const result = await framework.generate({
  model: 'gemini-2.0-flash-exp',
  prompt: 'Hello',
  systemInstruction: 'You are helpful',
  temperature: 0.7,
  retries: 3,
  timeout: 30000
});

// Streaming generation
for await (const chunk of framework.generateStream({
  model: 'gemini-2.0-flash-exp',
  prompt: 'Write a poem'
})) {
  console.log(chunk);
}

// Count tokens
const tokens = await framework.countTokens({
  model: 'gemini-2.0-flash-exp',
  contents: [...]
});
```

### Layer 2: Conversation Management
**Purpose**: Multi-turn conversations without full agent complexity
**Users**: Building chatbots and conversational apps

```typescript
// Current Chat interface (enhanced)
const chat = await framework.createChat({
  model: 'gemini-2.0-flash-exp',
  systemPrompt: 'You are helpful',
  
  // NEW: Middleware support
  middleware: [
    loggerMiddleware,
    rateLimitMiddleware,
    contentFilterMiddleware
  ],
  
  // NEW: Custom history management
  historyManager: customHistoryManager,
  
  // NEW: Message transformers
  onBeforeSend: (message) => preprocessMessage(message),
  onAfterReceive: (response) => postprocessResponse(response)
});
```

### Layer 3: Agent Execution (Agentic Loop)
**Purpose**: Full agent with tools and structured output
**Users**: Building autonomous agents

```typescript
// Current Agent interface (enhanced)
const agent = defineAgent({
  name: 'my-agent',
  
  // NEW: Custom execution hooks
  hooks: {
    beforeTurn: async (context) => { /* ... */ },
    afterTurn: async (context) => { /* ... */ },
    beforeToolCall: async (tool, args) => { /* ... */ },
    afterToolCall: async (tool, result) => { /* ... */ }
  },
  
  // NEW: Custom decision logic
  decisionMaker: customDecisionMaker,
  
  // NEW: Custom termination logic
  shouldTerminate: (context) => customCheck(context),
  
  // ... existing config
});
```

### Layer 4: Application Orchestration
**Purpose**: Compose multiple agents and workflows
**Users**: Building complex multi-agent systems

```typescript
// NEW: Workflow orchestration
const workflow = framework.createWorkflow({
  agents: [agent1, agent2, agent3],
  orchestrator: (context) => {
    // Custom orchestration logic
    if (condition) return 'agent1';
    return 'agent2';
  }
});

// NEW: Agent composition
const composedAgent = framework.composeAgents({
  primary: researchAgent,
  fallback: simplifiedAgent,
  validator: outputValidator
});
```

## Detailed Design

### Layer 0: LLM Client Access

```typescript
// Expose the underlying client
class AgentFramework {
  private genAI: GoogleGenAI;
  
  /**
   * Get direct access to the LLM client for advanced use cases
   */
  getLLMClient(): GoogleGenAI {
    return this.genAI;
  }
  
  /**
   * Get the models API for direct calls
   */
  getModels() {
    return this.genAI.models;
  }
}
```

**Use Cases:**
- Custom caching strategies
- Direct API experimentation
- Non-standard API features
- Performance optimization

### Layer 1: LLM Operations

```typescript
// Add simplified generation methods
class AgentFramework {
  /**
   * Generate content with simplified API
   */
  async generate(options: GenerateOptions): Promise<string> {
    const {
      model = 'gemini-2.0-flash-exp',
      prompt,
      systemInstruction,
      temperature,
      topP,
      maxOutputTokens,
      retries = 0,
      timeout,
      signal
    } = options;
    
    // Build request with defaults
    const request: GenerateContentParameters = {
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction 
          ? { parts: [{ text: systemInstruction }] } 
          : undefined,
        temperature,
        topP,
        maxOutputTokens
      }
    };
    
    // Execute with retry and timeout
    return this.executeWithRetry(request, retries, timeout, signal);
  }
  
  /**
   * Generate with streaming
   */
  async *generateStream(options: GenerateOptions): AsyncIterable<string> {
    // Similar to generate but with streaming
    const request = this.buildRequest(options);
    const result = await this.genAI.models.generateContentStream(request);
    
    for await (const chunk of result) {
      yield chunk.text || '';
    }
  }
  
  /**
   * Count tokens for content
   */
  async countTokens(options: CountTokensOptions): Promise<number> {
    const request = this.buildTokenRequest(options);
    const result = await this.genAI.models.countTokens(request);
    return result.totalTokens || 0;
  }
  
  /**
   * Batch generate multiple prompts
   */
  async generateBatch(requests: GenerateOptions[]): Promise<string[]> {
    return Promise.all(requests.map(r => this.generate(r)));
  }
}

interface GenerateOptions {
  model?: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  retries?: number;
  timeout?: number;
  signal?: AbortSignal;
}
```

**Use Cases:**
- Simple prompt-response without conversation
- Batch processing
- Token counting and estimation
- Custom retry logic

### Layer 2: Enhanced Conversation Management

```typescript
// Add middleware and lifecycle hooks to Chat
interface ChatMiddleware {
  beforeSend?: (message: string, context: ChatContext) => Promise<string | void>;
  afterReceive?: (response: string, context: ChatContext) => Promise<string | void>;
  onError?: (error: Error, context: ChatContext) => Promise<void>;
}

interface HistoryManager {
  add(message: ChatMessage): void;
  get(): ChatMessage[];
  summarize?(): Promise<void>;  // Compress old messages
  clear(): void;
}

interface EnhancedChatConfig extends ChatConfig {
  middleware?: ChatMiddleware[];
  historyManager?: HistoryManager;
  maxHistoryLength?: number;
  autoSummarize?: boolean;
}

class EnhancedChat implements Chat {
  private middleware: ChatMiddleware[] = [];
  private historyManager: HistoryManager;
  
  constructor(genAI: GoogleGenAI, config: EnhancedChatConfig) {
    // Setup with middleware support
    this.middleware = config.middleware || [];
    this.historyManager = config.historyManager || new DefaultHistoryManager();
  }
  
  async send(message: string): Promise<string> {
    const context = this.createContext();
    
    // Apply beforeSend middleware
    let processedMessage = message;
    for (const mw of this.middleware) {
      if (mw.beforeSend) {
        const result = await mw.beforeSend(processedMessage, context);
        if (result) processedMessage = result;
      }
    }
    
    // Send to LLM
    let response = await this.sendToLLM(processedMessage);
    
    // Apply afterReceive middleware
    for (const mw of this.middleware) {
      if (mw.afterReceive) {
        const result = await mw.afterReceive(response, context);
        if (result) response = result;
      }
    }
    
    return response;
  }
}
```

**Use Cases:**
- Content filtering and moderation
- Logging and monitoring
- Rate limiting
- Custom history compression
- Message preprocessing

### Layer 3: Enhanced Agent Execution

```typescript
// Add hooks and customization points to agent execution
interface AgentHooks<TOutput> {
  beforeStart?: (inputs: AgentInputs) => Promise<void>;
  afterComplete?: (output: OutputObject) => Promise<void>;
  beforeTurn?: (context: TurnContext) => Promise<void>;
  afterTurn?: (context: TurnContext) => Promise<void>;
  beforeToolCall?: (toolName: string, args: unknown) => Promise<void>;
  afterToolCall?: (toolName: string, result: unknown) => Promise<void>;
  onError?: (error: Error, context: TurnContext) => Promise<void>;
}

interface DecisionMaker {
  shouldCallTool(toolName: string, context: TurnContext): Promise<boolean>;
  selectNextAction(options: string[], context: TurnContext): Promise<string>;
}

interface TerminationChecker {
  shouldTerminate(context: TurnContext): boolean;
  getTerminationReason(context: TurnContext): AgentTerminateMode;
}

interface EnhancedAgentDefinition<TOutput extends z.ZodTypeAny> 
  extends AgentDefinition<TOutput> {
  hooks?: AgentHooks<TOutput>;
  decisionMaker?: DecisionMaker;
  terminationChecker?: TerminationChecker;
  maxRetries?: number;
  retryStrategy?: 'exponential' | 'linear' | 'immediate';
}

class EnhancedAgentExecutor<TOutput extends z.ZodTypeAny> {
  private hooks: AgentHooks<TOutput>;
  private decisionMaker?: DecisionMaker;
  private terminationChecker?: TerminationChecker;
  
  async run(inputs: AgentInputs, signal?: AbortSignal): Promise<OutputObject> {
    // Call beforeStart hook
    await this.hooks.beforeStart?.(inputs);
    
    try {
      // Main execution loop with hooks
      while (true) {
        const context = this.createTurnContext();
        
        // beforeTurn hook
        await this.hooks.beforeTurn?.(context);
        
        // Execute turn with custom decision making
        const action = await this.decideNextAction(context);
        
        if (action.type === 'tool_call') {
          await this.hooks.beforeToolCall?.(action.tool, action.args);
          const result = await this.executeTool(action.tool, action.args);
          await this.hooks.afterToolCall?.(action.tool, result);
        }
        
        // afterTurn hook
        await this.hooks.afterTurn?.(context);
        
        // Check custom termination
        if (this.terminationChecker?.shouldTerminate(context)) {
          break;
        }
      }
      
      const output = this.getOutput();
      await this.hooks.afterComplete?.(output);
      return output;
      
    } catch (error) {
      await this.hooks.onError?.(error, this.getCurrentContext());
      throw error;
    }
  }
}
```

**Use Cases:**
- Custom logging and telemetry
- Tool call approval workflows
- Custom decision logic (e.g., A/B testing strategies)
- Adaptive termination criteria
- Error recovery strategies

### Layer 4: Workflow Orchestration

```typescript
// Add workflow and composition capabilities
interface WorkflowStep {
  agent: AgentDefinition<any>;
  condition?: (context: WorkflowContext) => boolean;
  transform?: (input: any) => any;
}

interface WorkflowDefinition {
  steps: WorkflowStep[];
  orchestrator?: (context: WorkflowContext) => Promise<string>;
  errorHandler?: (error: Error, step: WorkflowStep) => Promise<'retry' | 'skip' | 'abort'>;
}

class AgentFramework {
  /**
   * Create a workflow that orchestrates multiple agents
   */
  createWorkflow(definition: WorkflowDefinition): Workflow {
    return new Workflow(this, definition);
  }
  
  /**
   * Compose multiple agents into one
   */
  composeAgents(options: CompositionOptions): AgentDefinition<any> {
    return new ComposedAgent(options);
  }
  
  /**
   * Create an agent pipeline
   */
  createPipeline(agents: AgentDefinition<any>[]): Pipeline {
    return new Pipeline(this, agents);
  }
}

class Workflow {
  async execute(input: any): Promise<any> {
    let context = { input, results: [] };
    
    for (const step of this.definition.steps) {
      // Check condition
      if (step.condition && !step.condition(context)) {
        continue;
      }
      
      // Transform input
      const stepInput = step.transform 
        ? step.transform(context.input) 
        : context.input;
      
      try {
        // Run agent
        const result = await this.runAgent(step.agent, stepInput);
        context.results.push(result);
        context.input = result; // Pass to next step
        
      } catch (error) {
        const action = await this.definition.errorHandler?.(error, step);
        if (action === 'abort') throw error;
        if (action === 'retry') {
          // Retry logic
        }
        // 'skip' continues to next step
      }
    }
    
    return context;
  }
}
```

**Use Cases:**
- Multi-step agent workflows
- Agent delegation and handoff
- Parallel agent execution
- Error recovery across agents
- Complex business logic

## Implementation Priorities

### Phase 1: Foundation (High Priority)
1. ✅ Expose LLM client access (Layer 0)
2. ✅ Add simplified generation methods (Layer 1)
3. ✅ Add token counting utilities (Layer 1)

### Phase 2: Conversation Enhancement (Medium Priority)
4. Add middleware support to Chat (Layer 2)
5. Add custom history management (Layer 2)
6. Add message transformers (Layer 2)

### Phase 3: Agent Enhancement (Medium Priority)
7. Add agent execution hooks (Layer 3)
8. Add custom decision makers (Layer 3)
9. Add termination checkers (Layer 3)

### Phase 4: Orchestration (Lower Priority)
10. Add workflow orchestration (Layer 4)
11. Add agent composition (Layer 4)
12. Add pipeline support (Layer 4)

## API Surface Summary

### Minimal (Current)
```typescript
// What we have now
const framework = await AgentFramework.create({ apiKey });
const response = await framework.sendMessage('Hello');
const chat = await framework.createChat({ model });
const result = await framework.runAgent(agent, inputs);
```

### Enhanced (Proposed)
```typescript
// Layer 0: Direct LLM access
const client = framework.getLLMClient();
const models = framework.getModels();

// Layer 1: LLM operations
const text = await framework.generate({ prompt: 'Hello' });
const stream = framework.generateStream({ prompt: 'Hello' });
const tokens = await framework.countTokens({ contents });
const batch = await framework.generateBatch([...]);

// Layer 2: Enhanced conversations
const chat = await framework.createChat({
  middleware: [logger, filter],
  historyManager: customManager,
  maxHistoryLength: 100
});

// Layer 3: Enhanced agents
const agent = defineAgent({
  // ... config
  hooks: { beforeTurn, afterTurn, beforeToolCall },
  decisionMaker: customDecider,
  terminationChecker: customChecker
});

// Layer 4: Orchestration
const workflow = framework.createWorkflow({ steps });
const composed = framework.composeAgents({ primary, fallback });
const pipeline = framework.createPipeline([agent1, agent2]);
```

## Benefits of Layered Architecture

### 1. Flexibility
- Users choose the right abstraction level
- Can mix layers as needed
- Easy to upgrade from simple to complex

### 2. Customization
- Every layer has extension points
- Can override default behaviors
- Can inject custom logic

### 3. Gradual Adoption
- Start simple (Layer 1)
- Add complexity as needed
- No forced complexity

### 4. Maintainability
- Clear separation of concerns
- Each layer is independently testable
- Easy to add features

### 5. Power
- Advanced users get full control
- Simple users get convenience
- Everyone gets what they need

## Migration Path

Users can migrate gradually:

```typescript
// Step 1: Start simple
const response = await framework.sendMessage('Hello');

// Step 2: Use LLM operations
const text = await framework.generate({
  prompt: 'Hello',
  temperature: 0.7
});

// Step 3: Add conversation
const chat = await framework.createChat({
  systemPrompt: 'You are helpful'
});

// Step 4: Add agents
const agent = defineAgent({...});
const result = await framework.runAgent(agent, inputs);

// Step 5: Add orchestration
const workflow = framework.createWorkflow({...});
const output = await workflow.execute(input);
```

## Comparison with Original CLI

The Gemini CLI has similar layers but they're not exposed:

| Layer | Gemini CLI | Framework (Current) | Framework (Proposed) |
|-------|-----------|-------------------|-------------------|
| L0: LLM Client | ❌ Hidden | ❌ Hidden | ✅ Exposed |
| L1: LLM Ops | ❌ Internal | ❌ Missing | ✅ Public |
| L2: Chat | ✅ Present | ✅ Basic | ✅ Enhanced |
| L3: Agents | ✅ Full | ✅ Basic | ✅ Enhanced |
| L4: Orchestration | ✅ Complex | ❌ Missing | ✅ Simple |

## Conclusion

By implementing this layered architecture, the framework will:

1. **Support all use cases** - From simple prompts to complex multi-agent systems
2. **Enable customization** - At every layer with hooks and extension points
3. **Maintain simplicity** - Simple things remain simple
4. **Enable complexity** - Complex things become possible
5. **Future-proof** - Easy to add features without breaking changes

This design makes the framework truly reusable across the entire spectrum of LLM applications, from basic prompting to sophisticated agent orchestration.
