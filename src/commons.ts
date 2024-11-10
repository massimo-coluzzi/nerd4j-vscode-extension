import * as vscode from 'vscode';


/**
 * Returns the project's root folder if any.
 * Otherwise, returns null and error message is displayed.
 * 
 * @return the project's root folder if any
 */
export function getProjectRootFolder() : string|null {
    
    /* Check if at least one workspace folder is defined. */
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if( ! workspaceFolders ) {

        /* If not, an error message will be displayed. */
        vscode.window.showErrorMessage( 'Could not find the root folder of the project' );
        return null;

    }

    /* Extract the project root folder. */
    return workspaceFolders[0].uri.fsPath;

}


/**
 * Collects the settings related to the JVM
 * like the source and output folders or 
 * the project dependencies.
 */
export interface JvmSettings {

    /** The Java output folder. */
    readonly outFolder : string;

    /** The dependency paths. */
    readonly dependencyPaths : string[];
    
}

/**
 * Represents an interval between two indexes in the text.
 * This class expects its boundaries to represent positions
 * in the text. Therefore, the starting and ending index
 * must be integer values and cannot be negative.
 * 
 * Moreover, a text interval can never be empty.
 * At least it contains one character. Therefore,
 * the starting and endting indexes are always included.
 * 
 * @author Massimo Coluzzi
 */
export class TextInterval {

    /** The starting index of the comment (included). */
    public readonly startIndex : number;

    /** The terminating index of the comment (included). */
    public readonly endIndex : number;


    /**
     * Constructor with paramenters.
     * 
     * @param startIndex the interval starting index (included)
     * @param endIndex   the interval ending index (included)
     */
    private constructor( startIndex : number, endIndex : number ) {
        
        if( startIndex < 0 ) {
            throw new Error( `The starting index cannot be negative, but ${startIndex} has been provided` );
        }
        
        if( endIndex < 0 ) {
            throw new Error( `The ending index cannot be negative, but ${endIndex} has been provided` );
        }
        
        if( endIndex < startIndex ) {
            throw new Error( `The starting index must be less or equal to the ending index but [${startIndex},${endIndex}] has been provided` );
        }
        
        this.startIndex = startIndex;
        this.endIndex   = endIndex;

    }


    /**
     * Factory method for the creation of a new interval.
     * 
     * @param startIndex the interval starting index (included)
     * @param endIndex   the interval ending index (included)
     * @returns 
     */
    public static of( startIndex : number, endIndex : number ) {

        return new TextInterval( startIndex, endIndex );
    
    }

    /**
     * Returns the size in characters of the interval.
     * 
     */
    public size() : number {

        return this.endIndex - this.startIndex + 1;

    }

    /**
     * Tells if the current interval lies within the given one.
     * 
     * @param interval the enclosing interval
     * @returns true if this interval is included in the povided one
     */
    public liesWithin( interval : TextInterval ) : boolean {

        return this.startIndex >= interval.startIndex
            && this.endIndex <= interval.endIndex;

    }

    /**
     * Tells if the given value is included in the current interval.
     * 
     * @param index the value to check
     * @returns true if the value is included in the interval
     */
    public includes( index : number ) : boolean {

        return this.startIndex <= index && this.endIndex >= index;

    }

    /**
     * Converts the current interval into a string.
     * This method is intended to be used to represent
     * the interval in logs and messages.
     * 
     * @return a string representing the interval
     */
    public toString() : string {

        return `[${this.startIndex},${this.endIndex}]`;

    }

    /**
     * Converts the current TextInterval into a vscode Range
     * relative to the provided document.
     * 
     * @param document the reference document
     * @returns a new Range within the document
     */
    public toRange( document : vscode.TextDocument ) : vscode.Range {

        const startPosition = document.positionAt( this.startIndex );
        const endPosition   = document.positionAt( this.endIndex );

        return new vscode.Range( startPosition, endPosition );

    }

}


/**
 * Enumerates the types of comment
 * available in the Java code.
 * 
 * @author Massimo Coluzzi
 */
export enum CommentType {

    /** A single line comment, prefixed by '//'. */
    singleLine,

    /** A multi line comment, prefixed by '/*'. */
    multiLine,

    /** A JavaDoc comment, prefixed by '/**'. */
    javaDoc

}

/**
 * Represents a comment in the Java code.
 * 
 * @author Massimo Coluzzi
 */
export class Comment {

    /** The type of comment.  */
    public readonly type : CommentType;

