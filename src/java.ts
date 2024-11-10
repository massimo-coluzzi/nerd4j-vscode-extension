import * as jvm from './jvm';
import * as vscode from 'vscode';
import * as parser from './parser';

import { exec } from 'child_process';
import { Accessor, Field, Indentation, JavaClass, JvmSettings } from './commons';
import { OBJECT_OVERRIDES, ObjectMethod, ObjectOverrideConf } from './config';


/** Regular expression to find the Nerd4J package import block. */
const GLOBAL_IMPORT_REGEXP : RegExp = /import\s+org.nerd4j.utils.lang.\*\s*;\s*/g;


/**
 * Aggregates fields into groups.
 * If the given fields are more than three,
 * it returns a list of groups where each
 * group counts at most three elements.
 * 
 * @param array the list of fields to group
 * @returns a list of groups
 */
function group( array : string[] ) : string[][] {

	if( array.length < 4 ) {
		return [array];
	}

	if( array.length === 4 ) {
		return [
			array.slice(0,2),
			array.slice(2,4)
		];
	}

	let groups = [] as string[][];
	for( var i = 0; i < array.length; i += 3 ) {
		groups.push( array.slice(i, i+3) );
	}

	return groups;

}

/**
 * Prints a group of fields using the given prefix and suffix.
 * 
 * @param group     the group of fields to print
 * @param prefix    the prefix to apply
 * @param separator the separator to use between fields
 * @param suffix    the suffix to apply
 * @returns a code snippet
 */
function printFieldGroup(
	group : string[], prefix : string,
	separator : string, suffix : string
) : string {

	let code = prefix + group[0];
	for( let i = 1; i < group.length; ++i ) {

		code += separator + group[i];

	}

	return code + suffix;

}


/**
 * Represents a processor capable to manipulate a Java class.
 * 
 * @author Massimo Coluzzi
 */
export class JavaClassProcessor {


    /** The JVM related settings. */
    private jvmSettings : JvmSettings;

    /** The editor holding the Java class source code. */
    private readonly editor : vscode.TextEditor;

    /** The indentation configurations to apply. */
    private readonly indentation : Indentation;

    /** The name of the package defined in the Java file. */
    private readonly packageName;

    /** The class to process. */
    private javaClass : JavaClass;

    
    /**
     * Constructor with parameters.
     * 
     * @param jvmSettings the JVM related settings
     * @param editor      the editor to use
     * @param packageName the name of the package
     * @param javaClass   the java class to process
     */
    constructor(
        jvmSettings : JvmSettings, editor : vscode.TextEditor,
        packageName : string, javaClass : JavaClass
    ) {

        this.editor = editor;
        this.javaClass = javaClass;
        this.jvmSettings = jvmSettings;
        this.packageName = packageName;
        this.indentation = Indentation.of( javaClass.getScope() );
        
    }


    /* ***************** */
    /*  PRIVATE METHODS  */
    /* ***************** */


    /**
     * Recomputes the JavaClass object after the code has been modified.
     * 
     */
    private updateJavaClass() : void {

        const javaClass = parser.findPointedClass( this.editor );
        if( javaClass ) {

            this.javaClass = javaClass;

        } else {

            vscode.window.showErrorMessage( `Unexpected failure. Unable to find the class to process ${this.javaClass.name}` );

        }

    }


    /**
     * Adds the given import to the given editor if it does not exist.
     * 
     * @param importRegExp regexp to use for finding the import statement
     * @param importCode   the import statement to write if not present
     */
    private async fixImport( importRegExp : RegExp, importCode : string ) : Promise<void>{

        const javaFileContent = this.editor.document.getText();
        if( ! importRegExp.exec(javaFileContent) && ! GLOBAL_IMPORT_REGEXP.exec(javaFileContent) ) {
        
            await this.editor.edit( editBuilder => {

                const position = new vscode.Position( 1, 0 );
                const range = new vscode.Range( position, new vscode.Position(2,0) );
                const suffix = this.editor.document.getText( range ) === '\n' ? '' : '\n';

                editBuilder.insert( position, `\n${importCode}${suffix}` );

            });
            this.updateJavaClass();

        }

    }


