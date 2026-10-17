import {runCommand, runGit} from './util.js';

const nonEmptyLines = output => output.split('\n').filter(line => line.trim() !== '');

export const getRepoInfo = async path => {
	const [root, branch, status] = await Promise.all([
		runCommand('git rev-parse --show-toplevel', {cwd: path}),
		runCommand('git branch --show-current', {cwd: path}),
		runCommand('git status --porcelain', {cwd: path}),
	]);
	return {
		name: root.trim().split('/').pop(),
		branch: branch.trim() || 'detached HEAD',
		changedFiles: nonEmptyLines(status).length,
	};
};

// Current branch first, then local branches, then remote ones
export const getGitBranches = async path => {
	const branchCommandResult = await runCommand(
		`git branch -a --format="%(HEAD)%(refname)"`,
		{cwd: path},
	);
	return nonEmptyLines(branchCommandResult)
		.map(line => {
			const ref = line.slice(1);
			return {
				ref,
				name: ref.replace(/^refs\/(heads|remotes)\//, ''),
				isCurrent: line.startsWith('*'),
				isRemote: ref.startsWith('refs/remotes/'),
			};
		})
		.filter(branch => branch.ref.startsWith('refs/') && !branch.ref.endsWith('/HEAD'))
		.sort(
			(a, b) =>
				Number(b.isCurrent) - Number(a.isCurrent) ||
				Number(a.isRemote) - Number(b.isRemote),
		);
};

// "3 weeks ago" -> "3w", "2 years, 4 months ago" -> "2y"
const shortenAge = age =>
	age.replace(
		/^(\d+) (second|minute|hour|day|week|month|year)s?(, .*)? ago$/,
		(_, amount, unit) => amount + (unit === 'month' ? 'mo' : unit[0]),
	);

export const getGitCommits = async (path, branchRef) => {
	// %x1f is an invisible separator that can't appear in a commit subject
	const commitCommand = await runCommand(
		`git log ${branchRef} --format=%h%x1f%s%x1f%an%x1f%ar`,
		{cwd: path},
	);
	return nonEmptyLines(commitCommand).map(line => {
		const [hash, subject, author, age] = line.split('\x1f');
		return {hash, subject, author, age: shortenAge(age)};
	});
};

export const getCommitCode = async (path, commitHash) => {
	const commitText = await runCommand(`git show ${commitHash} `, {
		cwd: path,
	});
	return commitText;
};

// `git status` paths are relative to the repo root, so commands that take
// those paths run from the root rather than from wherever greatGit started
const getRepoRoot = async path =>
	(await runGit(['rev-parse', '--show-toplevel'], path)).stdout.trim();

// Every changed file, including untracked ones. `staged` means it's already
// in the index, which is a good default for "commit this one".
export const getChangedFiles = async path => {
	const root = await getRepoRoot(path);
	// -z keeps paths exactly as they are (no quoting); -uall lists files inside
	// new folders instead of just the folder
	const {stdout} = await runGit(
		['status', '--porcelain=v1', '-z', '--untracked-files=all'],
		root,
	);
	const entries = stdout.split('\0');
	const files = [];
	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (entry.length < 4) continue;
		const [indexStatus, workTreeStatus] = entry;
		const file = {
			path: entry.slice(3),
			status: indexStatus === ' ' ? workTreeStatus : indexStatus,
			staged: indexStatus !== ' ' && indexStatus !== '?',
		};
		// Renames and copies are followed by the original path
		if (indexStatus === 'R' || indexStatus === 'C') {
			file.originalPath = entries[++i];
		}
		files.push(file);
	}
	return files;
};

// Commits exactly the given files, whatever else is staged. New and deleted
// files are added first so git knows about them; `commit -- <paths>` then
// takes only those paths.
export const commitFiles = async (path, files, message) => {
	const root = await getRepoRoot(path);
	// --literal-pathspecs: a file literally named "*.js" means that file only
	const added = await runGit(
		['--literal-pathspecs', 'add', '--all', '--', ...files.map(file => file.path)],
		root,
	);
	if (!added.ok) return added;
	// A rename needs its old name too, or the commit only records the new file.
	// The old name is only passed here: it no longer exists for `git add`.
	const paths = files.flatMap(file =>
		file.originalPath ? [file.path, file.originalPath] : [file.path],
	);
	const committed = await runGit(
		['--literal-pathspecs', 'commit', '-m', message, '--', ...paths],
		root,
	);
	if (!committed.ok) return committed;
	const hash = await runGit(['rev-parse', '--short', 'HEAD'], root);
	return {ok: true, hash: hash.stdout.trim(), error: ''};
};
