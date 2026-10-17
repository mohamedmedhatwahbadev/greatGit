import React from 'react';
import {Box, Text} from 'ink';
import {theme} from '../theme.js';

export const StatusBar = ({repo}) => (
	<Box paddingX={1} flexShrink={0}>
		<Text wrap="truncate-end">
			<Text color={theme.accent} bold>
				◆ greatGit
			</Text>
			{repo ? (
				<>
					<Text dimColor>{`  ${repo.name}`}</Text>
					<Text color={theme.branch}>{`  ⎇ ${repo.branch}`}</Text>
					{repo.changedFiles > 0 ? (
						<Text color={theme.warning}>{`  ● ${repo.changedFiles} changed`}</Text>
					) : (
						<Text color={theme.branch}>{'  ✓ clean'}</Text>
					)}
				</>
			) : null}
		</Text>
	</Box>
);
