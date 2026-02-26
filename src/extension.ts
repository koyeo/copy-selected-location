import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Core navigation logic: open file and select matching code
 */
async function navigateToCode(filePath: string, code: string): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    // Resolve absolute path from relative path
    let absolutePath: string | undefined;
    for (const folder of workspaceFolders) {
        const candidate = path.resolve(folder.uri.fsPath, filePath);
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(candidate));
            absolutePath = candidate;
            break;
        } catch {
            // File not found in this workspace folder, try next
        }
    }

    if (!absolutePath) {
        vscode.window.showErrorMessage(`File not found: ${filePath}`);
        return;
    }

    // Open the file
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
    const editor = await vscode.window.showTextDocument(document);

    // Search for the code in the document
    const fullText = document.getText();
    const index = fullText.indexOf(code);

    if (index === -1) {
        vscode.window.showWarningMessage('Code not found in file');
        return;
    }

    // Check for multiple matches
    const secondIndex = fullText.indexOf(code, index + 1);
    if (secondIndex !== -1) {
        vscode.window.showInformationMessage('Multiple matches found, selecting the first one');
    }

    // Convert offset to Position
    const startPos = document.positionAt(index);
    const endPos = document.positionAt(index + code.length);
    const selection = new vscode.Selection(startPos, endPos);

    editor.selection = selection;
    editor.revealRange(selection, vscode.TextEditorRevealType.InCenter);
    vscode.window.setStatusBarMessage(`Navigated to code in ${filePath}`, 3000);
}

/**
 * Parse input string in the format: "relativePath codeContent"
 * First space separates path from code.
 */
function parseInput(input: string): { filePath: string; code: string } | null {
    const trimmed = input.trim();
    const spaceIndex = trimmed.indexOf(' ');
    if (spaceIndex === -1) {
        return null;
    }
    return {
        filePath: trimmed.substring(0, spaceIndex),
        code: trimmed.substring(spaceIndex + 1),
    };
}

/**
 * URI Handler: vscode://kozilla.copy-selected-location/navigate?path=...&code=...
 */
class NavigateUriHandler implements vscode.UriHandler {
    handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
        if (uri.path === '/navigate') {
            const params = new URLSearchParams(uri.query);
            const filePath = params.get('path');
            const code = params.get('code');

            if (!filePath || !code) {
                vscode.window.showErrorMessage('Missing path or code parameter in URI');
                return;
            }

            navigateToCode(filePath, code);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Copy Location extension activated');

    // Existing copy command
    const copyDisposable = vscode.commands.registerCommand('copySelectedLocation.copy', () => {
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

    // Navigate to code command
    const navigateDisposable = vscode.commands.registerCommand(
        'copySelectedLocation.navigateToCode',
        async (args?: { path: string; code: string }) => {
            if (args && args.path && args.code) {
                // Called programmatically with arguments
                await navigateToCode(args.path, args.code);
                return;
            }

            // Called from command palette — prompt for input
            const input = await vscode.window.showInputBox({
                prompt: 'Paste copied location (format: relativePath codeContent)',
                placeHolder: 'src/extension.ts const foo = "bar";',
            });

            if (!input) {
                return;
            }

            const parsed = parseInput(input);
            if (!parsed) {
                vscode.window.showErrorMessage('Invalid format. Expected: relativePath codeContent');
                return;
            }

            await navigateToCode(parsed.filePath, parsed.code);
        }
    );

    // URI handler
    const uriHandler = new NavigateUriHandler();
    const uriDisposable = vscode.window.registerUriHandler(uriHandler);

    context.subscriptions.push(copyDisposable, navigateDisposable, uriDisposable);
}

export function deactivate() { }
