import {exec, execFile} from 'node:child_process';
import {measureElement} from 'ink';
import util from 'node:util';

// Convert exec into a promise-based function
const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);

// Runs git with an argument list instead of a shell string, so commit messages
// and file names with quotes, spaces or newlines reach git untouched. Returns
// git's error text instead of printing it, since printing breaks Ink's output.
export async function runGit(args, cwd) {
	try {
		const {stdout} = await execFilePromise('git', args, {
			cwd,
			maxBuffer: 64 * 1024 * 1024,
		});
		return {ok: true, stdout, error: ''};
	} catch (error) {
		return {
			ok: false,
			stdout: error.stdout ?? '',
			error: (error.stderr || error.message).trim(),
		};
	}
}

export async function runCommand(command, options = {}) {
	try {
		const {stdout, stderr} = await execPromise(command, options);

		if (stderr) {
			console.error('Command stderr:\n', stderr);
		}
		return stdout;
	} catch (error) {
		console.error('Execution Error:', error.message);
		return '';
	}
}

export const defaultPanelSelectMovement = (
	input,
	key,
	setSelectedIndex,
	itemCount,
) => {
	if (key.upArrow) {
		setSelectedIndex(prev => Math.max(prev - 1, 0));
	}
	if (key.downArrow) {
		setSelectedIndex(prev => Math.min(prev + 1, itemCount - 1));
	}
	if (input === 'g') {
		setSelectedIndex(0); // Jump to first
	}
	if (input === 'G') {
		setSelectedIndex(itemCount - 1); // Jump to last
	}
};

export const getDistanceBetweenTwoPoints = (a, b) => {
	return Math.sqrt(Math.pow(b.y - a.y, 2) + Math.pow(b.x - a.x, 2));
};

export const getNearestTerminal = (currentTermName, direction, screensMap) => {
	const currentTerm = screensMap.get(currentTermName);
	currentTerm.position = measureElement(currentTerm);

	let targetTerm = '';

	const direcitonedTerms = new Map(
		[...screensMap.entries()].filter(([key, value]) => {
			switch (direction) {
				case 'up':
					return measureElement(value).y < currentTerm.position.y;
				case 'down':
					return measureElement(value).y > currentTerm.position.y;
				case 'right':
					return measureElement(value).x > currentTerm.position.x;
				case 'left':
					return measureElement(value).x < currentTerm.position.x;
				default:
					return true;
			}
		}),
	);

	let score = -1;
	for (let [key, value] of direcitonedTerms) {
		const term = value;
		const position = measureElement(term);
		const _score = getDistanceBetweenTwoPoints(
			{x: currentTerm.position.x, y: currentTerm.position.y},
			{x: position.x, y: position.y},
		);
		if (score == -1) {
			score = _score;
			targetTerm = key;
		} else {
			if (_score < score) {
				score = _score;
				targetTerm = key;
			}
		}
	}
	if (score == -1) { return currentTermName; };
	return targetTerm;
};
