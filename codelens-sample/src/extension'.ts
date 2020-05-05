// The module 'vscode' contains the VS Code extensibility API
import { CodeLensProvider, TextDocument, CodeLens, ExtensionContext, languages, commands, workspace, window, ProviderResult, EventEmitter, Disposable, ConfigurationTarget } from 'vscode';

const isActive = () => workspace.getConfiguration("codelens-sample").get("enableCodeLens", false);

class SampleLens implements CodeLensProvider, Disposable {
	private readonly emitter: EventEmitter<void> = new EventEmitter();
	get onDidChangeCodeLenses() { return this.emitter.event; }
	private readonly disposables: Disposable = Disposable.from(
		this.emitter,
		workspace.onDidChangeConfiguration(e =>
			{ if (e.affectsConfiguration("codelens-sample")) { this.emitter.fire();}; }
		),
		this.onDidChangeCodeLenses(() => {
			window.showInformationMessage(`Codelens status changed to ${isActive()}`)
		})
	);

	dispose() { this.disposables.dispose(); }

	provideCodeLenses(document: TextDocument): ProviderResult<CodeLens[]> {
        if (isActive()) {
			const ar: CodeLens[] = [];
			for (let i=0; i < document.lineCount; i++) {
				const line = document.lineAt(i);
				if (line.text.length > 0) { ar.push(new CodeLens(line.range)); }
			}
			return ar;
		}
	}

	resolveCodeLens(codeLens: CodeLens): ProviderResult<CodeLens> {
		codeLens.command = {
			title: "Codelens provided by sample extension",
			tooltip: "Tooltip provided by sample extension",
			command: "codelens-sample.codelensAction",
			arguments: [[1,2,3]]
		};
		return;
    }
}

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export const activate = (context: ExtensionContext) => {
	const updateGlobal = (x : boolean) => {
		 workspace.getConfiguration("codelens-sample").update("enableCodeLens", x, ConfigurationTarget.Global);
	};
	const provider = new SampleLens();
	context.subscriptions.push(
		provider,
		languages.registerCodeLensProvider("*", provider),
		commands.registerCommand("codelens-sample.enableCodeLens", () => { updateGlobal(true); }),
		commands.registerCommand("codelens-sample.disableCodeLens", () => { updateGlobal(false); }),
		commands.registerCommand("codelens-sample.codelensAction", arg => {
			window.showInformationMessage(`CodeLens action clicked with args=${arg}`);
		})
	);
}

// this method is called when your extension is deactivated
export const deactivate= () => {};
