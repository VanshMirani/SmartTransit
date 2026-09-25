import assert from 'node:assert/strict';
import test from 'node:test';
import { pageMetadata, pageTitles, permittedLoginDestination } from '../src/utils/navigation.js';

test('login return paths preserve query/hash only within the authenticated role', () => {
    assert.equal(permittedLoginDestination('/student/track?view=route#stops', 'student'), '/student/track?view=route#stops');
    for (const value of ['/admin', '/student-other', '/student/../admin', '/student/%2e%2e/admin', '//attacker.invalid', '/student\\evil', undefined, {}, 'https://attacker.invalid'])
        assert.equal(permittedLoginDestination(value, 'student'), '/student');
});

test('each known route has a title and private routes are not indexable', () => {
    for (const path of Object.keys(pageTitles)) {
        const metadata = pageMetadata(path);
        assert.match(metadata.title, /SmartTransit/);
        assert.equal(metadata.robots, ['/', '/help', '/privacy'].includes(path) ? 'index,follow' : 'noindex,nofollow');
    }
    assert.equal(pageMetadata('/login').title, 'Sign in | SmartTransit');
    assert.equal(pageMetadata('/student/track/').title, 'Live Tracking | SmartTransit');
    assert.equal(pageMetadata('/unknown').title, 'Page not found | SmartTransit');
    assert.equal(pageMetadata('/student').canonical, null);
});
