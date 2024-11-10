import * as vscode from 'vscode';
import * as xml2js from 'xml2js';
import * as path from 'path';
import * as fs from 'fs';

import { JvmSettings, getProjectRootFolder } from './commons';
import { JavaProjectType, Nerd4JSetting } from './config';


/* ******************* */
/*  PRIVATE FUNCTIONS  */
/* ******************* */


/**
 * Return the path to the Maven POM file if any.
 * 
 * @return the POM path or null
 */
function getPomPath( javaFilePath : string ) : string|null {

    /* Extract the project root folder. */
    const projectRoot = getProjectRootFolder();
    if( ! projectRoot ) {
        return null;
    }
    
    let parentPath = path.dirname( javaFilePath );
    do {

        const pomPath = path.join( parentPath, 'pom.xml' );
        if( fs.existsSync(pomPath) ) {
            return pomPath;
        }

        parentPath = path.dirname( parentPath );

    }while( parentPath && parentPath.startsWith(projectRoot) );

    return null;

}


/**
 * Returns the path to the local maven repository.
 * 
 * @param pomContents the content of the pom.xml file
 * @return path to the local maven repository folder
 */
function getLocalMavenRepoPath( pomContents : string[] ): string|null {

    const localRepoRegexp = /<localRepository\s*>(.*?)<\/localRepository\s*>/;

    for( const pomContent of pomContents ) {
    
        const localRepoMatch = localRepoRegexp.exec( pomContent );
        if( localRepoMatch ) {
        
            /* The path string in the xml file. */
            const localRepoString = localRepoMatch[1];
            
            /*
            * The path string in the pom.xml file is platform dependent.
            * We need to make it platform independent by replacing the 
            * path separators.
            */
            const localRepoSplit = localRepoString.split( /[\/\\]/ );
            const localRepoPath = path.join( ...localRepoSplit );

            /* If the path exists we return it. */
            if( fs.existsSync(localRepoPath) ) {
                return localRepoPath;
            }

        }

    }

    /*
     * If no local repository is defined in the pom.xml files
     * we check if the default $HOME/.m2/repository exists.
     */

    /* First we retrieve the path to the user home folder. */
    const userHome = process.env.HOME || process.env.USERPROFILE;
    if( userHome ) {

        const defaultLocalRepoPath = path.join( userHome, '.m2', 'repository' );

        /* If the path exists we return it. */
        if( fs.existsSync(defaultLocalRepoPath) ) {
            return defaultLocalRepoPath;
        }
    }

    /* If neither the default path nor a custom path exist, we return null. */
    return null;

}


/**
 * Given the dependency definition, extracts the required values and returns
 * the path to the dependecy jar file.
 * 
 * @param localMavenRepoPath the path to the local maven repository
 * @param dependency         the dependency to parse
 * @return the path to the dependency jar file
 */
function getDependencyPath( localMavenRepoPath : string, dependency : string ) : string|null {

     /* Extract the different values from the dependency block. */
     const groupIdMatch    = /<groupId\s*>(.*?)<\/groupId\s*>/s.exec(dependency);
     const artifactIdMatch = /<artifactId\s*>(.*?)<\/artifactId\s*>/s.exec(dependency);
     const versionMatch    = /<version\s*>(.*?)<\/version\s*>/s.exec(dependency);

     if( artifactIdMatch && versionMatch && groupIdMatch ) {

         const groupId    = groupIdMatch[1];
         const artifactId = artifactIdMatch[1];
         const version    = versionMatch[1];

         /* Build the path to the jar file of the dependecy. */
         const groupSplit = groupId.split( '.' );
         return path.join(
             localMavenRepoPath, ...groupSplit, artifactId,
             version, `${artifactId}-${version}.jar`
         );

     }

     return null;

}


/**
 * Given the dependency definition, extracts the required values and returns
 * the path to the dependecy jar file.
 * 
 * @param localMavenRepoPath the path to the local maven repository
 * @param dependency         the dependency to parse
 * @return the path to the dependency jar file
 */
function parseDependency( localMavenRepoPath : string, dependency : any ) : string|null {

    if( ! dependency ) {
        return null;
    }

    /*
     * We are interested only in dependencies of type jar.
     * All other dependencies will be ignored.
     */
    if( dependency.type && dependency.type.length === 1 ) {
        const type = dependency.type[0].trim();
        if( type !== 'jar' ) {
            return null;
        }
    }

    /* We extract the different fields of the dependency. */
    const groupId    = dependency.groupId && dependency.groupId.length === 1 ? dependency.groupId[0].trim() : null;
    const artifactId = dependency.artifactId && dependency.artifactId.length === 1 ? dependency.artifactId[0].trim() : null;
    const version    = dependency.version && dependency.version.length === 1 ? dependency.version[0].trim() : null;

    /* If some value is missing we cannot proceed. */
    if( ! groupId || ! artifactId || ! version ) {
        return null;
    }

    /* Otherwise, we build the path to the jar file of the dependecy. */
    const groupSplit = groupId.split( '.' );
    return path.join( localMavenRepoPath, ...groupSplit, artifactId, version, `${artifactId}-${version}.jar` );

}