    /**
     * Inserts the given implementation of an Object inherited method. 
     * If the method exists asks the user to replace it.
     * Otherwise, it inserts it in the pointed position.
     * This method handles also the related imports.
     * 
     * @param objectOverride the configuration related to the method to override
     * @param code           the code to insert
     */
    private async insertOrReplaceMethodInheritedByObjectClass(
        objectOverride : ObjectOverrideConf, code : string
    ) : Promise<void> {

        const javaFileContent = this.editor.document.getText();
        const methodInterval = parser.findExistingMethod( javaFileContent, objectOverride.method.regexp, this.javaClass );
        if( methodInterval ) {
            
            /* If the code exists we ask the user to replace it. */
            const answer = await vscode.window.showInformationMessage(
                `The ${objectOverride.method.name} method is already implemented.`, "Regenerate", "Cancel"
            );
            if( answer === "Regenerate" ) {
                            
                const range = methodInterval.toRange( this.editor.document );
                await this.editor.edit( editBuilder => {
                    editBuilder.replace( range, code );
                });

                this.updateJavaClass();
                vscode.window.showInformationMessage( `${objectOverride.method.name} method regenerated` );
                
            }

        } else {

            const cursorPosition = this.editor.selection.end;
            const cursorIndex = this.editor.document.offsetAt( cursorPosition );

            const insertIndex = this.javaClass.getInsertIndex( javaFileContent, cursorIndex );
            const insertInterval = parser.getWhitespaceInterval( javaFileContent, insertIndex );

            const range = insertInterval.toRange( this.editor.document );
            await this.editor.edit( editBuilder => {
                editBuilder.replace( range, code );
            });
            this.updateJavaClass();

        }

        await this.fixImport( objectOverride.import.regexp, objectOverride.import.code );

    }


    /* **************** */
    /*  PUBLIC METHODS  */
    /* **************** */


    /**
     * Returns the Java class currently pointed in the editor.
     * 
     * @return currently pointed class
     */
    public getPointedClass() : JavaClass {

        return this.javaClass;

    }


    /* **************** */
    /*  CODE ANALYZERS  */
    /* **************** */


    /**
     * Returns all the fields of the declared or inherited by the
     * class currently pointed in the acrive editor.
     * 
     * @param prefix - prefix of the method type to analyze
     * @returns list of accessible fields
     */
    public async getFields( prefix : string = "" ) : Promise<Field[]> {

        return new Promise(async (resolve, reject) => {
                      
            /* Get the class path to use in the java command. */
            const javaFilePath = this.editor.document.uri.fsPath;
            const classAnalyzerCommand = await jvm.getClassAnalyzerJavaCommand( javaFilePath, this.jvmSettings );
            if( ! classAnalyzerCommand ) {
                return;
            }
            
            const className = this.javaClass.getNameUsedByClassLoader();
            const fullClassName = this.packageName ? `${this.packageName}.${className}` : className;

            /* Create the java command to execute. */
            const fullCommand = `${classAnalyzerCommand} '${fullClassName}' ${prefix}`;

            /* Execute the command. */
            exec( fullCommand, (error, stdout, stderr ) => {

                const failure = error ? error : stderr;
                if( failure ) {
                    vscode.window.showErrorMessage( `The code analysis failed with the following error: ${failure}` );
                    return;
                }

                /* We save the output of the java command as a list of lines. */
                const outputList = stdout.trim().split("\n");
                const fields = outputList
                    .filter( output => output?.length > 0 )
                    .map( output => Field.of(this.javaClass.name,output) );

                resolve( fields );
                
            });

        });
        
    } 



