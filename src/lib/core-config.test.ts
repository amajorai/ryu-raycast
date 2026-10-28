import { describe, expect, test } from "bun:test";
import { conversationsSchema, userJwtSchema } from "./core-responses";
import {
  isLocalCoreUrl,
  parseTextDeltaSseLine,
  resolveConfig,
} from "./core-config";

describe("Raycast Core configuration", () => {
  test("normalizes the default endpoint and optional preferences", () => {
    expect(resolveConfig()).toEqual({
      baseUrl: "http://localhost:7980",
      defaultAgent: null,
      token: null,
    });
    expect(
      resolveConfig({
        apiToken: "  secret-token  ",
        coreUrl: "http://127.0.0.1:7980///",
        defaultAgent: "  local-agent  ",
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:7980",
      defaultAgent: "local-agent",
      token: "secret-token",
    });
  });
});

describe("Core SSE parsing", () => {
  test("returns only text deltas", () => {
    expect(
      parseTextDeltaSseLine('data: {"type":"text-delta","delta":"hello"}'),
    ).toBe("hello");
    expect(
      parseTextDeltaSseLine('data: {"type":"finish","delta":"ignored"}'),
    ).toBeNull();
  });

  test("ignores sentinels and malformed frames", () => {
    for (const line of [
      ": keep-alive",
      "data:",
      "data: [DONE]",
      "data: not-json",
      "data: null",
      "data: []",
      'data: {"type":"text-delta","delta":null}',
      'data: {"type":"text-delta","delta":42}',
      'data: {"type":"text-delta"}',
    ]) {
      expect(parseTextDeltaSseLine(line)).toBeNull();
    }
  });
});

describe("local Core detection", () => {
  test("only this machine can broker a user identity", () => {
    expect(isLocalCoreUrl("http://localhost:7980")).toBe(true);
    expect(isLocalCoreUrl("http://127.0.0.1:8980")).toBe(true);
    expect(isLocalCoreUrl("https://team.example.ts.net")).toBe(false);
    expect(isLocalCoreUrl("::bad")).toBe(false);
  });
});

describe("Core response contracts", () => {
  test("accepts nullable conversation titles from Core summaries", () => {
    expect(
      conversationsSchema.parse({
        conversations: [
          { id: "conversation-1", title: null, created_at: 0 },
          { id: "conversation-2", title: "A title" },
          { id: "conversation-3", title: "" },
        ],
      }).conversations,
    ).toEqual([
      { id: "conversation-1", title: null },
      { id: "conversation-2", title: "A title" },
      { id: "conversation-3", title: "" },
    ]);
  });

  test("rejects malformed conversation envelopes and rows", () => {
    for (const response of [
      null,
      {},
      { conversations: null },
      { conversations: [null] },
      { conversations: [{ id: 4, title: null }] },
      { conversations: [{ id: "conversation-1", title: 4 }] },
    ]) {
      expect(conversationsSchema.safeParse(response).success).toBe(false);
    }
  });

  test("requires a nonempty JWT and tolerates a missing or null expiry", () => {
    expect(userJwtSchema.parse({ token: "jwt", expiresAt: 200 })).toEqual({
      token: "jwt",
      expiresAt: 200,
    });
    for (const response of [
      { token: "jwt" },
      { token: "jwt", expiresAt: null },
      { token: "jwt", expiresAt: "soon" },
    ]) {
      expect(userJwtSchema.parse(response)).toEqual({
        token: "jwt",
        expiresAt: null,
      });
    }
    for (const response of [null, {}, { token: "", expiresAt: 200 }]) {
      expect(userJwtSchema.safeParse(response).success).toBe(false);
    }
  });
});
