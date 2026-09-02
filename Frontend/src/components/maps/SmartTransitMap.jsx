import { useEffect, useMemo } from "react";
import { TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const defaultTileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const defaultTileAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const defaultBoundsPadding = [28, 28];

function tileUrl() {
    return import.meta.env.VITE_MAP_TILE_URL?.trim() || defaultTileUrl;
}

function tileAttribution() {
    return import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim() || defaultTileAttribution;
}

function isCoordinatePair(position) {
    return Array.isArray(position) &&
        position.length >= 2 &&
        Number.isFinite(Number(position[0])) &&
        Number.isFinite(Number(position[1]));
}

export function SmartTileLayer() {
    return <TileLayer attribution={tileAttribution()} url={tileUrl()} maxZoom={19}/>;
}

export function MapAutoCenter({ position, zoom = 13, enabled = true, trigger = "" }) {
    const map = useMap();
    const latitude = Number(position?.[0]);
    const longitude = Number(position?.[1]);

    useEffect(() => {
        if (!enabled || !Number.isFinite(latitude) || !Number.isFinite(longitude))
            return;
        map.flyTo([latitude, longitude], zoom, { duration: 0.45 });
    }, [enabled, latitude, longitude, map, trigger, zoom]);

    return null;
}

export function MapFitBounds({ points, enabled = true, padding = defaultBoundsPadding, trigger = "" }) {
    const map = useMap();
    const validPoints = useMemo(() => points?.filter(isCoordinatePair) ?? [], [points]);

    useEffect(() => {
        if (!enabled || !validPoints.length)
            return;
        if (validPoints.length === 1) {
            map.setView(validPoints[0], Math.max(map.getZoom(), 13));
            return;
        }
        map.fitBounds(L.latLngBounds(validPoints), { padding, maxZoom: 15 });
    }, [enabled, map, padding, trigger, validPoints]);

    return null;
}
