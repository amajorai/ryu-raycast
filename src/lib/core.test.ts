import { afterAll, expect, mock, test } from "bun:test";

mock.module("@raycast/api", () => ({
	getPreferenceValues: () => ({
		apiToken: "node-token",
		coreUrl: "http://127.0.0.1:7980",
	}),
}));

const originalFetch = globalThis.fetch;
let brokerToken: string | null = "jwt-account-a";
let brokerHits = 0;
const conversationIdentities: Array<string | null> = [];
const chatIdentities: Array<string | null> = [];
let chatResponse: (() => Response) | null = null;
globalThis.fetch = Object.assign(
	async (input: string | URL | Request, init?: RequestInit) => {
		const url = String(input);
		if (url.endsWith("/api/auth/user-jwt")) {
			brokerHits += 1;
			return brokerToken
				? new Response(JSON.stringify({ token: brokerToken }), { status: 200 })
				: new Response(null, { status: 401 });
		}
		const identity = new Headers(init?.headers).get("x-ryu-user-jwt");
		if (url.endsWith("/api/chat/stream")) {
			chatIdentities.push(identity);
			if (chatResponse) {
				return chatResponse();
			}
			return new Response('data: {"type":"text-delta","delta":"ok"}\n\n', {
				status: 200,
				headers: { "Content-Type": "text/event-stream" },
			});
		}
		conversationIdentities.push(identity);
		return new Response(JSON.stringify({ conversations: [] }), { status: 200 });
	},
	{ preconnect: originalFetch.preconnect }
);

const { listConversations, streamChat } = await import("./core");

afterAll(() => {
	globalThis.fetch = originalFetch;
});

test("asks the broker on every operation across account switch and logout", async () => {
	await listConversations();
	brokerToken = "jwt-account-b";
	await listConversations();
	brokerToken = null;
	await listConversations();

	expect(brokerHits).toBe(3);
	expect(conversationIdentities).toEqual([
		"jwt-account-a",
		"jwt-account-b",
		null,
	]);
});

test("a chat send after an account switch or logout never carries the prior account's JWT", async () => {
	const hitsBefore = brokerHits;
	brokerToken = "jwt-account-a";
	const messages = [{ role: "user" as const, content: "hi" }];
	await streamChat(messages, () => undefined, { conversationId: "c1" });
	brokerToken = "jwt-account-b";
	await streamChat(messages, () => undefined, { conversationId: "c1" });
	brokerToken = null;
	await streamChat(messages, () => undefined, { conversationId: "c1" });

	expect(brokerHits - hitsBefore).toBe(3);
	expect(chatIdentities).toEqual(["jwt-account-a", "jwt-account-b", null]);
});

test("a chat stream that never ends its SSE line is cancelled at the bound", async () => {
	const probe = { cancelled: false, pulls: 0 };
	const chunks = ["data: ", ...Array.from({ length: 64 }, () => "x".repeat(8192))];
	chatResponse = () =>
		new Response(
			new ReadableStream<Uint8Array>({
				pull(controller) {
					const next = chunks[probe.pulls];
					probe.pulls += 1;
					if (next === undefined) {
						controller.close();
						return;
					}
					controller.enqueue(new TextEncoder().encode(next));
				},
				cancel() {
					probe.cancelled = true;
				},
			}),
			{ status: 200, headers: { "Content-Type": "text/event-stream" } }
		);
	const deltas: string[] = [];
	try {
		await expect(
			streamChat([{ role: "user", content: "hi" }], (delta) => deltas.push(delta))
		).rejects.toThrow("Core SSE frame exceeded the client limit");
	} finally {
		chatResponse = null;
	}
	expect(probe.cancelled).toBe(true);
	expect(probe.pulls).toBeLessThan(chunks.length);
	expect(deltas).toEqual([]);
});

test("a terminated chat SSE line over the bound is refused before it is parsed", async () => {
	const oversized = `data: {"type":"text-delta","delta":"${"y".repeat(200 * 1024)}"}\r\n\r\n`;
	chatResponse = () =>
		new Response(oversized, {
			status: 200,
			headers: { "Content-Type": "text/event-stream" },
		});
	const deltas: string[] = [];
	try {
		await expect(
			streamChat([{ role: "user", content: "hi" }], (delta) => deltas.push(delta))
		).rejects.toThrow("Core SSE frame exceeded the client limit");
	} finally {
		chatResponse = null;
	}
	expect(deltas).toEqual([]);
});
