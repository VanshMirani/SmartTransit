import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeAssignmentDrafts } from '../src/admin/assignmentDrafts.js';

test('admin polling preserves unsaved selections and refreshes clean or removed routes', () => {
    const draft = { busId: 'new-bus', driverId: 'new-driver', conductorId: '' };
    const routes = [{ id: 'r1', busId: 'old-bus' }, { id: 'r2', driverId: 'updated-driver' }];
    const merged = mergeAssignmentDrafts(routes, { r1: draft, r2: { driverId: 'old-driver' }, deleted: draft }, new Set(['r1']));
    assert.deepEqual(merged.r1, draft);
    assert.equal(merged.r2.driverId, 'updated-driver');
    assert.equal(merged.deleted, undefined);
    assert.equal(mergeAssignmentDrafts(routes, merged, new Set()).r1.busId, 'old-bus');
});

test('dirty assignment forms retain the read version so polling cannot hide a stale edit', () => {
    const old = { busId: 'bus', driverId: 'driver', conductorId: 'conductor', _version: 'original' };
    const routes = [{ id: 'route', ...old, _version: 'newer' }];
    assert.equal(mergeAssignmentDrafts(routes, { route: old }, new Set(['route'])).route._version, 'original');
    assert.equal(mergeAssignmentDrafts(routes, { route: old }, new Set()).route._version, 'newer');
});
