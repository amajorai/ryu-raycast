import { z } from "zod";

// Core serializes absent conversation titles as JSON null. Extra summary fields
// belong to Core; Raycast consumes only the stable ID and optional title.
export const conversationsSchema = z.object({
  conversations: z.array(
    z.object({ id: z.string(), title: z.string().nullable() }),
  ),
});

// Mirrors the canonical broker contract in packages/core-client/src/user-jwt.ts:
// a token without a usable expiry is still valid; the caller applies a fallback.
export const userJwtSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.number().nullable().catch(null),
});

export const textDeltaSchema = z.object({
  type: z.literal("text-delta"),
  delta: z.string(),
});
