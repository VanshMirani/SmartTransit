import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadCsv, downloadSimplePdf } from '../src/utils/reportExport.js';

async function captureDownload(t, action) {
    let blob;
    const anchor = { click() {}, remove() {} };
    t.mock.method(URL, 'createObjectURL', (value) => { blob = value; return 'blob:qa'; });
    t.mock.method(URL, 'revokeObjectURL', () => {});
    const oldDocument = globalThis.document, oldWindow = globalThis.window;
    globalThis.document = { createElement: () => anchor, body: { append() {} } };
    globalThis.window = { setTimeout: (callback) => callback() };
    t.after(() => { globalThis.document = oldDocument; globalThis.window = oldWindow; });
    action();
    return { text: await blob.text(), filename: anchor.download, type: blob.type };
}

test('CSV treats formula-like text as text and preserves numbers, quotes, delimiters and line breaks', async (t) => {
    const { text, type, filename } = await captureDownload(t, () => downloadCsv('qa.csv', ['Value'], [
        ['=1+1'], ['  +SUM(1,2)'], ['@SUM(1,2)'], ['-1+1'], ['\t=1+1'], ['\n=1+1'], ['＝1+1'],
        ['a,"b"\nc'], [33], [-2], [null],
    ]));
    assert.ok(text.includes('"\'=1+1"'), 'Quoting alone must not leave a spreadsheet formula executable');
    for (const value of ['  +SUM(1,2)', '@SUM(1,2)', '-1+1', '\t=1+1', '\n=1+1', '＝1+1']) assert.ok(text.includes(`"'${value}"`));
    assert.ok(text.includes('"a,""b""\nc"'));
    assert.ok(text.includes('"33"\r\n"-2"\r\n""'));
    assert.equal(type, 'text/csv;charset=utf-8');
    assert.equal(filename, 'qa.csv');
});

test('PDF export includes every row and wraps long text before escaping PDF strings', async (t) => {
    const lines = Array.from({ length: 90 }, (_, index) => `Row ${index + 1}: transport evidence`);
    lines.push('('.repeat(140) + 'LAST-CELL');
    const { text, type } = await captureDownload(t, () => downloadSimplePdf('qa.pdf', 'QA report', lines));
    assert.ok(text.includes('Row 90: transport evidence'), 'Later report rows must not silently disappear');
    assert.ok(text.includes('LAST-CELL'));
    assert.match(text, /\/Count 3\b/);
    for (const stream of text.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
        assert.doesNotMatch(stream[1], /(?<!\\)\\\) Tj/, 'The PDF text delimiter must not be swallowed by a truncated escape');
    }
    assert.equal(type, 'application/pdf');
});
