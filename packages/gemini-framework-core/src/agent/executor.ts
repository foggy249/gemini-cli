/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simplified agent executor for the framework
 */

import {
  GoogleGenAI,
  Type,
  type Content,
  type Part,
  type FunctionCall,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type FunctionDeclaration,
} from '@google/genai';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import type {
  AgentDefinition,
  AgentInputs,
  OutputObject,
  AgentActivityEvent,
  ToolDefinition,
} from '../types.js';
import { AgentTerminateMode } from '../types.js';

const TASK_COMPLETE_TOOL_NAME = 'complete_task';

export type ActivityCallback = (activity: AgentActivityEvent) => void;

/**
 * Agent executor class
 */
export class AgentExecutor<TOutput extends z.ZodTypeAny> {
  readonly definition: AgentDefinition<TOutput>;
  private readonly genAI: GoogleGenAI;
  private readonly toolRegistry: Map<string, ToolDefinition<object, unknown>>;
  private readonly onActivity?: ActivityCallback;

  constructor(
    definition: AgentDefinition<TOutput>,
    apiKey: string,
    toolRegistry: Map<string, ToolDefinition<object, unknown>>,
    onActivity?: ActivityCallback,
  ) {
    this.definition = definition;
    this.genAI = new GoogleGenAI({ apiKey });
    this.toolRegistry = toolRegistry;
    this.onActivity = onActivity;
  }

  /**
   * Run the agent with given inputs
   */
  async run(inputs: AgentInputs, signal?: AbortSignal): Promise<OutputObject> {
    const startTime = Date.now();
    let turnCounter = 0;
    let terminateReason: AgentTerminateMode = AgentTerminateMode.ERROR;
    let finalResult: string | null = null;

    try {
      // Template the system prompt and query
      const systemPrompt = this.templateString(
        this.definition.promptConfig.systemPrompt || '',
        inputs,
      );
      const query = this.templateString(
        this.definition.promptConfig.query || 'Get Started!',
        inputs,
      );

      // Prepare tools for API
      const tools = this.prepareToolsForAPI();
      
      // Start conversation with initial query
      const conversation: Content[] = [
        ...(this.definition.promptConfig.initialMessages || []),
        { role: 'user', parts: [{ text: query }] },
      ];

      while (true) {
        // Check termination conditions
        const reason = this.checkTermination(startTime, turnCounter);
        if (reason) {
          terminateReason = reason;
          break;
        }
        if (signal?.aborted) {
          terminateReason = AgentTerminateMode.ABORTED;
          break;
        }

        turnCounter++;

        // Send message to model with correct API structure
        const request: GenerateContentParameters = {
          model: this.definition.modelConfig.model,
          contents: conversation,
          config: {
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
            tools: tools.length > 0 ? tools : undefined,
            temperature: this.definition.modelConfig.temp,
            topP: this.definition.modelConfig.top_p,
          },
        };
        
        const response = await this.genAI.models.generateContent(request);

        // Extract function calls from response
        const functionCalls = this.extractFunctionCalls(response);
        
        if (functionCalls.length === 0) {
          // No function calls, end (this shouldn't happen with proper agent design)
          terminateReason = AgentTerminateMode.ERROR;
          finalResult = response.text || 'No response';
          break;
        }

        // Add model response to conversation
        const modelParts = response.candidates?.[0]?.content?.parts || [];
        conversation.push({ role: 'model', parts: modelParts });

        // Execute function calls
        const functionResponses: Part[] = [];
        for (const functionCall of functionCalls) {
          if (functionCall.name === TASK_COMPLETE_TOOL_NAME) {
            // Agent is done
            terminateReason = AgentTerminateMode.GOAL;
            finalResult = JSON.stringify(functionCall.args);
            break;
          }

          // Execute tool
          const tool = this.toolRegistry.get(functionCall.name ?? '');
          if (!tool) {
            functionResponses.push({
              functionResponse: {
                name: functionCall.name!,
                response: { error: `Tool not found: ${functionCall.name}` },
              },
            });
            continue;
          }

          this.emitActivity({
            agentName: this.definition.name,
            type: 'TOOL_CALL_START',
            data: { toolName: functionCall.name, args: functionCall.args },
          });

          try {
            const result = await tool.execute(functionCall.args ?? {}, signal);
            functionResponses.push({
              functionResponse: {
                name: functionCall.name!,
                response: { result: JSON.stringify(result) },
              },
            });

            this.emitActivity({
              agentName: this.definition.name,
              type: 'TOOL_CALL_END',
              data: { toolName: functionCall.name, success: true },
            });
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            functionResponses.push({
              functionResponse: {
                name: functionCall.name!,
                response: { error: errorMsg },
              },
            });

            this.emitActivity({
              agentName: this.definition.name,
              type: 'ERROR',
              data: { toolName: functionCall.name, error: errorMsg },
            });
          }
        }

        if (terminateReason === AgentTerminateMode.GOAL) {
          break;
        }

        // Add function responses to conversation and continue
        conversation.push({ role: 'user', parts: functionResponses });
      }

      // Process final output if needed
      if (finalResult && this.definition.processOutput && this.definition.outputConfig) {
        try {
          const parsed = JSON.parse(finalResult);
          const validated = this.definition.outputConfig.schema.parse(
            parsed[this.definition.outputConfig.outputName],
          );
          finalResult = this.definition.processOutput(validated);
        } catch (_e) {
          // Use raw result if processing fails
        }
      }

      return {
        result: finalResult || 'No result',
        terminate_reason: terminateReason,
      };
    } catch (error) {
      this.emitActivity({
        agentName: this.definition.name,
        type: 'ERROR',
        data: { error: error instanceof Error ? error.message : String(error) },
      });

      return {
        result: error instanceof Error ? error.message : String(error),
        terminate_reason: AgentTerminateMode.ERROR,
      };
    }
  }

