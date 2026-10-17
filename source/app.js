import React, {useRef, useState, useEffect} from 'react';
import {Box, Text, useApp, useInput, useWindowSize} from 'ink';
import {getNearestTerminal} from './util.js';
import {ItemsList} from './panels/branchesList.js';
import {CodePanel} from './panels/codePanel.js';
import {StatusBar} from './panels/statusBar.js';
import {KeyHints} from './panels/keyHints.js';
import {MessagePanel} from './panels/messagePanel.js';
import {
	commitFiles,
	getChangedFiles,
	getCommitCode,
	getGitBranches,
	getGitCommits,
	getRepoInfo,
} from './dataRetrieval.js';
import {theme} from './theme.js';

const repoPath = process.argv[2];

const mapKeyToDirection = key => {
	switch (key) {
		case 's':
			return 'down';

		case 'a':
			return 'left';

		case 'd':
			return 'right';

		case 'w':
			return 'up';
		default:
			return '';
	}
};

const branchColor = branch => {
	if (branch.isCurrent) return theme.branch;
	if (branch.isRemote) return theme.remote;
	return undefined;
};

const renderBranch = branch => (
	<Text wrap="truncate-end">
		<Text color={theme.branch}>{branch.isCurrent ? '● ' : '  '}</Text>
		<Text color={branchColor(branch)} bold={branch.isCurrent}>
			{branch.name}
		</Text>
	</Text>
);

// Hash and age keep their width; the subject takes what's left and is cut short
const renderCommit = commit => (
	<>
		<Box flexShrink={0}>
			<Text color={theme.hash}>{`${commit.hash} `}</Text>
		</Box>
		<Box flexGrow={1} flexShrink={1} flexBasis={0}>
			<Text wrap="truncate-end">{commit.subject}</Text>
		</Box>
		<Box flexShrink={0}>
			<Text dimColor>{` ${commit.age}`}</Text>
		</Box>
	</>
);

const fileStatusColor = {
	M: theme.warning,
	A: theme.added,
	'?': theme.added,
	D: theme.removed,
	U: theme.removed,
	R: theme.accent,
	C: theme.accent,
};

const renderFile = pickedPaths => file => {
	const picked = pickedPaths.has(file.path);
	return (
		<Text wrap="truncate-end">
			<Text color={picked ? theme.added : theme.lineNumber}>
				{picked ? '[x] ' : '[ ] '}
			</Text>
			<Text color={fileStatusColor[file.status]}>{`${file.status} `}</Text>
			{file.originalPath ? `${file.originalPath} → ${file.path}` : file.path}
		</Text>
	);
};

const truncate = (text, length) =>
	text.length > length ? `${text.slice(0, length - 1)}…` : text;

const firstLine = text => text.split('\n')[0];

