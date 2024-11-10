import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.util.ArrayList;
import java.util.List;


/**
 * This class analyzes a compiled file and returns all the accessible fields Usage:
 * {@code java java ClassAnalyzer <className> <accessorPrefix>}
 * 
 * @author Bryan Beffa
 */
public class ClassAnalyzer
{


    /**
     * Tells if the given field, is accessible by the current class.
     * <p>
     * This method is interested only in instance fields.
     * Therefore, all static fields will return {@code false}.
     * <p>
     * If the field belongs to the current class, it is always accessible.
     * Otherwise, if it belongs to an ancestor class, it is accessible in three cases:
     * <ol>
     * <li>The field is declared as {@code public}.</li>
     * <li>The field is declared as {@code protected}.</li>
     * <li>The field is declared as package private and the current class is in the same package as
     * the ancestor class.</li>
     * </ol>
     * *
     * 
     * @param field the modifiers of the field to check
     * @param inCurrentClass tells if the field belongs to the current class
     * @param classPackage the package of the current class
     * @param parentPackage the package of the ancestor class
     * @return {@code true} if the field is accessible by the current class
     */
    private static boolean isAccessibleAndNotStatic(
        int field, boolean inCurrentClass, Package classPackage, Package parentPackage
    )
    {

        /* We are not interested in static fields. */
        if( Modifier.isStatic( field ) )
            return false;

        /* If the field belongs to the current class is always visible. */
        if( inCurrentClass )
            return true;

        /* Private fields are not visible by inheritance. */
        if( Modifier.isPrivate(field) )
            return false;

        /* Public and protected fields are visible by inheritance. */
        if( Modifier.isPublic( field ) || Modifier.isProtected( field ) )
            return true;

        /*
         * At this point, the fields must be declared as package private.
         * Therefore, it is visible only if the current class is in the
         * same package as the parent class.
         */
        return classPackage.equals( parentPackage );

    }


    /**
     * Returns all the fields declared in the current class and inherited from ancestor classes.
     * <p>
     * If the required accessor type is one of {@link AccessorType#SETTER} or {@link AccessorType#WITHER},
     * this method returns only the non final fields.
     * 
     * @param targetClass  the class to analyze
     * @param accessorType the required type of accessor
     * @return a list of accessible fields
     */
    public static List<AccessibleField> getAccessibleFields( Class<?> targetClass, AccessorType accessorType )
    {

        final List<AccessibleField> accessibleFields = new ArrayList<>();

        /* We need the class package to check package visibility. */
        final Package classPackage = targetClass.getPackage();

        /* Get all the accessible fields in current and ancestor classes. */
        Class<?> currentClass = targetClass;
        while( ! currentClass.equals(Object.class) )
        {

            /* Get all fields of the current class. */
            final Field[] fields = currentClass.getDeclaredFields();
            for( Field field : fields )
            {

                /* We get the modifiers to check. */
                final int mods = field.getModifiers();

                /* If the field is not accessible we skip it. */
                if( ! isAccessibleAndNotStatic( mods, currentClass == targetClass, classPackage, currentClass.getPackage() ) )
                    continue;

                /*
                 * If the fields are required to be modifiable
                 * we skip all the final fields.
                 */
                if( accessorType.requiresModifiableField && Modifier.isFinal( mods ) )
                    continue;

                /* Otherwise, we collect the field. */
                final AccessorAvailability accessorAvailability = getAccessorAvailability( targetClass, field, accessorType );
                accessibleFields.add( new AccessibleField( field.getName(), field.getType(), accessorAvailability ) );

            }

            /* We move to the next ancestor. */
            currentClass = currentClass.getSuperclass();

        }

        return accessibleFields;

    }


