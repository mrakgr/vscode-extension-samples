// My own redesign of the original extension.

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { TextDocument, window, Range, CallHierarchyItem, Uri, SymbolKind, CancellationToken, CallHierarchyProvider, CallHierarchyOutgoingCall, CallHierarchyIncomingCall, ExtensionContext, languages, workspace } from 'vscode';
import * as us from 'underscore';

class LowercaseString {
	public readonly content : string;
	constructor(str : string) {
		this.content = str.toLowerCase();
	}
	equals(b : LowercaseString) { return this.content === b.content; }
	toString() {return this.content;}
}

const enum WordType { Verb, Noun }

class Word {
	constructor(public text: LowercaseString, public range: Range, public type : WordType) {}
	equals(b : Word) {return this.text.equals(b.text);}
	toString() {return this.text;}
}

class FoodRelation {
	constructor(public subject: Word, public verb: Word, public object: Word) {}
	toString() {return `${this.subject.toString()} ${this.verb.toString()} ${this.object.toString()}`;}
}

type FoodModel = readonly FoodRelation[];

const getRelationAndWordAt = (relations: FoodModel, wordRange: Range): {relation: FoodRelation, word: Word} | undefined => {
	for (const relation of relations) {
		const has = (word : Word) => word.range.contains(wordRange) ? word : undefined;
		const word = has(relation.subject) || has(relation.verb) || has(relation.object);
		if (word) {return {relation, word};}
	}
};

const getVerbRelations = (relations: FoodModel, verb: LowercaseString): FoodRelation[] => {
	return relations.filter(relation => relation.verb.text.equals(verb));
};


const getSubjectRelations = (relations: FoodModel, subject: LowercaseString): FoodRelation[] => {
	return relations.filter(relation => relation.subject.text.equals(subject));
};

const getObjectRelations = (relations: FoodModel, object: LowercaseString): FoodRelation[] => {
	return relations.filter(relation => relation.object.text.equals(object));
};

const parse = (textDocument: TextDocument): FoodModel => {
	const relations : FoodRelation [] = [];
	const pattern = /^(\w+)\s+(\w+)\s+(\w+).$/gm;
	let match_: RegExpExecArray | null;
	while (match_ = pattern.exec(textDocument.getText())) {
		const match = match_; 
		const startPosition = textDocument.positionAt(match_.index);
		const translate = (characterDelta : number) => startPosition.translate({characterDelta});
		const orig = match[0];
		let end = 0;
		const f = (type : WordType, index : number) => {
			const x = match[index];
			const start = orig.indexOf(x, end);
			end = start + x.length;
			return new Word(new LowercaseString(x), new Range(translate(start),translate(end)),type);
			};
		relations.push(new FoodRelation(f(WordType.Noun,1), f(WordType.Verb,2), f(WordType.Noun,3)));
	}
	return relations;
};

class FoodItem extends CallHierarchyItem {
	constructor(type: string, uri: Uri, public model: FoodModel, public relation: FoodRelation, public word: Word) {
		super(SymbolKind.Object, word.text.content, `(${type})`, uri, word.range, word.range);
	}
}

const provideCallHierarchyTemplate = 
		<a>(getSubject : (arg: FoodRelation) => Word, getObject : (arg: FoodRelation) => Word, 
		verbType : string, getSubjectRelations : (model : FoodModel, word : LowercaseString) => FoodRelation [],
		createCall : (item: CallHierarchyItem, fromRanges: Range[]) => a) => 
		(item_ : CallHierarchyItem, _ : CancellationToken): a [] => {
	const {model, relation, word, uri} = <FoodItem>item_;
	switch (word.type) {
		case WordType.Verb: {
			return getVerbRelations(model,word.text)
				.filter(relation_ => getSubject(relation_).equals(getSubject(relation)))
				.map(relation => {
					const word = getObject(relation);
					return createCall(
						new FoodItem("noun", uri, model, relation, word), 
						[word.range]);
				});
		}
		case WordType.Noun: {
			return us.chain(getSubjectRelations(model,word.text))
				.groupBy(x => x.verb.text.content)
				.map(relations => {
						const relation = relations[0];
						const word = relation.verb;
						return createCall(
							new FoodItem(verbType, uri, model, relation, word), 
							relations.map(relation => relation.verb.range));
					})
				.value();
		}
	} 
};

const foodPyramidHierarchyProvider : CallHierarchyProvider = {
	prepareCallHierarchy(document, position) {
		const range = document.getWordRangeAtPosition(position);
		if (range) {
			const model = parse(document);
			const x = getRelationAndWordAt(model,range);
			if (x) { return new FoodItem("",document.uri,model,x.relation,x.word); }
		}
	},

	provideCallHierarchyOutgoingCalls: 
		provideCallHierarchyTemplate(x => x.subject, x => x.object, "verb", getSubjectRelations,
		(a,b) => new CallHierarchyOutgoingCall(a,b)),

	provideCallHierarchyIncomingCalls:
		provideCallHierarchyTemplate(x => x.object, x => x.subject, "verb-inverted", getObjectRelations,
		(a,b) => new CallHierarchyIncomingCall(a,b))
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export const activate = (context: ExtensionContext) => {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "call-hierarchy-sample" is now active!');

	context.subscriptions.push(languages.registerCallHierarchyProvider('plaintext', foodPyramidHierarchyProvider));

	(async (): Promise<void> => {
		let sampleTextEncoded = await workspace.fs.readFile(Uri.file(context.asAbsolutePath('sample.txt')));
		let sampleText = new TextDecoder('utf-8').decode(sampleTextEncoded);
		let doc = await workspace.openTextDocument({ language: 'plaintext', content: sampleText });
		window.showTextDocument(doc);
	})();
};

// this method is called when your extension is deactivated
export const deactivate = () => { };
