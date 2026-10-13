export type ModuleResponse<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; body?: Record<string, unknown> };

export interface ModuleRequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export type ModuleRequest = <T = unknown>(
  method: string,
  path: string,
  options?: ModuleRequestOptions,
) => Promise<ModuleResponse<T>>;

// AI-backed module endpoints (food estimation, journal structuring) can take well over a minute.
export const AI_TIMEOUT_MS = 130_000;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createModuleClient({ baseUrl, label }: { baseUrl: string; label: string }): ModuleRequest {
  const root = baseUrl.replace(/\/$/, "");

  return async function request<T = unknown>(method: string, path: string, options: ModuleRequestOptions = {}) {
    const { body, headers = {}, timeoutMs = 15_000 } = options;
    let response: Response;
    try {
      response = await fetch(`${root}${path}`, {
        method,
        headers: body === undefined ? headers : { "Content-Type": "application/json; charset=utf-8", ...headers },
        // Buffer avoids ByteString errors on Node.js v23+ Windows
        body: body === undefined ? undefined : Buffer.from(JSON.stringify(body), "utf-8"),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      return { ok: false, status: 0, error: timedOut ? `${label}服务响应超时` : `${label}服务未启动或无法连接` };
    }

    const payload: unknown = await response.json().catch(() => undefined);
    if (response.ok) return { ok: true, status: response.status, data: payload as T };

    const record = isRecord(payload) ? payload : undefined;
    const message = typeof record?.error === "string" ? record.error
      : typeof record?.message === "string" ? record.message
        : undefined;
    return {
      ok: false,
      status: response.status,
      error: response.status === 423 ? "数据仓库尚未解锁，请先在工作台输入数据密码" : message || `${label}服务返回 HTTP ${response.status}`,
      body: record,
    };
  };
}
