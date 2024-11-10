import * as xml2js from 'xml2js';
import * as fs from 'fs';


const text = fs.readFileSync( 'src/pom.xml', 'utf-8' );


xml2js.parseStringPromise( text )
.then( xml => {

  const build = xml.project?.build;
  console.log( build[0].directory );

  const dependencies = xml.project?.dependencies;
  console.log( dependencies[0].dependency );
});