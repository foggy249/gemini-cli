/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Main Gemini Agent Framework class
 */

import { GoogleGenAI, type Content, type GenerateContentParameters } from '@google/genai';
import type {
  FrameworkConfig,
  AgentDefinition,
  AgentInputs,
  OutputObject,
  ToolDefinition,
  ChatConfig,
  Chat,
  ChatMessage,
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
