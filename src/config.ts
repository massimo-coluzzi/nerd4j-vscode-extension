
/**
 * Collects the project types supported by the Nerd4J extension.
 * 
 * @author Massimo Coluzzi
 */
export namespace JavaProjectType {

    /**
     * Represents a plain Java project not managed
     * by any package manager.
     */
    export const plainJava = 'Plain Java project';

    /**
     * Represents a Java project managed by Apache Maven.
     */
    export const maven = 'Maven project';

}


/**
 * Collects the keys used to register Nerd4J settings.
 * 
 * @author Massimo Coluzzi
 */
export namespace Nerd4JSetting {

    /* Type of java project, can be one of the options availavle in the namespace JavaProjectType. */
    export const projectType    = 'nerd4j.project.type';

    /* Folder where to find Java compiled files in plain Java project. */
    export const javaOutFolder  = 'nerd4j.java.outFolder';

    /* Folder where to find Java libraries in plain Java project. */
    export const javaLibFolder  = 'nerd4j.java.libFolder';

    /* Path to the Maven local repository, defaults to '$user.home}/.m2/repository'. */
    export const mavenLocalRepo = 'nerd4j.maven.localRepo';

}

/**
 * Collects the keys used to register the GUI commands into vscode.
 * 
 * @author Massimo Coluzzi
 */
export namespace CommandKey {

    /* Java command */
    export const showJavaCommand                  = 'nerd4j-extension.showJavaCommand';
    export const setCustomJavaCommand             = 'nerd4j-extension.setCustomJavaCommand';
    export const resetDefaultJavaCommand          = 'nerd4j-extension.resetDefaultJavaCommand';
    export const showJavaCommandMenu              = 'nerd4j-extension.showJavaCommandMenu';

    /* Nerd4J settings */
    export const openNerd4jSettings               = 'nerd4j-extension.openNerd4jSettings';
    export const clearNerd4jSettings              = 'nerd4j-extension.clearNerd4jSettings';
    export const showSettingsMenu                 = 'nerd4j-extension.showSettingsMenu';

    /* Code generation */
    export const generateToStringMethod           = 'nerd4j-extension.generateToStringMethod';
    export const generateHashCodeAndEqualsMethods = 'nerd4j-extension.generateHashCodeAndEqualsMethods';
    export const generateAccessorMethods          = 'nerd4j-extension.generateAccessorMethods';
    export const showGenerateMenu                 = 'nerd4j-extension.showGenerateMenu';

    /* Extension initialization */
    export const chooseProjectTypeMenu            = 'nerd4j-extension.chooseProjectTypeMenu';
    export const initPlainJavaProject             = 'nerd4j-extension.initPlainJavaProject';
    export const initMavenProject                 = 'nerd4j-extension.initMavenProject';
    export const showOptionsMenu                  = 'nerd4j-extension.showOptionsMenu';
    export const openExtension                    = 'nerd4j-extension.openExtension';

}

/**
 * Enumerates the methods of the class Object
 * that can be overwritten.
 * 
 * @author Massimo Coluzzi
 */
export enum ObjectMethod {

    toString = 0,
    hashCode = 1,
    equals   = 2

}

/**
 * Defines the type of object containing
 * the configurations for object overrides.
 * 
 * @author Massimo Coluzzi
 */
export interface ObjectOverrideConf {

    readonly import : {
        readonly regexp : RegExp;
        readonly code : string
    };

    readonly method : {
        readonly regexp : RegExp,
        readonly name : string
    };

}

/**
 * Contains the configurations for the override
 * of methods belonging to the class Object:
 * toString(), hashCode(), and equals() 
 */
export const OBJECT_OVERRIDES : ObjectOverrideConf [] = [
    /* Configurations related to the method toString(). */
    {
        import : {
            regexp : /import\s+org.nerd4j.utils.lang.ToString\s*;\s*/,
            code   : 'import org.nerd4j.utils.lang.ToString;'
        },
        method : {
            regexp : /\s*(@Override)?\s*public\s+String\s+toString\s*\(\s*\)\s*\{/g,
            name   : 'toString()'
        }
    },
    /* Configurations related to the method hashCode(). */
    {
        import : {
            regexp : /import\s+org.nerd4j.utils.lang.Hashcode\s*;\s*/,
            code   : 'import org.nerd4j.utils.lang.Hashcode;'
        },
        method : {
            regexp : /\s*(@Override)?\s*public\s+int\s+hashCode\s*\(\s*\)\s*\{/g,
            name   : 'hashCode()' 
        }
    },
    /* Configurations related to the method equals(). */
    {
        import : {
            regexp : /import\s+org.nerd4j.utils.lang.Equals\s*;\s*/,
            code   : 'import org.nerd4j.utils.lang.Equals;'
        },
        method : {
            regexp : /\s*(@Override)?\s*public\s+boolean\s+equals\s*\(\s*Object[^\)]*\)\s*\{/g,
            name   : 'equals()'
        }
    }

];
                                        