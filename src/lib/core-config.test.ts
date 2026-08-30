import { describe, expect, test } from "bun:test";
import { parseTextDeltaSseLine, resolveConfig } from "./core-config";

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
			})
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
			parseTextDeltaSseLine('data: {"type":"text-delta","delta":"hello"}')
		).toBe("hello");
		expect(
			parseTextDeltaSseLine('data: {"type":"finish","delta":"ignored"}')
		).toBeNull();
	});

	test("ignores sentinels and malformed frames", () => {
		for (const line of [
			": keep-alive",
			"data:",
			"data: [DONE]",
			"data: not-json",
		]) {
			expect(parseTextDeltaSseLine(line)).toBeNull();
		}
	});
});
