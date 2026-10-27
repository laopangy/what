import type { Request, Response } from "express";
import type { DesktopPetData } from "../types/pet.js";

const clients = new Set<Response>();

const send = (response: Response, event: string, data: unknown) => {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
};

export function subscribeToPetEvents(request: Request, response: Response, initial: DesktopPetData): void {
  response.status(200);
  response.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  });
  response.flushHeaders();
  clients.add(response);
  send(response, "state", initial);
  const heartbeat = setInterval(() => response.write(": keep-alive\n\n"), 25_000);
  request.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(response);
  });
}

export function publishPetState(state: DesktopPetData): void {
  for (const client of clients) send(client, "state", state);
}
