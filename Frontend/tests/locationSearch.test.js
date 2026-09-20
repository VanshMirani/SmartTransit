import assert from 'node:assert/strict';
import test from 'node:test';
import { coordinatesFromStop, coordinatesFromText } from '../src/services/locationSearch.js';

test('map links prefer the actual place pin over a different viewport centre', () => {
    assert.deepEqual(coordinatesFromText('https://www.google.com/maps/place/Stop/@23.1,72.7,14z/data=!3d23.05!4d72.45'), [23.05, 72.45]);
    assert.deepEqual(coordinatesFromText('https://www.google.com/maps/@23.1,72.7,14z?query=23.05%2C72.45'), [23.05, 72.45]);
});

test('coordinate input supports encoded queries and negative coordinates without inventing missing locations', () => {
    assert.deepEqual(coordinatesFromText('https://www.google.com/maps/search/?api=1&query=23.05%2C72.45'), [23.05, 72.45]);
    assert.deepEqual(coordinatesFromText('-23.05, -72.45'), [-23.05, -72.45]);
    assert.equal(coordinatesFromText('https://maps.app.goo.gl/short-link'), null);
    assert.equal(coordinatesFromText('91,181'), null);
    assert.equal(coordinatesFromStop({ lat: '', lng: '' }), null);
    assert.equal(coordinatesFromStop({ lat: null, lng: 72.45 }), null);
    assert.deepEqual(coordinatesFromStop({ lat: '23.05', lng: '72.45' }), [23.05, 72.45]);
});
