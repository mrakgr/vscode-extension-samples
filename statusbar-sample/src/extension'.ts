/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import * as vscode from 'vscode';

export function activate({ subscriptions }: vscode.ExtensionContext) {
    const getNumberOfSelectedLines = (editor: vscode.TextEditor | undefined): number => 
        editor ? editor.selections.reduce((prev, curr) => prev + (curr.end.line - curr.start.line), 0) : 0;

	// register a command that is invoked when the status bar
	// item is selected
	const myCommandId = 'sample.showSelectionCount';
	subscriptions.push(vscode.commands.registerCommand(myCommandId, () => {
		const n = getNumberOfSelectedLines(vscode.window.activeTextEditor);
		vscode.window.showInformationMessage(`Yeah, ${n} line(s) selected... Keep going!`);
	}));

	// create a new status bar item that we can now manage
	const myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
	myStatusBarItem.command = myCommandId;
	subscriptions.push(myStatusBarItem);

    const updateStatusBarItem = (): void => {
        const n = getNumberOfSelectedLines(vscode.window.activeTextEditor);
        if (n > 0) {
            myStatusBarItem.text = `$(megaphone) ${n} line(s) selected`;
            myStatusBarItem.show();
        } else {
            myStatusBarItem.hide();
        }
    };

	// register some listener that make sure the status bar 
	// item always up-to-date
	subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateStatusBarItem),
	    vscode.window.onDidChangeTextEditorSelection(updateStatusBarItem));

	// update status bar item once at start
	updateStatusBarItem();
}


