import * as vscode from 'vscode';
import * as commands from './commands';

import { CommandKey, JavaProjectType } from './config';


/**
 * @inerhitDoc 
 */
export function activate( context: vscode.ExtensionContext ) : void {


	/* ************** */
	/*  JAVA COMMAND  */
	/* ************** */

	/* Register command to to show the Java command currently in use. */
	vscode.commands.registerCommand( CommandKey.showJavaCommand, commands.showJavaCommand );

	/* Register command to to set the Java command to use */
	vscode.commands.registerCommand( CommandKey.setCustomJavaCommand, commands.setCustomJavaCommand );

	/* Register command to to restore the default Java command defined in vscode */
	vscode.commands.registerCommand( CommandKey.resetDefaultJavaCommand, commands.resetDefaultJavaCommand );

	/* Register command to show the Java command menu. */
	vscode.commands.registerCommand( CommandKey.showJavaCommandMenu, async () => {

		const selectedOption = await vscode.window.showQuickPick(
			[
				{ label: 'Show Java command', command: CommandKey.showJavaCommand },
				{ label: 'Set custom Java command', command: CommandKey.setCustomJavaCommand },
				{ label: 'Reset default Java command', command: CommandKey.resetDefaultJavaCommand }
			],
			{ placeHolder: 'Java command' }

		);

		if( selectedOption ) {
			vscode.commands.executeCommand( selectedOption.command );
		}

	});


	/* *************** */
	/*  SETTINGS MENU  */
	/* *************** */

	/* Register command to open the Settings UI view. */
	vscode.commands.registerCommand( CommandKey.openNerd4jSettings, async () => {

		vscode.commands.executeCommand( 'workbench.action.openSettings', 'Nerd4J' );

	});

	/* Register command to clear the Nerd4J settings. */
	vscode.commands.registerCommand( CommandKey.clearNerd4jSettings, commands.clearNerd4JSettings );


	/* Register command to show the extension settings menu. */
	vscode.commands.registerCommand( CommandKey.showSettingsMenu, async () => {

		const selectedOption = await vscode.window.showQuickPick(
			[
				{ label: 'Open settings', command: CommandKey.openNerd4jSettings },
				{ label: 'Clear settings', command: CommandKey.clearNerd4jSettings },
				{ label: 'Java command', command: CommandKey.showJavaCommandMenu }
			],
			{ placeHolder: 'Settings' }
		);

		if( selectedOption ) {
			vscode.commands.executeCommand(selectedOption.command);
		}

	});


	/* ***************** */
	/*  CODE GENERATION  */
	/* ***************** */

	/* Register command to generate the toString method. */
	vscode.commands.registerCommand( CommandKey.generateToStringMethod,	commands.generateToStringMethod );

	/* Register command to generate methods equals and hashCode. */
	vscode.commands.registerCommand( CommandKey.generateHashCodeAndEqualsMethods, commands.generateHashCodeAndEqualsMethods );

	/* Register command to generate accessor methods. */
	vscode.commands.registerCommand( CommandKey.generateAccessorMethods, commands.generateAccessorMethods );

	/* Register command to show the code generation menu. */
	vscode.commands.registerCommand( CommandKey.showGenerateMenu, async () => {

		const selectedOption = await vscode.window.showQuickPick(
			[
				{ label: 'Method toString()', command: CommandKey.generateToStringMethod },
				{ label: 'Methods hashCode() and equals()', command: CommandKey.generateHashCodeAndEqualsMethods },
				{ label: 'Accessor methods', command: CommandKey.generateAccessorMethods }
			],
			{ placeHolder: 'Generate' }
		);

		if( selectedOption ) {
			vscode.commands.executeCommand( selectedOption.command );
		}

	});


	/* **************** */
	/*  EXTENSION INIT  */
	/* **************** */


	/* Register command to initialize a Maven project. */
	vscode.commands.registerCommand( CommandKey.initMavenProject, commands.initMavenProject );

	/* Register command to initialize a plain Java  project. */
	vscode.commands.registerCommand( CommandKey.initPlainJavaProject, commands.initPlainJavaProject );

	/* Register command to initialize the Nerd4J extension and choose the project type. */
	vscode.commands.registerCommand( CommandKey.chooseProjectTypeMenu, async () => {
	
		const selectedOption = await vscode.window.showQuickPick(
			[
				{ label: JavaProjectType.maven, command: CommandKey.initMavenProject },
				{ label: JavaProjectType.plainJava, command: CommandKey.initPlainJavaProject }
			],
			{ placeHolder: 'Select the type of project' }
		);

		if( selectedOption ) {
			vscode.commands.executeCommand( selectedOption.command );
		}

	});

	/* Register command to open the Nerd4J main menu. */
	vscode.commands.registerCommand( CommandKey.showOptionsMenu, async () => {
		
		const selectedOption = await vscode.window.showQuickPick(
			[
				{ label: 'Nerd4J: Generate', command: CommandKey.showGenerateMenu },
				{ label: 'Nerd4J: Settings', command: CommandKey.showSettingsMenu }
			],
			{ placeHolder: 'Nerd4J' }
		);

		if( selectedOption ) {
			vscode.commands.executeCommand( selectedOption.command );
		}

	});

	/* Register command to open the Nerd4J extension and initialize it if necessary. */
	vscode.commands.registerCommand( CommandKey.openExtension, async () => {

		if( commands.getProjectType() ) {

			vscode.commands.executeCommand( CommandKey.showOptionsMenu );
			
		} else {
			
			vscode.commands.executeCommand( CommandKey.chooseProjectTypeMenu );

		}

	});

}
