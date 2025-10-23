/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Main Gemini Agent Framework class
 */

import {
  GoogleGenAI,
  type Content,
  type GenerateContentParameters,
  type CountTokensParameters,
} from '@google/genai';
import type {
  FrameworkConfig,
  AgentDefinition,
  AgentInputs,
  OutputObject,
  ToolDefinition,
  ChatConfig,
  Chat,
  ChatMessage,
  GenerateOptions,
  CountTokensOptions,
  BatchGenerateOptions,
} from './types.js';
import { AgentExecutor, type ActivityCallback } from './agent/executor.js';
import { z } from 'zod';

/**
 * Simple chat implementation
 */
class SimpleChat implements Chat {
  private genAI: GoogleGenAI;
  private config: ChatConfig;
  private history: Content[] = [];

  constructor(genAI: GoogleGenAI, config: ChatConfig) {
    this.genAI = genAI;
    this.config = config;
  }

  async send(message: string): Promise<string> {
    const userContent: Content = { role: 'user', parts: [{ text: message }] };
    this.history.push(userContent);

    const request: GenerateContentParameters = {
      model: this.config.model || 'gemini-2.0-flash-exp',
      contents: this.history,
      config:
        this.config.temperature !== undefined || this.config.systemPrompt
          ? {
              systemInstruction: this.config.systemPrompt
                ? { parts: [{ text: this.config.systemPrompt }] }
                : undefined,
              temperature: this.config.temperature,
              topP: this.config.topP || 0.95,
            }
          : undefined,
    };

    const result = await this.genAI.models.generateContent(request);
    const text = result.text || '';

    const modelContent: Content = { role: 'model', parts: [{ text }] };
    this.history.push(modelContent);

    return text;
  }

  async *sendStream(message: string): AsyncIterable<string> {
    const userContent: Content = { role: 'user', parts: [{ text: message }] };
    this.history.push(userContent);

    const request: GenerateContentParameters = {
      model: this.config.model || 'gemini-2.0-flash-exp',
      contents: this.history,
      config:
        this.config.temperature !== undefined || this.config.systemPrompt
          ? {
              systemInstruction: this.config.systemPrompt
                ? { parts: [{ text: this.config.systemPrompt }] }
                : undefined,
              temperature: this.config.temperature,
              topP: this.config.topP || 0.95,
            }
          : undefined,
    };

    const result = await this.genAI.models.generateContentStream(request);

    let fullText = '';
    for await (const chunk of result) {
      const text = chunk.text || '';
      fullText += text;
      yield text;
    }

    const modelContent: Content = { role: 'model', parts: [{ text: fullText }] };
    this.history.push(modelContent);
  }

  getHistory(): ChatMessage[] {
    return this.history.map((content) => ({
      role: content.role as 'user' | 'model',
      content: content.parts?.map((p) => p.text || '').join('') || '',
    }));
  }
}

/**
 * Main Agent Framework
 */
export class AgentFramework {
  private genAI: GoogleGenAI;
  private config: FrameworkConfig;
  private toolRegistry: Map<string, ToolDefinition<object, unknown>>;

  private constructor(config: FrameworkConfig) {
    if (!config.apiKey) {
      throw new Error('API key is required. Provide it via config.apiKey or GEMINI_API_KEY env var');
    }
    
    this.config = config;
    this.genAI = new GoogleGenAI({ apiKey: config.apiKey });
    this.toolRegistry = new Map();

    // Register provided tools
    if (config.tools) {
      for (const tool of config.tools) {
        this.registerTool(tool);
      }
    }
  }

  /**
   * Create a new framework instance
   */
  static async create(config: FrameworkConfig = {}): Promise<AgentFramework> {
    // Allow API key from environment
    const apiKey = config.apiKey || process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      throw new Error(
        'API key is required. Provide it via config.apiKey or GEMINI_API_KEY environment variable',
      );
    }

