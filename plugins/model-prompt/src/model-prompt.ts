/**
 * Model Prompt Extension
 *
 * Adds a global, per-model prompt addendum stored under:
 *   getAgentDir()/model-prompts/<provider>/<encoded-model-id>.md
 *
 * Features:
 * - Appends the current model's addendum in before_agent_start
 * - /model-prompt show|edit|clear for manual management
 * - model_prompt_show and model_prompt_edit tools so the model can inspect/update
 *   its own model-specific instructions when the user explicitly asks
 *
 * Ported from @lukemelnik/pi-model-prompt 0.1.0 (MIT, Luke Melnik).
 * Upstream commit: 074b766f03f12c4851829bee095bc6640954cbed
 */

import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Api, Model } from "@oh-my-pi/pi-ai";
import type {
	ExtensionAPI,
	ExtensionContext,
	KeybindingsManager,
	Theme,
} from "@oh-my-pi/pi-coding-agent";
import type { Component, Focusable, TUI } from "@oh-my-pi/pi-tui";
// OMP's standalone executable supplies runtime UI exports through these host shims.
// Native package specifiers remain type-only so no npm packages are required.
import { DynamicBorder, getAgentDir, keyHint } from "@mariozechner/pi-coding-agent";
import {
	Container,
	Spacer,
	Text,
	truncateToWidth,
	wrapTextWithAnsi,
	visibleWidth,
} from "@mariozechner/pi-tui";
import { applyExactEdits, type ModelPromptEditInput } from "./edits";
import { showModelPromptBrowser, type PromptBrowserEntry } from "./browser";

interface ModelPromptInfo {
	provider: string;
	modelId: string;
	label: string;
	path: string;
	exists: boolean;
	content: string;
	hasContent: boolean;
}

interface ModelPromptShowDetails {
	path: string;
	provider: string;
	modelId: string;
	exists: boolean;
	hasContent: boolean;
}

interface ModelPromptEditDetails {
	path: string;
	provider: string;
	modelId: string;
	created: boolean;
}

const MODEL_PROMPT_TOOL_GUIDELINES = [
	"Use model prompt tools only when the user explicitly asks to inspect or modify model-specific behavior.",
	"Call model_prompt_show before model_prompt_edit unless you already know the exact current contents.",
	"Changes to a model prompt addendum apply on the next user prompt, not during the current turn.",
];


function encodePathSegment(value: string): string {
	return encodeURIComponent(value);
}

function getModelPromptPath(model: Pick<Model<Api>, "provider" | "id">): string {
	return join(getAgentDir(), "model-prompts", model.provider, `${encodePathSegment(model.id)}.md`);
}

async function loadModelPromptInfo(model: Pick<Model<Api>, "provider" | "id"> | undefined): Promise<ModelPromptInfo | undefined> {
	if (!model) {
		return undefined;
	}

	const path = getModelPromptPath(model);
	try {
		const content = await readFile(path, "utf-8");
		return {
			provider: model.provider,
			modelId: model.id,
			label: `${model.provider}/${model.id}`,
			path,
			exists: true,
			content,
			hasContent: content.trim().length > 0,
		};
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return {
				provider: model.provider,
				modelId: model.id,
				label: `${model.provider}/${model.id}`,
				path,
				exists: false,
				content: "",
				hasContent: false,
			};
		}
		throw error;
	}
}

async function listModelPrompts(current: Model<Api> | undefined): Promise<ModelPromptInfo[]> {
	const root = join(getAgentDir(), "model-prompts");
	const prompts = new Map<string, ModelPromptInfo>();
	let providers;
	try {
		providers = await readdir(root, { withFileTypes: true });
	} catch (error) {
		if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
		providers = [];
	}
	for (const provider of providers) {
		if (!provider.isDirectory()) continue;
		const files = await readdir(join(root, provider.name), { withFileTypes: true });
		for (const file of files) {
			if (!file.isFile() || !file.name.endsWith(".md")) continue;
			let modelId: string;
			try {
				modelId = decodeURIComponent(file.name.slice(0, -3));
			} catch {
				continue;
			}
			const info = await loadModelPromptInfo({ provider: provider.name, id: modelId });
			if (info?.exists) prompts.set(info.label, info);
		}
	}
	const active = await loadModelPromptInfo(current);
	if (active) prompts.set(active.label, active);
	return [...prompts.values()].sort((a, b) => {
		if (a.label === active?.label) return -1;
		if (b.label === active?.label) return 1;
		return a.label.localeCompare(b.label);
	});
}

function requireModelPromptInfo(info: ModelPromptInfo | undefined): ModelPromptInfo {
	if (!info) {
		throw new Error("No model selected.");
	}
	return info;
}

