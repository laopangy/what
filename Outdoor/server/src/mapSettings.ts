import { readVault, updateVault } from "./vault.js";
import type { z } from "zod";
import type { credentialSchema } from "./journeySchema.js";
export type MapCredentials = z.infer<typeof credentialSchema>;
export async function readCredentials(): Promise<MapCredentials | undefined> {
  const data = await readVault();
  return (data.outdoor as { mapCredentials?: MapCredentials } | undefined)?.mapCredentials;
}
export async function saveCredentials(credentials: MapCredentials): Promise<void> {
  await updateVault(data => {
    data.outdoor = { ...(data.outdoor as object || {}), mapCredentials: credentials };
  });
}
export async function mapStatus() {
  const credentials = await readCredentials();
  const jsReady = Boolean(credentials?.jsKey && credentials?.securityCode);
  const serviceReady = Boolean(credentials?.serviceKey);
  return { jsReady, serviceReady, ready: jsReady && serviceReady };
}
