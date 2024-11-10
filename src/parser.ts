import * as vscode from 'vscode';
import { Comment, CommentType, JavaClass, TextInterval } from './commons';


/* ******************* */
/*  PRIVATE FUNCTIONS  */
/* ******************* */


/**
 * Moves backwards in the code as long as white spaces are found.
 * 
 * @param code   the code to analyze.
 * @param index  the starting index.
 */
function includeLeadingWhitespaces( code : string, index : number ) : number {

	if( index <= 0 ) {
		return index;
	}

	const whiteSpace = /\s/;
	for( var i = index-1; i >= 0; --i ) {

		if( ! whiteSpace.test(code[i]) ) {
			return i + 1;
		}

	}

	return 0;

}


/**
 * Moves forwards in the code as long as white spaces are found.
 * This method returns at the position of the last new line.
 * It is necessary to maintain the proper indentation.
 * 
 * @param code   the code to analyze.
 * @param index  the starting index.
 */
function includeTrailingWhitespaces( code : string, index : number ) : number {

	if( index >= code.length - 1 ) {
		return index;
	}

	const whiteSpace = /\s/;
	let lastNewLineIndex = index;
	for( var i = index; i < code.length; ++i ) {

		const c = code[i];
		if( c === '\n' ) {

			lastNewLineIndex = i;

		} else if( ! whiteSpace.test(code[i]) ) {

			return lastNewLineIndex;

		}

	}

	return code.length-1;

}


/**
 * If the given index points to the opening sequence
 * of a comment it returns the type of comment.
 * Otherwise, it returns null.
 * 
 * @param code  the code to parse
 * @param index the index to start from
 * @returns returns the type of comment if any
 */
function getCommentType( code : string, index : number ) : CommentType|null {

    const c = code[index];
    if( c === '/' ) {
        return CommentType.singleLine;
    }

    if( c === '*' ) {
        return code[index+1] === '*'
        ? CommentType.javaDoc
        : CommentType.multiLine;
    }

    return null;

}


/**
 * Moves from the given index to the end of the line.
 * 
 * @param code  the code to parse 
 * @param index the starting point
 * @returns the index of the next new like
 */
function moveToEndOfLine( code : string, index : number ) : number {

    for( var i = index; i < code.length; ++i ) {

        if( code[i] === '\n' ) {
            return i;
        }

    }

    return index;

}


/**
 * Moves from the given index to the end of the comment.
 * 
 * @param code  the code to parse 
 * @param index the starting point
 * @returns the index of the last char of the comment
 */
function moveToEndOfComment( code : string, index : number) : number {

    for( var i = index; i < code.length; ++i ) {

        const c = code[i];
        if( c === '*' && code.length > i+1 && code[i+1] === '/' ) {
            return i+1;
        }

    }

    return index;

}


/**
 * Returns the JavaDoc comment of the method if it exists.
 * 
 * @param code     the code to parse
 * @param index    the starting index of the method signature
 * @param comments the comments availavle inside the code
 * @returns the JavaDoc comment if any
 */
function findJavaDoc( code : string, index : number, comments : Comment[] ) : Comment|null {

    /* We find the last comment before the given index. */
    var comment = comments[0];
    if( comment.interval.endIndex > index ) {
        return null;
    }
    
    let i = 1;
    while( i < comments.length && comments[i].interval.endIndex < index ) {
        comment = comments[i++];
    }

    /*
     * If the last comment before the method signature is not a JavaDoc
     * we consider it as not found.
     */
    if( comment.type !== CommentType.javaDoc ) {
        return null;
    }

    /*
     * Otherwise, we must make sure that there are only whitespaces
     * between the JavaDoc and the method signature.
     */
    const regexp = /^\s*$/;
    const spaces = code.slice( comment.interval.endIndex + 1, index );

    return regexp.test( spaces ) ? comment : null;

}


/**
 * Returns the starting index of the JavaDoc if any.
 * Otherwise returns the provided index.
 * 
 * @param code  the code to analyze
 * @param index the staring index
 */
function includeJavaDoc( code : string, index : number, comments : Comment[] ) : number {

	const javaDoc = findJavaDoc( code, index, comments );
    return javaDoc ? javaDoc.interval.startIndex : index;

}


/**
 * Parses the given code to find the boundaries of the matching classes.
 * 
 * @param code         code to parse
 * @param comments     comments to skip
 * @param classMatches matching classes
 * @returns forest of outher and inner classes
 */
function parseClasses( code : string, comments : Comment[], classMatches : RegExpMatchArray[] ) : JavaClass[] {

    const classes : JavaClass[] = [];

    let i = 0;
    while( i < classMatches.length ) {

        const classMatch = classMatches[i++];

        const name = classMatch[1];
        const signatureStartIndex = classMatch.index!;
        const signatureEndIndex =  signatureStartIndex + classMatch[0].length - 1;

        const bodyStartIndex = signatureEndIndex + 1;
        const bodyEndIndex = moveToClosingBracket( code, bodyStartIndex, comments );
        
        const signatureInterval = TextInterval.of( signatureStartIndex, signatureEndIndex );
        const bodyInterval = TextInterval.of( bodyStartIndex, bodyEndIndex );

        const javaClass = JavaClass.of( name, signatureInterval, bodyInterval, comments );

        const innerClassMatches = [];
        while( i < classMatches.length && bodyInterval.includes(classMatches[i].index!) ) {
            innerClassMatches.push( classMatches[i++] );
        }

        const innerClasses = parseClasses( code, comments, innerClassMatches );
        for( const innerClass of innerClasses ) {
            javaClass.add( innerClass );
        }

        classes.push( javaClass );

    }

    return classes;

}