async function saveModelPrompt(info: ModelPromptInfo, content: string): Promise<void> {
	await mkdir(dirname(info.path), { recursive: true });
	await writeFile(info.path, content, "utf-8");
}

async function removeModelPrompt(info: ModelPromptInfo): Promise<boolean> {
	try {
		await unlink(info.path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return false;
		}
		throw error;
	}
}

function formatModelPromptBody(info: ModelPromptInfo): string {
	if (!info.exists) {
		return [
			`Current model: ${info.label}`,
			`Path: ${info.path}`,
			"",
			"No model-specific prompt addendum exists yet.",
			"",
			"Create one with /model-prompt edit or the model_prompt_edit tool.",
		].join("\n");
	}

	if (!info.hasContent) {
		return [
			`Current model: ${info.label}`,
			`Path: ${info.path}`,
			"",
			"The model prompt file exists but is empty, so nothing is currently appended.",
		].join("\n");
	}

	return [`Current model: ${info.label}`, `Path: ${info.path}`, "", info.content].join("\n");
}

class PromptScrollView implements Component {
	private readonly tui: TUI;
	private readonly theme: Theme;
	private readonly lines: string[];
	private scrollOffset = 0;

	constructor(tui: TUI, theme: Theme, body: string) {
		this.tui = tui;
		this.theme = theme;
		this.lines = body.split("\n");
	}

	invalidate(): void {}

	scrollBy(delta: number): void {
		this.scrollOffset = Math.max(0, this.scrollOffset + delta);
	}

	page(direction: -1 | 1): void {
		const pageSize = Math.max(5, Math.floor(this.tui.terminal.rows * 0.3));
		this.scrollBy(direction * pageSize);
	}

	render(width: number): string[] {
		const horizontal = this.theme.fg("borderMuted", "─");
		const contentWidth = Math.max(1, width - 2);
		const maxVisibleLines = Math.max(5, Math.floor(this.tui.terminal.rows * 0.3));
		const wrappedLines = this.lines.flatMap((line) => {
			if (line.length === 0) return [""];
			const wrapped = wrapTextWithAnsi(line, contentWidth);
			return wrapped.length > 0 ? wrapped : [""];
		});
		const maxScrollOffset = Math.max(0, wrappedLines.length - maxVisibleLines);
		this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, maxScrollOffset));
		const visibleLines = wrappedLines.slice(this.scrollOffset, this.scrollOffset + maxVisibleLines);
		const result: string[] = [];

		if (this.scrollOffset > 0) {
			const indicator = `─── ↑ ${this.scrollOffset} more `;
			const remaining = Math.max(0, width - visibleWidth(indicator));
			result.push(this.theme.fg("borderMuted", indicator + "─".repeat(remaining)));
		} else {
			result.push(horizontal.repeat(width));
		}

		for (const line of visibleLines) {
			result.push(` ${truncateToWidth(line, contentWidth, "", true)} `);
		}

		const linesBelow = wrappedLines.length - (this.scrollOffset + visibleLines.length);
		if (linesBelow > 0) {
			const indicator = `─── ↓ ${linesBelow} more `;
			const remaining = Math.max(0, width - visibleWidth(indicator));
			result.push(this.theme.fg("borderMuted", indicator + "─".repeat(remaining)));
		} else {
			result.push(horizontal.repeat(width));
		}

		return result;
	}
}

class PromptViewerComponent extends Container implements Focusable {
	private readonly keybindings: KeybindingsManager;
	private readonly scrollView: PromptScrollView;
	private readonly onClose: () => void;

	focused = false;

	constructor(
		tui: TUI,
		theme: Theme,
		keybindings: KeybindingsManager,
		title: string,
		subtitle: string,
		body: string,
		onClose: () => void,
	) {
		super();
		this.keybindings = keybindings;
		this.scrollView = new PromptScrollView(tui, theme, body);
		this.onClose = onClose;

		this.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
		this.addChild(new Text(theme.fg("muted", subtitle), 1, 0));
		this.addChild(new Spacer(1));
		this.addChild(this.scrollView);
		this.addChild(new Spacer(1));
		this.addChild(
			new Text(
				theme.fg(
					"dim",
					[
						keyHint("tui.editor.cursorUp", "scroll up"),
						keyHint("tui.editor.cursorDown", "scroll down"),
						keyHint("tui.editor.pageUp", "page up"),
						keyHint("tui.editor.pageDown", "page down"),
						keyHint("tui.select.cancel", "close"),
					].join("  "),
				),
				1,
				0,
			),
		);
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder((text: string) => theme.fg("accent", text)));
	}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel") || this.keybindings.matches(data, "tui.select.confirm")) {
			this.onClose();
			return;
		}
		if (this.keybindings.matches(data, "tui.editor.cursorUp")) {
			this.scrollView.scrollBy(-1);
			return;
		}
		if (this.keybindings.matches(data, "tui.editor.cursorDown")) {
			this.scrollView.scrollBy(1);
			return;
		}
		if (this.keybindings.matches(data, "tui.editor.pageUp")) {
			this.scrollView.page(-1);
			return;
		}
		if (this.keybindings.matches(data, "tui.editor.pageDown")) {
			this.scrollView.page(1);
		}
	}
}

