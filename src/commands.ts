import * as vscode from 'vscode';
import * as jvm from './jvm';

import { Field, Accessor, Getter, Setter, Wither, AccessorImplementation } from './commons';
import { JavaClassProcessor } from './java';
import { JavaProjectType, Nerd4JSetting } from './config';
import { getDefaultLocalMavenRepository } from './maven';


/**
 * Show dialog to select a folder
 * 
 * @param openLabel label of the open button
 * @param title title of the dialog
 * @param foldersOnly tells if the file picker allows selectin files or only folders
 * @returns the path of the selected file or folder
 */
async function showFilePicker( openLabel: string, title: string, foldersOnly : boolean = false ) : Promise<string|null> {

	const dialogOptions: vscode.OpenDialogOptions = {
        canSelectMany: false,
        openLabel: openLabel,
        title: title,
        canSelectFiles: ! foldersOnly,
        canSelectFolders: foldersOnly
    };

    const fileUri = await vscode.window.showOpenDialog( dialogOptions );
    return fileUri && fileUri[0] ? fileUri[0].fsPath : null;

}


/**
 * Creates a quinck pick item using the values of the given field.
 * 
 * @param field the field to convert
 * @returns a new quick pick item
 */
function toQuickPickItem( field : Field ) : vscode.QuickPickItem {

    return {
        label : `${field.type} ${field.name}`,
        description : field.accessorImplementation,
        picked : field.accessorImplementation === AccessorImplementation.none
    };

}


/* ************** */
/*  JAVA COMMAND  */
/* ************** */


/**
* Executes the command associated to the GUI instruction
* Nerd4J: Settings > Java command > Show Java command
* 
* @return a promise to wait for
*/
export async function showJavaCommand() : Promise<void> {

    const javaCommand = await jvm.getJavaCommandPath();
    if( javaCommand ) {
        vscode.window.showInformationMessage( 'The Java command currently in use: ' + javaCommand );
    }
    
}


/**
* Executes the command associated to the GUI instruction
* Nerd4J: Settings > Java command > set custom Java command
* 
* @return a promise to wait for
*/
export async function setCustomJavaCommand() : Promise<void> {
    
    const javaCommand = await showFilePicker( 'Select Java command', 'Select the Java executable file' );
    if( javaCommand ) {

        await jvm.setCustomJavaCommandPath( javaCommand );
        vscode.window.showInformationMessage( 'The Java command has been set to: ' + javaCommand );

    } 

}

/**
* Executes the command associated to the GUI instruction
* Nerd4J: Settings > Java command > reset default Java command
* 
* @return a promise to wait for
*/
export async function resetDefaultJavaCommand() : Promise<void> {
    
    await jvm.resetDefaultJavaCommandPath();
    
    const javaCommand = await jvm.getJavaCommandPath();
    vscode.window.showInformationMessage( 'The Java command has beed restored to: ' + javaCommand );

}


/* ****************** */
/*  CODE GENERATION   */
/* ****************** */


/**
 * Executes the command associated to the GUI instruction
 * Nerd4J: Generate > toString()
 * 
 * @return a promise to wait for
 */
export async function generateToStringMethod() : Promise<void> {


    /* Getting the infos about the java class to modify. */
    const javaClassProcessor = await JavaClassProcessor.build();
    if( ! javaClassProcessor ) {
        return;
    }
    
    const fields = await javaClassProcessor.getFields();
    /* fields = undefined means the java processor faild in retrieving the information. */
    if( ! fields ) {
        return;
    }

    const options = fields.map( field => toQuickPickItem(field) );
    const selectedFields = fields.length > 0 
    ? await vscode.window.showQuickPick( options, {
        canPickMany: true,
        placeHolder: 'Select fields',
    })
    : [];

    /* selectedFields = undefined means the user aborted the operation. */
    if( ! selectedFields ) {
        return;
    }

    const layout = await vscode.window.showQuickPick(
        ['likeIntellij()', 'likeEclipse()', 'likeFunction()', 'likeTuple()', 'using( "{", ":", ",", "}" )'],
        { placeHolder: 'Select a layout' }
    );

    /* layout = undefined means the user aborted the operation. */
    if( ! layout ) {
        return;
    }

    const printFieldNamesAnswer = selectedFields.length > 0
    ? await vscode.window.showQuickPick(
        ["Yes","No"],
        { title : "Print field names" }
     )
    : "No";

    const printFieldNames : boolean = printFieldNamesAnswer === "Yes";
    const fieldNames = selectedFields.map( field => field.label.split( ' ' )[1] );
    
	await javaClassProcessor.insertOrReplaceToString( fieldNames, printFieldNames, layout );
    							
}

