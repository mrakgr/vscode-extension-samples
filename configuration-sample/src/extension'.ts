import { ExtensionContext, window, workspace, commands, ConfigurationTarget, WorkspaceConfiguration, Disposable } from 'vscode';

export function activate(context: ExtensionContext) {

	// Immutably extends the existing configuration by adding the fields in `value` to the current state of
	// configuration section at the specified target.
	const updateConfiguration = (section: string) => (value: string) =>
		(target: ConfigurationTarget) => // Global | Workspace | Workspace folder
		(configuration: WorkspaceConfiguration) => {
		const currentValue: object | undefined = configuration.get(section);
		return configuration.update(section, { ...currentValue, ...{[value]: true} }, target);
	};

	const updateInsertEmptyLastLine = updateConfiguration('conf.resource.insertEmptyLastLine');

	// Example: Reading Window scoped configuration
	switch (workspace.getConfiguration().get('conf.view.showOnWindowOpen')) {
		case 'explorer':
			commands.executeCommand('workbench.view.explorer');
			break;
		case 'search':
			commands.executeCommand('workbench.view.search');
			break;
		case 'scm':
			commands.executeCommand('workbench.view.scm');
			break;
		case 'debug':
			commands.executeCommand('workbench.view.debug');
			break;
		case 'extensions':
			commands.executeCommand('workbench.view.extensions');
			break;
	}

	context.subscriptions.push(

		// Example: Updating Window scoped configuration
		commands.registerCommand('config.commands.configureViewOnWindowOpen', async () => {
			const value = await window.showQuickPick(['explorer', 'search', 'scm', 'debug', 'extensions'], { placeHolder: 'Select the view to show when opening a window.' });
			const configuration = workspace.getConfiguration();

			if (workspace.workspaceFolders) {
				// Getting the Configuration target
				const pick = await window.showQuickPick(
					[
						{ label: 'User', description: 'User Settings', target: ConfigurationTarget.Global },
						{ label: 'Workspace', description: 'Workspace Settings', target: ConfigurationTarget.Workspace }
					],
					{ placeHolder: 'Select the view to show when opening a window.' });

				if (value && pick) {
					// Update the configuration value in the target
					await configuration.update('conf.view.showOnWindowOpen', value, pick.target);

					/*
					// Default is to update in Workspace
					await configuration.update('conf.view.showOnWindowOpen', value);
					*/
				}
			} else {
				// Update the configuration value in User Setting in case of no workspace folders
				await configuration.update('conf.view.showOnWindowOpen', value, ConfigurationTarget.Global);
			}


		}),
		// Example: Reading Resource scoped configuration for a file
		workspace.onDidOpenTextDocument(e => {
			const value: object | undefined = workspace.getConfiguration('', e.uri).get('conf.resource.insertEmptyLastLine');
			if (!!value && e.fileName in value) {
				window.showInformationMessage('An empty line will be added to the document ' + e.fileName);
				// TODO: Add code for actually doing that.
			}
		}),
		// Example: Updating Resource scoped Configuration for current file
		commands.registerCommand('config.commands.configureEmptyLastLineCurrentFile', async () => {
			if (window.activeTextEditor) {
				const currentDocument = window.activeTextEditor.document;
				await updateInsertEmptyLastLine(currentDocument.fileName)
					(workspace.workspaceFolders ? ConfigurationTarget.WorkspaceFolder : ConfigurationTarget.Global)
					(workspace.getConfiguration('', currentDocument.uri));
			}
		}),
		// Example: Updating Resource scoped Configuration
		commands.registerCommand('config.commands.configureEmptyLastLineFiles', async () => {
			const value = await window.showInputBox({ prompt: 'Provide glob pattern of files to have empty last line.' });
			if (value) {
				const update_ = updateInsertEmptyLastLine(value);
				// If there are workspace folders present, show a sequence of choices to narrow the scope.
				// Otherwise, the update's scope is assumed to be global.
				if (workspace.workspaceFolders) {
					const pick = await window.showQuickPick(
						[
							{ label: 'Application', description: 'User Settings', configTarget: ConfigurationTarget.Global },
							{ label: 'Workspace', description: 'Workspace Settings', configTarget: ConfigurationTarget.Workspace },
							{ label: 'Workspace Folder', description: 'Workspace Folder Settings', configTarget: ConfigurationTarget.WorkspaceFolder }
						],
						{ placeHolder: 'Select the target to which this setting should be applied' });

					if (pick) {
						const target = pick.configTarget;
						const update = update_(target);
						if (target === ConfigurationTarget.WorkspaceFolder) {
							const workspaceFolder = await window.showWorkspaceFolderPick({
								placeHolder: 'Pick Workspace Folder to which this setting should be applied'
							});
							if (workspaceFolder) { await update(workspace.getConfiguration('', workspaceFolder.uri)); }
						} else { await update(workspace.getConfiguration()); }
					}
				} else { await update_(ConfigurationTarget.Global)(workspace.getConfiguration()); }
			}
		})
	);

	// Not going to bother with the rest as this sample is unfinished.
	// I did some refactoring, but I can't finish something whose purpose is not clear.
	// At this point (4/25/2020) I still not that familiar with the API anyway.
}