async function showModelPromptViewer(ctx: ExtensionContext, info: ModelPromptInfo): Promise<void> {
	if (!ctx.hasUI || ctx.mode !== "tui") {
		throw new Error("/model-prompt show requires the interactive terminal UI. Use model_prompt_show in other modes.");
	}

	await ctx.ui.custom<void>((tui, theme, keybindings, done): Component => {
		return new PromptViewerComponent(
			tui,
			theme,
			keybindings,
			`Global model prompt for ${info.label}`,
			info.path,
			formatModelPromptBody(info),
			() => done(undefined),
		);
	});
}

async function showModelPromptEditor(ctx: ExtensionContext, info: ModelPromptInfo): Promise<string | undefined> {
	if (!ctx.hasUI) {
		throw new Error("/model-prompt edit requires interactive or RPC UI support.");
	}

	return ctx.ui.editor(
		info.hasContent ? `Edit global model prompt for ${info.label}` : `Create global model prompt for ${info.label}`,
		info.content,
	);
}

async function updateStatus(ctx: ExtensionContext, model: Model<Api> | undefined): Promise<void> {
	const info = await loadModelPromptInfo(model);
	if (info?.hasContent) {
		ctx.ui.setStatus("model-prompt", "[+P]");
	} else {
		ctx.ui.setStatus("model-prompt", undefined);
	}
}

function buildShowToolText(info: ModelPromptInfo): string {
	if (!info.exists) {
		return [
			`No model-specific prompt addendum exists for ${info.label}.`,
			`Path: ${info.path}`,
			"Create one with model_prompt_edit using a single edit whose oldText is an empty string.",
		].join("\n");
	}

	if (!info.hasContent) {
		return [
			`The model-specific prompt addendum file for ${info.label} exists but is empty.`,
			`Path: ${info.path}`,
		].join("\n");
	}

	return [`Model-specific prompt addendum for ${info.label}:`, `Path: ${info.path}`, "", info.content].join("\n");
}

async function applyToolEdits(
	info: ModelPromptInfo,
	params: ModelPromptEditInput,
	ctx: ExtensionContext,
	signal: AbortSignal | undefined,
): Promise<{
	content: Array<{ type: "text"; text: string }>;
	details: ModelPromptEditDetails;
}> {
	signal?.throwIfAborted();
	if (!info.hasContent) {
		if (params.edits.length !== 1 || params.edits[0].oldText !== "") {
			throw new Error(
				`No non-empty model prompt exists yet for ${info.label}. Create it with exactly one edit whose oldText is an empty string.`,
			);
		}

		const newContent = params.edits[0].newText;
		if (newContent.trim().length === 0) {
			throw new Error("Cannot create an empty model prompt addendum.");
		}

		signal?.throwIfAborted();
		await saveModelPrompt(info, newContent);
		await updateStatus(ctx, ctx.model);
		return {
			content: [
				{
					type: "text",
					text: `Created model prompt addendum for ${info.label} at ${info.path}. Changes apply on the next user prompt.`,
				},
			],
			details: {
				path: info.path,
				provider: info.provider,
				modelId: info.modelId,
				created: true,
			},
		};
	}

	const newContent = applyExactEdits(info.content, params.edits);
	signal?.throwIfAborted();
	await saveModelPrompt(info, newContent);

	await updateStatus(ctx, ctx.model);
	return {
		content: [
			{
				type: "text",
				text: `Updated model prompt addendum for ${info.label} at ${info.path}. Changes apply on the next user prompt.`,
			},
		],
		details: {
			path: info.path,
			provider: info.provider,
			modelId: info.modelId,
			created: false,
		},
	};
}