/**
 * Executes the command associated to the GUI instruction
 * Nerd4J: Generate > equals() and hashCode()
 * 
 * @return a promise to wait for
 */
export async function generateHashCodeAndEqualsMethods() : Promise<void> {

    /* Getting the infos about the java class to modify. */
    const javaClassProcessor = await JavaClassProcessor.build();
    if( ! javaClassProcessor ) {
        return;
    }

    const fields = await javaClassProcessor.getFields();
    /* fields = undefined means the java processor faild in retrieving the information. */
    if( ! fields ) {
        return;
    }

    const options = fields.map( field => toQuickPickItem(field) );
    const selectedFields = fields.length > 0
    ? await vscode.window.showQuickPick( options, {
        canPickMany: true,
        placeHolder: 'Select fields'
    })
    : [];

    /* selectedFields = undefined means the user aborted the operation. */
    if( ! selectedFields ) {
        return;
    }

    const fieldNames = selectedFields.map( field => field.label.split( ' ' )[1] );

    await javaClassProcessor.insertOrReplaceEquals( fieldNames );
    await javaClassProcessor.insertOrReplaceHashCode( fieldNames );
	
}


/**
 * Parameter object used to define the values of each accessor method.
 * 
 * @author Massimo Coluzzi
 */
interface AccessorParams {

    /** The type of accesso method. Can be one of: 'getter', 'setter', or 'wither' */
    readonly type : string;

    /** The prefix of the related accesso method. Can be one of 'get', 'set', or 'with'. */
    readonly prefix : string;

    /** The factory method used to create the related Accessor object. */
    readonly map : ( field : Field ) => Accessor;

}


/**
 * Executes the command associated to the GUI instruction
 * Nerd4J: Generate > Accessor methods
 * 
 * @returns a promise to wait for
 */
export async function generateAccessorMethods() : Promise<void> {

    /* Getting the infos about the java class to modify. */
    const javaClassProcessor = await JavaClassProcessor.build();
    if( ! javaClassProcessor ) {
        return;
    }

    /* Define the parameters to use for the creation of the accessor methods. */
    const createAccessorsParams = new Map<String,AccessorParams> ();
    createAccessorsParams.set( 'Getters', { prefix : 'get',  type : 'getter', map : Getter.of } );
    createAccessorsParams.set( 'Setters', { prefix : 'set',  type : 'setter', map : Setter.of } );
    createAccessorsParams.set( 'Withers', { prefix : 'with', type : 'wither', map : Wither.of } );

    /* Define the menu to show. */
    const createAccessorOptions = Array
        .from( createAccessorsParams.keys() )
        .map( (key) => ({label: key, picked: true} as vscode.QuickPickItem) );

    /* Ask the user to chose the accessor methods to create. */
    const createAccessorsSelection = await vscode.window.showQuickPick( createAccessorOptions, {
        canPickMany: true,
        placeHolder: 'Select methods to generate'
    });

    /* If no accessors have been selected, nothing will be done. */
    if( ! createAccessorsSelection ) {
        return;
    }
       
    const accessorMap = new Map<string,Accessor[]>();
    for( const accessorType of createAccessorsSelection ) {

        /* Define the menu to show. */
        const createAccessorParams = createAccessorsParams.get( accessorType.label );
        if( ! createAccessorParams ) {
            continue;
        }

        const fields = await javaClassProcessor.getFields( createAccessorParams.prefix );
        if( ! fields || fields.length <= 0 ) {
            continue;
        }

        const fieldsOptions : vscode.QuickPickItem[] = [];
        const fieldMap = new Map<string,Field>();
        for( const field of fields ) {
            
            const label = `${field.type} ${field.name}`;
            fieldMap.set( label, field );
            fieldsOptions.push({
                label : label,
                description : field.accessorImplementation,
                picked : field.accessorImplementation === AccessorImplementation.none
            });

        }

        /* Ask the user to choose the fields. */
        const fieldsSelection = await vscode.window.showQuickPick( fieldsOptions, {
            canPickMany: true,
            placeHolder: `Select fields for ${createAccessorParams.type} methods`,
        });
        
        /* selectedFields = undefined means the user aborted the operation. */
        if( ! fieldsSelection ) {
            return;
        }

        /* If the user did not select any field, nothing needs to be done. */
        if( fieldsSelection.length <= 0 ) {
            continue;
        }

        /* Collect the fields corresponding to the picked items in the selection. */
        const selectedFields = fieldsSelection.map( item => fieldMap.get(item.label)! );

        /* Converts the selected fields into the corresponding accessor methods. */
        const selectedAccessors = selectedFields.map( createAccessorParams.map );

        for( let accessor of selectedAccessors ) {

            let accessors = accessorMap.get( accessor.field.name );
            if( ! accessors ) {
                accessors = [];
                accessorMap.set( accessor.field.name, accessors );
            }
            accessors.push( accessor );

        }
    }
    
    /* Generate the code for all the accessors. */
    await javaClassProcessor.inseertOrReplaceAccessors( accessorMap );

};


