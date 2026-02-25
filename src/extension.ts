import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('Copy Location extension activated');

    const disposable = vscode.commands.registerCommand('copySelectedLocation.copy', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (!selectedText) {
            vscode.window.showWarningMessage('No text selected');
            return;
        }

        // Compute relative path from workspace root
        const filePath = editor.document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        const relativePath = workspaceFolder
            ? path.relative(workspaceFolder.uri.fsPath, filePath)
            : path.basename(filePath);

        const location = `${relativePath} ${selectedText}`;

        vscode.env.clipboard.writeText(location).then(() => {
            vscode.window.setStatusBarMessage(`Copied: ${location}`, 3000);
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() { }