    /**
     * Returns the availability of the accessor method of the given type for the given field.
     * 
     * @param targetClass   the class to analyze
     * @param field         the field to access
     * @param accessorType  the type of accessor method to search for
     * @return the availability of the accessor method
     */
    private static AccessorAvailability getAccessorAvailability(
        Class<?> targetClass, Field field, AccessorType accessorType
    )
    {

        if( accessorType == AccessorType.NONE )
            return AccessorAvailability.NONE;

        final String accessorName = accessorType.getAccessorName( field );
        final Class<?> accessorParam = accessorType.getAccessorParam( field );
            
        try{

            /* 
             * If the method exists will be returned.
             * Otherwise, a NoSuchMethod exception will
             * be thrown.
             * An accessor method must be public, but we return also
             * methods with the same signature but other visibilities
             * because we aim to notify the user of the existence
             * of a method with the same signature.
             */
            if( accessorParam != null )
                targetClass.getDeclaredMethod( accessorName, accessorParam );
            else
                targetClass.getDeclaredMethod( accessorName );

            return AccessorAvailability.CURRENT_CLASS;

        }catch( NoSuchMethodException ex )
        {

            /*
             * If the method is not declared by the target class,
             * we check if it is inherited by the ancestor classes.
             */

        }

        try{

            /* 
             * If the method exists will be returned.
             * Otherwise, a NoSuchMethod exception will
             * be thrown. The Class.getMethod method 
             * returns all "public" methods declared
             * by the target class or inherited by
             * the ancestor classes.
             * Since we already checked the methods
             * declared in the target class, if such
             * method exists, it must be inherited.
             */
            if( accessorParam != null )
                targetClass.getMethod( accessorName, accessorParam );
            else
                targetClass.getMethod( accessorName );
                
            return AccessorAvailability.ANCESTOR_CLASS;

        }catch( NoSuchMethodException ex )
        {

            /*
             * If the method is neither declared by the target class,
             * nor in ancestor classes, it does not exist.
             */
            return AccessorAvailability.NONE;

        }



    }


    /* *************** */
    /*  INNER CLASSES  */
    /* *************** */


    /**
     * Enumerates the possible types of accessors.
     * <p>
     * Given a field named {@code field} of type {@code Type}, the accessor methods
     * are the following:
     * <ul>
     *  <li>{@code Type getField()}</li>
     *  <li>{@code void setField(Type)}</li>
     *  <li>{@code this withField(Type)}</li>
     * </ul>
     * Therefore, the possible accessor methods are:
     * <ul>
     *  <li>getters</li>
     *  <li>setters</li>
     *  <li>withers</li>
     * </ul>
     * 
     * @author Massimo Coluzzi
     */
    private enum AccessorType
    {

        /** Represents the absence of accessors. */
        NONE( "", false ),

        /** Represents a getter method in the form {@code Type getField()}. */
        GETTER( "get", false ),
        
        /** Represents a setter method in the form {@code void setField(Field)}. */
        SETTER( "set", true ),
        
        /** Represents a wither method in the form {@code this withField(Field)}. */
        WITHER( "with", true );


        /** The prefix of the accessor. */
        private final String prefix;

        /** Tells if the current accessor method modifies the field. */
        public final boolean requiresModifiableField;

        /**
         * Constructor with parameters.
         * 
         * @param prefix the prefix of the accessor
         */
        private AccessorType( String prefix, boolean requiresModifiableField )
        {

            this.prefix = prefix;
            this.requiresModifiableField = requiresModifiableField;

        }

        /**
         * Returns the name of the accessor method represented
         * by this accessor type.
         * 
         * @param field the field to access
         * @return the accessor method name
         */
        public String getAccessorName( Field field )
        {

            if( this == NONE )
                return "";

            final String fieldName = field.getName();
            final char capitalLetter = Character.toUpperCase( fieldName.charAt(0) );

            return new StringBuilder( fieldName.length() + 4 )
                .append( prefix )
                .append( capitalLetter )
                .append( fieldName.substring(1) )
                .toString();

        }

