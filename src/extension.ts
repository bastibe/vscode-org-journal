import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

function getJournalDir() {
	let config = vscode.workspace.getConfiguration('org-journal');
	let journalDir = String(config.get('journalDirectory'));
	journalDir = journalDir.replaceAll('~', os.homedir());
	return journalDir;
}

function isJournalPath(input_path: string) {
	const relative = path.relative(getJournalDir(), input_path);
	return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function journalFileName(date: number) {
	const config = vscode.workspace.getConfiguration('org-journal');
	let journalDir = String(config.get('journalDirectory'));
	journalDir = journalDir.replaceAll('~', os.homedir());
	const year = Intl.DateTimeFormat('en', {year: 'numeric'}).format(date);
	const month = Intl.DateTimeFormat('en', {month: '2-digit'}).format(date);
	const day = Intl.DateTimeFormat('en', {day: '2-digit'}).format(date);
	return `${journalDir}${path.sep}${year}-${month}-${day}.org`;
}

function incrementDay(timestamp: number, increment: number) {
	const date = new Date(timestamp);
	return Date.parse(`${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate() + increment}`);
}

function openNextOrPrevious(increment: number) {
	let currentFile = vscode.window.activeTextEditor?.document.fileName;
	if (typeof currentFile !== 'undefined') {
		if (!isJournalPath(currentFile)) {
			vscode.window.showInformationMessage(`org-journal: not in journal dir: ${currentFile}`);
			return false;
		}
		const basename = path.basename(currentFile);
		const fileRegex = /(?<year>[0-9]{4})-(?<month>[0-9]{2})-(?<day>[0-9]{2})\.org/;
		const match = basename.match(fileRegex);
		if (typeof match === 'undefined') {
			vscode.window.showInformationMessage(`org-journal: not a journal file: ${basename}`);
			return false;
		}
		let fileDate = Date.parse(`${match?.groups?.year}-${match?.groups?.month}-${match?.groups?.day}`);
		let counter = 100;
		while (counter > 0) {
			fileDate = incrementDay(fileDate, increment);
			if (fs.existsSync(journalFileName(fileDate))) {
				vscode.workspace.openTextDocument(journalFileName(fileDate)).then( doc => { 
					vscode.window.showTextDocument(doc); 
				});
				return true;
			}
			counter -= 1;
		}
	}
	return false; // caller will show message
}

export function activate(context: vscode.ExtensionContext) {
	let today = vscode.commands.registerCommand('org-journal.today', () => {
		let fileName = journalFileName(Date.now());
		if (fs.existsSync(fileName)) {
			vscode.workspace.openTextDocument(vscode.Uri.file(fileName)).then(
				doc => { 
					vscode.window.showTextDocument(doc);
				 },
				error => {
					vscode.window.showInformationMessage(`org-journal: Could not open existing ${fileName} because ${error}`); 
				});
		} else {
			vscode.workspace.openTextDocument(vscode.Uri.file(fileName).with({ scheme: 'untitled' })).then(
				doc => { 
					vscode.window.showTextDocument(doc).then( editor => {
						// generate the date header if the document is empty:
						if (editor.document.lineCount === 1) {
							editor.edit(edit => {
								const date = Date.now();
								const weekday = Intl.DateTimeFormat('en', {weekday: 'long'}).format(date);
								const year = Intl.DateTimeFormat('en', {year: 'numeric'}).format(date);
								const month = Intl.DateTimeFormat('en', {month: '2-digit'}).format(date);
								const day = Intl.DateTimeFormat('en', {day: '2-digit'}).format(date);
								edit.insert(new vscode.Position(0, 0), `* ${weekday}, ${year}-${month}-${day}\n`);
							});
						}
					});
				},
				reason => { 
					vscode.window.showInformationMessage(`org-journal: Could not open new ${fileName} because ${reason}`); 
				}
			);
		}
	});
	context.subscriptions.push(today);

	let search = vscode.commands.registerCommand('org-journal.search', () => {
		vscode.window.showInformationMessage('org-journal: search');
	});
	context.subscriptions.push(search);

	let tomorrow = vscode.commands.registerCommand('org-journal.nextDay', () => {
		if (!openNextOrPrevious(1)) {
			vscode.window.showInformationMessage('org-journal: no next day found');
		}
	});
	context.subscriptions.push(tomorrow);

	let yesterday = vscode.commands.registerCommand('org-journal.previousDay', () => {
		if (!openNextOrPrevious(-1)) {
			vscode.window.showInformationMessage('org-journal: no previous day found');
		}
	});
	context.subscriptions.push(yesterday);
}

export function deactivate() {}
