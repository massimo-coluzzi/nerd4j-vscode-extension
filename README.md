# Nerd4J Extension
The VS Code extension for the Java library Nerd4J is designed to provide advanced features and streamline development with this library. With this extension, you can easily generate the necessary code for common operations such as generating the `toString()` method, `withField()` methods, and `equals()` and `hashCode()` methods based on selected fields.

Additionally, the extension provides predefined snippets for quickly importing the required libraries to use Nerd4J, simplifying the inclusion of the correct dependencies in your project. You can also find snippets for configuring Nerd4J dependencies in various build systems such as Apache Maven, Apache Ant, Apache Buildr, Groovy Grape, Grails, Leiningen, and SBT. This makes it easier to add the necessary dependencies to your project based on the build system you are using.

By leveraging the full potential of the VS Code extension for Nerd4J, you can enhance your productivity in Java application development, thanks to its ability to automate code generation and simplify dependency management.

## Installation

1. Install the extension from the marketplace 
2. Restart VS Code
3. Open a java file and start coding

## Features
The following commands are available in the VS Code command palette:

### Nerd4J:

This is the entry point of all extension commands.

### Nerd4J > Generate:

- __Method toString()__: generates the _toString_ method for the class pointed by the cursor.
- __Methods hashCode() and equals()__: generates the _hashCode_ and _equals_ methods for the class pointed by the cursor.
- __Accessor methods__: generates _getters_, _setters_, and _withers_ for every field defined in the class or inherited from the ancestor classes.

All generated methods can be regenerated if they are already present. The java import of the Nerd4j library is automatically added if it is not already present.

### Nerd4J > Settings:

- __Open settings__: Shortcut tu access the Nerd4J extension settings
- __Clear settings__: Restores the defaults for the Nerd4J extension settings
- __Java command__: Allows to specify the Java executable to use

The first time the extension is used, a quick setup is required.
By invoking the __Clear settings__ command, the setup is deleted and will be prompted at the next usage.


### Code snippets
There are a few code snippets available for quickly importing the required libraries to use Nerd4J. 

__Imports:__
The editor via autocomplete will suggest the following Nerd4J library imports:

- import org.nerd4j.utils.lang.*;
- import org.nerd4j.utils.tuple.*;
- import org.nerd4j.utils.math.*;
- import org.nerd4j.utils.cache.*;

__Dependencies:__
The editor via autocomplete will suggest the Nerd4J library dependencies for the following dependency managers:

- Apache Maven
- Apache Ant
- Apache Buildr
- Groovy Grape
- Grails
- Leiningen
- SBT