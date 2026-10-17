import React, {useRef} from 'react';
import {Box, Text, useBoxMetrics, useInput, usePaste} from 'ink';
import {theme} from '../theme.js';
import {Panel} from './panel.js';

// Git's convention: keep the first line (the summary) under about 50 characters
const SUMMARY_LIMIT = 50;

// A small multi-line text box. Typing always goes to the end of the message;
// there's no cursor to move around yet.
export const MessagePanel = ({
	name,
	title,
	value,
	onChange,
	placeholder = '',
	refMap,
	currentFocusedWindow,
	...boxProps
}) => {
	const contentRef = useRef(null);
	const {height} = useBoxMetrics(contentRef);
	const focused = currentFocusedWindow === name;

	// onChange gets updater functions (like a useState setter) so fast typing
	// never builds on a stale copy of the message
	useInput(
		(input, key) => {
			if (key.return) {
				onChange(previous => previous + '\n');
			} else if (key.backspace || key.delete) {
				onChange(previous => previous.slice(0, -1));
			} else if (input && !key.ctrl && !key.meta && !key.escape && !key.tab) {
				onChange(previous => previous + input);
			}
		},
		{isActive: focused},
	);

	usePaste(
		text => {
			const normalized = text.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
			onChange(previous => previous + normalized);
		},
		{isActive: focused},
	);

	// Show the end of the message, where the typing happens
	const lines = value.split('\n');
	const visibleLines = lines.slice(-Math.max(1, Math.floor(height)));
	const summaryLength = lines[0].length;

	return (
		<Panel
			title={title}
			footer={`${summaryLength}/${SUMMARY_LIMIT}`}
			focused={focused}
			ref={el => {
				refMap.set(name, el);
				return () => {
					refMap.delete(name);
				};
			}}
			{...boxProps}
		>
			<Box ref={contentRef} flexGrow={1} flexDirection="column" overflow="hidden">
				{value === '' ? (
					<Text wrap="truncate-end">
						{focused ? <Text inverse> </Text> : null}
						<Text dimColor>{placeholder}</Text>
					</Text>
				) : (
					visibleLines.map((line, i) => {
						const isLastLine = i === visibleLines.length - 1;
						const isSummary = lines.length - visibleLines.length + i === 0;
						return (
							// The line being typed is cut from the left so its end stays visible
							<Text key={i} wrap={isLastLine ? 'truncate-start' : 'truncate-end'}>
								<Text
									bold={isSummary}
									color={
										isSummary && summaryLength > SUMMARY_LIMIT
											? theme.warning
											: undefined
									}
								>
									{line}
								</Text>
								{isLastLine && focused ? <Text inverse> </Text> : null}
							</Text>
						);
					})
				)}
			</Box>
		</Panel>
	);
};
