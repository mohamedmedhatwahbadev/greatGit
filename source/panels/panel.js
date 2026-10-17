import React from 'react';
import {Box, Text} from 'ink';
import {theme} from '../theme.js';

// Rounded box with its title drawn into the top border and an optional label
// in the bottom-right corner. Ink paints children after borders, so absolute
// children placed one row outside the content land on top of the border line.
export const Panel = ({title, footer, focused, ref, children, ...boxProps}) => (
	<Box
		ref={ref}
		borderStyle="round"
		borderColor={focused ? theme.accent : theme.border}
		flexDirection="column"
		paddingX={1}
		{...boxProps}
	>
		{/* left and right both set so a long title is cut short with "…" instead
		    of wrapping onto a hidden second line */}
		<Box position="absolute" top={-1} left={1} right={1}>
			<Text
				color={focused ? theme.accent : undefined}
				bold={focused}
				wrap="truncate-end"
			>
				{` ${title} `}
			</Text>
		</Box>
		{footer ? (
			<Box position="absolute" bottom={-1} right={1}>
				<Text dimColor>{` ${footer} `}</Text>
			</Box>
		) : null}
		{children}
	</Box>
);
