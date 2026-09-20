import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { tmpdir } from 'node:os';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

// Offline component rendering only. No browser, map tiles, hosted API or credentials are used.
test('route-save errors and active-trip restrictions remain visible inside the open editor', async (t) => {
    const server = await createServer({
        configFile: false, root: path.resolve('Frontend'), envDir: tmpdir(),
        appType: 'custom',
        optimizeDeps: { noDiscovery: true, include: [] },
        ssr: { noExternal: ['react-router-dom', 'react-leaflet'] },
        server: { middlewareMode: true, hmr: false, watch: null },
        esbuild: { jsx: 'automatic' },
        plugins: [{
            name: 'offline-map-components',
            enforce: 'pre',
            resolveId(id) {
                if (id === 'react-router-dom') return '\0qa-router';
                if (id === 'react-leaflet' || id.endsWith('/maps/SmartTransitMap')) return '\0qa-map';
            },
            load(id) {
                if (id === '\0qa-router') return 'export const useSearchParams = () => [new URLSearchParams()];';
                if (id !== '\0qa-map') return;
                return `export const MapContainer = ({children}) => children;
                    export const CircleMarker = ({children}) => children;
                    export const Popup = ({children}) => children;
                    export const StopNameTooltip = ({children}) => children;
                    export const Polyline = () => null;
                    export const CampusMapMarker = () => null;
                    export const MapAutoCenter = () => null;
                    export const MapFitBounds = () => null;
                    export const SmartTileLayer = () => null;
                    export const useMapEvents = () => ({});`;
            },
        }],
    });
    t.after(() => server.close());
    const { RouteEditor } = await server.ssrLoadModule('/src/pages/admin/AdminRoutesPage.jsx');
    const message = 'End the active trip before editing or deactivating this route.';
    const html = renderToStaticMarkup(React.createElement(RouteEditor, {
        route: { id: 'qa-route', code: 'IU-R99', name: 'QA route', startPoint: 'Origin', destination: 'Campus', status: 'active', busId: '', driverId: '', conductorId: '', stops: [{ id: 'qa-stop', name: 'Existing stop', scheduledTime: '8:00 AM', coordinates: [23.1, 72.5], lat: '23.123456', lng: '72.56789' }] },
        setRoute() {}, errors: {}, records: { buses: [], drivers: [], conductors: [] }, routes: [],
        save() {}, saving: false, cancel() {}, dismissFeedback() {}, tripActive: true,
        feedback: { type: 'error', title: 'Could not save route', message },
    }));
    assert.match(html, /role="alert"/);
    assert.ok(html.includes(message));
    assert.ok(html.indexOf(message) < html.indexOf('route-editor-actions'));
    assert.match(html, /Keep this editor open to retain your changes/);
    assert.match(html, /value="23.123456"/);
    assert.match(html, /value="qa-stop" selected=""/);
    assert.match(html, /Save route/);
    assert.match(html, /type="button" aria-label="Dismiss message"/);
});
