import { TerritoryMarker } from './types';

// Cantidad de territorios de la congregación y de zonas de predicación.
export const TERRITORY_COUNT = 40;
export const ZONE_COUNT = 8;
export const ZONES: number[] = Array.from({ length: ZONE_COUNT }, (_, i) => i + 1);

// Distribución ORIGINAL de territorios por zona. Sirve como punto de partida:
// en cuanto alguien reasigna un territorio desde la pestaña "Zonas", el valor
// guardado en su pin (campo `zona`) tiene prioridad sobre esta lista.
//
// Nota: el territorio 36 se dio tanto en la Zona 5 como en la Zona 6. Se dejó
// en la Zona 5; se puede mover a la Zona 6 desde la pestaña "Zonas".
export const DEFAULT_ZONE_TERRITORIES: Record<number, number[]> = {
    1: [1, 2, 3, 4, 5],
    2: [6, 16, 17, 22, 23, 40],
    3: [13, 18, 19, 20, 21],
    4: [7, 8, 9, 10, 11, 12, 14],
    5: [33, 34, 35, 36, 37],
    6: [15, 38, 39],
    7: [25, 26, 27, 29, 30],
    8: [24, 28, 31, 32],
};

export const DEFAULT_ZONE_BY_TERRITORY: Record<number, number> = Object.entries(
    DEFAULT_ZONE_TERRITORIES
).reduce((acc, [zone, terrs]) => {
    terrs.forEach(t => {
        acc[t] = Number(zone);
    });
    return acc;
}, {} as Record<number, number>);

// Zona efectiva de un pin: la guardada en el pin (0 = sin zona) o, si nunca se
// ha reasignado, la distribución original.
export const getMarkerZone = (m: Pick<TerritoryMarker, 'terrNum' | 'zona'>): number =>
    typeof m.zona === 'number' ? m.zona : DEFAULT_ZONE_BY_TERRITORY[m.terrNum] ?? 0;

// Zona efectiva de un territorio (con o sin pin en el mapa global).
export const getTerritoryZone = (terrNum: number, markers: TerritoryMarker[]): number => {
    const m = markers.find(mk => mk.terrNum === terrNum);
    return m ? getMarkerZone(m) : DEFAULT_ZONE_BY_TERRITORY[terrNum] ?? 0;
};
