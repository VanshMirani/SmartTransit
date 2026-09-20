import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanRouteForSave, initialCoordinateTarget, prepareRouteForEdit, updateStopCoordinates } from '../src/admin/routeDrafts.js';

const route = { id: 'route-qa', code: 'IU-R99', stops: [
    { id: 'one', name: 'First stop', coordinates: [23.1, 72.5], scheduledTime: '8:00 AM' },
    { id: 'two', name: 'Second stop', coordinates: [23.2, 72.6], scheduledTime: '8:15 AM' },
] };

test('editing an existing route targets an existing stop, not an unsaved new stop', () => {
    assert.equal(initialCoordinateTarget(route), 'one');
    assert.equal(initialCoordinateTarget({ id: '', stops: [] }), 'new');
});

test('map-selected coordinates replace the selected stop in the save payload without changing other stops', () => {
    const before = structuredClone(route);
    const draft = updateStopCoordinates(prepareRouteForEdit(route), 'two', { lat: 23.0456789, lng: 72.4567891 });
    const saved = cleanRouteForSave(draft);
    assert.deepEqual(saved.stops[1].coordinates, [23.045679, 72.456789]);
    assert.deepEqual(saved.stops[0], route.stops[0]);
    assert.equal(Object.hasOwn(saved.stops[1], 'lat'), false);
    assert.deepEqual(route, before);
    assert.deepEqual(cleanRouteForSave(prepareRouteForEdit(saved)), saved);
});

test('invalid edited coordinate fields do not silently restore the old saved pin', () => {
    const draft = prepareRouteForEdit(route);
    draft.stops[0].lat = '';
    assert.equal(cleanRouteForSave(draft).stops[0].coordinates, null);
});