    /** The code interval containing the comment. */
    public readonly interval : TextInterval;


    /**
     * Constructor with parameters.
     * 
     * @param type     the type of comment
     * @param interval the text interval enclosing the comment
     */
    private constructor( type : CommentType, interval : TextInterval ) {

        this.type = type;
        this.interval = interval;

    }

    /**
     * Returns a new Comment of the given type.
     * 
     * @param type       type of comment
     * @param startIndex starting index of the comment interval
     * @param endIndex   ending index of the comment interval
     * @returns a new comment
     */
    public static of( type : CommentType, startIndex : number, endIndex : number ) : Comment {

        const interval = TextInterval.of( startIndex, endIndex );
        return new Comment( type, interval );

    }

}


/**
 * Represents the code indentation.
 * 
 * @author Massimo Coluzzi
 */
export class Indentation {

    /** The string of white spaces or tabs representing the initial indentation. */
    public readonly base : string;
    
    /** The string of white spaces or tabs representing a single indentation step. */
    public readonly step : string;


    /**
     * Constructor with paramenters.
     * 
     * @param step  the indentation step to apply
     * @param level the indentation level, i.e., the initial number of steps
     */
    private constructor( step : string, count : number ) {

        this.step = step;
        this.base = step.repeat( count );

    }

    /**
     * Creates a new indentation with the given level.
     * 
     * @param level the indentation level, i.e., the initial number of steps
     */
    public static of( level : number ) {

        const unitChar = vscode.workspace.getConfiguration().get( 'editor.insertSpaces' ) ? ' ' : '\t';
	    const tabSize  = vscode.workspace.getConfiguration().get( 'editor.tabSize' );

	    const step = tabSize ? unitChar.repeat( +tabSize ) : unitChar;
        return new Indentation( step, Math.max(0, level) );

    }

}


/**
 * Represents a class in the Java code.
 * 
 * @author Massimo Coluzzi
 */
export class JavaClass {


    /** The name of the class. */
    public readonly name : string;
    
    /** The comments in the portion of code belonging to the class. */
    public readonly comments : Comment[];

    /** The code interval covering the class signature.  */
    private readonly signatureInterval : TextInterval;

    /** The code interval covering the body of the class.  */
    private readonly bodyInterval : TextInterval;

    /** The code interval covering the overall class. */
    private readonly classInterval : TextInterval;
    
    /** List of inner classes, if any. */
    private readonly innerClasses : JavaClass[];
    
    /** The outher class, if any. */
    private outherClass? : JavaClass;


    /**
     * Constructor with parameters.
     * 
     * @param name     the name of the class
     * @param interval the code interval containing the class block
     * @param comments the comment blocks within the class block
     */
    private constructor(
        name : string, signatureInterval : TextInterval,
        bodyInterval : TextInterval, comments : Comment[]
    ) {

        this.name = name;
        this.comments = comments;

        this.signatureInterval = signatureInterval;
        this.bodyInterval = bodyInterval;
        this.classInterval = TextInterval.of( signatureInterval.startIndex, bodyInterval.endIndex );

        this.outherClass = undefined;
        this.innerClasses = [];

    }


    /* ***************** */
    /*  PRIVATE METHODS  */
    /* ***************** */


    /**
     * Sets the given class as the outher class of this class.
     * 
     * @param outherClass the outher class to set
     * @throws an error if the given class is not a proper outher class
     *         or if the outher class has been already set.
     */
    private setOutherClass( outherClass : JavaClass ) : void {

        if( this.outherClass ) {
            throw new Error( `The outher class has been already set to ${this.outherClass.toString()}` );
        }

        if( ! this.classInterval.liesWithin(outherClass.bodyInterval) ) {
            throw new Error( `The provided java class ${outherClass.toString()} is not an outher class of ${this.toString()}` );
        }

        this.outherClass = outherClass;

    }


    /**
     * Returns the scope of the given index inside this class.
     * If the scope is greater than 0, it means that the index
     * lies inside the block of a method or an inner class.
     * 
     * @param index the index to check
     * @param code  the code to parse
     * @return the scope of the index
     */
    private getScopeOf( index : number, code : string ) : number {

        /* Skip all the comments before the index. */
        let k = 0;
        while( k < this.comments.length && this.comments[k].interval.endIndex < index ) {
            k += 1;
        }

        /* Moving from the index to the end of the class. */
        let scope = 0;
        for( var i = index; i < this.bodyInterval.endIndex; ++i ) {

            /* If we reach a comment, we skip it. */
            if( k < this.comments.length && this.comments[k].interval.startIndex <= i ) {

                i = this.comments[k].interval.endIndex;
                k += 1;

            } else {

                const c = code[i];

                /*
                 * If we find an open curly bracket we are entering a new block.
                 * Hence, the scope increases.
                 */
                if( c === '{' ) {

                    scope += 1;

                /*
                 * If we find a close curly bracket we are exiting a block.
                 * Hence, the scope decreases.
                 */
                } else if( c === '}' ) {

                    scope -= 1;

                }
            }

        }

        return scope;

    }


