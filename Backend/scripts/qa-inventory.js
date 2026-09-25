import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from '@babel/parser';

// Static discovery only. An entry is not evidence that its interaction was tested.
const target = 'docs/QA_COVERAGE.md';
const start = '<!-- GENERATED SURFACES START -->';
const end = '<!-- GENERATED SURFACES END -->';
const rows = [];
const cell = (text) => String(text).replaceAll('|', '&#124;').replace(/\s+/g, ' ').slice(0, 220);
async function files(directory) {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
        const name = path.join(directory, entry.name);
        if (entry.isDirectory()) result.push(...await files(name));
        else if (/\.[jt]sx?$/.test(name)) result.push(name);
    }
    return result.sort();
}
for (const filename of [...await files('Frontend/src'), ...await files('Backend').then((list) => list.filter((name) => !/\/(tests|scripts|data)\//.test(name)))]) {
    const source = await readFile(filename, 'utf8');
    const tree = parse(source, { sourceType: 'module', plugins: ['jsx'] });
    const role = /pages\/student|components\/student/.test(filename) ? 'Student' : /pages\/driver/.test(filename) ? 'Driver' : /pages\/conductor/.test(filename) ? 'Conductor' : /admin|Admin/.test(filename) ? 'Admin' : 'Shared/public; see permission matrix';
    function visit(node) {
        if (!node || typeof node !== 'object') return;
        let label, kind;
        if (node.type === 'JSXOpeningElement') {
            const tag = node.name.name;
            if (['Route', 'button', 'a', 'Link', 'NavLink', 'form', 'input', 'select', 'textarea', 'table', 'details', 'summary', 'AdminModal', 'EmergencyForm', 'MapContainer', 'Popup'].includes(tag) || node.attributes.some((attr) => ['onClick', 'onSubmit'].includes(attr.name?.name) || attr.name?.name === 'role' && attr.value?.value === 'dialog')) {
                const routeDeclaration = tag === 'Route' && node.attributes.some((attr) => ['path', 'index', 'element'].includes(attr.name?.name));
                kind = routeDeclaration ? 'Route declaration' : ['form', 'AdminModal', 'EmergencyForm'].includes(tag) ? 'Form/dialog' : tag === 'table' ? 'Table' : 'Control/component';
                label = source.slice(node.start, node.end);
            }
        } else if (node.type === 'CallExpression') {
            const name = node.callee.name || node.callee.property?.name;
            if (['setInterval', 'setTimeout', 'watchPosition', 'getCurrentPosition', 'addEventListener', 'fetch', 'downloadCsv', 'downloadSimplePdf', 'localStorage', 'createMongoDataStore', 'createDataStore'].includes(name)) {
                kind = 'Background/integration'; label = source.slice(node.start, Math.min(node.end, node.start + 200));
            }
        } else if (filename === 'Backend/apiServer.js' && node.type === 'IfStatement' && /pathname|Match/.test(source.slice(node.test.start, node.test.end))) {
            label = source.slice(node.test.start, node.test.end);
            kind = /\b(method|pathname)\b/.test(label) ? 'API dispatch' : 'API guard';
        }
        if (label) rows.push(`| S${rows.length + 1} | ${kind} | ${role} | \`${filename}:${node.loc.start.line}\` | ${cell(label)} | NOT TESTED | Source inventory only; use linked scenario evidence below for executed cases. |`);
        for (const [key, child] of Object.entries(node)) {
            if (['loc', 'start', 'end'].includes(key)) continue;
            if (Array.isArray(child)) child.forEach(visit);
            else if (child && typeof child === 'object') visit(child);
        }
    }
    visit(tree);
}
const current = await readFile(target, 'utf8');
const generated = `${start}\n\n${rows.length} statically discovered declarations/call sites. Dynamic per-record controls share their component entry. Each entry inherits the universal cases and preconditions above; NOT TESTED means no individual universal-matrix sign-off, even where a route smoke test passes.\n\n| ID | Surface | Role | Source evidence | Declaration | Individual matrix status | Actual / evidence |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n${end}`;
await writeFile(target, current.slice(0, current.indexOf(start)) + generated + current.slice(current.indexOf(end) + end.length));
console.log(`Inventoried ${rows.length} source surfaces in ${target}`);
