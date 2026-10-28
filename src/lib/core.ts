// Shared Ryu Core client for the Raycast extension.
//
// Unlike the Electron command bar, Raycast commands run in a Node context with no
// browser Origin header, so CORS is a non-issue — these talk to Core directly.
// The base URL + optional bearer token + default agent come from the extension
// preferences (configured in Raycast → Extensions → Ryu).

import { getPreferenceValues } from "@raycast/api";
import { conversationsSchema, userJwtSchema } from "./core-responses";
import {
  isLocalCoreUrl,
  parseTextDeltaSseLine,
  resolveConfig,
  USER_JWT_HEADER,
  type RaycastPreferences,
  type RyuConfig,
} from "./core-config";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type { RyuConfig } from "./core-config";

const MAX_SSE_PENDING_BYTES = 256 * 1024;
const MAX_CHAT_OUTPUT_CHARS = 1_000_000;

/** Resolve the configured Core endpoint + auth from Raycast preferences. */
export function getConfig(): RyuConfig {
  return resolveConfig(getPreferenceValues<RaycastPreferences>());
}

/** Build Core headers: the node bearer plus, when the local Core can mint one,
 * the signed-in user's JWT so a shared node knows which member is calling. */
async function headers(config: RyuConfig, extra?: Record<string, string>) {
  const base = new Headers(extra);
  base.set("Accept", "application/json");
  if (config.token) {
    base.set("Authorization", `Bearer ${config.token}`);
  }
  const userJwt = await fetchUserJwt(config);
  if (userJwt) {
    base.set(USER_JWT_HEADER, userJwt);
  }
  return base;
}

/** Ask the LOCAL Core for the signed-in user's short-lived JWT. Raycast holds no
 * cloud session, so only a Core on this machine can broker it; a remote node's
 * bearer is never sent anywhere else. Core owns the session-token-keyed mint
 * cache, so every operation asks it again and observes account switches/logout.
 * Best effort: `null` means anonymous. */
async function fetchUserJwt(config: RyuConfig): Promise<string | null> {
  if (!isLocalCoreUrl(config.baseUrl)) {
    return null;
  }
  try {
    const resp = await fetch(`${config.baseUrl}/api/auth/user-jwt`, {
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : {},
    });
    if (!resp.ok) {
      return null;
    }
    const body = userJwtSchema.safeParse(await resp.json());
    if (!body.success) {
      return null;
    }
    return body.data.token;
  } catch {
    return null;
  }
}

/** One conversation row from `GET /api/conversations`. */
export interface RyuConversation {
  id: string;
  title: string;
}

/** List recent conversations. Throws on an unreachable/erroring Core. */
export async function listConversations(): Promise<RyuConversation[]> {
  const config = getConfig();
  const resp = await fetch(`${config.baseUrl}/api/conversations`, {
    headers: await headers(config),
  });
  if (!resp.ok) {
    throw new Error(`Core responded ${resp.status}`);
  }
  const data = conversationsSchema.parse(await resp.json());
  return data.conversations.map((conversation) => ({
    id: conversation.id,
    title: conversation.title || "Untitled",
  }));
}

/**
 * Stream a chat turn from Core's AI SDK v6 SSE endpoint, invoking `onDelta` with
 * each text chunk. Resolves with the full assistant text. `signal` aborts it.
 */
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  options?: {
    agentId?: string | null;
    conversationId?: string;
    signal?: AbortSignal;
  },
): Promise<string> {
  const config = getConfig();
  const agentId = options?.agentId ?? config.defaultAgent ?? undefined;
  const resp = await fetch(`${config.baseUrl}/api/chat/stream`, {
    method: "POST",
    headers: await headers(config, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      messages,
      agent_id: agentId,
      conversation_id: options?.conversationId,
      enable_long_term: false,
    }),
    signal: options?.signal,
  });
  if (!(resp.ok && resp.body)) {
    throw new Error(`Core responded ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  const handleLine = (line: string): void => {
    const delta = parseTextDeltaSseLine(line);
    if (delta !== null) {
      if (full.length + delta.length > MAX_CHAT_OUTPUT_CHARS) {
        throw new Error("Core chat output exceeded the client limit");
      }
      full += delta;
      onDelta(delta);
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        // A complete line is held to the same bound before it is parsed, so
        // an oversized terminated frame cannot slip past the pending check.
        if (newlineIndex * 2 > MAX_SSE_PENDING_BYTES) {
          throw new Error("Core SSE frame exceeded the client limit");
        }
        handleLine(buffer.slice(0, newlineIndex).replace(/\r$/, ""));
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");
      }
      // JavaScript strings use at most two bytes per UTF-16 code unit. This
      // conservative memory bound catches a never-terminated SSE line.
      if (buffer.length * 2 > MAX_SSE_PENDING_BYTES) {
        throw new Error("Core SSE frame exceeded the client limit");
      }
    }
    if (buffer.length > 0) {
      handleLine(buffer.replace(/\r$/, ""));
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return full;
}