/* **************** */
/*  EXTENSION INIT  */
/* **************** */


/**
 * Returns the project type defined in the Nerd4J settings.
 * 
 * @returns the project type defined in the Nerd4J settings
 */
export function getProjectType() : string {

    const projectType = vscode.workspace.getConfiguration().get( Nerd4JSetting.projectType );
    return projectType ? projectType as string : '';
    
}


/**
 * Sets the project type in the Nerd4j settings as a Maven project.
 * 
 * @param projectType the project type to set
 */
export async function setProjectType( projectType : string ) : Promise<void> {


    await vscode.workspace.getConfiguration().update( Nerd4JSetting.projectType, projectType );

}


/**
 * Sets the project type in the Nerd4j settings to undefined.
 * 
 */
export async function clearNerd4JSettings() : Promise<void> {


    await vscode.workspace.getConfiguration().update( Nerd4JSetting.projectType,    undefined );
    await vscode.workspace.getConfiguration().update( Nerd4JSetting.javaOutFolder,  undefined );
    await vscode.workspace.getConfiguration().update( Nerd4JSetting.javaLibFolder,  undefined );
    await vscode.workspace.getConfiguration().update( Nerd4JSetting.mavenLocalRepo, undefined );
    
}


/**
 * Initialize the Nerd4J extension to manage an Apache Maven project.
 * 
 */
export async function initMavenProject() : Promise<void> {

    let mavenLocalRepoPath = getDefaultLocalMavenRepository();
    if( ! mavenLocalRepoPath ) {

        mavenLocalRepoPath = await showFilePicker( 'Select the local Maven reposotory folder', 'Select the local Maven reposotory folder', true );
        
        /*
         * If the user does not peek the local maven repository
         * we are not able to proceed.
         */
        if( ! mavenLocalRepoPath ) {
            return;
        }

    }

    await vscode.workspace.getConfiguration().update( Nerd4JSetting.mavenLocalRepo, mavenLocalRepoPath );
    await setProjectType( JavaProjectType.maven );

    vscode.window.showInformationMessage( 'The Nerd4J extension has been configured in Maven project mode.' );

}


/**
 * Initialize the Nerd4J extension to manage a plain Java project.
 * 
 */
export async function initPlainJavaProject() : Promise<void> {


    try {
    
        const javaOutFolder = await showFilePicker( 'Select Java output folder', 'Select Java output folder', true );
        if( javaOutFolder ) {

            await vscode.workspace.getConfiguration().update( Nerd4JSetting.javaOutFolder, javaOutFolder );

            const javaLibFolder = await showFilePicker( 'Select Java depencency libs folder', 'Select Java dependency libs folder', true );
            if( javaLibFolder ) {

                await vscode.workspace.getConfiguration().update( Nerd4JSetting.javaLibFolder, javaLibFolder );
                await setProjectType( JavaProjectType.plainJava );

                vscode.window.showInformationMessage( 'The Nerd4J extension has been configured in plain Java project mode.' );
                return;

            }
        }

    }catch( ex ) {
        
        const error = ex as Error;
        vscode.window.showErrorMessage( error.message );

    }

    /*
     * If one of the previous steps fails the configuration will be rolled back
     * and an error message will be displayed.
     */
    vscode.window.showWarningMessage( 'Nerd4J extension initialization failed' );

}