/**
 * Searches for a custom Java output folder in the POM xml.
 * If not found retuns the default Maven output folder.
 * 
 * @param pomPath path of the POM file
 * @param xml     content of the POM file
 * @returns the Java output folder
 */
function parseOutFolder( pomPath : string, xml : any ) : string|null {
    
    /*
     * In POM file, the Java output folder is defined in the <build> block.
     * If such a block is not defined we move forward.
     */
    const build = xml.project?.build;
    if( build && build.length === 1 ) {

        /*
         * Inside the <build> block the output folder is defined
         * by the <outputDirectory> block.
         */
        const outputDirectory = build[0].outputDirectory;
        if( outputDirectory && outputDirectory.length === 1 ) {
            
            const outFolder = outputDirectory[0].trim();
            if( outFolder ) {
                return outFolder;
            }

        }

        /*
         * If the <outputDirectory> block is not defined,
         * the output folder is defined joining the path
         * defined in the <directory> block and the "classes"
         * suffix.
         */
        const buildDirectory = build[0].directory;
        if( buildDirectory && buildDirectory.length === 1 ) {

            const targetFolder = buildDirectory[0].trim();
            if( targetFolder ) {
                return path.join( targetFolder, 'classes' );
            }

        }

    }

    /*
     * If the <directory> block is not explicitly defined,
     * the default value is "target". Therefore, the default
     * output folder is "target/classes".
     */
    const pomFolder = path.dirname( pomPath );
    return path.join( pomFolder, 'target', 'classes' );

}


/**
 * Parses the given POM xml to search for dependencies ann
 * returns the paths to the dependecy JAR files.
 * 
 * @param localMavenRepoPath the path to the local Maven repo
 * @param xml the content of the POM file to parse
 * @returns the paths to the dependecy JAR files
 */
function parseDependencies( localMavenRepoPath : string, xml : any ) : string[] {

    const dependencyPaths : string[] = [];

    const dependencies = xml.project?.dependencies;
    if( ! dependencies || dependencies.length <= 0 ) {
        return dependencyPaths;
    }

    const dependencyList = dependencies[0].dependency;
    if( ! dependencyList || dependencyList.length <= 0 ) {
        return dependencyPaths;
    }

    for( const dependency of dependencyList ) {

        const dependencyPath = parseDependency( localMavenRepoPath,dependency ); 
        if( dependencyPath ) {
            dependencyPaths.push( dependencyPath );
        }

    }

    return dependencyPaths;

}


/* ****************** */
/*  PUBLIC FUNCTIONS  */
/* ****************** */


/**
 * Returns if the Nerd4J extension is configured
 * to work in Maven project mode.
 * 
 * @return true if it is a Maven project
 */
export function isMavenProject() : boolean {

    const projectType = vscode.workspace.getConfiguration().get( Nerd4JSetting.projectType );
    return projectType === JavaProjectType.maven;

}


/**
 * Returns the path to the local maven repository.
 * 
 * @param xml the xml content parsed from the pom file
 * @return path to the local maven repository folder
 */
export function getDefaultLocalMavenRepository(): string|null {

        
    /* First we retrieve the path to the user home folder. */
    const userHome = process.env.HOME || process.env.USERPROFILE;
    if( userHome ) {

        const defaultLocalRepoPath = path.join( userHome, '.m2', 'repository' );

        /* If the path exists we return it. */
        if( fs.existsSync(defaultLocalRepoPath) ) {
            return defaultLocalRepoPath;
        }
    }

    /* If the default path does not exist, we return null. */
    return null;

}


/**
 * Returns the JVM settings if available.
 * Otherwise, returns null.
 * 
 * @param javaFilePath path to the Java file if any.
 * @returns the JVM settings if available
 */
export async function getJvmSettings( javaFilePath : string ) : Promise<JvmSettings|null> {

    /*
     * If it is a Maven project, there must exist at least one pom.xml file
     * in the given path. If it is not the case, we must raise an error.
     */
    const pomPath = getPomPath( javaFilePath );
    if( ! pomPath ) {
        vscode.window.showErrorMessage( 'This project is expected to be a Maven project, but no POM files have been found.' );
        return null;
    }
    
    const mavenRepoConf = vscode.workspace.getConfiguration().get( Nerd4JSetting.mavenLocalRepo );
    if( ! mavenRepoConf ) {
        vscode.window.showErrorMessage( 'The Maven local repository is not properly configured. Please, configure the Maven repo in the Nerd4J settings.' );
        return null;
    }
    
    const localMavenRepo = mavenRepoConf as string;
    if( ! fs.existsSync(localMavenRepo) ) {
        vscode.window.showErrorMessage( 'The configured path to the Maven local repository ${localMavenRepo} does not exist. Please, change the Maven repo in the Nerd4J settings.' );
        return null;
    }
    
    const pomContent = fs.readFileSync( pomPath, 'utf-8' );
    const xml = await xml2js.parseStringPromise( pomContent );
    
    const outFolder = parseOutFolder( pomPath, xml );
    if( ! outFolder ) {
        vscode.window.showErrorMessage( 'Cannot identify the java output folder.' );
        return null;
    }
    
    const dependencyPaths = parseDependencies( localMavenRepo, xml );
    return {
        outFolder : outFolder,
        dependencyPaths : dependencyPaths
    };

}
