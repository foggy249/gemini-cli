/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Gemini Agent Framework - Main Entry Point
 * 
 * A lightweight framework for building AI agents with Google Gemini.
 * 
 * @packageDocumentation
 */

// Main framework exports
export { AgentFramework, defineAgent, defineTool } from './framework.js';

// Type exports
export type {
  FrameworkConfig,
  AgentDefinition,
  AgentInputs,
  OutputObject,
  AgentActivityEvent,
  ToolDefinition,
  ToolReference,
  ChatConfig,
  Chat,
  ChatMessage,
  PromptConfig,
  ToolConfig,
  InputConfig,
  OutputConfig,
  ModelConfig,
  RunConfig,
} from './types.js';

// Enums
export { AgentTerminateMode } from './types.js';

// Agent executor (advanced use)
export { AgentExecutor, type ActivityCallback } from './agent/executor.js';
