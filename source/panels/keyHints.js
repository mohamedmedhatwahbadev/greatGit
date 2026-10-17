import React from 'react';
import {Box, Text} from 'ink';
import {theme} from '../theme.js';

const panelHints = {
	branches: [
		['↑↓', 'move'],
		['enter', 'show commits'],
		['g/G', 'top/bottom'],
	],
	commits: [
		['↑↓', 'move'],
		['enter', 'show diff'],
		['g/G', 'top/bottom'],
	],
	code: [
		['↑↓', 'scroll'],
		['space', 'page down'],
		['g/G', 'top/bottom'],
	],
	files: [
		['↑↓', 'move'],
		['space', 'pick file'],
		['A', 'pick all'],
		['tab', 'message'],
		['ctrl+s', 'commit'],
		['esc', 'cancel'],
	],
	message: [
		['enter', 'new line'],
		['tab', 'files'],
		['ctrl+s', 'commit'],
		['esc', 'cancel'],
	],
};

// The message box takes every letter as text, so it gets no global keys, and
// "new commit" isn't offered while a commit is already being written
const globalHints = focused => {
	if (focused === 'message') return [];
	return [
		...(focused === 'files' ? [] : [['N', 'new commit']]),
		['w a s d', 'switch panel'],
		['q', 'quit'],
	];
};

// Bottom bar: the keys that work in the focused panel, plus a status message
export const KeyHints = ({focused, message}) => (
	<Box paddingX={1} flexShrink={0} justifyContent="space-between">
		<Text wrap="truncate-end">
			{[...(panelHints[focused] ?? []), ...globalHints(focused)].map(([key, label]) => (
				<Text key={key}>
					<Text color={theme.accent}>{key}</Text>
					<Text dimColor>{` ${label}   `}</Text>
				</Text>
			))}
		</Text>
		{message ? <Text color={theme.warning}>{message}</Text> : null}
	</Box>
);
