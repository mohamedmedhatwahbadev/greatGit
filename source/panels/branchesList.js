import React, {useEffect, useImperativeHandle, useRef, useState} from 'react';
import {Box, Text, useBoxMetrics, useInput} from 'ink';
import {defaultPanelSelectMovement} from '../util.js';
import {theme} from '../theme.js';
import {Panel} from './panel.js';

const renderText = item => <Text wrap="truncate-end">{item}</Text>;

export const ItemsList = ({
	name,
	title,
	items,
	renderItem = renderText,
	emptyText = '',
	ref,
	refMap,
	currentFocusedWindow,
	...boxProps
}) => {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const listRef = useRef(null);
	const scrollTop = useRef(0);
	const {height} = useBoxMetrics(listRef);
	const focused = currentFocusedWindow === name;

	// Ref Data Passing (Pass the SetSelectIndex)
	useImperativeHandle(ref, () => {
		return {
			setSelectedIndex,
			selectedIndex,
		};
	});

	// A new list (e.g. another branch's commits) starts at the top
	useEffect(() => {
		setSelectedIndex(0);
		scrollTop.current = 0;
	}, [items]);

	useInput((i, k) => {
		if (focused) {
			defaultPanelSelectMovement(i, k, setSelectedIndex, items.length);
		}
	});

	// Only render the rows that fit. Rendering every item (thousands of commits)
	// makes each keypress re-layout the whole list.
	const visibleCount = Math.max(1, Math.floor(height));
	scrollTop.current = Math.min(
		Math.max(scrollTop.current, selectedIndex - visibleCount + 1),
		selectedIndex,
	);
	const top = Math.max(0, scrollTop.current);
	const visibleItems = items.slice(top, top + visibleCount);
	const selectionColor = focused ? theme.selection : theme.selectionInactive;

	return (
		<Panel
			title={title}
			footer={items.length > 0 ? `${selectedIndex + 1} of ${items.length}` : ''}
			focused={focused}
			ref={el => {
				refMap.set(name, el);
				return () => {
					refMap.delete(name);
				};
			}}
			{...boxProps}
		>
			<Box ref={listRef} flexGrow={1} flexDirection="column" overflow="hidden">
				{items.length === 0 ? (
					<Text dimColor wrap="truncate-end">
						{emptyText}
					</Text>
				) : (
					visibleItems.map((item, i) => (
						<Box
							key={top + i}
							flexShrink={0}
							backgroundColor={
								top + i === selectedIndex ? selectionColor : undefined
							}
						>
							{renderItem(item)}
						</Box>
					))
				)}
			</Box>
		</Panel>
	);
};
