/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { window, Range, CodeActionKind, CodeActionProvider, TextDocument, CodeAction, WorkspaceEdit, CodeActionContext, CancellationToken, DiagnosticCollection, Diagnostic, DiagnosticSeverity, ExtensionContext, Disposable, languages, TextEditor, workspace, commands, env, Uri } from 'vscode';

const COMMAND = 'code-actions-sample.command';

interface EmojiProvider {
	actionKinds : CodeActionKind [];
	provider : CodeActionProvider;
}

/**
 * Provides code actions for converting :) to an smiley emoji.
 */
const emojizer : EmojiProvider = {
	actionKinds: [ CodeActionKind.QuickFix, CodeActionKind.Empty ],
	provider: { 
		provideCodeActions(document: TextDocument, range: Range): CodeAction[] | undefined {
			const isAtStartOfSmiley = (() => {
				const start = range.start;
				const line = document.lineAt(start.line);
				return line.text[start.character] === ':' && line.text[start.character + 1] === ')';
			})();
			if (!isAtStartOfSmiley) { return;}

			const createFix = (emoji: string, isPreferred? : boolean): CodeAction => {
				const fix = new CodeAction(`Convert to ${emoji}`, CodeActionKind.QuickFix);
				fix.edit = new WorkspaceEdit();
				fix.edit.replace(document.uri, new Range(range.start, range.start.translate(0, 2)), emoji);
				// Marking a single fix as `preferred` means that users can apply it with a
				// single keyboard shortcut using the `Auto Fix` command.
				fix.isPreferred = isPreferred;
				return fix;
			};

			const createCommand = (): CodeAction => {
				const action = new CodeAction('Learn more...', CodeActionKind.Empty);
				action.command = { command: COMMAND, title: 'Learn more about emojis', tooltip: 'This will open the unicode emoji page.' };
				return action;
			};

			return [
				createFix('😺'),
				createFix('😀', true),
				createFix('💩'),
				createCommand()
			];
		}
	}
};

/**
 * Provides code actions corresponding to diagnostic problems.
 */
const emojiInfo : EmojiProvider = {
	actionKinds: [ CodeActionKind.QuickFix ],
	provider: {
		provideCodeActions(document: TextDocument, range: Range | Selection, 
				context: CodeActionContext, token: CancellationToken): CodeAction[] {
			// for each diagnostic entry that has the matching `code`, create a code action command
			return context.diagnostics
				.filter(diagnostic => diagnostic.code === EMOJI_MENTION)
				.map(diagnostic => {
					const action = new CodeAction('Learn more...', CodeActionKind.QuickFix);
					action.command = { command: COMMAND, title: 'Learn more about emojis', tooltip: 'This will open the unicode emoji page.' };
					action.diagnostics = [diagnostic];
					action.isPreferred = true;
					return action;
					});
		}
	}
};

/** Code that is used to associate diagnostic entries with code actions. */
const EMOJI_MENTION = 'emoji_mention';
/** String to detect in the text document. */
const EMOJI = 'emoji';

/**
 * Analyzes the text document for problems. 
 * This demo diagnostic problem provider finds all mentions of 'emoji'.
 * @param doc text document to analyze
 * @param emojiDiagnostics diagnostic collection
 */
const refreshDiagnostics = (doc: TextDocument, emojiDiagnostics: DiagnosticCollection): void => {
	const diagnostics: Diagnostic[] = [];

	for (let lineIndex = 0; lineIndex < doc.lineCount; lineIndex++) {
		const lineOfText = doc.lineAt(lineIndex);
		// find where in the line of thet the 'emoji' is mentioned
		const charIndex = lineOfText.text.indexOf(EMOJI);
		if (charIndex !== -1) {
			diagnostics.push(((): Diagnostic => {
				// create a range that represents, where in the document the word is
				let range = new Range(lineIndex, charIndex, lineIndex, charIndex + EMOJI.length);
				let diagnostic = new Diagnostic(range, "When you say 'emoji', do you want to find out more?",
					DiagnosticSeverity.Information);
				diagnostic.code = EMOJI_MENTION;
				return diagnostic;
			})());
		}
	}

	emojiDiagnostics.set(doc.uri, diagnostics);
};

export const activate = (context: ExtensionContext) => {
	context.subscriptions.push(
		// subscribes to editor changes
		((): Disposable => {
			const emojiDiagnostics = languages.createDiagnosticCollection("emoji");
			const refreshDocument = (editor : {document : TextDocument}) => refreshDiagnostics(editor.document, emojiDiagnostics);
			const refreshDocumentIfActive = (editor : TextEditor | undefined) => { if (editor) { refreshDocument(editor); } };
			refreshDocumentIfActive(window.activeTextEditor);
			return Disposable.from(
				emojiDiagnostics,
				window.onDidChangeActiveTextEditor(refreshDocumentIfActive),
				workspace.onDidChangeTextDocument(refreshDocument),
				workspace.onDidCloseTextDocument(doc => emojiDiagnostics.delete(doc.uri))
			);
		})(),
		languages.registerCodeActionsProvider('markdown', emojizer.provider, {
			providedCodeActionKinds: emojizer.actionKinds
		}),
		languages.registerCodeActionsProvider('markdown', emojiInfo.provider, {
			providedCodeActionKinds: emojiInfo.actionKinds
		}),
		commands.registerCommand(COMMAND, () => 
			env.openExternal(Uri.parse('https://unicode.org/emoji/charts-12.0/full-emoji-list.html'))
		)
	);
};