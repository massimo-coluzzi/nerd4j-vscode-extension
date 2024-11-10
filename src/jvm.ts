import * as fs from 'fs';
import * as path from 'path';
import * as which from 'which';
import * as vscode from 'vscode';

import * as maven from './maven';
import * as plain from './plain';

import { exec } from 'child_process';
import { CommandKey } from './config';
import { JavaClass, JvmSettings } from './commons';

/* Name of the Java analyzer class. */
const JAVA_CLASS_ANALYZER_FILE : string = 'ClassAnalyzer';

/* Location of the Java analyzer class. */
const JAVA_CLASS_ANALYZER_FOLDER : string = path.join(__dirname, '..', 'src', 'java'); 

/* Key of the Java home property in vscode settings. */
const JAVA_HOME = 'java.jdt.ls.java.home';

/* Key of the Nerd4J Java command property in vscode settings. */
const NERD4J_JAVA_COMMAND = 'nerd4j.java.command';


/* ******************* */
/*  PRIVATE FUNCTIONS  */
/* ******************* */


/**
 * Return the path to the default Java command if it is defined.
 * Otherwise, it returns null.
 * 
 * @returns the path of the java command if defined, null otherwise
 */
async function getDefaultJavaCommand(): Promise<string|null> {
    
    try{

        return await which( 'java' );

    }catch( error ) {

        return null;

    }

}


/**
 * Return the classpath of the project, built with the dependencies in the pom.xml file.
 * 
 * @param javaFilePath the path to the java file
 * @param jvmSettings  the JVM settings to use
 * @returns the classpath of the project
 */
function getJavaClassPath( javaFilePath : string, jvmSettings : JvmSettings ): string|null {
    
    /* Get the right separator based on the OS. */
    const separator = process.platform === 'win32' ? ';' : ':';
    
    /* Extract the paths of the dependency jar files from the pom.xml file. */
    const dependecyPaths = jvmSettings.dependencyPaths;

    /* Create the class path for the maven dependencies. */
    const mavenClassPath = dependecyPaths.join( separator );

    /* Create the full class path for the java project. */
    const javaOutputFolderPath = jvmSettings.outFolder;
    return mavenClassPath
    ? `${JAVA_CLASS_ANALYZER_FOLDER}${separator}${mavenClassPath}${separator}${javaOutputFolderPath}`
    : `${JAVA_CLASS_ANALYZER_FOLDER}${separator}${javaOutputFolderPath}`;
    
}


/**
 * Tells if the provided path points to a Java source file.
 * 
 * @param javaFilePath path to check
 * @returns true if the path refers to a Java source file
 */
export function isJavaSourceFile( javaFilePath : string ) : boolean {

    const fileParts = path.basename( javaFilePath ).split('.'); 
	const fileExt  = fileParts[1];

	return fileExt === 'java';

}


/* ****************** */
/*  PUBLIC FUNCTIONS  */
/* ****************** */


/**
 * Returns the JVM settings if available.
 * Otherwise, returns null.
 * 
 * @param javaFilePath path to the Java file if any.
 * @returns the JVM settings if available
 */
export async function getJvmSettings( javaFilePath : string ) : Promise<JvmSettings|null> {


    if( ! isJavaSourceFile(javaFilePath) ) {
        vscode.window.showErrorMessage( "The active editor is not pointing to a Java file" );
        return null;
    }

    return maven.isMavenProject()
    ? await maven.getJvmSettings( javaFilePath )
    : plain.getJvmSettings();

}


/**
 * Return the path of the Java command defined in the project.
 * It starts checking vscode settings using the following priority:
 * workspace > user > operating system
 * 
 * If no java home is defined in the vscode settings, it checks if Java
 * is installed in the system. If no reference to Java is found,
 * the method returns null.
 * 
 * @return the path of the Java command in use
 */
export async function getJavaCommandPath(): Promise<string|null> {

    const config = vscode.workspace.getConfiguration();

    /*
     * If the Nerd4J custom Java command property is defined in the vscode settings
     * returns the configured path to the java command.
     */
    const nerd4JJavaCommandPath = config.get( NERD4J_JAVA_COMMAND );
    if( nerd4JJavaCommandPath ) {
        return nerd4JJavaCommandPath as string;
    }

    /*
     * If the Ner4J custom Java command is not defined, search for the
     * Java home property in the vscode settings.
     */
    const javaHome = config.get( JAVA_HOME );
    if( javaHome ) {
        return path.join( javaHome as string, 'bin', 'java' );
    }

    /*
     * Otherwise, search for the operating system default Java command.
     */
    return getDefaultJavaCommand();

}


/**
 * Set a custom java command to be used by the Nerd4J extension.
 * 
 * @param javaHome - path to the Java home folder
 */
export async function setCustomJavaCommandPath( javaCommand: string ) {

    return new Promise( (resolve,reject) => {

        /*
         * We execute a dry run of the ClassAnalyzer Java program.
         * If the execution succeeds, the provided path is a valid Java executable.
         * Otherwise, an error message will be prompted.
         */
        exec( `${javaCommand} --dry-run -cp '${JAVA_CLASS_ANALYZER_FOLDER}' ${JAVA_CLASS_ANALYZER_FILE}`,
        ( error, stdout, stderr ) => {

            if( error || stderr ) {
                
                vscode.window
                .showErrorMessage(
                    `The selected file ${javaCommand} is not a valid Java command`,
                    { title: 'Select a valid Java command', command: CommandKey.setCustomJavaCommand } )
                .then( selection => {
                    if( selection ) {
                        vscode.commands.executeCommand(selection.command);
                    }
                });

                reject();

            } else {

                vscode.workspace
                    .getConfiguration()
                    .update( NERD4J_JAVA_COMMAND, javaCommand, vscode.ConfigurationTarget.Workspace )
                    .then( () => resolve(null) );

            }

        });

    });

}


/**
 * Removes the vscode settings for the Java command if any.
 * 
 */
export async function resetDefaultJavaCommandPath(): Promise<void> {

    await vscode.workspace.getConfiguration().update( NERD4J_JAVA_COMMAND, undefined );

}


/**
 * Tells if a compiled versio of the class code is available
 * in the project folder. Otherwise, the code must be compiled.
 * 
 * @param packageName the Java package name
 * @param javaClass   the Java class to search
 * @returns true if the code has been compiled
 */
export function isCompiledVersionAvailable(
    jvmSettings : JvmSettings, packageName : string, javaClass : JavaClass
) : boolean {

    const packageSplit = packageName.split( '.' );
    const classFileName = javaClass.getNameUsedByClassLoader();
    const classFilePath = path.join( jvmSettings.outFolder, ...packageSplit, classFileName + '.class' );

    if( ! fs.existsSync(classFilePath) ) {
        vscode.window.showErrorMessage(
            'There is no compiled version of the class file. Please compile the class files'
        );
        return false;
    }

    return true;

}


/**
 * Returns the Java command to run the CodeAnalyzer class.
 * 
 * @param jvmSettings the JVM settings to use
 * @returns the Java command to run the CodeAnalyzer class
 */
export async function getClassAnalyzerJavaCommand(
    javaFilePath : string, jvmSettings : JvmSettings
) : Promise<string|null> {
    
    /* Retrieve the java command. */
    const javaCommandPath = await getJavaCommandPath();
    if( ! javaCommandPath ) {
        return null;
    }
                            
    /* Get the class path to use in the java command. */
    const classPath = getJavaClassPath( javaFilePath, jvmSettings );
                
    /* Create the java command to execute. */
    return `${javaCommandPath} -cp '${classPath}' ${JAVA_CLASS_ANALYZER_FILE}`;

}