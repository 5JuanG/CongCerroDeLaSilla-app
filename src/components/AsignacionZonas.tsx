import React, { useMemo, useState } from 'react';
import { TerritoryMarker, ModalInfo } from '../types';
import { ZONES, TERRITORY_COUNT, DEFAULT_ZONE_BY_TERRITORY, getMarkerZone } from '../zonas';

interface AsignacionZonasProps {
    markers: TerritoryMarker[];
    onSaveMarker: (marker: Omit<TerritoryMarker, 'id'> & { id?: string }) => Promise<void>;
    canManage: boolean;
    onShowModal: (info: ModalInfo) => void;
}

const AsignacionZonas: React.FC<AsignacionZonasProps> = ({ markers, onSaveMarker, canManage, onShowModal }) => {
    // Cambios pendientes: número de territorio -> zona nueva (0 = sin zona).
    // Nada se guarda hasta pulsar "Guardar cambios".
    const [draft, setDraft] = useState<Record<number, number>>({});
    const [isSaving, setIsSaving] = useState(false);

    const terrNums = useMemo(() => {
        const set = new Set<number>(Array.from({ length: TERRITORY_COUNT }, (_, i) => i + 1));
        markers.forEach(m => {
            if (m.terrNum > 0) set.add(m.terrNum);
        });
        return Array.from(set).sort((a, b) => a - b);
    }, [markers]);

    const markersByTerr = useMemo(() => {
        const map = new Map<number, TerritoryMarker[]>();
        markers.forEach(m => {
            const list = map.get(m.terrNum) || [];
            list.push(m);
            map.set(m.terrNum, list);
        });
        return map;
    }, [markers]);

    const hasMarker = (n: number) => (markersByTerr.get(n)?.length ?? 0) > 0;

    const currentZone = (n: number): number => {
        const list = markersByTerr.get(n);
        return list && list.length > 0 ? getMarkerZone(list[0]) : DEFAULT_ZONE_BY_TERRITORY[n] ?? 0;
    };

    const effectiveZone = (n: number): number => (draft[n] !== undefined ? draft[n] : currentZone(n));

    const handleChange = (n: number, zone: number) => {
        setDraft(prev => {
            const next = { ...prev };
            if (zone === currentZone(n)) delete next[n];
            else next[n] = zone;
            return next;
        });
    };

    const pendingTerrs = Object.keys(draft).map(Number).sort((a, b) => a - b);

    const handleSave = async () => {
        if (!canManage || pendingTerrs.length === 0) return;
        setIsSaving(true);
        try {
            for (const n of pendingTerrs) {
                const list = markersByTerr.get(n) || [];
                for (const m of list) {
                    // Al cambiar de zona se borra la posición que tenía en el mapa de
                    // la zona anterior: no sirve sobre la imagen de la zona nueva y
                    // el pin debe ubicarse de nuevo ahí.
                    await onSaveMarker({ ...m, zona: draft[n], zoneX: null, zoneY: null });
                }
            }
            const count = pendingTerrs.length;
            setDraft({});
            onShowModal({
                type: 'success',
                title: 'Zonas actualizadas',
                message: `Se reasignó ${count} territorio${count === 1 ? '' : 's'}. Recuerda ubicar su pin en el mapa de la nueva zona (Mapa Interactivo → Zona).`,
            });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudieron guardar todos los cambios. Revisa y vuelve a intentar.' });
        } finally {
            setIsSaving(false);
        }
    };

    const groups: { zone: number; label: string; terrs: number[] }[] = [
        ...ZONES.map(z => ({ zone: z, label: `Zona ${z}`, terrs: terrNums.filter(n => effectiveZone(n) === z) })),
        { zone: 0, label: 'Sin zona', terrs: terrNums.filter(n => effectiveZone(n) === 0) },
    ].filter(g => g.zone !== 0 || g.terrs.length > 0);

    return (
        <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-sm border">
                <h3 className="text-lg font-bold text-gray-800">Zonas de Predicación</h3>
                <p className="text-sm text-gray-500 mt-1">
                    {canManage
                        ? 'Cambia la zona de un territorio con el selector y pulsa «Guardar cambios». Al mover un territorio a otra zona, su pin debe ubicarse de nuevo en el mapa de esa zona.'
                        : 'Distribución actual de los territorios por zona.'}
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {groups.map(g => (
                    <div key={g.zone} className="bg-white p-3 rounded-lg shadow-sm border">
                        <div className="flex justify-between items-baseline mb-2">
                            <span className="font-bold text-gray-800 text-sm">{g.label}</span>
                            <span className="text-xs text-gray-400">{g.terrs.length} territorio{g.terrs.length === 1 ? '' : 's'}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {g.terrs.length === 0 && <span className="text-xs text-gray-400">Sin territorios</span>}
                            {g.terrs.map(n => (
                                <span
                                    key={n}
                                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                        draft[n] !== undefined
                                            ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-400'
                                            : 'bg-blue-50 text-blue-700'
                                    }`}
                                >
                                    {n}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
                    <h4 className="font-bold text-gray-800">Reasignar territorios</h4>
                    {canManage && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDraft({})}
                                disabled={pendingTerrs.length === 0 || isSaving}
                                className="px-3 py-2 text-xs font-bold rounded-lg border border-gray-300 text-gray-600 disabled:opacity-40"
                            >
                                Descartar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={pendingTerrs.length === 0 || isSaving}
                                className="px-4 py-2 text-xs font-black rounded-lg bg-blue-600 text-white shadow-md disabled:opacity-40"
                            >
                                {isSaving ? 'Guardando…' : `Guardar cambios${pendingTerrs.length > 0 ? ` (${pendingTerrs.length})` : ''}`}
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {terrNums.map(n => {
                        const changed = draft[n] !== undefined;
                        const noPin = !hasMarker(n);
                        return (
                            <div
                                key={n}
                                className={`flex items-center justify-between gap-3 p-2 rounded-lg border ${
                                    changed ? 'border-amber-400 bg-amber-50' : 'border-gray-200'
                                }`}
                            >
                                <div className="min-w-0">
                                    <div className="font-bold text-gray-800 text-sm">Territorio {n}</div>
                                    {noPin && <div className="text-[10px] text-gray-400">Sin pin en el mapa global</div>}
                                    {changed && <div className="text-[10px] text-amber-700 font-semibold">Cambio pendiente</div>}
                                </div>
                                <select
                                    value={effectiveZone(n)}
                                    onChange={e => handleChange(n, Number(e.target.value))}
                                    disabled={!canManage || noPin || isSaving}
                                    title={noPin ? 'Coloca primero el pin de este territorio en el mapa global' : undefined}
                                    className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400"
                                >
                                    <option value={0}>Sin zona</option>
                                    {ZONES.map(z => (
                                        <option key={z} value={z}>
                                            Zona {z}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AsignacionZonas;
