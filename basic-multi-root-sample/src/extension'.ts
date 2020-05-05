/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

// I do my own refactoring as exercise here.

import { Event, ExtensionContext, StatusBarAlignment, window, StatusBarItem, workspace } from 'vscode';
import { basename } from 'path';

export function activate(context: ExtensionContext) {
    // Create a status bar item
    const status = window.createStatusBarItem(StatusBarAlignment.Left, 1000000);
    context.subscriptions.push(status);

    [
    // Update status bar item based on events for multi root folder changes
    workspace.onDidChangeWorkspaceFolders,

    // Update status bar item based on events for configuration
    workspace.onDidChangeConfiguration,

    // Update status bar item based on events around the active editor
    window.onDidChangeActiveTextEditor, window.onDidChangeTextEditorViewColumn,
    workspace.onDidOpenTextDocument, workspace.onDidCloseTextDocument
    ].forEach((event : Event<any>) => context.subscriptions.push(event(_ => updateStatus(status))));

    updateStatus(status);
}

function updateStatus(status: StatusBarItem): void {
    const editorInfo = ((): {text: string, tooltip?: string, color?: string} | undefined => {
        const editor = window.activeTextEditor;

        // If no workspace is opened or just a single folder, we return without any status label
        // because our extension only works when more than one folder is opened in a workspace.
        if (!editor || !workspace.workspaceFolders || workspace.workspaceFolders.length < 2) { return; } 
        
        // If we have a file:// resource we resolve the WorkspaceFolder this file is from and update
        // the status accordingly.
        const resource = editor.document.uri;
        if (resource.scheme === 'file') {
            const folder = workspace.getWorkspaceFolder(resource);
            if (!folder) {
                return {text : `$(alert) <outside workspace> → ${basename(resource.fsPath)}`};
            } else {
                return {
                    text: `$(file-submodule) ${basename(folder.uri.fsPath)} (${folder.index + 1} of ${workspace.workspaceFolders.length}) → $(file-code) ${basename(resource.fsPath)}`,
                    tooltip: resource.fsPath,
                    color: workspace.getConfiguration('multiRootSample', resource).get('statusColor')
                    };
            }
        }
    })();
    if (editorInfo) {
        status.text = editorInfo.text;
        status.tooltip = editorInfo.tooltip;
        status.color = editorInfo.color;
        status.show();
    } else {
        status.hide();
    }
}
