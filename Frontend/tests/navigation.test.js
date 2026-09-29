import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { pageMetadata, pageTitles, permittedLoginDestination } from '../src/utils/navigation.js';

test('student profile allows long account identifiers to fit narrow screens', () => {
    const css = readFileSync('Frontend/src/styles.css', 'utf8');
    for (const selector of ['.profile-primary,\n.profile-side', '.profile-card__identity > div', '.profile-details > div']) {
        const rule = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
        assert.match(rule, /min-width:\s*0/);
    }
    const identityRule = css.slice(css.indexOf('.profile-card__identity > div {')).split('}')[0];
    assert.match(identityRule, /overflow-wrap:\s*anywhere/);
});

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
