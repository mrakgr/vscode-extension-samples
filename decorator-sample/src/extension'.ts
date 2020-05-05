import * as vscode from 'vscode';

// this method is called when vs code is activated
export function activate(context: vscode.ExtensionContext) {

	console.log('decorator sample is activated');

	// create a decorator type that we use to decorate small numbers
	const smallNumberDecorationType = vscode.window.createTextEditorDecorationType({
		borderWidth: '1px',
		borderStyle: 'solid',
		overviewRulerColor: 'blue',
		overviewRulerLane: vscode.OverviewRulerLane.Right,
		light: {
			// this color will be used in light color themes
			borderColor: 'darkblue'
		},
		dark: {
			// this color will be used in dark color themes
			borderColor: 'lightblue'
		}
	});
	context.subscriptions.push(smallNumberDecorationType);
	
	// create a decorator type that we use to decorate large numbers
	const largeNumberDecorationType = vscode.window.createTextEditorDecorationType({
		cursor: 'crosshair',
		// use a themable color. See package.json for the declaration and default values.
		backgroundColor: { id: 'myextension.largeNumberBackground' }
	});
	context.subscriptions.push(largeNumberDecorationType);

	const updateDecorations = (editor : vscode.TextEditor) => {
		const regEx = /\d+/g;
		const text = editor.document.getText();
		const smallNumbers: vscode.DecorationOptions[] = [];
		const largeNumbers: vscode.DecorationOptions[] = [];
		let match;
		while (match = regEx.exec(text)) {
			const startPos = editor.document.positionAt(match.index);
			const endPos = editor.document.positionAt(match.index + match[0].length);
			const decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: 'Number **' + match[0] + '**' };
			if (match[0].length < 3) {
				smallNumbers.push(decoration);
			} else {
				largeNumbers.push(decoration);
			}
		}
		editor.setDecorations(smallNumberDecorationType, smallNumbers);
		editor.setDecorations(largeNumberDecorationType, largeNumbers);
	};

	const debounceUpdateDecorations = (() => {
		let timeout: NodeJS.Timer;
		return (editor: vscode.TextEditor) => {
			if (timeout) { clearTimeout(timeout); }
			timeout = setTimeout(() => updateDecorations(editor), 500);
		};
	})();

	const onEditor = (f: (editor: vscode.TextEditor) => void) => (editor: vscode.TextEditor | undefined) => {
		if (editor) (f(editor));
	};
	const tryTrigger = onEditor(debounceUpdateDecorations);
	tryTrigger(vscode.window.activeTextEditor);

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(tryTrigger),
		vscode.workspace.onDidChangeTextDocument(event => {
			onEditor(editor => {
				if (event.document === editor.document) {
					debounceUpdateDecorations(editor);
				}
			})(vscode.window.activeTextEditor);
		})
	);
}

