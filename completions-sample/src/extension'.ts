/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { ExtensionContext, Position, languages, TextDocument, CancellationToken, CompletionContext, CompletionItem, SnippetString, MarkdownString, CompletionItemKind } from 'vscode';

export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		languages.registerCompletionItemProvider('plaintext', {
			provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext) {
				const make = (label : string, f? : (completion : CompletionItem) => void) => {
					const completion = new CompletionItem(label);
					if (f) { f(completion); }
					return completion;
				};

				// return all completion items as array
				return [
					// a simple completion item which inserts `Hello World!`
					make('Hello World!'),

					// a completion item that inserts its text as snippet,
					// the `insertText`-property is a `SnippetString` which will be
					// honored by the editor.
					make('Good part of the day', snippetCompletion => {
						snippetCompletion.insertText = new SnippetString('Good ${1|morning,afternoon,evening|}. It is ${1}, right?');
						snippetCompletion.documentation = new MarkdownString("Inserts a snippet that lets you select the _appropriate_ part of the day for your greeting.");
					}),

					// a completion item that can be accepted by a commit character,
					// the `commitCharacters`-property is set which means that the completion will
					// be inserted and then the character will be typed.
					make('console', commitCharacterCompletion => {
						commitCharacterCompletion.commitCharacters = ['.'];
						commitCharacterCompletion.documentation = new MarkdownString('Press `.` to get `console.`');
					}),

					// a completion item that retriggers IntelliSense when being accepted,
					// the `command`-property is set which the editor will execute after 
					// completion has been inserted. Also, the `insertText` is set so that 
					// a space is inserted after `new`
					make('new', commandCompletion => {
						commandCompletion.kind = CompletionItemKind.Keyword;
						commandCompletion.insertText = 'new ';
						commandCompletion.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions...' };
					})
				];
			}
		}),

		languages.registerCompletionItemProvider(
			'plaintext',
			{
				provideCompletionItems(document: TextDocument, position: Position) {
					// get all text until the `position` and check if it reads `console.`
					// and if so then complete if `log`, `warn`, and `error`
					let linePrefix = document.lineAt(position).text.substr(0, position.character);
					if (linePrefix.endsWith('console.')) {
						const make = (label : string) => new CompletionItem(label, CompletionItemKind.Method);
						return [make('log'), make('warn'), make('error')];
					}
				}
			},
			'.' // triggered whenever a '.' is being typed
		)
	);
}