  private templateString(template: string, inputs: AgentInputs): string {
    return template.replace(/\$\{(\w+)\}/g, (_, key) => {
      return String(inputs[key] ?? '');
    });
  }

  private prepareToolsForAPI(): { functionDeclarations: FunctionDeclaration[] }[] {
    const functionDeclarations: FunctionDeclaration[] = [];

    // Add registered tools
    if (this.definition.toolConfig) {
      for (const toolRef of this.definition.toolConfig.tools) {
        if (typeof toolRef === 'string') {
          const tool = this.toolRegistry.get(toolRef);
          if (tool) {
            const schema = zodToJsonSchema(tool.parameters) as Record<string, unknown>;
            functionDeclarations.push({
              name: tool.name,
              description: tool.description,
              parameters: schema,
            });
          }
        } else if ('name' in toolRef && 'parameters' in toolRef) {
          // It's a ToolDefinition
          const tool = toolRef as unknown as ToolDefinition<object, unknown>;
          const schema = zodToJsonSchema(tool.parameters) as Record<string, unknown>;
          functionDeclarations.push({
            name: tool.name,
            description: tool.description,
            parameters: schema,
          });
        } else {
          // It's a raw FunctionDeclaration
          functionDeclarations.push(toolRef as FunctionDeclaration);
        }
      }
    }

    // Add complete_task tool
    if (this.definition.outputConfig) {
      const outputSchema = zodToJsonSchema(this.definition.outputConfig.schema) as Record<
        string,
        unknown
      >;
      functionDeclarations.push({
        name: TASK_COMPLETE_TOOL_NAME,
        description: 'Call this function when you have completed the task.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            [this.definition.outputConfig.outputName]: outputSchema,
          },
          required: [this.definition.outputConfig.outputName],
        },
      });
    } else {
      // Default output
      functionDeclarations.push({
        name: TASK_COMPLETE_TOOL_NAME,
        description: 'Call this function when you have completed the task.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            result: { type: Type.STRING, description: 'The final result' },
          },
          required: ['result'],
        },
      });
    }

    if (functionDeclarations.length === 0) {
      return [];
    }

    return [{ functionDeclarations }];
  }

  private extractFunctionCalls(response: GenerateContentResponse): FunctionCall[] {
    const calls: FunctionCall[] = [];
    const content = response.candidates?.[0]?.content;
    if (content?.parts) {
      for (const part of content.parts) {
        if (part.functionCall) {
          calls.push(part.functionCall);
        }
      }
    }
    return calls;
  }

  private checkTermination(startTime: number, turnCounter: number): AgentTerminateMode | null {
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    if (elapsedMinutes >= this.definition.runConfig.max_time_minutes) {
      return AgentTerminateMode.TIMEOUT;
    }

    if (
      this.definition.runConfig.max_turns &&
      turnCounter >= this.definition.runConfig.max_turns
    ) {
      return AgentTerminateMode.MAX_TURNS;
    }

    return null;
  }

  private emitActivity(activity: AgentActivityEvent) {
    if (this.onActivity) {
      this.onActivity(activity);
    }
  }
}