    /* ***************** */
    /*  CODE GENERATORS  */
    /* ***************** */


    /**
     * Generate the code for the toString method.
     * Inserts the code if not present or replaces
     * the existing verion if present.
     * 
     * @param fieldNames names of the fields to include in the hashCode method
     * @param layoutType layout type of the toString output
     * @param printFieldNames tells if the output should report the name of the fields
     */
    public async insertOrReplaceToString(
        fieldNames: string[], printFieldNames : boolean, layoutType: string
    ) : Promise<void> {

        const base = this.indentation.base;
        const step = this.indentation.step;

        let code = `
${base}
${base}/**
${base} * {@inheritDoc}
${base} */
${base}@Override
${base}public String toString()
${base}{
${base}
${base}${step}return ToString.of( this )`;

        if( ! fieldNames || fieldNames.length > 0 ) {

            if( printFieldNames ) {

                for( const fieldName of fieldNames ) {

                    code += `\n${base}${step}${step}.print("${fieldName}", ${fieldName})`;

                }

            } else {

                for( var fieldGroup of group(fieldNames) ) {
                
                    code += printFieldGroup( fieldGroup, `\n${base}${step}${step}.print( `, ', ', ' )' );

                }

            }

        }

	code += `
${base}${step}${step}.${layoutType};
${base}
${base}}
${base}
`;

        await this.insertOrReplaceMethodInheritedByObjectClass( OBJECT_OVERRIDES[ObjectMethod.toString], code );

    }


    /**
     * Generate the code for the hashCode method.
     * Inserts the code if not present or replaces
     * the existing verion if present.
     * 
     * @param fieldNames names of the fields to include in the hashCode method
     */
    public async insertOrReplaceHashCode( fieldNames: string[] ) : Promise<void> {

	    const base = this.indentation.base;
	    const step = this.indentation.step;

	    let code = `
${base}
${base}/**
${base} * {@inheritDoc}
${base} */
${base}@Override
${base}public int hashCode()
${base}{
${base}
${base}${step}return `;

        if( ! fieldNames || fieldNames.length === 0 ) {

            code += 'super.hashCode();';

        } else {

            code += 'Hashcode.of(';
            const groups = group( fieldNames );

            if( groups.length === 1 ) {

                code += printFieldGroup( groups[0], ' ', ', ', ' );' );

            } else {

                code += printFieldGroup( groups[0], `\n${base}${step}${step}`, ', ', '' );
                for( let i = 1; i < groups.length; ++i ) {

                    code += printFieldGroup( groups[i], `,\n${base}${step}${step}`, ', ', '' );
                    
                }
                code += `\n${base}${step});`;

            }

        }

	code += `
${base}
${base}}
${base}
`;

        await this.insertOrReplaceMethodInheritedByObjectClass( OBJECT_OVERRIDES[ObjectMethod.hashCode], code );

    }


    /**
     * Generate the code for the equals method.
     * Inserts the code if not present or replaces
     * the existing verion if present.
     * 
     * @param fieldNames names of the fields to include in the hashCode method
     */
    public async insertOrReplaceEquals( fieldNames: string[] ) : Promise<void> {

        const base = this.indentation.base;
        const step = this.indentation.step;

        let code = `
${base}
${base}/**
${base} * {@inheritDoc}
${base} */
${base}@Override
${base}public boolean equals( Object other )
${base}{
${base}
${base}${step}return Equals.ifSameClass( this, other`;

        if( ! fieldNames || fieldNames.length === 0 ) {

            code += ' );';

        } else {

            for( var fieldName of fieldNames ) {

                if( fieldName ) {

                    code += `,\n${base}${step}${step}o -> o.${fieldName}`;

                }
            }

            code += `\n${base}${step});`;
        }

        code += `
${base}
${base}}
${base}
`;

        await this.insertOrReplaceMethodInheritedByObjectClass( OBJECT_OVERRIDES[ObjectMethod.equals], code );

    }


