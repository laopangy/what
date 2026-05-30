import type { ModuleToolPlugin } from "./types.js";

const plugins: ModuleToolPlugin[] = [];
const toolToPlugin = new Map<string, ModuleToolPlugin>();

export function registerPlugin(plugin: ModuleToolPlugin): void {
  plugins.push(plugin);
  for (const tool of plugin.tools) {
    toolToPlugin.set(tool.name, plugin);
  }
  console.log(`[toolRegistry] Registered plugin "${plugin.name}" with ${plugin.tools.length} tools`);
}

export function getAllTools() {
  return plugins.flatMap((p) => p.tools);
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const plugin = toolToPlugin.get(name);
  if (!plugin) return { error: `Unknown tool: ${name}` };
  return plugin.execute(name, args);
}