    /**
     * Tells if the given index lies inside a comment.
     * 
     * @param index the index to check
     * @return true if inside a comment
     */
    private belongsToAComment( index : number ) : boolean {

        for( const comment of this.comments ) {

            if( comment.interval.includes(index) ) {
                return true;
            }

        }

        return false;

    }


    /* **************** */
    /*  PUBLIC METHODS  */
    /* **************** */


    /**
     * Adds a new inner class to this class.
     * 
     * @param innerClass the inner class to set
     * @throws an error if the given class is not a proper inner class.
     */
    public add( innerClass : JavaClass ) : void {

        if( ! innerClass.classInterval.liesWithin(this.bodyInterval) ) {
            throw new Error( `The provided java class ${innerClass.toString()} is not an inner class of ${this.toString()}` );
        }

        this.innerClasses.push( innerClass );
        innerClass.setOutherClass( this );
        
    }


    /**
     * Returns the scope of the class block.
     * If it is a first level class the scope of its block is 1.
     * If it is an inner class, its scope is 1 plus the scope
     * of its outher class.
     * 
     * @return the scope of the class block
     */
    public getScope() : number {

        return this.outherClass ? this.outherClass.getScope() + 1 : 1;

    }


    /**
     * Returns this class or the inner class whose boundaries contain the given index.
     * If the index lies outside the boundaries of this class returns null.
     * 
     * @param index the index to check
     * @returns the pointed class if any, or null
     */
    public getEnclosingClass( index : number ) : JavaClass|null {

        if( ! this.classInterval.includes(index) ) {
            return null;
        }

        for( const innerClass of this.innerClasses ) {
            
            const pointedClass = innerClass.getEnclosingClass( index );
            if( pointedClass ) {
                return pointedClass;
            }

        }

        return this;

    }
    

    /**
     * Returns a valid position for the new code to be inserted.
     * If the currently pointed position is safe, it will be returned.
     * Otherwise, the end of the class will be returned instead.
     * 
     * @param editor the editor to query
     * @return a valid position for conde insertion.
     */
    public getInsertIndex( javaFileContent : string, index : number ) : number {

        /*
         * The index can be positioned on the class signature.
         * It is a valid postion to identify the class but not
         * to insert the code. 
         * It it is the case, we move it to the end of the class.
         */
        if( ! this.bodyInterval.includes(index) ) {
            return this.bodyInterval.endIndex;
        }

        /*
         * If the index is not positioned on a white space
         * it is not a valid insert index.
         */
        if( ! /\s/.test(javaFileContent[index]) ) {
            return this.bodyInterval.endIndex;
        }

        /*
         * If the index points to a white space but inside
         * a comment, it is not a valid insert index.
         */
        if( this.belongsToAComment(index) ) {
            return this.bodyInterval.endIndex;
        }

        /*
         * Finally, if the index points to a region
         * within the body of a method, then it is
         * not a valid inser index.
         */
        if( this.getScopeOf(index,javaFileContent) !== 0 ) {
            return this.bodyInterval.endIndex;
        }

        /*
         * There are other invalid positions that are not covered
         * by this method. For example a white space within a
         * method signature. If it is the case, the inserted code
         * will break the existing code.
         */

        /*
         * This method is intended to work in best effort.
         * It will return a valid position in most of the cases.
         */
        return index;

    }


    /**
     * Returns the name used by the Java class loader to find this class.
     * 
     * @returns name of this Java class in class loader format
     */
     public getNameUsedByClassLoader() : string {
 
        return this.outherClass
        ? `${this.outherClass.getNameUsedByClassLoader()}$${this.name}`
        : this.name;

    }


    /**
     * Converts the current Java class into a string.
     * This method is intended to be used to represent
     * the Java class in logs and messages.
     * 
     * @return a string representing the Java class
     */
    public toString() : string {
    
        return `${this.name},${this.bodyInterval.toString()}`;

    }


