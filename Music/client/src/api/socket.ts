type Callback = (data: unknown) => void;

const listeners = new Map<string, Set<Callback>>();
let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;

function connect(): void {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${location.host}/ws`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("WebSocket connected");
    reconnectDelay = 1000;
    ws?.send(JSON.stringify({ event: "subscribe:playback" }));
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const cbs = listeners.get(msg.event);
      if (cbs) cbs.forEach((cb) => cb(msg.data));
    } catch {
      // ignore
    }
  };

  ws.onclose = () => {
    ws = null;
    reconnectTimer = setTimeout(() => {
      connect();
      reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
    }, reconnectDelay);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

export function onSocketEvent(event: string, cb: Callback): () => void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(cb);

  if (!ws && !reconnectTimer) connect();

  return () => {
    listeners.get(event)?.delete(cb);
  };
}

export function getSocket(): WebSocket | null {
  return ws;
}
