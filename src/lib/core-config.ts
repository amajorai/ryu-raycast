import { textDeltaSchema } from "./core-responses";

export interface RaycastPreferences {
  coreUrl?: string;
  apiToken?: string;
  defaultAgent?: string;
}

export interface RyuConfig {
  baseUrl: string;
  token: string | null;
  defaultAgent: string | null;
}

const TRAILING_SLASHES = /\/+$/;

/** Header carrying the signed-in user's JWT to a shared Core node. */
export const USER_JWT_HEADER = "x-ryu-user-jwt";

/** Whether a Core URL points at this machine, where Core can mint a user JWT. */
export function isLocalCoreUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
    return (
      host === "localhost" ||
      host === "::1" ||
      /^127(?:\.\d{1,3}){3}$/.test(host)
    );
  } catch {
    return false;
  }
}

/** Resolve Raycast preferences into the normalized Core client configuration. */
export function resolveConfig(prefs: RaycastPreferences = {}): RyuConfig {
  const baseUrl = (prefs.coreUrl || "http://localhost:7980").replace(
    TRAILING_SLASHES,
    "",
  );
  const token = prefs.apiToken?.trim() ? prefs.apiToken.trim() : null;
  const defaultAgent = prefs.defaultAgent?.trim()
    ? prefs.defaultAgent.trim()
    : null;
  return { baseUrl, token, defaultAgent };
}

/** Return a text delta from one Core SSE line, or null for non-text frames. */
export function parseTextDeltaSseLine(line: string): string | null {
  if (!line.startsWith("data:")) {
    return null;
  }
  const payload = line.slice("data:".length).trim();
  if (payload.length === 0 || payload === "[DONE]") {
    return null;
  }
  try {
    const part = textDeltaSchema.safeParse(JSON.parse(payload));
    return part.success ? part.data.delta : null;
  } catch {
    return null;
  }
}
