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

/** Resolve Raycast preferences into the normalized Core client configuration. */
export function resolveConfig(prefs: RaycastPreferences = {}): RyuConfig {
	const baseUrl = (prefs.coreUrl || "http://localhost:7980").replace(
		TRAILING_SLASHES,
		""
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
		const part = JSON.parse(payload) as { type?: string; delta?: unknown };
		return part.type === "text-delta" && typeof part.delta === "string"
			? part.delta
			: null;
	} catch {
		return null;
	}
}
