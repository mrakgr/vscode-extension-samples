import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	let doc = await vscode.workspace.openTextDocument(context.asAbsolutePath('sample-demo.rs'));
	vscode.window.showTextDocument(doc);
	const collection = vscode.languages.createDiagnosticCollection('test');
	context.subscriptions.push(collection);
	collection.set(doc.uri, [{
		code: '',
		message: 'cannot assign twice to immutable variable `x`',
		range: new vscode.Range(new vscode.Position(3, 4), new vscode.Position(3, 10)),
		severity: vscode.DiagnosticSeverity.Error,
		source: '',
		relatedInformation: [
			new vscode.DiagnosticRelatedInformation(new vscode.Location(doc.uri, new vscode.Range(new vscode.Position(1, 8), new vscode.Position(1, 9))), 'first assignment to `x`')
		]
	}]);
}

// this method is called when your extension is deactivated
export function deactivate() {
}