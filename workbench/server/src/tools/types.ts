import type { DeepSeekTool } from "../types/chat.js";

export interface ModuleToolPlugin {
  name: string;
  tools: DeepSeekTool[];
  execute(toolName: string, args: Record<string, unknown>): Promise<unknown>;
}
