
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
    onResetCompletedMarkers?: () => Promise<void>;
    canManage: boolean;
    onShowModal: (info: ModalInfo) => void;
    currentServiceYear: number;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ 
    maps, markers, records, onSaveMarker, onDeleteMarker, onSaveRecord, onResetCompletedMarkers, canManage, onShowModal, currentServiceYear 
}) => {
    const [editingMarker, setEditingMarker] = useState<Partial<TerritoryMarker> | null>(null);
    const [editingRecord, setEditingRecord] = useState<Partial<TerritoryRecord> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const globalMap = maps.find(m => m.territoryId === 'global');

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!canManage || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        setEditingMarker({ x, y, status: 'available', terrNum: 0 });
        setEditingRecord(null);
    };

    const handleSelectMarker = (marker: TerritoryMarker) => {
        if (!canManage) return;
        setEditingMarker(marker);
        
        const terrRecords = records.filter(r => r.terrNum === marker.terrNum && r.serviceYear === currentServiceYear);
        const latestRecord = terrRecords.sort((a, b) => b.vueltaNum - a.vueltaNum)[0];
        
        if (latestRecord) {
            setEditingRecord(latestRecord);
        } else {
            setEditingRecord({ 
                terrNum: marker.terrNum, 
                vueltaNum: 1, 
                serviceYear: currentServiceYear,
                asignadoA: '',
                assignedDate: '',
                completedDate: ''
            });
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
                    await onSaveRecord(editingRecord as Omit<TerritoryRecord, 'id'>);
                }
            }

            await onSaveMarker({ ...(editingMarker as any), status: finalStatus });
            
            setEditingMarker(null);
            setEditingRecord(null);
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
                    <p className="text-sm text-gray-500">{canManage ? 'Haz clic en el mapa para ubicar o gestionar territorios.' : 'Vista rápida del estado de los territorios.'}</p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
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

                {markers.map(marker => (
                    <div
                        key={marker.id}
                        className={`absolute ${!canManage ? 'w-3 h-3 opacity-90 text-[5px] sm:text-[9px]' : 'w-[18px] h-[18px] text-[8px] sm:text-[9px]'} sm:w-5 sm:h-5 translate-x-[-50%] translate-y-[-50%] rounded-full border-[0.5px] border-white/50 shadow-md flex items-center justify-center font-bold text-white transition-all active:scale-[3] z-10 ${
                            marker.status === 'completed' ? 'bg-green-500' : 
                            marker.status === 'assigned' ? 'bg-red-500' : 
                            marker.status === 'delayed' ? 'bg-orange-500 animate-pulse' :
                            'bg-gray-500'
                        } ${canManage ? 'cursor-pointer hover:scale-125' : ''}`}
                        style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleSelectMarker(marker);
                        }}
                        title={`Territorio ${marker.terrNum}`}
                    >
                        <span className="hidden sm:inline">{marker.terrNum}</span>
                        <span className="sm:hidden font-black" style={{ fontSize: !canManage ? '5px' : '7px', lineHeight: '1' }}>{marker.terrNum}</span>
                    </div>
                ))}
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
                                            const terrRecords = records.filter(r => r.terrNum === num && r.serviceYear === currentServiceYear);
                                            const latest = terrRecords.sort((a, b) => b.vueltaNum - a.vueltaNum)[0];
                                            setEditingRecord(latest || { terrNum: num, vueltaNum: 1, serviceYear: currentServiceYear });
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
                                </div>
                            )}
                        </div>
                        <div className="p-6 bg-slate-50 border-t flex flex-col gap-2">
                            <button onClick={handleSave} disabled={isSaving} className="w-full py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-200">
                                {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                            </button>
                            <button onClick={() => { setEditingMarker(null); setEditingRecord(null); }} className="w-full py-3 bg-white text-slate-600 font-bold rounded-xl border border-slate-200">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InteractiveMap;
