import * as vscode from 'vscode';

const {tokenTypes, tokenModifiers, legend} = (function () { // Enums are no good for this because their object keys include their values as well.
	const tokenTypesLegend = [
		'comment', 'string', 'keyword', 'number', 'regexp', 'operator', 'namespace',
		'type', 'struct', 'class', 'interface', 'enum', 'typeParameter', 'function',
		'member', 'macro', 'variable', 'parameter', 'property', 'label'
	];

	const tokenModifiersLegend = [
		'declaration', 'documentation', 'readonly', 'static', 'abstract', 'deprecated',
		'modification', 'async'
	];

	const init = (a:string []) => { const b = new Map<string,number>(); a.forEach((x,i) => b.set(x,i)); return b; };
	return {
		tokenTypes: init(tokenTypesLegend),
		tokenModifiers: init(tokenModifiersLegend),
		legend: new vscode.SemanticTokensLegend(tokenTypesLegend, tokenModifiersLegend)
	};
})();

interface IParsedToken {
	line: number;
	startCharacter: number;
	length: number;
	tokenType: string;
	tokenModifiers: string[];
}

const parseText = (text: string): IParsedToken[] => {
	let r: IParsedToken[] = [];
	text.split(/\r\n|\r|\n/).map((line,i) => {
		let currentOffset = 0;
		do {
			const openOffset = line.indexOf('[', currentOffset);
			if (openOffset === -1) {
				break;
			}
			const closeOffset = line.indexOf(']', openOffset);
			if (closeOffset === -1) {
				break;
			}
			const parseTextToken = (text: string): { tokenType: string; tokenModifiers: string[]; } => {
				let parts = text.split('.');
				return {
					tokenType: parts[0],
					tokenModifiers: parts.slice(1)
				};
			};
			let tokenData = parseTextToken(line.substring(openOffset + 1, closeOffset));
			r.push({
				line: i,
				startCharacter: openOffset + 1,
				length: closeOffset - openOffset - 1,
				tokenType: tokenData.tokenType,
				tokenModifiers: tokenData.tokenModifiers
			});
			currentOffset = closeOffset;
		} while (true);
	});
	return r;
};

const encodeTokenType = (tokenType: string): number => tokenTypes.has(tokenType) ? tokenTypes.get(tokenType)! : 0;
const encodeTokenModifiers = (strTokenModifiers: string[]): number => 
	strTokenModifiers.reduce((result, tokenModifier) =>
		tokenModifiers.has(tokenModifier) ? result | (1 << tokenModifiers.get(tokenModifier)!) : 0
	,0);

class DocumentSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
	async provideDocumentSemanticTokens(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.SemanticTokens> {
		const allTokens = parseText(document.getText());
		const builder = new vscode.SemanticTokensBuilder();
		allTokens.forEach((token) => {
			builder.push(token.line, token.startCharacter, token.length, encodeTokenType(token.tokenType), encodeTokenModifiers(token.tokenModifiers));
		});
		return builder.build();
	}
}

export const activate = (context: vscode.ExtensionContext) => {
	context.subscriptions.push(vscode.languages.registerDocumentSemanticTokensProvider({ language: 'semanticLanguage'}, new DocumentSemanticTokensProvider(), legend));
};