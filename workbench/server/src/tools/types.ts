import type { DeepSeekTool } from "../types/chat.js";

export type ToolRisk = "read" | "write" | "confirm";

export interface ModuleTool extends DeepSeekTool {
  label: string;
  risk: ToolRisk;
}

export interface ToolContext {
  journalToken?: string;
}

export type ToolPreparation = { summary: string } | { result: unknown };

export interface ModuleToolPlugin {
  name: string;
  label: string;
  summary: string;
  intent?: RegExp;
  prompt?: string;
  sensitive?: boolean;
  tools: ModuleTool[];
  execute(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown>;
  // Confirm-risk tools: return a summary to show on the confirmation card, or a result to skip confirmation.
  prepare?(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolPreparation>;
}
