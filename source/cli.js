#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
	`
		Usage
		  $ greatGit

		Options
			--name  Your name

		Examples
		  $ greatGit --name=Jane
		  Hello, Jane
	`,
	{
		importMeta: import.meta,
	},
);

 const enterAltScreenCommand = "\x1b[?1049h";
 const leaveAltScreenCommand = "\x1b[?1049l";
 process.stdout.write(enterAltScreenCommand);
 process.on("exit", () => {
   process.stdout.write(leaveAltScreenCommand);
 });

// Leave the alternate screen before printing a crash, otherwise the error is
// wiped along with it. Writes to stderr directly because Ink patches console.
const exitWithError = error => {
	process.stdout.write(leaveAltScreenCommand);
	process.stderr.write(`${error?.stack ?? error}\n`);
	process.exit(1);
};

process.on('uncaughtException', exitWithError);
process.on('unhandledRejection', exitWithError);

// Only rewrite the terminal lines that changed, instead of the whole frame
const {waitUntilExit} = render(<App name={cli.flags.name} />, {
	incrementalRendering: true,
});
try {
	await waitUntilExit();
} catch (error) {
	// Errors thrown while rendering are caught by Ink and land here
	exitWithError(error);
}
console.log("MY APP EXISTED");
