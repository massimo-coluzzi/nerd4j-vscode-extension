import * as vscode from "vscode";
import * as fs from "fs";

import { CommandKey, Nerd4JSetting } from "./config";
import { JvmSettings } from "./commons";


/**
 * Returns the Nerd4J with the given key if present.
 * 
 * @param key    the setting to search for
 * @param folder the name of the folder
 * @returns the Nerd4J setting if present
 */
function getNerd4JSetting( key : string, folder : string ) : string|null {

    const path = vscode.workspace.getConfiguration().get( key ) as string;
    if( path && fs.existsSync(path) ) {
        return path;
    }
        
    vscode.window.showErrorMessage(
        `The Nerd4J extension is configured to use ${path} as Java ${folder} folder, but such a folder is not present or not reachable.`,
        { title: 'Check settings', command: CommandKey.openNerd4jSettings }
    ).then( selection => {
        if( selection ) {
            vscode.commands.executeCommand( selection.command );
        }
    });

    return null;

}


/**
 * Returns the JVM settings if available.
 * Otherwise, returns null.
 * 
 * @returns the JVM settings if available
 */
export function getJvmSettings() : JvmSettings|null {

    const outFolder = getNerd4JSetting( Nerd4JSetting.javaOutFolder, 'output' );
    if( ! outFolder ) {
        return null;
    }

    const libFolder = getNerd4JSetting( Nerd4JSetting.javaLibFolder, 'lib' );
    if( ! libFolder ) {
        return null;
    }

    const dependecyPath = `${libFolder}/*`;
    return {
        outFolder : outFolder,
        dependencyPaths : [dependecyPath]
    };

}


/**
 * Return the path of the Java output folder.
 * 
 * @returns the path of the Java output folder
 */
export function getJavaOutputFolderPath() : string|null {

    const customPath = vscode.workspace.getConfiguration().get( Nerd4JSetting.javaOutFolder ) as string;
    if( customPath ) {

        /*
         * If a custom path for the Java output folder is defined
         * in the vscode settings, and such a path exists, we return it.
         */
        if( fs.existsSync(customPath) ) {
            return customPath;

        /*
         * If a custom path is configured but it does not exist
         * we notify the user and fallback to the default paths.
         */
        } else {

            vscode.window.showInformationMessage(
                `The Nerd4J extension is configured to use ${customPath} as Java output folder, but such a folder is not present or not reachable.`,
                { title: 'Check settings', command: CommandKey.openNerd4jSettings }
            ).then( selection => {
                if( selection ) {
                    vscode.commands.executeCommand( selection.command );
                }
            });

        }
    }

    return null;
    
}
