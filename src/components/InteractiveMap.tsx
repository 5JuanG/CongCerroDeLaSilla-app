
import React, { useState, useRef } from 'react';
import { TerritoryMarker, TerritoryRecord, TerritoryMap, ModalInfo } from '../types';
import { DEFAULT_MAP_ERROR } from '../constants';

interface InteractiveMapProps {
    maps: TerritoryMap[];
    markers: TerritoryMarker[];
    records: TerritoryRecord[];
    onSaveMarker?: (marker: Omit<TerritoryMarker, 'id'> & { id?: string }) => Promise<void>;
    onDeleteMarker?: (id: string) => Promise<void>;
    onSaveRecord?: (record: Omit<TerritoryRecord, 'id'>) => Promise<void>;
    onDeleteRecord?: (record: Partial<TerritoryRecord>) => Promise<void>;
    onResetCompletedMarkers?: () => Promise<void>;
    canManage: boolean;
    onShowModal: (info: ModalInfo) => void;
    currentServiceYear: number;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ 
    maps, markers, records, onSaveMarker, onDeleteMarker, onSaveRecord, onDeleteRecord, onResetCompletedMarkers, canManage, onShowModal, currentServiceYear 
}) => {
    const [editingMarker, setEditingMarker] = useState<Partial<TerritoryMarker> | null>(null);
    const [editingRecord, setEditingRecord] = useState<Partial<TerritoryRecord> | null>(null);
    // All records found for the selected territory, across every service year
    // (not just the currently selected one). This lets the user find and fix
    // records that were mistakenly saved under the wrong service year — those
    // are otherwise invisible because the rest of the app filters by the
    // currently selected service year.
    const [territoryRecordOptions, setTerritoryRecordOptions] = useState<TerritoryRecord[]>([]);
    // Snapshot of the record as it was BEFORE editing, so we know whether the
    // vuelta number changed and whether we need to delete the old document
    // (otherwise changing the vuelta number creates a duplicate/orphan record
    // instead of correcting the existing one).
    const [originalEditingRecord, setOriginalEditingRecord] = useState<Partial<TerritoryRecord> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    // Tracks which marker is currently being dragged, and its live x/y while
    // dragging, so we can render it moving smoothly before committing the
    // final position on mouse/touch release.
    const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
    const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
    // When true (the default), pins cannot be dragged out of place — a tap
    // still opens the assignment form as usual. This prevents accidental
    // moves while working on assignments. The person managing territories
    // must explicitly unlock to reposition a pin, then can lock it again.
    const [pinsLocked, setPinsLocked] = useState(true);
    // Distinguishes a real drag from a simple click/tap, so a click still
    // opens the edit modal instead of being swallowed by the drag handler.
    const dragMovedRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const globalMap = maps.find(m => m.territoryId === 'global');

    const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

    const getRelativePosition = (clientX: number, clientY: number) => {
        const rect = containerRef.current!.getBoundingClientRect();
        return {
            x: clampPercent(((clientX - rect.left) / rect.width) * 100),
            y: clampPercent(((clientY - rect.top) / rect.height) * 100),
        };
    };

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!canManage || !containerRef.current) return;
        // Only treat this as "add a new marker on empty space" if the click
        // landed on the map container or its background image directly —
        // never on a marker (or anything rendered on top of it). This avoids
        // accidentally resetting the edit modal to a blank marker when a
        // click on a pin also bubbles up here.
        const target = e.target as HTMLElement;
        const isBackground = target === e.currentTarget || target.tagName === 'IMG';
        if (!isBackground) return;

        const { x, y } = getRelativePosition(e.clientX, e.clientY);

        setEditingMarker({ x, y, status: 'available', terrNum: 0 });
        setEditingRecord(null);
        setOriginalEditingRecord(null);
        setTerritoryRecordOptions([]);
    };

    const handleMarkerPointerDown = (e: React.PointerEvent<HTMLDivElement>, marker: TerritoryMarker) => {
        if (!canManage) return;
        e.stopPropagation();
        dragMovedRef.current = false;
        // While pins are locked, don't start a drag at all — pointerUp below
        // will still see wasDragged=false and treat this as a normal tap,
        // opening the assignment form instead of moving the pin.
        if (pinsLocked) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        setDraggingMarkerId(marker.id);
        setDragPosition({ x: marker.x, y: marker.y });
    };

    const handleMarkerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (pinsLocked || !draggingMarkerId || !containerRef.current) return;
        dragMovedRef.current = true;
        setDragPosition(getRelativePosition(e.clientX, e.clientY));
    };

    const handleMarkerPointerUp = async (e: React.PointerEvent<HTMLDivElement>, marker: TerritoryMarker) => {
        if (!canManage) return;
        e.stopPropagation();

        const wasDragged = dragMovedRef.current;
        const finalPosition = dragPosition;
        setDraggingMarkerId(null);
        setDragPosition(null);

        if (wasDragged && finalPosition && onSaveMarker) {
            try {
                await onSaveMarker({ ...marker, x: finalPosition.x, y: finalPosition.y });
            } catch (error) {
                onShowModal({ type: 'error', title: 'Error', message: 'No se pudo mover el marcador.' });
            }
        } else if (!wasDragged) {
            // A plain click/tap with no movement: open the edit modal as before.
            handleSelectMarker(marker);
        }
    };

    const handleSelectMarker = (marker: TerritoryMarker) => {
        if (!canManage) return;
        setEditingMarker(marker);

        // Show every record for this territory regardless of service year, so
        // a record misfiled under the wrong year (e.g. a new "vuelta 1" that
        // was accidentally saved as "vuelta 13" of the old year) is still
        // visible and selectable here instead of silently hidden.
        const allTerrRecords = records
            .filter(r => r.terrNum === marker.terrNum)
            .sort((a, b) => (b.serviceYear - a.serviceYear) || (b.vueltaNum - a.vueltaNum));
        setTerritoryRecordOptions(allTerrRecords);

        const currentYearRecord = allTerrRecords.find(r => r.serviceYear === currentServiceYear);
        const latestRecord = currentYearRecord || allTerrRecords[0];

        if (latestRecord) {
            setEditingRecord(latestRecord);
            setOriginalEditingRecord(latestRecord);
        } else {
            const blankRecord = { 
                terrNum: marker.terrNum, 
                vueltaNum: 1, 
                serviceYear: currentServiceYear,
                asignadoA: '',
                assignedDate: '',
                completedDate: ''
            };
            setEditingRecord(blankRecord);
            setOriginalEditingRecord(null);
        }
    };

    const handlePickRecordOption = (record: TerritoryRecord) => {
        setEditingRecord(record);
        setOriginalEditingRecord(record);
    };

    const handleAddBlankRecordForCurrentYear = () => {
        setEditingRecord({
            terrNum: editingMarker?.terrNum,
            vueltaNum: 1,
            serviceYear: currentServiceYear,
            asignadoA: '',
            assignedDate: '',
            completedDate: ''
        });
        setOriginalEditingRecord(null);
    };

    const handleDeleteRecordOnly = async () => {
        if (!originalEditingRecord?.id || !onDeleteRecord) return;
        if (!window.confirm(`¿Eliminar solo el registro (Vuelta ${originalEditingRecord.vueltaNum}, Año ${originalEditingRecord.serviceYear}) de este territorio?\n\nEl marcador en el mapa NO se eliminará. Esta acción no se puede deshacer.`)) return;

        setIsDeleting(true);
        try {
            await onDeleteRecord(originalEditingRecord);
            const remaining = territoryRecordOptions.filter(r => r.id !== originalEditingRecord.id);
            setTerritoryRecordOptions(remaining);
            const next = remaining.find(r => r.serviceYear === currentServiceYear) || remaining[0];
            if (next) {
                setEditingRecord(next);
                setOriginalEditingRecord(next);
            } else {
                handleAddBlankRecordForCurrentYear();
            }
            onShowModal({ type: 'success', title: 'Eliminado', message: 'Registro eliminado con éxito.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo eliminar el registro.' });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleDeleteMarker = async () => {
        if (!onDeleteMarker || !editingMarker?.id) return;

        const confirmMsg = originalEditingRecord?.id
            ? `¿Eliminar el marcador del Territorio ${editingMarker.terrNum}?\n\nEsto también eliminará su registro de asignación (S-13) del año de servicio actual. Esta acción no se puede deshacer.`
            : `¿Eliminar el marcador del Territorio ${editingMarker.terrNum}? Esta acción no se puede deshacer.`;

        if (!window.confirm(confirmMsg)) return;

        setIsDeleting(true);
        try {
            // Delete the linked S-13 record first (if any) so it doesn't become
            // an orphan once the marker itself is gone.
            if (originalEditingRecord?.id && onDeleteRecord) {
                await onDeleteRecord(originalEditingRecord);
            }
            await onDeleteMarker(editingMarker.id);

            setEditingMarker(null);
            setEditingRecord(null);
            setOriginalEditingRecord(null);
            setTerritoryRecordOptions([]);
            onShowModal({ type: 'success', title: 'Eliminado', message: 'Marcador eliminado con éxito.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo eliminar el marcador.' });
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSave = async () => {
        if (!onSaveMarker || !onSaveRecord || !editingMarker || !editingMarker.terrNum) return;

        setIsSaving(true);
        try {
            let finalStatus = editingMarker.status || 'available';
            if (editingRecord) {
                if (editingRecord.assignedDate && !editingRecord.completedDate) {
                    finalStatus = 'assigned';
                } else if (editingRecord.completedDate) {
                    finalStatus = 'completed';
                }
                if (editingRecord.vueltaNum) {
                    // If we were editing an existing record and the vuelta number
                    // AND/OR the service year was changed, saving would create a NEW
                    // record for that combination (App.tsx matches by
                    // terrNum+vueltaNum+serviceYear, not by id) and leave the old one
                    // behind as an orphan. To "move"/correct the record properly,
                    // delete the old one first.
                    const keyChanged = originalEditingRecord?.id && (
                        originalEditingRecord.vueltaNum !== editingRecord.vueltaNum ||
                        originalEditingRecord.serviceYear !== editingRecord.serviceYear
                    );

                    if (keyChanged && onDeleteRecord) {
                        await onDeleteRecord(originalEditingRecord as Partial<TerritoryRecord>);
                    }

                    await onSaveRecord(editingRecord as Omit<TerritoryRecord, 'id'>);
                }
            }

            await onSaveMarker({ ...(editingMarker as any), status: finalStatus });
            
            setEditingMarker(null);
            setEditingRecord(null);
            setOriginalEditingRecord(null);
            setTerritoryRecordOptions([]);
            onShowModal({ type: 'success', title: 'Éxito', message: 'Marcador y registro actualizados.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo completar la operación.' });
        } finally {
            setIsSaving(false);
        }
    };

    if (!globalMap) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <span className="text-4xl mb-4">🗺️</span>
                <p className="text-gray-500 text-center max-w-md">No se ha subido un mapa global interactivo.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-4 rounded-lg shadow-sm border gap-4">
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">Mapa Territorial Interactivo</h3>
                    <p className="text-sm text-gray-500">
                        {canManage
                            ? (pinsLocked
                                ? 'Haz clic en un pin para registrar el trabajo. Los pines están fijos: desbloquéalos para corregir su ubicación.'
                                : 'Modo edición de posición: arrastra un pin para moverlo, o haz clic en él para registrar el trabajo.')
                            : 'Vista rápida del estado de los territorios.'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    {canManage && (
                        <button
                            onClick={() => setPinsLocked(prev => !prev)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 ${
                                pinsLocked
                                    ? 'bg-slate-100 text-slate-600 border border-slate-200'
                                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                            }`}
                            title={pinsLocked ? 'Los pines están fijos. Haz clic para poder moverlos.' : 'Los pines se pueden mover. Haz clic para volver a fijarlos.'}
                        >
                            {pinsLocked ? '🔒 Pines Fijados' : '🔓 Editando Posición'}
                        </button>
                    )}
                    {canManage && onResetCompletedMarkers && (
                        <button
                            onClick={async () => {
                                const completedCount = markers.filter(m => m.status === 'completed').length;
                                if (completedCount === 0) {
                                    onShowModal({
                                        type: 'info',
                                        title: 'Información',
                                        message: 'No hay marcadores completados (verdes) para reiniciar.'
                                    });
                                    return;
                                }

                                if (window.confirm(`¿Estás seguro de que deseas iniciar una nueva vuelta?\n\nEsto cambiará automáticamente los ${completedCount} marcadores completados (verdes) a disponibles (grises), sin tocar los asignados o rezagados, y sin alterar los registros del S-13.`)) {
                                    try {
                                        await onResetCompletedMarkers();
                                        onShowModal({
                                            type: 'success',
                                            title: 'Éxito',
                                            message: `Se han reiniciado ${completedCount} marcadores a disponibles.`
                                        });
                                    } catch (e) {
                                        onShowModal({
                                            type: 'error',
                                            title: 'Error',
                                            message: 'Hubo un problema al reiniciar los marcadores.'
                                        });
                                    }
                                }
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md transition-all hover:scale-105 active:scale-95"
                        >
                            🔄 Iniciar Nueva Vuelta
                        </button>
                    )}
                    <div className="flex flex-wrap gap-3 text-[10px] font-bold bg-slate-50 p-2 rounded-lg border">
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span> Disp.</div>
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Asig.</div>
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Comp.</div>
                        <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Resagado</div>
                    </div>
                </div>
            </div>

            <div
                ref={containerRef}
                className={`relative overflow-hidden rounded-xl shadow-2xl border-4 border-white ${canManage ? 'cursor-crosshair' : 'cursor-default'}`}
                onClick={handleMapClick}
            >
                <img
                    src={globalMap.mapUrl}
                    alt="Mapa Global"
                    className="w-full h-auto block select-none"
                    draggable={false}
                    onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_MAP_ERROR; }}
                />

                {markers.map(marker => {
                    const isDraggingThis = draggingMarkerId === marker.id;
                    const displayX = isDraggingThis && dragPosition ? dragPosition.x : marker.x;
                    const displayY = isDraggingThis && dragPosition ? dragPosition.y : marker.y;
                    return (
                        <div
                            key={marker.id}
                            className={`absolute ${!canManage ? 'w-3 h-3 opacity-90 text-[5px] sm:text-[9px]' : 'w-[18px] h-[18px] text-[8px] sm:text-[9px]'} sm:w-5 sm:h-5 translate-x-[-50%] translate-y-[-50%] rounded-full border-[0.5px] border-white/50 shadow-md flex items-center justify-center font-bold text-white z-10 ${
                                isDraggingThis ? 'scale-150 z-20 shadow-xl' : 'transition-all active:scale-[3]'
                            } ${
                                marker.status === 'completed' ? 'bg-green-500' : 
                                marker.status === 'assigned' ? 'bg-red-500' : 
                                marker.status === 'delayed' ? 'bg-orange-500 animate-pulse' :
                                'bg-gray-500'
                            } ${canManage ? (pinsLocked ? 'cursor-pointer hover:scale-110' : 'cursor-grab active:cursor-grabbing hover:scale-125 touch-none') : ''}`}
                            style={{ left: `${displayX}%`, top: `${displayY}%` }}
                            onPointerDown={(e) => handleMarkerPointerDown(e, marker)}
                            onPointerMove={handleMarkerPointerMove}
                            onPointerUp={(e) => handleMarkerPointerUp(e, marker)}
                            onClick={(e) => e.stopPropagation()}
                            title={`Territorio ${marker.terrNum}${canManage ? (pinsLocked ? ' (clic para registrar trabajo — posición fija)' : ' (clic para registrar trabajo, arrastra para mover)') : ''}`}
                        >
                            <span className="hidden sm:inline">{marker.terrNum}</span>
                            <span className="sm:hidden font-black" style={{ fontSize: !canManage ? '5px' : '7px', lineHeight: '1' }}>{marker.terrNum}</span>
                        </div>
                    );
                })}
            </div>

            {canManage && editingMarker && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 bg-slate-50 border-b">
                            <h3 className="text-xl font-black text-slate-800">Gestionar Marcador</h3>
                        </div>
                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Territorio #</label>
                                    <input
                                        type="number"
                                        value={editingMarker.terrNum || ''}
                                        onChange={e => {
                                            const num = parseInt(e.target.value);
                                            setEditingMarker({ ...editingMarker, terrNum: num });
                                            const allTerrRecords = records
                                                .filter(r => r.terrNum === num)
                                                .sort((a, b) => (b.serviceYear - a.serviceYear) || (b.vueltaNum - a.vueltaNum));
                                            setTerritoryRecordOptions(allTerrRecords);
                                            const latest = allTerrRecords.find(r => r.serviceYear === currentServiceYear) || allTerrRecords[0];
                                            setEditingRecord(latest || { terrNum: num, vueltaNum: 1, serviceYear: currentServiceYear });
                                            setOriginalEditingRecord(latest || null);
                                        }}
                                        className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Estado Marker</label>
                                    <select
                                        value={editingMarker.status}
                                        onChange={e => setEditingMarker({ ...editingMarker, status: e.target.value as any })}
                                        className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                    >
                                        <option value="available">Disponible</option>
                                        <option value="assigned">Asignado</option>
                                        <option value="completed">Completado</option>
                                        <option value="delayed">Resagado</option>
                                    </select>
                                </div>
                            </div>

                            {territoryRecordOptions.length > 1 && (
                                <div className="pt-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">
                                        Se encontraron {territoryRecordOptions.length} registros para este territorio
                                    </label>
                                    <select
                                        value={originalEditingRecord?.id || 'new'}
                                        onChange={e => {
                                            const selected = territoryRecordOptions.find(r => r.id === e.target.value);
                                            if (selected) {
                                                handlePickRecordOption(selected);
                                            } else {
                                                handleAddBlankRecordForCurrentYear();
                                            }
                                        }}
                                        className="w-full p-3 bg-amber-50 rounded-xl border border-amber-200 focus:ring-2 focus:ring-blue-500 font-bold transition-all text-sm"
                                    >
                                        {territoryRecordOptions.map(r => (
                                            <option key={r.id} value={r.id}>
                                                Vuelta {r.vueltaNum} — Año {r.serviceYear}{r.asignadoA ? ` — ${r.asignadoA}` : ''}
                                            </option>
                                        ))}
                                        <option value="new">+ Nuevo registro (Año {currentServiceYear})</option>
                                    </select>
                                    <p className="text-xs text-slate-500 mt-1">Si ves un registro con un año incorrecto, selecciónalo aquí para corregirlo o eliminarlo.</p>
                                </div>
                            )}

                            {editingRecord && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Vuelta #</label>
                                            <input
                                                type="number"
                                                value={editingRecord.vueltaNum || 1}
                                                onChange={e => setEditingRecord({ ...editingRecord, vueltaNum: parseInt(e.target.value) })}
                                                className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Año de Servicio</label>
                                            <input
                                                type="number"
                                                value={editingRecord.serviceYear || currentServiceYear}
                                                onChange={e => setEditingRecord({ ...editingRecord, serviceYear: parseInt(e.target.value) })}
                                                className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Asignado a</label>
                                            <input
                                                type="text"
                                                placeholder="Nombre del hermano"
                                                value={editingRecord.asignadoA || ''}
                                                onChange={e => setEditingRecord({ ...editingRecord, asignadoA: e.target.value })}
                                                className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Asignación</label>
                                            <input
                                                type="date"
                                                value={editingRecord.assignedDate || ''}
                                                onChange={e => setEditingRecord({ ...editingRecord, assignedDate: e.target.value })}
                                                className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-1">Fecha Completado</label>
                                            <input
                                                type="date"
                                                value={editingRecord.completedDate || ''}
                                                onChange={e => setEditingRecord({ ...editingRecord, completedDate: e.target.value })}
                                                className="w-full p-3 bg-slate-100 rounded-xl border-none focus:ring-2 focus:ring-blue-500 font-bold transition-all text-sm"
                                            />
                                        </div>
                                    </div>
                                    {originalEditingRecord?.id && onDeleteRecord && (
                                        <button
                                            onClick={handleDeleteRecordOnly}
                                            disabled={isSaving || isDeleting}
                                            className="w-full py-2 bg-amber-50 text-amber-700 font-bold rounded-xl border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all disabled:opacity-60 text-sm"
                                        >
                                            {isDeleting ? 'Eliminando...' : '🗑️ Eliminar solo este registro (mantiene el pin)'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 border-t flex flex-col gap-2">
                            <button onClick={handleSave} disabled={isSaving || isDeleting} className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200 disabled:opacity-60">
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                            {editingMarker.id && onDeleteMarker && (
                                <button onClick={handleDeleteMarker} disabled={isSaving || isDeleting} className="w-full py-3 bg-red-50 text-red-600 font-black rounded-xl border border-red-200 hover:bg-red-100 active:scale-95 transition-all disabled:opacity-60">
                                    {isDeleting ? 'Eliminando...' : '🗑️ Eliminar Marcador'}
                                </button>
                            )}
                            <button onClick={() => { setEditingMarker(null); setEditingRecord(null); setOriginalEditingRecord(null); setTerritoryRecordOptions([]); }} disabled={isSaving || isDeleting} className="w-full py-3 bg-white text-slate-600 font-bold rounded-xl border border-slate-200 disabled:opacity-60">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InteractiveMap;
