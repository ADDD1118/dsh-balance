window.__ModuleLoader__.load({
	id: "dsh-balance",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/BalanceCard.tsx
		/**
		* The floating balance card — a compact widget. The cut-out girl (transparent
		* background + bubble) is on top and her paws rest right on the liquid-glass
		* balance box, so she appears to cling onto it. The estimated-days value lives
		* in a small glass chip inside the speech bubble (top-left).
		*
		* The card stores its position as a *fraction of the free space* (`fx`/`fy` in
		* [0,1] over the area not occupied by the card itself), not as absolute pixels.
		* Rendering maps that fraction onto the current viewport, so when the browser
		* window moves to a differently-sized display (or is resized) the card keeps
		* its relative placement and never leaves the visible area — no re-snapping or
		* jump is needed to keep it reachable.
		*/
		const POS_STORE = "dsh-balance-pos";
		const W = 200;
		const CARD_H0 = 260;
		const glass = {
			background: "linear-gradient(135deg, rgba(30,40,66,0.5), rgba(16,24,44,0.42))",
			backdropFilter: "blur(12px) saturate(150%)",
			WebkitBackdropFilter: "blur(12px) saturate(150%)",
			border: "1px solid rgba(255,255,255,0.14)",
			boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 8px 22px rgba(0,0,0,0.24)",
			color: "#fff",
			fontFamily: "var(--dsw-font-family)",
			textShadow: "0 1px 2px rgba(0,0,0,0.5)"
		};
		const label$1 = (size, op = .72) => ({
			fontSize: size,
			fontWeight: 600,
			opacity: op,
			lineHeight: 1.3,
			whiteSpace: "nowrap"
		});
		const value = (size, w = 800) => ({
			fontSize: size,
			fontWeight: w,
			lineHeight: 1.1,
			whiteSpace: "nowrap"
		});
		function clamp01(v) {
			return Math.max(0, Math.min(1, v));
		}
		/** Restore the saved position. New saves are fractions; older saves are pixels. */
		function restorePos() {
			try {
				const raw = localStorage.getItem(POS_STORE);
				if (raw !== null) {
					const p = JSON.parse(raw);
					if (typeof p.fx === "number" && typeof p.fy === "number") return {
						fx: clamp01(p.fx),
						fy: clamp01(p.fy)
					};
					if (typeof p.x === "number" && typeof p.y === "number") return {
						fx: clamp01(p.x / Math.max(1, window.innerWidth - W)),
						fy: clamp01(p.y / Math.max(1, window.innerHeight - CARD_H0))
					};
				}
			} catch {}
			return {
				fx: .98,
				fy: .08
			};
		}
		function fmtMoney(v) {
			if (v === null || Number.isNaN(v)) return "—";
			return v.toLocaleString("zh-CN", {
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			});
		}
		function fmtTokens(v) {
			if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
			if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
			return String(Math.round(v));
		}
		function BalanceCard({ useSessions, t }) {
			const [data, setData] = (0, react.useState)(null);
			const [sess, setSess] = (0, react.useState)(null);
			const [width, setWidth] = (0, react.useState)(200);
			const [pos, setPos] = (0, react.useState)(restorePos);
			const [viewport, setViewport] = (0, react.useState)(() => ({
				vw: window.innerWidth,
				vh: window.innerHeight
			}));
			const pointer = (0, react.useRef)(null);
			const cardRef = (0, react.useRef)(null);
			const scale = width / 200;
			const fs = (size) => Math.round(size * scale);
			const cardH = cardRef.current?.offsetHeight ?? CARD_H0;
			const maxX = Math.max(1, viewport.vw - width);
			const maxY = Math.max(1, viewport.vh - cardH);
			const left = Math.round(pos.fx * maxX);
			const top = Math.round(pos.fy * maxY);
			const toFraction = (0, react.useCallback)((x, y) => {
				const h = cardRef.current?.offsetHeight ?? CARD_H0;
				const mx = Math.max(1, viewport.vw - width);
				const my = Math.max(1, viewport.vh - h);
				let cx = Math.max(0, Math.min(x, mx));
				let cy = Math.max(0, Math.min(y, my));
				const edge = 16;
				if (cx <= edge) cx = 0;
				else if (cx >= mx - edge) cx = mx;
				if (cy <= edge) cy = 0;
				else if (cy >= my - edge) cy = my;
				return {
					fx: cx / mx,
					fy: cy / my
				};
			}, [viewport, width]);
			(0, react.useEffect)(() => {
				const onResize = () => setViewport({
					vw: window.innerWidth,
					vh: window.innerHeight
				});
				window.addEventListener("resize", onResize);
				return () => window.removeEventListener("resize", onResize);
			}, []);
			const sessionId = useSessions((s) => s.current);
			(0, react.useEffect)(() => {
				let alive = true;
				const load = async () => {
					try {
						const json = await (await fetch("/dsh-balance-card")).json();
						if (alive) {
							setData(json);
							if (typeof json.config?.width === "number") setWidth(json.config.width);
						}
					} catch {}
				};
				load();
				const timer = setInterval(() => {
					load();
				}, 6e4);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, []);
			(0, react.useEffect)(() => {
				if (sessionId === void 0) {
					setSess(null);
					return;
				}
				let alive = true;
				const load = async () => {
					try {
						const json = await (await fetch(`/dsh-session-usage?sessionId=${encodeURIComponent(sessionId)}`)).json();
						if (alive && "cost" in json) setSess(json);
					} catch {}
				};
				load();
				const timer = setInterval(() => {
					load();
				}, 6e4);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, [sessionId]);
			const onPointerDown = (0, react.useCallback)((e) => {
				e.currentTarget.setPointerCapture(e.pointerId);
				pointer.current = {
					x: e.clientX - left,
					y: e.clientY - top
				};
			}, [left, top]);
			const onPointerMove = (0, react.useCallback)((e) => {
				if (pointer.current === null) return;
				if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
				setPos(toFraction(e.clientX - pointer.current.x, e.clientY - pointer.current.y));
			}, [toFraction]);
			const onPointerUp = (0, react.useCallback)((e) => {
				if (pointer.current === null) return;
				e.currentTarget.releasePointerCapture(e.pointerId);
				const final = toFraction(e.clientX - pointer.current.x, e.clientY - pointer.current.y);
				pointer.current = null;
				setPos(final);
				try {
					localStorage.setItem(POS_STORE, JSON.stringify(final));
				} catch {}
			}, [toFraction]);
			const est = data?.estimate ?? null;
			const balance = data?.balance?.balance ?? null;
			const trendTxt = est === null ? "" : est.trend > .001 ? t("card.trend.up") : est.trend < -.001 ? t("card.trend.down") : t("card.trend.flat");
			const daysText = est === null || est.estimatedDays === null || est.estimatedDays === Number.POSITIVE_INFINITY ? t("card.days.unlimited") : t("card.days.value", { v: String(Math.floor(est.estimatedDays)) });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				onPointerDown,
				onPointerMove,
				onPointerUp,
				ref: cardRef,
				style: {
					position: "fixed",
					left,
					top,
					zIndex: 1050,
					width,
					pointerEvents: "auto",
					cursor: "grab",
					userSelect: "none",
					touchAction: "none"
				},
				role: "dialog",
				"aria-label": t("card.days"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						position: "relative",
						zIndex: 2
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
						src: "/dsh-balance-mascot?v=girlbubble8",
						alt: "",
						draggable: false,
						style: {
							display: "block",
							width: "100%",
							height: "auto",
							pointerEvents: "none"
						}
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							position: "absolute",
							left: "10%",
							top: "16%",
							width: "24%",
							height: "25%",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							textAlign: "center",
							gap: 1,
							color: "#263a63",
							fontFamily: "var(--dsw-font-family)"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: fs(8),
									fontWeight: 700,
									color: "#263a63",
									lineHeight: 1.2,
									whiteSpace: "nowrap",
									opacity: .85
								},
								children: t("card.days.label")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: fs(17),
									fontWeight: 800,
									color: "#263a63",
									lineHeight: 1.05,
									whiteSpace: "nowrap"
								},
								children: daysText
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: fs(7),
									fontWeight: 600,
									color: "#263a63",
									lineHeight: 1.2,
									whiteSpace: "nowrap",
									opacity: .8
								},
								children: trendTxt
							})
						]
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						...glass,
						borderRadius: fs(13),
						padding: `${fs(7)}px ${fs(10)}px`,
						marginTop: "-5%",
						textAlign: "center",
						position: "relative",
						zIndex: 1
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "baseline",
								justifyContent: "center",
								gap: fs(4)
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: label$1(fs(8), .75),
								children: t("card.balance")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: value(fs(14)),
								children: balance === null ? t("card.error") : `¥${fmtMoney(balance)}`
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								alignItems: "baseline",
								justifyContent: "center",
								gap: fs(4),
								marginTop: fs(4)
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: label$1(fs(8), .75),
								children: t("card.usage")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: value(fs(11), 700),
								children: sess === null ? t("card.error") : `¥${fmtMoney(sess.cost)}`
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: label$1(fs(7), .55),
							children: sess === null ? "" : t("card.usage.value", {
								in: fmtTokens(sess.input),
								out: fmtTokens(sess.output)
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: fs(8),
								justifyContent: "center",
								marginTop: fs(5),
								alignItems: "center"
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: label$1(fs(8), .82),
									children: t("card.recent7", { v: est === null ? "—" : fmtMoney(est.avgDaily7) })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
									width: 1,
									height: fs(8),
									background: "rgba(255,255,255,0.22)"
								} }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: label$1(fs(8), .82),
									children: t("card.recent30", { v: est === null ? "—" : fmtMoney(est.avgDaily30) })
								})
							]
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/balance-settings-controller.ts
		/** The settings namespace this card edits (spelled here, not imported). */
		const BALANCE_NS = "dsh-balance";
		/** Bridges the `dsh-balance` settings scope onto the card's actions. */
		var BalanceSettingsCardController = class {
			scope;
			constructor(scope) {
				this.scope = scope;
			}
			inject() {
				return {
					getWidth: () => this.scope.getSnapshot().value?.width,
					setWidth: (value) => this.scope.set("width", value)
				};
			}
		};
		//#endregion
		//#region src/client/BalanceSettingsCard.tsx
		/**
		* The dsh-balance "adjust size" card, registered into `settings.plugin.item`
		* under the `dsh-balance` namespace. A minimal self-contained form: a numeric
		* width input and a Save button, writing to the settings scope.
		*/
		const row = {
			display: "flex",
			alignItems: "center",
			gap: 10,
			marginTop: 4
		};
		const label = {
			fontSize: 13,
			color: "var(--dsw-alias-label-primary)",
			fontWeight: 600,
			minWidth: 90
		};
		const input = {
			flex: 1,
			height: 30,
			padding: "0 8px",
			borderRadius: 8,
			border: "1px solid var(--dsw-alias-border-l2)",
			background: "var(--dsw-alias-bg-layer-1)",
			color: "var(--dsw-alias-label-primary)",
			fontSize: 13,
			boxSizing: "border-box"
		};
		const button = {
			height: 30,
			padding: "0 14px",
			borderRadius: 15,
			border: "none",
			cursor: "pointer",
			background: "var(--dsw-alias-button-info-fill)",
			color: "#fff",
			fontSize: 13,
			fontWeight: 600
		};
		const hint = {
			fontSize: 11,
			color: "var(--dsw-alias-label-tertiary)",
			marginTop: 4
		};
		function BalanceSettingsCard({ t, getWidth, setWidth }) {
			const [draft, setDraft] = (0, react.useState)(() => {
				const w = getWidth();
				return w === void 0 ? "200" : String(w);
			});
			const [done, setDone] = (0, react.useState)(false);
			const parsed = Number(draft);
			const valid = Number.isFinite(parsed) && parsed >= 100 && parsed <= 400;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: row,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: label,
							children: t("settings.width")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							style: input,
							type: "text",
							inputMode: "numeric",
							value: draft,
							"aria-label": t("settings.width"),
							onChange: (e) => {
								setDraft(e.target.value);
								setDone(false);
							}
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							style: {
								...button,
								opacity: valid ? 1 : .5
							},
							disabled: !valid,
							onClick: () => {
								setWidth(parsed).then(() => {
									setDone(true);
								});
							},
							children: t("settings.save")
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: hint,
					children: t("settings.widthHint")
				}),
				done && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						...hint,
						color: "var(--dsw-alias-state-success-primary)"
					},
					children: t("settings.saved")
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					type: "hidden",
					value: BALANCE_NS,
					readOnly: true
				})
			] });
		}
		//#endregion
		//#region src/client/locales.ts
		/** dsh-balance browser copy. Product copy is Chinese; English mirrors it. */
		const NS = "dsh-balance";
		const zh = {
			"card.days": "预计可用天数",
			"card.days.label": "预计可用",
			"card.days.value": "{v} 天",
			"card.days.unlimited": "充足",
			"card.balance": "当前余额",
			"card.usage": "当前任务消耗",
			"card.usage.value": "输入 {in} · 输出 {out}",
			"card.cost": "消耗 ¥{cost}",
			"card.recent7": "近7天日均 ¥{v}",
			"card.recent30": "近30天日均 ¥{v}",
			"card.weighted": "加权日均 ¥{v}",
			"card.trend.up": "↑ 用量上升",
			"card.trend.down": "↓ 用量下降",
			"card.trend.flat": "— 用量平稳",
			"card.error": "—",
			"settings.width": "卡片宽度",
			"settings.widthHint": "范围 100–400 px，保存后刷新可见大小变化。",
			"settings.save": "保存",
			"settings.saved": "已保存"
		};
		const en = {
			"card.days": "Est. days left",
			"card.days.label": "Est. days",
			"card.days.value": "{v} days",
			"card.days.unlimited": "Plenty",
			"card.balance": "Balance",
			"card.usage": "Current task",
			"card.usage.value": "In {in} · Out {out}",
			"card.cost": "Cost ¥{cost}",
			"card.recent7": "7d avg ¥{v}",
			"card.recent30": "30d avg ¥{v}",
			"card.weighted": "Wtd avg ¥{v}",
			"card.trend.up": "↑ rising",
			"card.trend.down": "↓ falling",
			"card.trend.flat": "— flat",
			"card.error": "—",
			"settings.width": "Card width",
			"settings.widthHint": "Range 100–400 px; refresh to see the size change.",
			"settings.save": "Save",
			"settings.saved": "Saved"
		};
		//#endregion
		//#region src/client/index.ts
		/** Required services for locale registration, the overlay slot, and the settings scope. */
		const inject = [
			"slots",
			"locale",
			"settingsScope"
		];
		/**
		* Client plugin body: register the dictionaries, the overlay card, and the
		* settings card.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-balance: dictionaries");
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "dsh-balance",
				order: 1,
				locale: NS
			}, BalanceCard));
			const settingsCard = new BalanceSettingsCardController(ctx.settingsScope.bind({ namespace: BALANCE_NS }));
			ctx.slots.inject("settings.plugin.item", function* () {
				yield ctx.slots.register({
					name: "settings.plugin.item",
					key: BALANCE_NS,
					locale: NS,
					inject: () => settingsCard.inject()
				}, BalanceSettingsCard);
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map