export default function modelPromptExtension(pi: ExtensionAPI) {
	const { Type } = pi.typebox;
	const modelPromptShowSchema = Type.Object({});
	const modelPromptEditSchema = Type.Object({
		edits: Type.Array(
			Type.Object({
				oldText: Type.String({
					description:
						"Exact text to replace, matching uniquely. Use an empty string only to initialize a missing or empty model prompt.",
				}),
				newText: Type.String({ description: "Replacement text." }),
			}),
			{
				minItems: 1,
				description:
					"Exact replacements applied in order. Every match must be unique; no changes are written if any edit fails. To initialize a missing or empty prompt, supply one edit with empty oldText and non-empty newText.",
			},
		),
	});

	pi.registerTool({
		name: "model_prompt_show",
		label: "Model Prompt Show",
		description: [
			"Show the current global model-specific prompt addendum for the active model.",
			...MODEL_PROMPT_TOOL_GUIDELINES,
		].join("\n"),
		parameters: modelPromptShowSchema,
		approval: "read",
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			const info = requireModelPromptInfo(await loadModelPromptInfo(ctx.model));
			return {
				content: [{ type: "text", text: buildShowToolText(info) }],
				details: {
					path: info.path,
					provider: info.provider,
					modelId: info.modelId,
					exists: info.exists,
					hasContent: info.hasContent,
				} satisfies ModelPromptShowDetails,
			};
		},
	});

	pi.registerTool({
		name: "model_prompt_edit",
		label: "Model Prompt Edit",
		description: [
			"Edit the current global model-specific prompt addendum for the active model using exact, unique text replacements.",
			"To initialize a missing or empty prompt, supply exactly one edit with empty oldText and non-empty newText.",
			...MODEL_PROMPT_TOOL_GUIDELINES,
		].join("\n"),
		parameters: modelPromptEditSchema,
		approval: "write",
		async execute(_toolCallId, params, signal, _onUpdate, ctx) {
			const info = requireModelPromptInfo(await loadModelPromptInfo(ctx.model));
			return applyToolEdits(info, params, ctx, signal);
		},
	});

	pi.registerCommand("model-prompt", {
		description: "Browse, edit, show, or clear model prompt addenda",
		handler: async (args, ctx) => {
			const subcommand = args.trim();
			let info: ModelPromptInfo;
			if (subcommand === "") {
				const prompts = await listModelPrompts(ctx.model);
				const entries: PromptBrowserEntry[] = prompts.map(prompt => ({
					key: prompt.label,
					label: prompt.label,
					provider: prompt.provider,
					modelId: prompt.modelId,
					path: prompt.path,
					content: prompt.content,
					current: prompt.provider === ctx.model?.provider && prompt.modelId === ctx.model?.id,
				}));
				const selected = await showModelPromptBrowser(ctx, entries);
				if (!selected) return;
				const choice = prompts.find(prompt => prompt.label === selected);
				if (!choice) return;
				info = requireModelPromptInfo(await loadModelPromptInfo({ provider: choice.provider, id: choice.modelId }));
			} else {
				info = requireModelPromptInfo(await loadModelPromptInfo(ctx.model));
			}

			if (subcommand === "show") {
				await showModelPromptViewer(ctx, info);
				return;
			}

			if (subcommand === "" || subcommand === "edit") {
				const result = await showModelPromptEditor(ctx, info);
				if (result === undefined) {
					ctx.ui.notify("Cancelled", "info");
					return;
				}

				if (result.trim().length === 0) {
					const removed = await removeModelPrompt(info);
					await updateStatus(ctx, ctx.model);
					ctx.ui.notify(
						removed
							? `Cleared global model prompt for ${info.label}. Changes apply on the next user prompt.`
							: `No model prompt existed for ${info.label}.`,
						"info",
					);
					return;
				}

				await saveModelPrompt(info, result);
				await updateStatus(ctx, ctx.model);
				ctx.ui.notify(
					`Saved global model prompt for ${info.label}. Changes apply on the next user prompt.`,
					"info",
				);
				return;
			}

			if (subcommand === "clear") {
				if (!ctx.hasUI) {
					throw new Error("/model-prompt clear requires interactive or RPC UI support.");
				}

				if (!info.exists) {
					ctx.ui.notify(`No model prompt exists for ${info.label}.`, "info");
					return;
				}

				const confirmed = await ctx.ui.confirm(
					`Clear model prompt for ${info.label}?`,
					`Delete ${info.path}? This only affects future prompts for the current model.`,
				);
				if (!confirmed) {
					ctx.ui.notify("Cancelled", "info");
					return;
				}

				await removeModelPrompt(info);
				await updateStatus(ctx, ctx.model);
				ctx.ui.notify(
					`Cleared global model prompt for ${info.label}. Changes apply on the next user prompt.`,
					"info",
				);
				return;
			}

			ctx.ui.notify("Usage: /model-prompt [edit|show|clear]", "warning");
		},
	});

	pi.on("before_agent_start", async (event, ctx) => {
		const info = await loadModelPromptInfo(ctx.model);
		ctx.ui.setStatus("model-prompt", info?.hasContent ? "[+P]" : undefined);
		if (!info?.hasContent) {
			return undefined;
		}

		return {
			systemPrompt: [
				...event.systemPrompt,
				`## Model-Specific Instructions (${info.label})\n\n${info.content}`,
			],
		};
	});

	pi.on("session_start", async (_event, ctx) => {
		await updateStatus(ctx, ctx.model);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		ctx.ui.setStatus("model-prompt", undefined);
	});
}