    /* ***************** */
    /*  FACTORY METHODS  */
    /* ***************** */


    /**
     * Factory method, returns a new Java class with the given parameters.
     * 
     * @param name     the name of the class
     * @param interval the code interval containing the class block
     * @param comments the comment blocks available in the text
     * @returns a new Java class
     */
    public static of(
        name : string, signatureInterval : TextInterval,
        bodyInterval : TextInterval, comments : Comment[] ) {

        /* We extract from the list of comments those within the code block intervall. */
        const classComments = comments.filter( comment => comment.interval.liesWithin(bodyInterval) );

        return new JavaClass( name, signatureInterval, bodyInterval, classComments );

    }

}


/**
 * Enumerates the possible locations where an accessor
 * method can be implemented.
 * 
 * @author Massimo Coluzzi
 */
export enum AccessorImplementation {

    /** The accessor method is not implemented.  */
    none = '',

    /** The accessor method is implemented in the currently analyzed class. */
    inCurrentClass = '(defined in current class)',

    /** The accessor method is implemented in one of the ancestor classes. */
    inAncestorClass = '(defined in parent class)'

}


/**
 * Represents one of the fields to use in code generation.
 * 
 * @author Massimo Coluzzi
 */
export class Field {

    /** The name of the field. */
    public readonly name : string;

    /** The type of the field. */
    public readonly type : string;

    /** The class this field belongs to. */
    public readonly enclosingClass : string;

    /** Tells which is the accesso implementatio for the field.  */
    public readonly accessorImplementation : AccessorImplementation;


    /**
     * Constructor with parameters.
     * 
     * @param name the name of the filed
     * @param type the type of the field
     * @param enclosingClass the class this field belongs to
     * @param accessorImplementation where the accesso method is implemented
     */
    private constructor(
        name : string, type : string, enclosingClass : string,
        accessorImplementation : AccessorImplementation
    ) {

        this.name = name;
        this.type = type;
        this.enclosingClass = enclosingClass;
        this.accessorImplementation = accessorImplementation;

    }


    /**
     * Converts the given analysis outcome into an instance
     * of AccessorImplementation.
     * 
     * @param analysisOutcome the outcome to convert
     * @returns instance of AccessorImplementation
     */
    private static toAccessorImplementation( analysisOutcome : string ) : AccessorImplementation {

        if( analysisOutcome === '1' ) {
            return AccessorImplementation.inCurrentClass;
        }
        
        if( analysisOutcome === '2' ) {
            return AccessorImplementation.inAncestorClass;
        }
        
        return AccessorImplementation.none;

    }

    /**
     * Factory method returning a new field with the given values.
     * 
     * @param enclosingClass the class this field belongs to
     * @param itemLabel the label of a QuickPickItem
     * @returns a new field
     */
    public static of( enclosingClass : string, analysisOutcome : string ) : Field {

        const values = analysisOutcome.trim().split( ' ' );
        const accessorImplementation = this.toAccessorImplementation( values[2] );
        
        return new Field( values[1], values[0], enclosingClass, accessorImplementation );

    }


    /**
     * Returns the Override annotation if any.
     * 
     * @returns the Override annotation
     */
    public override() : string {

        return this.accessorImplementation === AccessorImplementation.inAncestorClass
        ? '@Override'
        : '';

    }

}

/**
 * Represents a generic accessor method.
 * 
 * @author Massimo Coluzzi
 */
export abstract class Accessor
{

    /** The Field this Accessor refers to. */
    public field : Field;

    /** The return type for this accessor method. */
    protected returnType : string;

    /** The name of the accessor method. */
    public readonly name : string;


    /**
     * Constructor with parameters.
     * 
     * @param prefix       the prefix of the accessor method name
     * @param field        the field to access
     * @param returnType   the return type of the method
     */
    protected constructor( prefix : string, field : Field, returnType : string ) {

        this.field  = field;
        this.returnType = returnType;

        let fieldName = this.field.name;
        this.name = prefix + fieldName.charAt(0).toUpperCase() + fieldName.slice(1);

    }


    /* **************** */
    /*  PUBLIC METHODS  */
    /* **************** */


    /**
     * Return the regex pattern to use to find this accessor method
     * in the text of a java file.
     * 
     * @returns a regex pattern
     */
    public regexPattern() : string {

        const param = this.paramContent().replace( ' ', '\\s*' );
        return `(@Override)?\\s*public\\s+[^\\s]+\\s+${this.name}\\s*\\(${param}\\)\\s*\\{[^\\}]*\\}`;

    }

