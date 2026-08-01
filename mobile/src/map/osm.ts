/**
 * Style de carte : OpenFreeMap « Liberty » — tuiles vectorielles gratuites,
 * sans clé d'API ni inscription, rendu moderne (données OpenStreetMap).
 * Les tuiles consultées sont mises en cache automatiquement par MapLibre
 * et restent visibles hors ligne.
 */
export const OSM_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

/** Équivalent zoom MapLibre d'un `latitudeDelta` de react-native-maps. */
export function zoomForDelta(delta: number): number {
  return Math.log2(360 / delta);
}

/** Polygone GeoJSON approximant un cercle (rayon en km). */
export function circlePolygon(
  center: { latitude: number; longitude: number },
  radiusKm: number,
  points = 64
) {
  const dLat = radiusKm / 110.574;
  const dLng =
    radiusKm / (111.32 * Math.cos((center.latitude * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * 2 * Math.PI;
    ring.push([
      center.longitude + dLng * Math.cos(theta),
      center.latitude + dLat * Math.sin(theta),
    ]);
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [ring] },
  };
}

/** Bornes [ouest, sud, est, nord] d'une liste de points. */
export function boundsOf(
  coords: { latitude: number; longitude: number }[]
): [number, number, number, number] {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const c of coords) {
    west = Math.min(west, c.longitude);
    south = Math.min(south, c.latitude);
    east = Math.max(east, c.longitude);
    north = Math.max(north, c.latitude);
  }
  return [west, south, east, north];
}