        /**
         * Returns the type of the parameter in the accessor method signature.
         * <p>
         * If the accessor type is {@link ClassAnalyzer.AccessorType#SETTER} or
         * {@link ClassAnalyzer.AccessorType#WITHER}, the type of the field is
         * returned. Otherwise, {@code null} is returned.
         * 
         * @param field the field to access
         * @return the type of the accessor method parameter
         */
        public Class<?> getAccessorParam( Field field )
        {

            if( this == AccessorType.SETTER || this == AccessorType.WITHER )
                return field.getType();

            return null;

        }

        /**
         * Factory method to create an accessor given its prefix
         * (one of "get", "set", or "with").
         * <p>
         * If the prefix does not match one of the valid prefixes
         * {@link #NONE} is returned.
         * 
         * @param prefix the prefix to parse
         * @return the related {@link AccessorType}
         */
        public static AccessorType of( String prefix )
        {

            if( prefix == null )
                return NONE;

            for( AccessorType accessor : AccessorType.values() )
                if( prefix.equalsIgnoreCase(accessor.prefix) )
                    return accessor;

            return NONE;

        }

    }

    
    /**
     * Enumerates the places where the accessor method of a given field can be found.
     * <p>
     * Given a field named {@code field} of type {@code Type}, the accessor methods
     * are the following:
     * <ul>
     *  <li>{@code Type getField()}</li>
     *  <li>{@code void setField(Type)}</li>
     *  <li>{@code this withField(Type)}</li>
     * </ul>
     * 
     * @author Massimo Coluzzi
     */
    private enum AccessorAvailability
    {

        /** The method is not available. */
        NONE,

        /** The method is available in the current class. */
        CURRENT_CLASS,

        /** The method is available in at least one ancestor class. */
        ANCESTOR_CLASS;

    }


    /**
     * This class aims to store the information related to
     * an accessible field collected by the {@link ClassAnalyzer}.
     * 
     * @author Massimo Coluzzi
     */
    private static class AccessibleField
    {

        /* The type of the field. */
        private final Class<?> type;

        /* The name of the field. */
        private final String name;

        /** The availability of the accesso method of this field. */
        private final AccessorAvailability accessorAvailability;


        /**
         * Constructor with parameters.
         * 
         * @param name The name of the field.
         * @param type The type of the field.
         */
        public AccessibleField( String name, Class<?> type, AccessorAvailability accessorAvailability )
        {

            super();

            this.name = name;
            this.type = type;
            this.accessorAvailability = accessorAvailability;

        }


        /**
         * {@inheritDoc}
         */
        @Override
        public String toString()
        {

            return new StringBuilder()
                .append( type.getSimpleName() )
                .append( ' ' ).append( name )
                .append( ' ' ).append( accessorAvailability.ordinal() )
                .toString();

        }

    }


    /* ************* */
    /*  ENTRY POINT  */
    /* ************* */


    /**
     * Entry point for the class execution.
     * <p>
     * This method expects two arguments:
     * <ol>
     * <li>fully qualified name of the class to analyze.</li>
     * <li>prefix of the method ("set", "get", "with", "")</li>
     * </ol>
     * The method prints a list of fields one per line.
     * 
     * @param args the three arguments
     */
    public static void main( String[] args )
    {

        if( args.length < 1 )
        {
            System.err.print( "Usage: java ClassAnalyzer <className> <accessorPrefix>" );
            return;
        }

        try{

            /* Get the class to analyze. */
            final Class<?> targetClass = Class.forName( args[0] );

            /* Get the type of accessor to earch for. */
            final AccessorType accessorType = args.length > 1
            ? AccessorType.of( args[1] )
            : AccessorType.NONE;

            /* Get all accessible fields. */
            final List<AccessibleField> accessibleFields = ClassAnalyzer.getAccessibleFields( targetClass, accessorType );

            /* Prints the name of the class for reference. */
            System.out.println( targetClass.getSimpleName() );

            /* Prints the founded fields. */
            for( AccessibleField field : accessibleFields )
                System.out.println( field );

        }catch( Throwable ex )
        {

            System.err.println( ex.getClass() + " " + ex.getMessage() );

        }

    }

}