    return new AgentFramework({ ...config, apiKey });
  }

  /**
   * Register a tool
   */
  registerTool(tool: ToolDefinition<object, unknown>): void {
    this.toolRegistry.set(tool.name, tool);
  }

  /**
   * Get a registered tool
   */
  getTool(name: string): ToolDefinition<object, unknown> | undefined {
    return this.toolRegistry.get(name);
  }

  /**
   * List all registered tools
   */
  listTools(): string[] {
    return Array.from(this.toolRegistry.keys());
  }

  /**
   * Run an agent with inputs
   */
  async runAgent<TOutput extends z.ZodTypeAny>(
    definition: AgentDefinition<TOutput>,
    inputs: AgentInputs,
    options?: {
      signal?: AbortSignal;
      onActivity?: ActivityCallback;
    },
  ): Promise<OutputObject> {
    const executor = new AgentExecutor(
      definition,
      this.config.apiKey!,
      this.toolRegistry,
      options?.onActivity,
    );

    return executor.run(inputs, options?.signal);
  }

  /**
   * Create a chat session
   */
  async createChat(config: ChatConfig = {}): Promise<Chat> {
    return new SimpleChat(this.genAI, {
      model: config.model || this.config.model || 'gemini-2.0-flash-exp',
      ...config,
    });
  }

  /**
   * Send a single message (convenience method)
   */
  async sendMessage(
    message: string,
    options?: {
      model?: string;
      systemPrompt?: string;
    },
  ): Promise<string> {
    const chat = await this.createChat(options);
    return chat.send(message);
  }

  // ========================================
  // Layer 0: Direct LLM Client Access
  // ========================================

  /**
   * Get direct access to the underlying GoogleGenAI client for advanced use cases.
   * This provides full control over all SDK features.
   * 
   * @example
   * ```typescript
   * const client = framework.getLLMClient();
   * const response = await client.models.generateContent({...});
   * ```
   */
  getLLMClient(): GoogleGenAI {
    return this.genAI;
  }

  /**
   * Get the models API for direct generation calls.
   * 
   * @example
   * ```typescript
   * const models = framework.getModels();
   * const response = await models.generateContent({...});
   * ```
   */
  getModels() {
    return this.genAI.models;
  }

  // ========================================
  // Layer 1: Simplified LLM Operations
  // ========================================

  /**
   * Generate content with a simplified API and built-in retry logic.
   * This is a convenience wrapper around the SDK's generateContent method.
   * 
   * @example
   * ```typescript
   * const text = await framework.generate({
   *   prompt: 'Explain quantum computing',
   *   temperature: 0.7,
   *   retries: 3
   * });
   * ```
   */
  async generate(options: GenerateOptions): Promise<string> {
    const {
      model = this.config.model || 'gemini-2.0-flash-exp',
      prompt,
      systemInstruction,
      temperature,
      topP,
      maxOutputTokens,
      retries = 0,
      timeout,
      signal,
    } = options;

    const request: GenerateContentParameters = {
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined,
        temperature,
        topP,
        maxOutputTokens,
      },
    };

    return this.executeWithRetry(request, retries, timeout, signal);
  }

  /**
   * Generate content with streaming response.
   * 
   * @example
   * ```typescript
   * for await (const chunk of framework.generateStream({ prompt: 'Write a poem' })) {
   *   process.stdout.write(chunk);
   * }
   * ```
   */
  async *generateStream(options: GenerateOptions): AsyncIterable<string> {
    const {
      model = this.config.model || 'gemini-2.0-flash-exp',
      prompt,
      systemInstruction,
      temperature,
      topP,
      maxOutputTokens,
      signal,
    } = options;

    const request: GenerateContentParameters = {
      model,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined,
        temperature,
        topP,
        maxOutputTokens,
        abortSignal: signal,
      },
    };

    const result = await this.genAI.models.generateContentStream(request);

    for await (const chunk of result) {
      const text = chunk.text || '';
      if (text) yield text;
    }
  }

  /**
   * Count tokens in the given content.
   * Useful for estimating costs and checking limits.
   * 
   * @example
   * ```typescript
   * const count = await framework.countTokens({
   *   contents: 'This is my prompt'
   * });
   * console.log(`Tokens: ${count}`);
   * ```
   */
  async countTokens(options: CountTokensOptions): Promise<number> {
    const { model = this.config.model || 'gemini-2.0-flash-exp', contents } = options;

    let contentsArray: Content[];
    if (typeof contents === 'string') {
      contentsArray = [{ role: 'user', parts: [{ text: contents }] }];
    } else {
      contentsArray = contents.map((item) => ({
        role: item.role,
        parts: [{ text: item.content }],
      }));
    }

    const request: CountTokensParameters = {
      model,
      contents: contentsArray,
    };

    const result = await this.genAI.models.countTokens(request);
    return result.totalTokens || 0;
  }

  /**
   * Generate content for multiple prompts in parallel or with controlled concurrency.
   * 
   * @example
   * ```typescript
   * const results = await framework.generateBatch({
   *   requests: [
   *     { prompt: 'Question 1' },
   *     { prompt: 'Question 2' },
   *     { prompt: 'Question 3' }
   *   ],
   *   concurrency: 2
   * });
   * ```
   */
  async generateBatch(options: BatchGenerateOptions): Promise<string[]> {
    const { requests, concurrency = Infinity } = options;

    if (concurrency === Infinity) {
      // Parallel execution
      return Promise.all(requests.map((req) => this.generate(req)));
    }

    // Controlled concurrency
    const results: string[] = [];
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map((req) => this.generate(req)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Private helper for executing requests with retry logic
   */
  private async executeWithRetry(
    request: GenerateContentParameters,
    retries: number,
    timeout?: number,
    signal?: AbortSignal,
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Add timeout if specified
        if (timeout && request.config) {
          request.config.abortSignal = signal || AbortSignal.timeout(timeout);
        } else if (signal && request.config) {
          request.config.abortSignal = signal;
        }

        const result = await this.genAI.models.generateContent(request);
        return result.text || '';
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort
        if (signal?.aborted || lastError.name === 'AbortError') {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }
}

/**
 * Helper function to define an agent
 */
export function defineAgent<TOutput extends z.ZodTypeAny>(
  definition: AgentDefinition<TOutput>,
): AgentDefinition<TOutput> {
  return definition;
}

/**
 * Helper function to define a tool
 */
export function defineTool<TParams extends object, TResult>(
  definition: ToolDefinition<TParams, TResult>,
): ToolDefinition<TParams, TResult> {
  return definition;
}
