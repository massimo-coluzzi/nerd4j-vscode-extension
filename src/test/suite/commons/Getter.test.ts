import * as assert from 'assert';
import { describe, it } from 'node:test';
import { Field, Getter } from '../../../commons';

describe( 'Test for class Getter', () => {

    it( 'should generate class Getter properly', () => {

        const className = 'MyClass';
        const field = Field.of( className, 'type myField 0' );
        
        const getter = Getter.of( field );
        assert.strictEqual( getter.name, 'getMyField' );

    });

});
