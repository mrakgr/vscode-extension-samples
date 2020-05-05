/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
import { Range, Position, Location, workspace, languages, window, commands, ExtensionContext, Disposable, TextDocumentContentProvider, DocumentLinkProvider, EventEmitter, Uri, TextDocument, CancellationToken, DocumentLink } from 'vscode';

class ReferencesDocument {
	readonly links: DocumentLink[] = [];
	// Start with printing a header and start resolving
	private readonly _lines: string[] = [`Found ${this._locations.length} references`];
	
	// The ReferencesDocument has access to the event emitter from
	// the containg provider. This allows it to signal changes
	constructor(uri: Uri, private readonly _locations: Location[], private readonly _emitter: EventEmitter<Uri>) {
		(async () => {
			// group all locations by files containg them
			const groups: Location[][] = [];
			let group: Location[] = [];
			for (const loc of this._locations) {
				if (group.length === 0 || group[0].uri.toString() !== loc.uri.toString()) {
					group = [];
					groups.push(group); // Adds an empty initial group by mistake.
				}
				group.push(loc);
			}

			// show the groups
			for (const group of groups) {
				const ranges = group.map(loc => loc.range);
				await this._fetchAndFormatLocations(group[0].uri, ranges);
				// There is a concurrency bug in the sample where the references will fail to get printed.
				// Adding a small timeout is hacky workaround for the time being, but it would better to
				// remove this async processing until the issue is resolved.
				// https://github.com/microsoft/vscode-extension-samples/issues/287
				setTimeout(() => this._emitter.fire(uri), 10); 
			}
		})();
	}

	get value() { return this._lines.join('\n'); }

	private async _fetchAndFormatLocations(uri: Uri, ranges: Range[]): Promise<void> {
		// Fetch the document denoted by the uri and format the matches
		// with leading and trailing content form the document. Make sure
		// to not duplicate lines
		try {
			const doc = await workspace.openTextDocument(uri);
			this._lines.push('', uri.toString());
			for (let i = 0; i < ranges.length; i++) {
				const { start: { line } } = ranges[i];
				this._appendLeading(doc, line, ranges[i - 1]);
				this._appendMatch(doc, line, ranges[i], uri);
				this._appendTrailing(doc, line, ranges[i + 1]);
			}
		} catch (err) {
			this._lines.push('', `Failed to load '${uri.toString()}'\n\n${String(err)}`, '');
		}
	}

	private _appendLeading(doc: TextDocument, line: number, previous: Range): void {
		let from = Math.max(0, line - 3, previous && previous.end.line || 0);
		while (++from < line) {
			const text = doc.lineAt(from).text;
			this._lines.push(`  ${from + 1}` + (text && `  ${text}`));
		}
	}

	private _appendMatch(doc: TextDocument, line: number, match: Range, target: Uri) {
		const text = doc.lineAt(line).text;
		const preamble = `  ${line + 1}: `;

		// Append line, use new length of lines-array as line number
		// for a link that point to the reference
		const len = this._lines.push(preamble + text);

		// Create a document link that will reveal the reference
		const linkRange = new Range(len - 1, preamble.length + match.start.character, len - 1, preamble.length + match.end.character);
		const linkTarget = target.with({ fragment: String(1 + match.start.line) });
		this.links.push(new DocumentLink(linkRange, linkTarget));
	}

	private _appendTrailing(doc: TextDocument, line: number, next: Range): void {
		let to = Math.min(doc.lineCount, line + 3);
		if (next && next.start.line - to <= 2) {
			return; // next is too close, _appendLeading does the work
		}
		while (++line < to) {
			const text = doc.lineAt(line).text;
			this._lines.push(`  ${line + 1}` + (text && `  ${text}`));
		}
		if (next) {
			this._lines.push(`  ...`);
		}
	}
}

class DisposableArray implements Disposable {
	private _disposables : Disposable [] = [];
	add<t extends Disposable>(x : t): t { this._disposables.push(x); return x; }
	addAll<t extends Disposable>(...x : t[]): void { x.forEach(x => this._disposables.push(x)); }
	dispose() {this._disposables.forEach(x => x.dispose());}
}