export default function App({name = 'Stranger'}) {
	const {exit} = useApp();
	const windowsListRef = useRef(new Map());
	const branchesListRef = useRef(null);
	const commitsListRef = useRef(null);
	const filesListRef = useRef(null);
	const [currentFocusedWindow, setCurrentFocusedWindow] = useState('branches');

	// Commit mode (N): the diff panel is swapped for a files panel and a
	// message panel. `draft` is the commit message being written.
	const [commitMode, setCommitMode] = useState(false);
	const [changedFiles, setChangedFiles] = useState([]);
	const [pickedPaths, setPickedPaths] = useState(new Set());
	const [draft, setDraft] = useState('');
	const focusBeforeCommit = useRef('branches');
	const isCommitting = useRef(false);

	const [repo, setRepo] = useState(null);
	const [branches, setBranches] = useState(null);
	const [commits, setCommits] = useState([]);
	const [openedBranch, setOpenedBranch] = useState(null);
	const [openedCommit, setOpenedCommit] = useState(null);
	const [code, setCode] = useState('');
	const [message, setMessage] = useState('');
	// Never draw taller than the terminal: once the output overflows, Ink has to
	// clear and repaint the whole screen on every frame instead of diffing it.
	const {rows, columns} = useWindowSize();
	// One row each for the status bar and the key hints
	const panelsHeight = Math.max(0, rows - 2);
	// 40% of the width, but never so narrow that commit subjects disappear
	const listsWidth = Math.min(columns, Math.max(32, Math.round(columns * 0.4)));
	const messageHeight = Math.max(5, Math.floor(panelsHeight * 0.35));

	const openCommitMode = async () => {
		setMessage('Loading changes…');
		const files = await getChangedFiles(repoPath);
		if (files.length === 0) {
			setMessage('Nothing to commit: no files have changed');
			return;
		}
		setChangedFiles(files);
		// Files already staged start picked, matching what `git commit` would take
		setPickedPaths(new Set(files.filter(file => file.staged).map(file => file.path)));
		focusBeforeCommit.current = currentFocusedWindow;
		setCommitMode(true);
		setCurrentFocusedWindow('files');
		setMessage('');
	};

	const closeCommitMode = () => {
		setCommitMode(false);
		setCurrentFocusedWindow(focusBeforeCommit.current);
	};

	const togglePicked = file => {
		setPickedPaths(previous => {
			const next = new Set(previous);
			if (next.has(file.path)) {
				next.delete(file.path);
			} else {
				next.add(file.path);
			}
			return next;
		});
	};

	const toggleAllPicked = () => {
		setPickedPaths(previous =>
			previous.size === changedFiles.length
				? new Set()
				: new Set(changedFiles.map(file => file.path)),
		);
	};

	const commit = async () => {
		if (isCommitting.current) return;
		const files = changedFiles.filter(file => pickedPaths.has(file.path));
		const text = draft.trim();
		if (files.length === 0) {
			setMessage('Pick at least one file to commit');
			setCurrentFocusedWindow('files');
			return;
		}
		if (text === '') {
			setMessage('Write a commit message first');
			setCurrentFocusedWindow('message');
			return;
		}

		isCommitting.current = true;
		setMessage('Committing…');
		const result = await commitFiles(repoPath, files, text);
		isCommitting.current = false;
		if (!result.ok) {
			setMessage(`Commit failed: ${firstLine(result.error)}`);
			return;
		}

		setDraft('');
		closeCommitMode();
		setMessage(`Committed ${result.hash} · ${truncate(firstLine(text), 40)}`);
		setRepo(await getRepoInfo(repoPath));
		if (openedBranch?.isCurrent) {
			setCommits(await getGitCommits(repoPath, openedBranch.ref));
		}
	};

	useInput((i, k) => {
		if (commitMode) {
			const typing = currentFocusedWindow === 'message';
			if (k.escape) {
				setMessage('');
				closeCommitMode();
				return;
			}
			if (k.tab) {
				setCurrentFocusedWindow(typing ? 'files' : 'message');
				return;
			}
			if (k.ctrl && i === 's') {
				commit();
				return;
			}
			// Everything else typed in the message box is text, not a shortcut
			if (typing) return;
			if (currentFocusedWindow === 'files') {
				const file = changedFiles[filesListRef.current?.selectedIndex];
				if (i === ' ' && file) {
					togglePicked(file);
					return;
				}
				if (i === 'A') {
					toggleAllPicked();
					return;
				}
			}
		}
		// ctrl+s arrives as "s", which would otherwise also move focus down
		if (k.ctrl || k.meta) return;

		if (i === 'q') {
			exit();
			return;
		}
		if (i === 'N' && !commitMode) {
			openCommitMode();
			return;
		}
		if (windowsListRef.current) {
			(async () => {
				const direction = mapKeyToDirection(i);
				if (direction != '') {
					setCurrentFocusedWindow(
						getNearestTerminal(
							currentFocusedWindow,
							direction,
							windowsListRef.current,
						),
					);
				}
				if (k.return) {
					if (currentFocusedWindow == 'branches') {
						const branch = branches?.[branchesListRef.current.selectedIndex];
						if (!branch) return;
						setMessage(`Loading commits for ${branch.name}…`);
						setCommits(await getGitCommits(repoPath, branch.ref));
						setOpenedBranch(branch);
						setMessage('');
						setCurrentFocusedWindow('commits');
					} else if (currentFocusedWindow == 'commits') {
						const commit = commits[commitsListRef.current.selectedIndex];
						if (!commit) return;
						setMessage(`Loading ${commit.hash}…`);
						setCode(await getCommitCode(repoPath, commit.hash));
						setOpenedCommit(commit);
						setMessage('');
					}
				}
			})();
		}
	});

	useEffect(() => {
		(async () => {
			setRepo(await getRepoInfo(repoPath));
		})();
		(async () => {
			setBranches(await getGitBranches(repoPath));
		})();
	}, []);

	return (
		<Box flexDirection="column" width="100%" height={rows}>
			<StatusBar repo={repo} />
			<Box height={panelsHeight}>
				<Box flexDirection="column" width={listsWidth} flexShrink={0}>
					{/* A whole number of rows: splitting an odd height 50/50 gives half
					    rows, and the rounding hides the first list item */}
					<ItemsList
						name={'branches'}
						title="Branches"
						ref={branchesListRef}
						items={branches ?? []}
						renderItem={renderBranch}
						emptyText={branches ? 'No branches yet' : 'Loading branches…'}
						refMap={windowsListRef.current}
						currentFocusedWindow={currentFocusedWindow}
						height={Math.ceil(panelsHeight / 2)}
					/>
					<ItemsList
						name={'commits'}
						title={
							openedBranch
								? `Commits · ${truncate(openedBranch.name, 30)}`
								: 'Commits'
						}
						items={commits}
						renderItem={renderCommit}
						emptyText="Pick a branch and press enter to see its commits"
						ref={commitsListRef}
						refMap={windowsListRef.current}
						currentFocusedWindow={currentFocusedWindow}
						flexGrow={1}
						flexBasis={0}
					/>
				</Box>
				{commitMode ? (
					<Box flexDirection="column" flexGrow={1}>
						<ItemsList
							name="files"
							title={`Files to commit · ${pickedPaths.size} of ${changedFiles.length} picked`}
							items={changedFiles}
							renderItem={renderFile(pickedPaths)}
							ref={filesListRef}
							refMap={windowsListRef.current}
							currentFocusedWindow={currentFocusedWindow}
							flexGrow={1}
							flexBasis={0}
						/>
						<MessagePanel
							name="message"
							title="Commit message"
							value={draft}
							onChange={setDraft}
							placeholder="Summary on the first line, details below"
							refMap={windowsListRef.current}
							currentFocusedWindow={currentFocusedWindow}
							height={messageHeight}
						/>
					</Box>
				) : (
					<CodePanel
						name="code"
						title={
							openedCommit
								? `${openedCommit.hash} · ${truncate(openedCommit.subject, 50)}`
								: 'Diff'
						}
						code={code}
						emptyText="Pick a commit and press enter to see what it changed"
						refMap={windowsListRef.current}
						currentFocusedWindow={currentFocusedWindow}
						flexGrow={1}
					/>
				)}
			</Box>
			<KeyHints focused={currentFocusedWindow} message={message} />
		</Box>
	);
}
