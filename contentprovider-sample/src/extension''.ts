import { Range, Position, Location, workspace, languages, window, commands, ExtensionContext, Disposable, TextDocumentContentProvider, DocumentLinkProvider, EventEmitter, Uri, TextDocument, CancellationToken, DocumentLink } from 'vscode';
import * as _ from 'lodash';
// There is a bug in TextDocumentContentProvider, so right now I cannot take advantage
// of Observables, and just turn them into Promises at the end.
import * as rx from 'rxjs';
import { merge, mergeAll, map, startWith, scan, mergeMap, reduce } from 'rxjs/operators';

const itemTrailingLines = 2;
const itemMaxDistance = 5;
const itemLeadingLines = 2;

interface ReferenceDocument { text: string; links: DocumentLink[]; }

const showReferences = (firstUri: Uri, locs: Location[]): Promise<ReferenceDocument> => {
	interface RangeFromLength { from: number; length: number; }
	interface RangeFromNearTo { from: number; nearTo: number; }
	interface Link { range: RangeFromLength; uri: Uri; }
	interface DecoratedLine { text: string; links: Link[]; }
	type ClusterText = DecoratedLine[];

	const clusterTextCreate = (...x: string[]): ClusterText => {
		return x.map(x => ({ text: x, links: [] }));
	};

	const a = _.chain(locs)
		.partition(x => x.uri.toString() === firstUri.toString())
		.value()
		.map(x => _.chain(x)
			// JS is nasty in how it has no concept of comparable interfaces. Or equality or hashing.
			// Using toString() to do comparison could be dangerous.
			.groupBy(loc => loc.uri.toString())
			.map(async (loc): Promise<ClusterText> => {
				const uri = loc[0].uri; // assuming that locs all have the same Uri
				let doc = await workspace.openTextDocument(uri);

				interface RangeLine { line: number; char: RangeFromLength; }
				interface State { links: RangeLine[]; range: RangeFromNearTo; }

				const lines_ = ((): State[] => { // further groups the locations in the URI group to their cluster ranges along with the links
					const clusters: State[] = [];
					const pushCluster = ({ range, links }: State) => {
						const from = Math.max(0, range.from - itemTrailingLines);
						const nearTo = Math.min(range.nearTo + itemLeadingLines, doc.lineCount);
						clusters.push({ links, range: { from, nearTo } });
					};
					// Having the first element be null is unecessary, but doing it like this is less
					// error prone than writing a loop even if it takes a bit extra effort for the computer.
					type T = State | null;
					const cluster =
						loc.sort((x, b) => x.range.start.compareTo(b.range.start)) // assuming that locs all have the same Uri
							.map(({ range: x }): RangeLine => {
								if (!x.isSingleLine) { throw "Links have to be single line ranges"; }
								return { line: x.start.line, char: { from: x.start.character, length: x.end.character - x.start.character } };
							}).reduce((state: T, x: RangeLine): T => {
								const from = x.line;
								const nearTo = from + 1;
								const freshState = (): State => ({ range: { from, nearTo }, links: [x] });
								if (!state) { return freshState(); }
								const { range, links } = state;
								if (nearTo - range.nearTo > itemMaxDistance) { pushCluster(state); return freshState(); }
								else { links.push(x); return { links, range: { from: range.from, nearTo } }; }
							}, null);
					if (cluster) { pushCluster(cluster); }
					return clusters;
				})().map(({ links, range: { from, nearTo } }): ClusterText => { // maps the ranges and the links to their textual representation
					const lines: DecoratedLine[] = [];
					const loop = (f: (i: number) => void) => { for (let i = from; i < nearTo; i++) { f(i); } };
					// converts the range to an array of text lines
					loop(i => { lines.push({ links: [], text: doc.lineAt(i).text }); });
					// adds the links for each line
					// for the uri, the fragment field determines the line position of the outgoing link
					links.forEach(x => { lines[x.line - from].links.push({ range: x.char, uri: uri.with({ fragment: String(x.line + 1) }) }); });
					// adds the line prefix
					loop(i_ => {
						const i = i_ - from;
						const x = lines[i];
						const formatLineIndex = (minSize: number, lineIndex: number) => {
							const str = lineIndex.toString();
							return ' '.repeat(Math.max(0, minSize - str.length)) + str;
						};
						const lineNumberAsString = formatLineIndex(6, i_ + 1);
						const preamble = x.links.length > 0 ? `${lineNumberAsString}: ` : `${lineNumberAsString}  `;

						const prefixLine = (x: DecoratedLine, preamble: string) => ({
							links: x.links.map(({ range: { from, length }, uri }) => ({ range: { from: from + preamble.length, length }, uri })),
							text: preamble + x.text
						});
						lines[i] = prefixLine(x, preamble);
					});
					return lines;
				});

				return ((): ClusterText => {
					const lines: ClusterText = [];
					// Prefixes the Uri to the cluster
					lines.push(...clusterTextCreate(uri.toString()));
					// intersperses the '...' between the clusters and flattens them.
					type T = ClusterText | null;
					const a = lines_.reduce((a: T, b): T => {
						if (!a) { return b; }
						lines.push(...a, ...clusterTextCreate('   ...'));
						return b;
					}, null);
					if (a) { lines.push(...a); }
					return lines;
				})();
			}).value()
		);

	const b: rx.Observable<ClusterText> = rx.of(...(_.flatten(a))).pipe( // Merges all the observable streams.
		mergeAll(),
		startWith(clusterTextCreate(`Found ${locs.length} references.`)), // Prepends the initial line.
		mergeMap(x => [x, clusterTextCreate('')]) // Puts an empty line between the chunks
	);

	interface T { text: string[]; links: DocumentLink[]; }
	return b.pipe(
		reduce((a: T, x: ClusterText): T => {
			const { text, links } = a;
			x.forEach(x => {
				const line = text.length;
				text.push(x.text);
				x.links.forEach(({ range, uri }) => {
					links.push(
						new DocumentLink(
							new Range(line, range.from, line, range.from + range.length),
							uri
						)
					);
				});
			});
			return a;
		}, { text: [], links: [] }),
		map(({ text, links }) => ({ text: text.join("\n"), links }))
	).toPromise();
};

