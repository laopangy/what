import { randomUUID } from "crypto";

export interface PendingAction {
  id: string;
  plugin: string;
  tool: string;
  args: Record<string, unknown>;
  summary: string;
  expiresAt: number;
}

export interface PendingActionStore {
  create(input: Omit<PendingAction, "id" | "expiresAt">): PendingAction;
  take(id: string): PendingAction | undefined;
  cancel(id: string): boolean;
}

interface PendingActionOptions {
  ttlMs?: number;
  maxEntries?: number;
  now?: () => number;
}

export function createPendingActionStore({
  ttlMs = 10 * 60_000,
  maxEntries = 50,
  now = Date.now,
}: PendingActionOptions = {}): PendingActionStore {
  const actions = new Map<string, PendingAction>();

  const prune = () => {
    const current = now();
    for (const [id, action] of actions) if (action.expiresAt <= current) actions.delete(id);
  };

  return {
    create(input) {
      prune();
      while (actions.size >= maxEntries) {
        const oldest = actions.keys().next();
        if (oldest.done) break;
        actions.delete(oldest.value);
      }
      const action: PendingAction = { ...input, id: randomUUID(), expiresAt: now() + ttlMs };
      actions.set(action.id, action);
      return action;
    },

    take(id) {
      prune();
      const action = actions.get(id);
      actions.delete(id);
      return action;
    },

    cancel(id) {
      return actions.delete(id);
    },
  };
}
