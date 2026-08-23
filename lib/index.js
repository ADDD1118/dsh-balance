import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
import z from "@deepseek-ai/schemastery";
//#region src/index.ts
/**
* dsh-balance — host half.
*
* Backs the balance card: fetches the live DeepSeek balance, computes a
* trend/weighted daily burn over the last 7 & 30 days of token usage recorded
* in the DSH session logs, serves the card's mascot image, and reports the
* selected session's own token usage plus its cost.
*/
const HERE = dirname(fileURLToPath(import.meta.url));
const name = "dsh-balance";
const inject = [
	"webServer",
	"sessionPersistence",
	"settings"
];
/** The card's adjustable width, exposed as a settings namespace so it shows in
* the "设置 → 插件配置" page. */
const Config = z.object({ width: z.number().min(100).max(400).default(200) });
settingsNamespace("dsh-balance");
const DAY_MS = 864e5;
const CUTOVER = "2026-08-17";
const DEFAULT_BASE = "https://api.deepseek.com";
/** Default pricing (CNY per million tokens). DeepSeek idle/peak; configurable
* via `~/.dsh/.dsh-balance-pricing.json`. */
const DEFAULT_PRICING = {
	cutover: CUTOVER,
	before: {
		"deepseek-v4-flash": {
			input: 1.5,
			cacheRead: .05,
			output: 4.5
		},
		"deepseek-v4-pro": {
			input: 4.5,
			cacheRead: .15,
			output: 13.5
		},
		"deepseek-v4-flash-vision-exp": {
			input: 1.5,
			cacheRead: .05,
			output: 4.5
		}
	},
	after: {
		"deepseek-v4-flash": {
			input: 3,
			cacheRead: .1,
			output: 9
		},
		"deepseek-v4-pro": {
			input: 9,
			cacheRead: .3,
			output: 27
		},
		"deepseek-v4-flash-vision-exp": {
			input: 3,
			cacheRead: .1,
			output: 9
		}
	}
};
function homeDir() {
	return process.env.DSH_HOME ?? join(homedir(), ".dsh");
}
function pricingPath() {
	return join(homeDir(), ".dsh-balance-pricing.json");
}
function mascotPath() {
	return process.env.DSH_BALANCE_MASCOT ?? join(homeDir(), ".dsh-balance-mascot.png");
}
function loadPricing() {
	const base = structuredClone(DEFAULT_PRICING);
	try {
		const user = JSON.parse(readFileSync(pricingPath(), "utf8"));
		if (typeof user.cutover === "string") base.cutover = user.cutover;
		if (user.before) Object.assign(base.before, user.before);
		if (user.after) Object.assign(base.after, user.after);
	} catch {}
	return base;
}
function sendJson(res, status, value) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.setHeader("cache-control", "no-store");
	res.end(JSON.stringify(value));
}
function priceFor(model, at, pricing) {
	const tier = at < Date.parse(pricing.cutover) ? pricing.before : pricing.after;
	const known = model !== void 0 && Object.prototype.hasOwnProperty.call(tier, model) ? tier[model] : tier["deepseek-v4-flash"];
	return {
		input: known.input / 1e6,
		cacheRead: known.cacheRead / 1e6,
		output: known.output / 1e6
	};
}
function dayOf(at) {
	const d = new Date(at);
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}
/** Cost a single usage sample at a time/model. */
function costOf(usage, model, at, pricing) {
	const price = priceFor(model, at, pricing);
	const input = usage.inputTokens ?? 0;
	const cacheRead = usage.cacheReadTokens ?? 0;
	const output = usage.outputTokens ?? 0;
	return {
		input,
		cacheRead,
		output,
		cost: input * price.input + cacheRead * price.cacheRead + output * price.output
	};
}
/** Fold one session's events into per-(turn,step) deduped usage samples. */
function foldEvents(events) {
	let curModel;
	const perStep = /* @__PURE__ */ new Map();
	for (const raw of events) {
		const ev = raw;
		if (ev.type === "request/header") curModel = ev.data?.header?.config?.model;
		else if (ev.type === "request/context") curModel = ev.data?.model ?? curModel;
		else if (ev.type === "assistant/chunk" && ev.data?.chunk?.type === "usage") perStep.set(`${ev.data.turn}:${ev.data.step}`, {
			model: curModel,
			time: ev.time,
			usage: ev.data.chunk.usage
		});
		else if (ev.type === "assistant/message" && ev.data?.usage !== void 0) perStep.set(`${ev.data.turn}:${ev.data.step}`, {
			model: curModel,
			time: ev.time,
			usage: ev.data.usage
		});
	}
	return [...perStep.values()];
}
function spOf(ctx) {
	return ctx.get("sessionPersistence");
}
/** Per-day cost over the last `days` days for all sessions in the window. */
async function computeUsage(ctx, days, pricing) {
	const sp = spOf(ctx);
	if (sp === void 0) return null;
	const now = Date.now();
	const cutoff = now - days * DAY_MS;
	let headers;
	try {
		headers = await sp.list();
	} catch {
		return null;
	}
	const perDay = /* @__PURE__ */ new Map();
	let totalCost = 0;
	for (const h of headers) {
		if (typeof h.createdAt === "number" && h.createdAt < cutoff - 7 * DAY_MS) continue;
		let events;
		try {
			events = (await sp.inspect(h.id)).events;
		} catch {
			continue;
		}
		for (const { model, time, usage } of foldEvents(events)) {
			if (usage === void 0) continue;
			const at = Math.min(Math.max(time, cutoff), now);
			const c = costOf(usage, model, at, pricing);
			const key = dayOf(at);
			let row = perDay.get(key);
			if (row === void 0) {
				row = {
					input: 0,
					cacheRead: 0,
					output: 0,
					cost: 0
				};
				perDay.set(key, row);
			}
			row.input += c.input;
			row.cacheRead += c.cacheRead;
			row.output += c.output;
			row.cost += c.cost;
			totalCost += c.cost;
		}
	}
	return {
		days: [...perDay.entries()].map(([date, row]) => ({
			date,
			...row
		})).sort((a, b) => a.date.localeCompare(b.date)),
		totalCost
	};
}
/** Cost for a single session (current conversation). */
async function computeSessionUsage(ctx, sessionId, pricing) {
	const sp = spOf(ctx);
	if (sp === void 0) return null;
	let events;
	try {
		events = (await sp.inspect(sessionId)).events;
	} catch {
		return null;
	}
	let input = 0;
	let cacheRead = 0;
	let output = 0;
	let cost = 0;
	for (const { model, time, usage } of foldEvents(events)) {
		if (usage === void 0) continue;
		const c = costOf(usage, model, time, pricing);
		input += c.input;
		cacheRead += c.cacheRead;
		output += c.output;
		cost += c.cost;
	}
	return {
		input,
		cacheRead,
		output,
		cost
	};
}
/** Trend/weighted daily burn over the last 30 days (recent-weighted). */
function estimate(balance, daysList) {
	const now = Date.now();
	const costsByDate = new Map(daysList.map((d) => [d.date, d.cost]));
	const arr = [];
	for (let i = 0; i < 30; i += 1) {
		const key = dayOf(now - i * DAY_MS);
		arr.push(costsByDate.get(key) ?? 0);
	}
	const sum = (a) => a.reduce((x, y) => x + y, 0);
	const avgDaily7 = sum(arr.slice(0, 7)) / 7;
	const avgDaily30 = sum(arr) / 30;
	let wsum = 0;
	let wco = 0;
	for (let i = 0; i < 30; i += 1) {
		const w = Math.pow(.5, i / 7);
		wsum += w;
		wco += arr[i] * w;
	}
	const weightedDaily = wsum > 0 ? wco / wsum : 0;
	const trend = avgDaily7 - sum(arr.slice(7, 14)) / 7;
	const effectiveDaily = trend > 0 ? Math.max(weightedDaily, avgDaily7) : weightedDaily;
	return {
		avgDaily7,
		avgDaily30,
		weightedDaily,
		trend,
		effectiveDaily,
		estimatedDays: balance !== null && effectiveDaily > 0 ? balance / effectiveDaily : balance !== null && effectiveDaily === 0 ? Number.POSITIVE_INFINITY : null
	};
}
function resolveApiKey() {
	const envKey = process.env.DEEPSEEK_API_KEY;
	if (typeof envKey === "string" && envKey.trim() !== "") return envKey.trim();
	try {
		const credFile = join(homeDir(), ".credentials.yaml");
		if (existsSync(credFile)) {
			const m = readFileSync(credFile, "utf8").match(/^\s*DEEPSEEK_API_KEY:\s*"?([^"\s]+)/m);
			if (m) return m[1];
		}
	} catch {}
	return null;
}
async function getBalance(base) {
	const key = resolveApiKey();
	if (key === null) return {
		balance: null,
		currency: "CNY",
		isAvailable: false,
		error: "missing-api-key"
	};
	try {
		const res = await fetch(`${base}/user/balance`, { headers: { authorization: `Bearer ${key}` } });
		if (!res.ok) return {
			balance: null,
			currency: "CNY",
			isAvailable: false,
			error: `http-${res.status}`
		};
		const data = await res.json();
		const info = data.balance_infos?.[0];
		return {
			balance: info?.total_balance !== void 0 ? Number.parseFloat(info.total_balance) : null,
			currency: info?.currency ?? "CNY",
			isAvailable: data.is_available ?? false
		};
	} catch (error) {
		return {
			balance: null,
			currency: "CNY",
			isAvailable: false,
			error: error instanceof Error ? error.message : "network"
		};
	}
}
function apply(ctx, config) {
	const webServer = ctx.webServer;
	let cache;
	const CACHE_TTL = 6e4;
	const cached = (key, compute) => {
		if (cache !== void 0 && cache.key === key && Date.now() - cache.at < CACHE_TTL) return Promise.resolve(cache.value);
		const value = compute();
		cache = {
			key,
			at: Date.now(),
			value
		};
		return value;
	};
	let widthOf = () => config.width;
	installSettingsSection(ctx, settingsNamespace("dsh-balance"), Config, { width: config.width }, {
		setSource: (source) => {
			widthOf = () => {
				const v = source();
				return typeof v?.width === "number" ? v.width : config.width;
			};
		},
		onChange: () => {}
	});
	webServer.register({
		kind: "exact",
		path: "/dsh-balance-mascot",
		handler: (_req, res) => {
			let path = mascotPath();
			if (!existsSync(path)) path = join(HERE, "mascot.default.png");
			try {
				const bytes = readFileSync(path);
				res.statusCode = 200;
				res.setHeader("content-type", "image/png");
				res.setHeader("cache-control", "no-store");
				res.end(bytes);
			} catch {
				sendJson(res, 404, { error: "no-mascot" });
			}
		}
	});
	webServer.register({
		kind: "exact",
		path: "/dsh-balance",
		handler: async (_req, res) => {
			sendJson(res, 200, await cached("balance", () => getBalance(DEFAULT_BASE)));
		}
	});
	webServer.register({
		kind: "exact",
		path: "/dsh-session-usage",
		handler: async (req, res) => {
			const sessionId = new URL(req.url ?? "/", "http://localhost").searchParams.get("sessionId") ?? "";
			if (sessionId === "") {
				sendJson(res, 200, { error: "no-session" });
				return;
			}
			const pricing = loadPricing();
			sendJson(res, 200, await cached(`session-${sessionId}`, () => computeSessionUsage(ctx, sessionId, pricing)) ?? { error: "session-unavailable" });
		}
	});
	webServer.register({
		kind: "exact",
		path: "/dsh-balance-card",
		handler: async (_req, res) => {
			const pricing = loadPricing();
			const [balance, usage] = await Promise.all([cached("balance", () => getBalance(DEFAULT_BASE)), cached("usage-30", () => computeUsage(ctx, 30, pricing))]);
			const u = usage;
			sendJson(res, 200, {
				balance,
				estimate: estimate(balance.balance, u?.days ?? []),
				totalCost: u?.totalCost ?? 0,
				config: { width: widthOf() },
				pricing: {
					cutover: pricing.cutover,
					after: pricing.after,
					before: pricing.before
				}
			});
		}
	});
}
//#endregion
export { Config, apply, inject, name };
