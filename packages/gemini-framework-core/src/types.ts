/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Core framework types and interfaces
 */

import type { Content, FunctionDeclaration } from '@google/genai';
import { type z } from 'zod';

/**
 * Agent termination modes
 */
export enum AgentTerminateMode {
  ERROR = 'ERROR',
  TIMEOUT = 'TIMEOUT',
  GOAL = 'GOAL',
  MAX_TURNS = 'MAX_TURNS',
  ABORTED = 'ABORTED',
}

/**
 * Agent output structure
 */
export interface OutputObject {
  result: string;
  terminate_reason: AgentTerminateMode;
}

/**
 * Agent input parameters
 */
export type AgentInputs = Record<string, unknown>;

/**
 * Activity events for agent execution monitoring
 */
export interface AgentActivityEvent {
  agentName: string;
  type: 'TOOL_CALL_START' | 'TOOL_CALL_END' | 'THOUGHT_CHUNK' | 'ERROR';
  data: Record<string, unknown>;
}

/**
 * Tool reference (by name or definition)
 */
export type ToolReference = string | FunctionDeclaration | ToolDefinition<object, unknown>;

/**
 * Agent definition interface
 */
export interface AgentDefinition<TOutput extends z.ZodTypeAny = z.ZodUnknown> {
  name: string;
  displayName?: string;
  description: string;
  promptConfig: PromptConfig;
  modelConfig: ModelConfig;
  runConfig: RunConfig;
  toolConfig?: ToolConfig;
  outputConfig?: OutputConfig<TOutput>;
  inputConfig: InputConfig;
  processOutput?: (output: z.infer<TOutput>) => string;
}

/**
 * Prompt configuration
 */
export interface PromptConfig {
  systemPrompt?: string;
  initialMessages?: Content[];
  query?: string;
}

/**
 * Tool configuration
 */
export interface ToolConfig {
  tools: ToolReference[];
}

/**
 * Input configuration
 */
export interface InputConfig {
  inputs: Record<
    string,
    {
      description: string;
      type: 'string' | 'number' | 'boolean' | 'integer' | 'string[]' | 'number[]';
      required: boolean;
    }
  >;
}

/**
 * Output configuration
 */
export interface OutputConfig<T extends z.ZodTypeAny> {
  outputName: string;
  description: string;
  schema: T;
}

/**
 * Model configuration
 */
export interface ModelConfig {
  model: string;
  temp: number;
  top_p: number;
  thinkingBudget?: number;
}

/**
 * Runtime configuration
 */
export interface RunConfig {
  max_time_minutes: number;
  max_turns?: number;
}

/**
 * Tool definition interface
 */
export interface ToolDefinition<TParams extends object, TResult> {
  name: string;
  description: string;
  parameters: z.ZodType<TParams>;
  execute: (params: TParams, signal?: AbortSignal) => Promise<TResult>;
}

/**
 * Framework configuration
 */
export interface FrameworkConfig {
  apiKey?: string;
  model?: string;
  tools?: ToolDefinition<object, unknown>[];
  autoApproveTools?: string[];
  requireConfirmationTools?: string[];
}

/**
 * Chat configuration
 */
export interface ChatConfig {
  model?: string;
  systemPrompt?: string;
  tools?: ToolReference[];
  temperature?: number;
  topP?: number;
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

/**
 * Chat interface
 */
export interface Chat {
  send(message: string): Promise<string>;
  sendStream(message: string): AsyncIterable<string>;
  getHistory(): ChatMessage[];
}