    /**
     * Generate the code for the required accessor methods.
     * 
     * @param accessorMap the accessor methods to generate
     * @returns the code for the required accessor methods
     */
    public async inseertOrReplaceAccessors( accessorMap : Map<string,Accessor[]> ) : Promise<void> {


        let code = '';
        let javaFileContent = this.editor.document.getText();

        for( var accessors of accessorMap.values() ) {

            for( var accessor of accessors ) {

                /* The regular expression to use to find the method. */
                const regexp = new RegExp( accessor.regexPattern(), 'g' );

                /* Check if the accessor method already exists. */
                const methodInterval = parser.findExistingMethod( javaFileContent, regexp, this.javaClass );
                if( methodInterval ) {

                    /* 
                    * If the code already exists, ask the user to confirm
                    * the substitution of the existing code.
                    */
                    const answer = await vscode.window.showInformationMessage(
                        `The ${accessor.name} method is already implemented.`,
                        "Regenerate", "Cancel"
                    );
                    
                    /*
                    * If the user confirms, the old code will be removed
                    * and the new code will be added to the output of the
                    * method.
                    */
                    if( answer === "Regenerate" ) {
                        
                        const range = methodInterval.toRange( this.editor.document );
                        await this.editor.edit( editBuilder => {
                            editBuilder.delete( range );
                        });
                        this.updateJavaClass();
                        code += accessor.code( this.indentation );

                        /* We changed the code of the class so we need to update it. */
                        this.updateJavaClass();
                        javaFileContent = this.editor.document.getText();

                    }

                } else {

                    /* If the accessor method does not exist will be created. */
                    code += accessor.code( this.indentation );

                }

            }
                
        }

        if( code ) {
            
            /* We ask the Java class for the right position where to insert the code. */
            const cursorPosition = this.editor.selection.end;
            const cursorIndex = this.editor.document.offsetAt( cursorPosition );

            const insertIndex = this.javaClass.getInsertIndex( javaFileContent, cursorIndex );
            const insertInterval = parser.getWhitespaceInterval( javaFileContent, insertIndex );
            const range = insertInterval.toRange( this.editor.document );

            await this.editor.edit( editBuilder => {
                editBuilder.replace( range, code );
            });

            this.updateJavaClass();
            
        }

    }


    /* ***************** */
    /*  FACTORY METHODS  */
    /* ***************** */


    /**
     * Builds a new JavaClass object by parsing
     * the code in the currently active editor.
     * 
     * @return a new JavaClass if any, null otherwise.
     */
    public static async build() : Promise<JavaClassProcessor|null> {

        /* Getting the current active editor if any. */
        const activeEditor = vscode.window.activeTextEditor;
        if( ! activeEditor ) {
            vscode.window.showErrorMessage( 'No active editor' );
            return null;
        }

        /* Path to the currently pointed Java file. */
        const javaFilePath  = activeEditor.document.uri.fsPath;

        /* Settings to use for configuring the JVM. */
        const jvmSettings = await jvm.getJvmSettings( javaFilePath );
        if( ! jvmSettings ) {
            return null;
        }

        /* Extract the content of the java file. */
        const javaFileContent = activeEditor.document.getText();

        /* Extract the name of the package. */
        const packageName = parser.getPackageName( javaFileContent );

        /* Find the Java class containing the current position of the cursor in the text editor. */
        const javaClass = parser.findPointedClass( activeEditor );
        if( ! javaClass ) {
            vscode.window.showErrorMessage( "The cursor in the active editor is not pointing to any Java class" );
            return null;
        }

        /* Make sure the class has been poperly compiled. */
        if( ! jvm.isCompiledVersionAvailable(jvmSettings,packageName,javaClass) ) {
            return null;
        }

        /* Returns the Java processor to use for processing this Java file. */
        return new JavaClassProcessor( jvmSettings, activeEditor, packageName, javaClass );

    }
    
}
