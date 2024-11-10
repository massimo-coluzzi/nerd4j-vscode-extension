import * as assert from 'assert';
import { describe, it } from 'node:test';
import { Field } from '../../../commons';

describe( 'Test for class Field', () => {

    it( 'should generate class Field properly', () => {

        const fieldClass = 'class';
        const fieldType = 'type';
        const fieldName = 'field';
        const label = `${fieldType} ${fieldName}`;

        const field = Field.of( fieldClass, label );

        assert.strictEqual( fieldClass, field.enclosingClass );
        assert.strictEqual( fieldType, field.type );
        assert.strictEqual( fieldName, field.name );

    });

});