    /**
     * Return the java code implementing this accessor method.
     * 
     * @param indentation the indentation configurations to apply
     * @returns java code snipet
     */
    public code( indentation : Indentation ) : string {

        const base = indentation.base;
        const step = indentation.step;

        return `
${base}${this.field.override()}
${base}public ${this.returnType} ${this.name}(${this.paramContent()})
${base}{
${base}${step}${this.methodContent(indentation)}
${base}}
`;

    }

    /* ***************** */
    /*  EXTENSION HOOKS  */
    /* ***************** */


    /**
     * Return the code to insert in the parameter section of the method.
     * 
     * @return java code snipet
     */
    protected abstract paramContent() : string;

    /**
     * Return the code to insert in the body of the method.
     * 
     * @param indentation the indentation configurations to apply
     * @return java code snipet
     */
    protected abstract methodContent( indentation : Indentation ): string;

}


/**
 * Represents an accessor method of type getter.
 * 
 * @author Massimo Coluzzi
 */
export class Getter extends Accessor
{

    /**
     * Constructor with parameters.
     * 
     * @param field the field to access
     */
    private constructor( field : Field )
    {

        super( 'get', field, field.type );

    }


    /* ***************** */
    /*  FACTORY METHODS  */
    /* ***************** */


    /**
     * Factory method to create a new Getter.
     * 
     * @param field the field to access
     * @returns a new Getter
     */
    public static of( field : Field ) : Getter {

        return new Getter( field );

    }


    /* ***************** */
    /*  EXTENSION HOOKS  */
    /* ***************** */


    /**
     * Return the code to insert in the parameter section of the method.
     * 
     * @return java code snipet
     */
    protected paramContent() : string {

        return '';

    }

    /**
     * Return the code to insert in the body of the method.
     * 
     * @param indentation the indentation configurations to apply
     * @return java code snipet
     */
    protected methodContent( indentation : Indentation ): string {

        return `return this.${this.field.name};`;
        
    }



}

/**
 * Represents an accessor method of type setter.
 * 
 * @author Massimo Coluzzi
 */
export class Setter extends Accessor
{

    /**
     * Constructor with parameters.
     * 
     * @param field the field to access
     */
    private constructor( field : Field )
    {

        super( 'set', field, 'void' );

    }


    /* ***************** */
    /*  FACTORY METHODS  */
    /* ***************** */

    
    /**
     * Factory method to create a new Setter.
     * 
     * @param field the field to access
     * @returns a new Setter
     */
    public static of( field : Field ) : Setter {

        return new Setter( field );

    }


    /* ***************** */
    /*  EXTENSION HOOKS  */
    /* ***************** */


    /**
     * Return the code to insert in the parameter section of the method.
     * 
     * @return java code snipet
     */
    protected paramContent() : string {

        return ` ${this.field.type} ${this.field.name} `;

    }

    /**
     * Return the code to insert in the body of the method.
     * 
     * @param indentation the indentation configurations to apply
     * @return java code snipet
     */
    protected methodContent( indentation : Indentation ): string {

        return `this.${this.field.name} = ${this.field.name};`;
        
    }



}

/**
 * Represents an accessor method of type wither.
 * 
 * @author Massimo Coluzzi
 */
export class Wither extends Accessor
{

    /**
     * Constructor with parameters.
     * 
     * @param field the field to access
     */
    private constructor( field : Field )
    {

        super( 'with', field, field.enclosingClass );

    }


    /* ***************** */
    /*  FACTORY METHODS  */
    /* ***************** */

    
    /**
     * Factory method to create a new Wither.
     * 
     * @param field the field to access
     * @returns a new Wither
     */
    public static of( field : Field ) : Wither {

        return new Wither( field );

    }


    /* ***************** */
    /*  EXTENSION HOOKS  */
    /* ***************** */


    /**
     * Return the code to insert in the parameter section of the method.
     * 
     * @return java code snipet
     */
    protected paramContent() : string {

        return ` ${this.field.type} ${this.field.name} `;

    }

    /**
     * Return the code to insert in the body of the method.
     * 
     * @param indentation the indentation configurations to apply
     * @return java code snipet
     */
    protected methodContent( indentation : Indentation ) : string {

        const indent = indentation.base + indentation.step;
        return `this.${this.field.name} = ${this.field.name};\n${indent}return this;`;
        
    }

}