class SampleProvider implements TextDocumentContentProvider, DocumentLinkProvider, Disposable {
	static scheme = 'references';

	private _disposables = new DisposableArray();

	private _onDidChange = this._disposables.add(new EventEmitter<Uri>());
	private _documents = new Map<string, ReferencesDocument>();

	constructor () {
		this._disposables.addAll(
			// Listen to the `closeTextDocument`-event which means we must
			// clear the corresponding model object - `ReferencesDocument`
			workspace.onDidCloseTextDocument(doc => this._documents.delete(doc.uri.toString()))
		);
	}

	dispose() { this._disposables.dispose(); }

	// Expose an event to signal changes of _virtual_ documents
	// to the editor
	get onDidChange () { return this._onDidChange.event; }

	// Provider method that takes an uri of the `references`-scheme and
	// resolves its content by (1) running the reference search command
	// and (2) formatting the results
	provideTextDocumentContent(uri: Uri): string | Thenable<string> {
		// already loaded?
		let document = this._documents.get(uri.toString());
		if (document) { return document.value; }

		// Decode target-uri and target-position from the provided uri and execute the
		// `reference provider` command (https://code.visualstudio.com/api/references/commands).
		// From the result create a references document which is in charge of loading,
		// printing, and formatting references
		const [target, pos] = decodeLocation(uri);
		return commands.executeCommand<Location[]>('vscode.executeReferenceProvider', target, pos).then(locations => {
			locations = locations || [];

			// sort by locations and shuffle to begin from target resource
			const idx = locations.sort(SampleProvider._compareLocations)
				.findIndex(loc => loc.uri.toString() === target.toString());
			if (idx !== -1) { locations.push(...locations.splice(0, idx)); }

			// create document and return its early state
			let document = new ReferencesDocument(uri, locations, this._onDidChange);
			this._documents.set(uri.toString(), document);
			return document.value;
		});
	}

	private static _compareLocations(a: Location, b: Location): number {
		// toString() is cached under the hood.
		if (a.uri.toString() < b.uri.toString()) {
			return -1;
		} else if (a.uri.toString() > b.uri.toString()) {
			return 1;
		} else {
			return a.range.start.compareTo(b.range.start);
		}
	}

	provideDocumentLinks(document: TextDocument, token: CancellationToken): DocumentLink[] | undefined {
		// While building the virtual document we have already created the links.
		// Those are composed from the range inside the document and a target uri
		// to which they point
		const doc = this._documents.get(document.uri.toString());
		if (doc) { return doc.links; }
	}
}

let seq = 0;

const encodeLocation = (uri: Uri, pos: Position): Uri => {
	const query = JSON.stringify([uri.toString(), pos.line, pos.character]);
	return Uri.parse(`${SampleProvider.scheme}:References.locations?${query}#${seq++}`);
};

const decodeLocation = (uri: Uri): [Uri, Position] => {
	let [target, line, character] = <[string, number, number]>JSON.parse(uri.query);
	return [Uri.parse(target), new Position(line, character)];
};

export const activate = (context: ExtensionContext) => {
	context.subscriptions.push(
		(() => {
			const provider = new SampleProvider();

			return Disposable.from(
				provider,
				// register content provider for scheme `references`
				workspace.registerTextDocumentContentProvider(SampleProvider.scheme, provider),
				// register document link provider for scheme `references`
				languages.registerDocumentLinkProvider({ scheme: SampleProvider.scheme }, provider)
			);
		})(),

		// register command that crafts an uri with the `references` scheme,
		// open the dynamic document, and shows it in the next editor
		commands.registerTextEditorCommand('editor.printReferences', editor => {
			const uri = encodeLocation(editor.document.uri, editor.selection.active);
			return workspace.openTextDocument(uri).then(doc => window.showTextDocument(doc, editor.viewColumn! + 1));
		})
	);
};