/**
 * Finds all the Java classes defined in the document and returns them
 * as a forest of first level classes each one containig one or more inner classes.
 * 
 * @param code     the code to parse
 * @param comments the comments to skip
 * @returns a forest of outher and inner classes
 */
function findClasses( code : string, comments : Comment[] ) : JavaClass[] {
    
    const classRegExp : RegExp = /class\s+([^\s\{]+)[^\{]+/g;
    const classMatches = code.matchAll( classRegExp );

    return parseClasses( code, comments, [...classMatches] );

}


/**
 * Returns all portions of code enclosing comments.
 * 
 * @param code the code to parse
 * @returns list of comments in the code
 */
function findComments( code : string ) : Comment[] {

    const comments : Comment[] = [];

    for( var i = 0; i < code.length; ++i ) {

        const c = code[i];
        if( c === '/' && code.length > i+1 ) {

            const commentType = getCommentType( code, i+1 );
            if( commentType === CommentType.singleLine ) {

                const startIndex = i;
                const endIndex = moveToEndOfLine( code, i+1 );

                const comment = Comment.of( commentType, startIndex, endIndex );
                comments.push( comment );

            } else if( commentType === CommentType.multiLine || commentType === CommentType.javaDoc ) {

                const startIndex = i;
                const endIndex = moveToEndOfComment( code, i+1 );

                const comment = Comment.of( commentType, startIndex, endIndex );
                comments.push( comment );

            }

        }

    }

    return comments;

}


/* ****************** */
/*  PUBLIC FUNCTIONS  */
/* ****************** */


/**
 * Uses the provided regexp to check if the requested method already exists.
 * It returns the interval of text covered by the code if it exists.
 * 
 * @param javaFileContent  the document to parse
 * @param regexp    the regular expression to match
 * @param javaClass the Java class containing the method
 * @returns the range of text covered by the code if it exists.
 */
export function findExistingMethod( javaFileContent : string, regexp: RegExp, javaClass : JavaClass ) : TextInterval|null {

    /* Find all occurrences of the method in the whole java file. */
    const allMatches = javaFileContent.matchAll( regexp );
    for( let match of allMatches ) {
        
        /* For every occurrence, find the class containing the method. */
        const methodStartIndex = match.index!;
        const ownerClass = javaClass.getEnclosingClass( methodStartIndex );

        /* If the method belongs to the current pointed java class, proceed. */
        if( ownerClass === javaClass ) {

            const javaDocStartIndex = includeJavaDoc( javaFileContent, methodStartIndex, javaClass.comments );
            const leadingWhiteSpacesStartIndex = includeLeadingWhitespaces( javaFileContent, javaDocStartIndex );
                                                
            const openBracketIndex = methodStartIndex + match[0].length;
            const closeBracketIndex = moveToClosingBracket( javaFileContent, openBracketIndex, javaClass.comments );
            
            const selectionStartIndex = leadingWhiteSpacesStartIndex;
            const selectionEndIndex   = includeTrailingWhitespaces( javaFileContent, closeBracketIndex + 1 );

            return TextInterval.of( selectionStartIndex, selectionEndIndex );

        }
        
    }

    return null;
        
}


/**
 * Finds the Java class pointed by the cursor in the acrive editor.
 * 
 * @param editor      the editor displaying the java source file
 * @returns the java class pointed by the cursor or null
 */
export function findPointedClass( editor : vscode.TextEditor ) : JavaClass|null {

    /* Extract the content of the Java source file. */
    const javaFileContent = editor.document.getText();

    /* Extract the comments in the Java source code. */
    const comments = findComments( javaFileContent );

    /* Extract all Java classes defined in the source file. */
    const javaClasses = findClasses( javaFileContent, comments );

    const cursorPosition = editor.selection.end;
    const cursorIndex = editor.document.offsetAt( cursorPosition );

    for( const javaClass of   javaClasses ) {

        const pointedClass = javaClass.getEnclosingClass( cursorIndex );
        if( pointedClass ) {
            return pointedClass;
        }
    }

    return null;

}


/**
 * Moves from the given index to the end of the block.
 * This method assumes the index to point to an open curly bracket
 * and moves to match the corresponging cose curly bracket.
 * 
 * @param code  the code to parse 
 * @param index the starting point
 * @returns the index of the last char of the comment
 */
export function moveToClosingBracket( code : string, index : number, comments : Comment[] ) : number {

    let k = 0;
    while( k < comments.length && comments[k].interval.endIndex < index ) {
        k += 1;
    }

    let scope = 1;
    for( var i = index + 1; i < code.length; ++i ) {

        if( k < comments.length && i >= comments[k].interval.startIndex ) {
            i = comments[k].interval.endIndex;
            k += 1;
        }

        if( code[i] === '{' ) {

            scope += 1;

        } else if( code[i] === '}' ) {
            
            scope -= 1;
            if( scope === 0 ) {
                return i;
            }

        }

    }

    return index;

}


/**
 * Returns the package name of the current java file
 * 
 * @param code code of the current java file 
 * @returns package name
 */
export function getPackageName( code : string ) : string {

	const packageRegExp : RegExp = /package\s+([^\s;]+)/g;
	const match = packageRegExp.exec( code! );
	
	return match ? match[1] : "";

}

/**
 * Returns the interval of whitespaces surrounding the given position.
 * 
 * @param javaFileContent text to parse
 * @param index           surrounded index
 * @returns an interval containing only white spaces
 */
export function getWhitespaceInterval( javaFileContent : string, index : number ) : TextInterval {

    const startIndex = includeLeadingWhitespaces( javaFileContent, index );
    const endIndex   = includeTrailingWhitespaces( javaFileContent, index );

    return TextInterval.of( startIndex, endIndex );

}