class SampleProvider implements TextDocumentContentProvider, DocumentLinkProvider, Disposable {
	static scheme = 'references';

	// The sample on VS Code site exposes onDidChange, but I found it to be very buggy, so
	// it has been ommited in this redesign.
	private _documents = new Map<string, Promise<ReferenceDocument>>();
	private _disposables = workspace.onDidCloseTextDocument(doc => this._documents.delete(doc.uri.toString()));

	dispose() { this._disposables.dispose(); }

	// Provider method that takes an uri of the `references`-scheme and
	// resolves its content by (1) running the reference search command
	// and (2) formatting the results
	provideTextDocumentContent(uri: Uri): string | Thenable<string> {
		// Decode target-uri and target-position from the provided uri and execute the
		// `reference provider` command (https://code.visualstudio.com/api/references/commands).
		// From the result create a references document which is in charge of loading,
		// printing, and formatting references
		const [target, pos] = decodeLocation(uri);
		return commands.executeCommand<Location[]>('vscode.executeReferenceProvider', target, pos).then((locations): Promise<string> => {
			if (!locations) { return Promise.resolve(""); }
			let document = showReferences(target, locations);
			this._documents.set(uri.toString(), document);
			return document.then(x => x.text);
		});
	}

	provideDocumentLinks(document: TextDocument, token: CancellationToken): Promise<DocumentLink[]> | undefined {
		// While building the virtual document we have already created the links.
		// Those are composed from the range inside the document and a target uri
		// to which they point
		const doc = this._documents.get(document.uri.toString());
		if (doc) { return doc.then(x => x.links); }
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
