import type { ExtensionContext, KeybindingsManager, Theme } from "@oh-my-pi/pi-coding-agent";
import type { Component, Focusable, SelectItem, TUI } from "@oh-my-pi/pi-tui";
// Standalone OMP supplies runtime UI exports through its legacy host shims.
import { getMarkdownTheme, getSelectListTheme, keyHint } from "@mariozechner/pi-coding-agent";
import { Input, Markdown, SelectList, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export interface PromptBrowserEntry {
	key: string;
	label: string;
	provider: string;
	modelId: string;
	path: string;
	content: string;
	current: boolean;
}

class PromptBrowserComponent implements Component, Focusable {
	private readonly input = new Input();
	private readonly entriesByKey: Map<string, PromptBrowserEntry>;
	private readonly searchable: readonly { entry: PromptBrowserEntry; text: string }[];
	private filtered: readonly PromptBrowserEntry[];
	private list: SelectList;
	private query = "";
	private listRows = 1;
	private previewRows = 1;
	private previewOffset = 0;
	private previewWidth = -1;
	private previewLines: readonly string[] = [];
	private previewKey: string | undefined;
	private markdown: Markdown | undefined;
	private hasFocus = false;

	constructor(
		private readonly tui: TUI,
		private readonly theme: Theme,
		private readonly keybindings: KeybindingsManager,
		entries: readonly PromptBrowserEntry[],
		private readonly done: (key: string | undefined) => void,
	) {
		this.entriesByKey = new Map(entries.map(entry => [entry.key, entry]));
		this.searchable = entries.map(entry => ({
			entry,
			text: `${entry.label}\n${entry.provider}\n${entry.modelId}\n${entry.content}`.toLowerCase(),
		}));
		this.filtered = entries;
		this.list = this.createList(entries.find(entry => entry.current)?.key);
		this.input.onSubmit = () => this.accept();
		this.input.onEscape = () => this.done(undefined);
	}

	get focused(): boolean {
		return this.hasFocus;
	}

	set focused(value: boolean) {
		this.hasFocus = value;
		this.input.focused = value;
	}

	private createList(selectedKey?: string): SelectList {
		const items: SelectItem[] = this.filtered.map(entry => ({
			value: entry.key,
			label: `${entry.current ? "[current] " : ""}${entry.label}`,
		}));
		const list = new SelectList(items, this.listRows, getSelectListTheme(), { overflowSearch: false });
		list.setSelectedIndex(Math.max(0, items.findIndex(item => item.value === selectedKey)));
		list.onSelect = item => this.done(item.value);
		list.onCancel = () => this.done(undefined);
		list.onSelectionChange = () => this.tui.requestRender();
		return list;
	}

	private accept(): void {
		const selected = this.list.getSelectedItem();
		if (selected) this.done(selected.value);
	}

	private updateFilter(): void {
		const query = this.input.getValue();
		if (query === this.query) return;
		this.query = query;
		const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
		const selectedKey = this.list.getSelectedItem()?.value;
		this.filtered = this.searchable
			.filter(item => terms.every(term => item.text.includes(term)))
			.map(item => item.entry);
		this.list = this.createList(selectedKey);
		this.previewOffset = 0;
	}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) {
			this.done(undefined);
			return;
		}
		if (this.keybindings.matches(data, "tui.select.confirm") || data === "\n") {
			this.accept();
			return;
		}
		if (this.keybindings.matches(data, "tui.editor.pageUp")) {
			this.previewOffset = Math.max(0, this.previewOffset - this.previewRows);
		} else if (this.keybindings.matches(data, "tui.editor.pageDown")) {
			this.previewOffset += this.previewRows;
		} else if (
			this.keybindings.matches(data, "tui.select.up") ||
			this.keybindings.matches(data, "tui.select.down")
		) {
			this.list.handleInput(data);
		} else {
			this.input.handleInput(data);
			this.updateFilter();
		}
		this.tui.requestRender();
	}

	pasteText(text: string): void {
		this.input.pasteText(text);
		this.updateFilter();
		this.tui.requestRender();
	}

	invalidate(): void {
		this.input.invalidate();
		this.list.invalidate();
		this.markdown?.invalidate();
		this.previewWidth = -1;
	}

	private preview(width: number, rows: number): string[] {
		const key = this.list.getSelectedItem()?.value;
		const entry = key === undefined ? undefined : this.entriesByKey.get(key);
		if (key !== this.previewKey) {
			this.previewKey = key;
			this.previewOffset = 0;
			this.previewWidth = -1;
			this.markdown = entry?.content.trim() ? new Markdown(entry.content, 0, 0, getMarkdownTheme()) : undefined;
		}
		if (width !== this.previewWidth) {
			this.previewWidth = width;
			this.previewLines = entry
				? [
					truncateToWidth(this.theme.bold(entry.label), width),
					truncateToWidth(this.theme.fg("dim", entry.path), width),
					"",
					...(this.markdown
						? this.markdown.render(width)
						: [this.theme.fg("muted", "No prompt addendum yet."), this.theme.fg("dim", "Press Enter to create one.")]),
				]
				: [this.theme.fg("muted", this.searchable.length ? "No matching model prompts." : "No model prompts available.")];
		}
		// Keep the position indicator outside the content window: no prompt line is hidden by it.
		this.previewRows = Math.max(1, rows - 1);
		this.previewOffset = Math.min(this.previewOffset, Math.max(0, this.previewLines.length - this.previewRows));
		const lines = this.previewLines.slice(this.previewOffset, this.previewOffset + this.previewRows);
		while (lines.length < this.previewRows) lines.push("");
		const end = Math.min(this.previewLines.length, this.previewOffset + this.previewRows);
		lines.push(this.theme.fg("dim", `${this.previewOffset + 1}–${end} / ${this.previewLines.length} lines`));
		return lines;
	}

	render(width: number): string[] {
		width = Math.max(1, width);
		const height = Math.max(10, Math.min(this.tui.terminal.rows - 4, Math.floor(this.tui.terminal.rows * 0.8)));
		const bodyRows = Math.max(3, height - 7);
		const split = width >= 88;
		const listRows = split ? bodyRows : Math.max(1, Math.min(5, Math.floor(bodyRows / 3)));
		if (listRows !== this.listRows) {
			this.listRows = listRows;
			this.list = this.createList(this.list.getSelectedItem()?.value);
		}
		const fit = (line: string, cells = width): string => truncateToWidth(line, cells, "", true);
		const border = this.theme.fg("borderMuted", "─".repeat(width));
		const searchLabel = this.theme.fg("accent", "Search: ");
		const searchWidth = Math.max(1, width - visibleWidth(searchLabel));
		const lines = [
			fit(this.theme.fg("accent", this.theme.bold("Model prompts"))),
			width > visibleWidth(searchLabel) ? searchLabel + this.input.render(searchWidth)[0] : this.input.render(width)[0],
			fit(this.theme.fg("muted", `${this.filtered.length} / ${this.searchable.length} prompts · [current] = active model`)),
			border,
		];

		if (split) {
			const leftWidth = Math.min(48, Math.floor(width * 0.38));
			const rightWidth = width - leftWidth - 3;
			const list = this.list.render(leftWidth);
			const preview = this.preview(rightWidth, bodyRows);
			const divider = this.theme.fg("borderMuted", " │ ");
			for (let row = 0; row < bodyRows; row++) {
				lines.push(fit(list[row] ?? "", leftWidth) + divider + fit(preview[row] ?? "", rightWidth));
			}
		} else {
			const list = this.list.render(width);
			for (let row = 0; row < listRows; row++) lines.push(fit(list[row] ?? ""));
			lines.push(border);
			lines.push(...this.preview(width, Math.max(2, bodyRows - listRows - 1)).map(line => fit(line)));
		}
		lines.push(
			border,
			fit(this.theme.fg("dim", [keyHint("tui.select.up", "previous"), keyHint("tui.select.down", "next"), keyHint("tui.select.confirm", "edit"), keyHint("tui.select.cancel", "cancel")].join("  "))),
			fit(this.theme.fg("dim", [keyHint("tui.editor.pageUp", "preview up"), keyHint("tui.editor.pageDown", "preview down"), "Type to search"].join("  "))),
		);
		return lines;
	}
}

export async function showModelPromptBrowser(
	ctx: ExtensionContext,
	entries: readonly PromptBrowserEntry[],
): Promise<string | undefined> {
	if (!ctx.hasUI || ctx.mode !== "tui") {
		throw new Error("/model-prompt requires the interactive terminal UI. Use model_prompt_show in other modes.");
	}
	return ctx.ui.custom<string | undefined>((tui, theme, keybindings, done): Component => {
		return new PromptBrowserComponent(tui, theme, keybindings, entries, done);
	});
}
