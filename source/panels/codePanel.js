import {useInput, Box, Text, useBoxMetrics} from 'ink';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {theme} from '../theme.js';
import {Panel} from './panel.js';

// Same colours `git show` uses in a terminal
const diffLineStyle = line => {
	if (line.startsWith('commit ')) return {color: theme.hash};
	if (/^(diff --git|index |--- |\+\+\+ )/.test(line)) return {bold: true};
	if (line.startsWith('@@')) return {color: theme.accent};
	if (line.startsWith('+')) return {color: theme.added};
	if (line.startsWith('-')) return {color: theme.removed};
	if (/^(Author|Date|Merge):/.test(line)) return {dimColor: true};
	return {};
};

export const CodePanel = ({
	name,
	title,
	code,
	emptyText = '',
	refMap,
	currentFocusedWindow,
	...boxProps
}) => {
	const contentRef = useRef(null);
	const [scrollTop, setScrollTop] = useState(0);
	const {height} = useBoxMetrics(contentRef);
	const focused = currentFocusedWindow == name;
	const lines = useMemo(
		() => code.replace(/\n$/, '').replaceAll('\t', '    ').split('\n'),
		[code],
	);
	const pageSize = Math.max(1, Math.floor(height));
	const maxScrollTop = Math.max(0, lines.length - pageSize);

	useEffect(() => {
		setScrollTop(0);
	}, [code]);

	useInput((i, k) => {
		if (focused) {
			if (k.upArrow) {
				setScrollTop(prev => Math.max(prev - 1, 0)); // Scroll up 1 line
			}
			if (k.downArrow) {
				setScrollTop(prev => Math.min(prev + 1, maxScrollTop)); // Scroll down 1 line
			}
			if (k.pageUp) {
				setScrollTop(prev => Math.max(prev - pageSize, 0));
			}
			if (k.pageDown || i === ' ') {
				setScrollTop(prev => Math.min(prev + pageSize, maxScrollTop));
			}
			if (i === 'g') {
				setScrollTop(0);
			}
			if (i === 'G') {
				setScrollTop(maxScrollTop);
			}
		}
	});

	// Only render the lines on screen: `git show` output can be thousands of
	// lines. Each line is cut to the panel width so long lines don't wrap and
	// push the rest of the diff off screen.
	const visibleLines = lines.slice(scrollTop, scrollTop + pageSize);
	const lastVisibleLine = Math.min(scrollTop + pageSize, lines.length);
	// Vim-style gutter: sized for the biggest number (at least 3 digits, like
	// vim's default) so the column doesn't shift while scrolling
	const gutterWidth = Math.max(3, String(lines.length).length);

	return (
		<Panel
			title={title}
			footer={code ? `${scrollTop + 1}–${lastVisibleLine} of ${lines.length}` : ''}
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
				{code ? (
					visibleLines.map((line, i) => (
						<Text key={scrollTop + i} wrap="truncate-end">
							<Text color={theme.lineNumber}>
								{`${String(scrollTop + i + 1).padStart(gutterWidth)} `}
							</Text>
							<Text {...diffLineStyle(line)}>{line || ' '}</Text>
						</Text>
					))
				) : (
					<Text dimColor>{emptyText}</Text>
				)}
			</Box>
		</Panel>
	);
};
