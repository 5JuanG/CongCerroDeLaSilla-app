

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TerritoryRecord, TerritoryMap, ModalInfo } from '../App';
import Tooltip from './Tooltip';

interface TerritoriosProps {
    records: TerritoryRecord[];
    onSave: (record: Omit<TerritoryRecord, 'id'>) => Promise<void>;
    onDelete: (record: Partial<TerritoryRecord>) => Promise<void>;
    territoryMaps: TerritoryMap[];
    onUploadMap: (territoryId: string, file: File) => Promise<void>;
    onDeleteMap: (mapId: string, mapUrl: string) => Promise<void>;
    canManage: boolean;
    onShowModal: (info: ModalInfo) => void;
}

interface TerritoryData {
    [terrNum: number]: {
        vueltas: { [vueltaNum: number]: TerritoryRecord };
    };
}


// Helper to get the current service year
const getCurrentServiceYear = () => {
    const now = new Date();
    return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
};

const MapManager: React.FC<{
    maps: TerritoryMap[];
    onUpload: (territoryId: string, file: File) => Promise<void>;
    onDelete: (mapId: string, mapUrl: string) => Promise<void>;
    canManage: boolean;
    setViewingMapUrl: (url: string | null) => void;
}> = ({ maps, onUpload, onDelete, canManage, setViewingMapUrl }) => {
    const [selectedTerritoryId, setSelectedTerritoryId] = useState('global');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [status, setStatus] = useState('');

    const handleUpload = async () => {
        if (!selectedFile) {
            setStatus('Por favor, seleccione un archivo de imagen.');
            return;
        }
        setIsUploading(true);
        setStatus(`Subiendo mapa para territorio ${selectedTerritoryId}...`);
        try {
            await onUpload(selectedTerritoryId, selectedFile);
            setStatus('¡Mapa subido con éxito!');
            setSelectedFile(null);
            // Clear file input visually
            const fileInput = document.getElementById('map-file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        } catch (error) {
            setStatus('Error al subir el mapa.');
            console.error(error);
        } finally {
            setIsUploading(false);
            setTimeout(() => setStatus(''), 4000);
        }
    };

    const handleDelete = async (map: TerritoryMap) => {
        if(window.confirm(`¿Está seguro de que desea eliminar el mapa del territorio ${map.territoryId}?`)) {
            try {
                await onDelete(map.id, map.mapUrl);
            } catch (error) {
                console.error("Error deleting map:", error);
                alert("No se pudo eliminar el mapa.");
            }
        }
    };
    
    const sortedMaps = useMemo(() => {
        return [...maps].sort((a, b) => {
            if (a.territoryId === 'global') return -1;
            if (b.territoryId === 'global') return 1;
            return parseInt(a.territoryId, 10) - parseInt(b.territoryId, 10);
        });
    }, [maps]);

    return (
        <div className="space-y-8">
            {canManage && (
                <div className="p-6 bg-white rounded-lg shadow-md border">
                    <h2 className="text-xl font-bold mb-4">Añadir o Actualizar Mapa</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label htmlFor="territory-select" className="block text-sm font-medium text-gray-700">Territorio</label>
                            <select id="territory-select" value={selectedTerritoryId} onChange={e => setSelectedTerritoryId(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                                <option value="global">Global (Todos)</option>
                                {Array.from({ length: 40 }, (_, i) => i + 1).map(num => <option key={num} value={num.toString()}>{num}</option>)}
                            </select>
                        </div>
                        <div>
                             <label htmlFor="map-file-input" className="block text-sm font-medium text-gray-700">Archivo de Imagen</label>
                            <input id="map-file-input" type="file" onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} accept="image/png, image/jpeg, image/webp" className="mt-1 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        </div>
                        <button onClick={handleUpload} disabled={isUploading || !selectedFile} className="w-full md:w-auto bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {isUploading ? 'Subiendo...' : 'Subir Mapa'}
                        </button>
                    </div>
                    {status && <p className="text-center text-sm font-semibold mt-4 text-blue-600">{status}</p>}
                </div>
            )}
            
            <div>
                <h2 className="text-xl font-bold mb-4">Galería de Mapas</h2>
                {sortedMaps.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {sortedMaps.map(map => (
                             <div key={map.id} className="group relative border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                                <img src={map.mapUrl} alt={`Mapa ${map.territoryId}`} onClick={() => setViewingMapUrl(map.mapUrl)} className="w-full h-32 object-cover cursor-pointer"/>
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-center py-1 text-sm font-bold">
                                    {map.territoryId === 'global' ? 'Global' : `Terr. ${map.territoryId}`}
                                </div>
                                {canManage && (
                                    <button onClick={() => handleDelete(map)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-gray-500 bg-gray-50 p-6 rounded-lg">No se han subido mapas de territorio.</p>
                )}
            </div>
        </div>
    );
};


const Territorios: React.FC<TerritoriosProps> = ({ records, onSave, onDelete, territoryMaps, onUploadMap, onDeleteMap, canManage, onShowModal }) => {
    const [activeTab, setActiveTab] = useState('registro');
    const [currentServiceYear, setCurrentServiceYear] = useState(getCurrentServiceYear());
    const [vueltaPage, setVueltaPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterTerritory, setFilterTerritory] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Partial<TerritoryRecord> | null>(null);
    const [viewingMapUrl, setViewingMapUrl] = useState<string | null>(null);

    const serviceYearOptions = useMemo(() => Array.from({ length: 5 }, (_, i) => getCurrentServiceYear() - i), []);

    const { territoryData, maxVueltas } = useMemo(() => {
        const data: TerritoryData = {};
        let maxV = 0;

        for (let i = 1; i <= 40; i++) {
            data[i] = { vueltas: {} };
        }
        
        const currentYearRecords = records.filter(r => r.serviceYear === currentServiceYear);

        currentYearRecords.forEach(record => {
            if (!record.terrNum) return;
            
            if (!data[record.terrNum]) {
                data[record.terrNum] = { vueltas: {} };
            }
            
            data[record.terrNum].vueltas[record.vueltaNum] = record;
            if (record.vueltaNum > maxV) maxV = record.vueltaNum;
        });
        
        let effectiveMaxVueltas = Math.max(4, maxV);
        if (maxV > 0 && maxV % 4 === 0) {
            effectiveMaxVueltas = maxV + 1;
        }

        return { territoryData: data, maxVueltas: effectiveMaxVueltas };
    }, [records, currentServiceYear]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(maxVueltas / 4)), [maxVueltas]);

    const handleOpenModal = (terrNum: number, vueltaNum: number) => {
        const record = territoryData[terrNum]?.vueltas[vueltaNum];
        setEditingRecord(record || { terrNum, vueltaNum, serviceYear: currentServiceYear });
        setIsModalOpen(true);
    };

    const handleSave = async (recordToSave: Partial<TerritoryRecord>) => {
        if (!recordToSave.terrNum || !recordToSave.vueltaNum || !recordToSave.serviceYear) {
            alert("Error: Faltan datos esenciales (territorio, vuelta o año de servicio).");
            return;
        }

        const fullRecordData: Omit<TerritoryRecord, 'id'> = {
            terrNum: recordToSave.terrNum,
            vueltaNum: recordToSave.vueltaNum,
            serviceYear: recordToSave.serviceYear,
            asignadoA: recordToSave.asignadoA || '',
            assignedDate: recordToSave.assignedDate || '',
            completedDate: recordToSave.completedDate || '',
            observations: recordToSave.observations || '',
        };

        try {
            await onSave(fullRecordData);
            setIsModalOpen(false);
            setEditingRecord(null);
        } catch (error) {
            console.error("Failed to save:", error);
            alert("Hubo un error al guardar el registro.");
        }
    };

    const handleDelete = async (recordToDelete: Partial<TerritoryRecord>) => {
        if (!recordToDelete.id && !recordToDelete.terrNum) {
            setIsModalOpen(false);
            setEditingRecord(null);
            return;
        }

        if (window.confirm('¿Estás seguro de que deseas eliminar este registro? Esta acción no se puede deshacer.')) {
            try {
                await onDelete(recordToDelete);
                setIsModalOpen(false);
                setEditingRecord(null);
            } catch (error) {
                console.error("Failed to delete:", error);
                alert("Hubo un error al eliminar el registro.");
            }
        }
    };

    const handleViewTerritoryMap = (terrNum: number) => {
        const map = territoryMaps.find(m => m.territoryId === terrNum.toString());
        if (map) {
            setViewingMapUrl(map.mapUrl);
        } else {
            onShowModal({
                type: 'info',
                title: 'Mapa no Encontrado',
                message: `No se ha subido un mapa para el territorio #${terrNum}.`
            });
        }
    };

    const handleViewGlobalMap = () => {
        const map = territoryMaps.find(m => m.territoryId === 'global');
        if (map) {
            setViewingMapUrl(map.mapUrl);
        } else {
            onShowModal({
                type: 'info',
                title: 'Mapa no Encontrado',
                message: 'No se ha subido un mapa global de territorios.'
            });
        }
    };
    
    const filteredTerritoryNumbers = useMemo(() => {
        return Object.keys(territoryData).map(Number).filter(terrNum => {
            if (filterTerritory && !terrNum.toString().startsWith(filterTerritory)) return false;
            
            const vueltas = Object.values(territoryData[terrNum].vueltas);

            if (searchQuery) {
                const asignadoMatch = vueltas.some((v) => (v as TerritoryRecord).asignadoA && (v as TerritoryRecord).asignadoA!.toLowerCase().includes(searchQuery.toLowerCase()));
                if (!asignadoMatch) return false;
            }

            switch (filterStatus) {
                case 'assigned': return vueltas.some((v) => (v as TerritoryRecord).assignedDate && !(v as TerritoryRecord).completedDate);
                case 'completed': return vueltas.some((v) => (v as TerritoryRecord).completedDate);
                case 'empty': return vueltas.length === 0;
                default: return true;
            }
        });
    }, [territoryData, filterTerritory, filterStatus, searchQuery]);
    
    const CrudModal = () => {
        const [record, setRecord] = useState(editingRecord);
        if (!isModalOpen || !record) return null;
        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setRecord(prev => ({ ...prev, [e.target.id]: e.target.value }));
        };
        return (
             <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                    <div className="p-4 border-b"><h2 className="text-xl font-bold">Territorio {record.terrNum} (Vuelta {record.vueltaNum})</h2></div>
                    <div className="p-4 space-y-4">
                        <div><label htmlFor="asignadoA" className="block text-sm font-medium">Asignado a:</label><input type="text" id="asignadoA" value={record.asignadoA || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded" /></div>
                        <div><label htmlFor="assignedDate" className="block text-sm font-medium">Fecha en que se asignó:</label><input type="date" id="assignedDate" value={record.assignedDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded" /></div>
                        <div><label htmlFor="completedDate" className="block text-sm font-medium">Fecha en que se completó:</label><input type="date" id="completedDate" value={record.completedDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded" /></div>
                        <div><label htmlFor="observations" className="block text-sm font-medium">Observaciones:</label><textarea id="observations" value={record.observations || ''} onChange={handleChange} rows={3} className="mt-1 w-full p-2 border rounded" /></div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-between">
                         {record.id ? (
                            <button onClick={() => handleDelete(record)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Eliminar</button>
                         ) : <div></div>}
                         <div>
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded mr-2">Cancelar</button>
                            <button onClick={() => handleSave(record)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar</button>
                         </div>
                    </div>
                </div>
            </div>
        )
    }

    const DesktopTable = ({ startTerr, endTerr }: {startTerr: number, endTerr: number}) => {
        const vueltasPorPagina = 4;
        const startVuelta = (vueltaPage - 1) * vueltasPorPagina + 1;
        const vueltasRange = Array.from({ length: vueltasPorPagina }, (_, i) => startVuelta + i);
        const territoriesForTable = filteredTerritoryNumbers.filter(
            terrNum => terrNum >= startTerr && terrNum <= endTerr
        );

        if (territoriesForTable.length === 0) {
            return <div className="p-4 text-center text-gray-500">No hay territorios para mostrar en esta sección con los filtros actuales.</div>;
        }

        return (
             <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs md:text-sm">
                    <thead className="bg-gray-100 text-[10px] md:text-xs">
                        <tr>
                            <th rowSpan={2} className="p-1 md:p-2 border border-gray-400 align-middle">Núm. de terr.</th>
                            <th rowSpan={2} className="p-1 md:p-2 border border-gray-400 align-middle relative group">
                                Última fecha en que se completó*
                                <Tooltip text="Muestra la fecha en que se completó la última vuelta de la PÁGINA ANTERIOR. Sirve como referencia para saber cuándo se trabajó por última vez un territorio antes de las vueltas que se muestran en esta página." />
                            </th>
                            {vueltasRange.map(v => <th colSpan={2} key={v} className="p-1 md:p-2 border border-gray-400 font-bold">Asignado a</th>)}
                        </tr>
                        <tr>
                            {vueltasRange.map(v => (
                                <React.Fragment key={v}>
                                    <th className="p-1 md:p-2 border border-gray-400 font-normal">Fecha en que se asignó</th>
                                    <th className="p-1 md:p-2 border border-gray-400 font-normal">Fecha en que se completó</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {territoriesForTable.map(terrNum => {
                            const terrData = territoryData[terrNum];
                            const prevPageLastVueltaNum = (vueltaPage - 1) * vueltasPorPagina;
                            const ultimaFechaCompletado = vueltaPage > 1 && prevPageLastVueltaNum > 0
                                ? terrData.vueltas[prevPageLastVueltaNum]?.completedDate || ''
                                : '';

                            return (
                                <React.Fragment key={terrNum}>
                                    <tr className="border-t-2 border-gray-500 h-8">
                                        <td rowSpan={2} className="p-0 border border-gray-400 font-bold text-center align-middle">
                                            <button
                                                onClick={() => handleViewTerritoryMap(terrNum)}
                                                className="w-full h-full p-1 md:p-2 text-blue-600 hover:bg-blue-100 hover:underline transition-colors"
                                            >
                                                {terrNum}
                                            </button>
                                        </td>
                                        <td rowSpan={2} className="p-1 md:p-2 border border-gray-400 text-center align-middle">{ultimaFechaCompletado}</td>
                                        {vueltasRange.map(vueltaNum => {
                                            const vueltaData = terrData.vueltas[vueltaNum];
                                            return (
                                                <td colSpan={2} key={vueltaNum} onClick={() => handleOpenModal(terrNum, vueltaNum)} className="p-1 md:p-2 border border-gray-400 text-center font-semibold cursor-pointer hover:bg-blue-50 align-bottom">
                                                    {vueltaData?.asignadoA || '\u00A0'}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    <tr className="h-8">
                                        {vueltasRange.map(vueltaNum => {
                                            const vueltaData = terrData.vueltas[vueltaNum];
                                            return (
                                                <React.Fragment key={vueltaNum}>
                                                    <td onClick={() => handleOpenModal(terrNum, vueltaNum)} className="p-1 md:p-2 border border-gray-400 text-center cursor-pointer hover:bg-blue-50">{vueltaData?.assignedDate || '\u00A0'}</td>
                                                    <td onClick={() => handleOpenModal(terrNum, vueltaNum)} className="p-1 md:p-2 border border-gray-400 text-center cursor-pointer hover:bg-blue-50">{vueltaData?.completedDate || '\u00A0'}</td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
             </div>
        )
    };

    const MobileCards = () => {
         if (filteredTerritoryNumbers.length === 0) {
            return <div className="p-4 text-center text-gray-500">No hay territorios para mostrar con los filtros actuales.</div>;
        }
        
        const getLastCompletedDate = (terrNum: number) => {
             const allVueltas = (Object.values(territoryData[terrNum].vueltas) as TerritoryRecord[])
                .filter((v) => v.completedDate)
                .sort((a, b) => new Date(b.completedDate!).getTime() - new Date(a.completedDate!).getTime());
            return allVueltas.length > 0 ? (allVueltas[0] as TerritoryRecord).completedDate : 'N/A';
        }

        return (
            <div className="space-y-4">
                {filteredTerritoryNumbers.map(terrNum => (
                    <div key={terrNum} className="bg-white rounded-lg shadow-md p-4">
                        <div className="flex justify-between items-center border-b pb-2 mb-3">
                            <h3 className="font-bold text-lg">Territorio #{terrNum}</h3>
                            <button
                                onClick={() => handleViewTerritoryMap(terrNum)}
                                className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
                            >
                                Ver Mapa
                            </button>
                        </div>
                        <p className="text-sm font-normal text-gray-500 -mt-2 mb-3">
                            Última fecha en que se completó: {getLastCompletedDate(terrNum)}
                        </p>
                         <div className="space-y-2">
                            {Array.from({ length: maxVueltas }, (_, i) => i + 1).map(vueltaNum => {
                                const vueltaData = territoryData[terrNum]?.vueltas[vueltaNum];
                                if (!vueltaData && filterStatus !== 'all' && filterStatus !== 'empty') return null;

                                const cardBgClass = 'bg-gray-50 border-gray-200'; // Neutral background

                                return (
                                    <div key={vueltaNum} onClick={() => handleOpenModal(terrNum, vueltaNum)} className={`p-3 rounded-md cursor-pointer border ${cardBgClass}`}>
                                        <p className="font-semibold text-gray-800">Vuelta {vueltaNum}: {vueltaData?.asignadoA || <span className="text-gray-400 italic">Sin asignar</span>}</p>
                                        {vueltaData?.asignadoA && (
                                            <p className="text-xs text-gray-600 mt-1">
                                                Asignado: {vueltaData.assignedDate || 'N/A'} | Completado: {vueltaData.completedDate || 'N/A'}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="p-2 sm:p-4">
            {viewingMapUrl && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" onClick={() => setViewingMapUrl(null)}>
                    <img src={viewingMapUrl} alt="Mapa de territorio" className="max-w-full max-h-full" />
                </div>
            )}
            <CrudModal />
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button onClick={() => setActiveTab('registro')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'registro' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Registro de Asignaciones
                    </button>
                    <button onClick={() => setActiveTab('mapas')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'mapas' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Mapas de Territorio
                    </button>
                </nav>
            </div>
            
            {activeTab === 'registro' && (
                <>
                    <header className="bg-white p-4 rounded-lg shadow-md mb-6">
                        <h1 className="text-xl sm:text-2xl font-bold text-center mb-4">REGISTRO DE ASIGNACIÓN DE TERRITORIO</h1>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                            <div>
                                <label className="font-semibold block mb-1 text-sm">Año de servicio:</label>
                                <select value={currentServiceYear} onChange={e => setCurrentServiceYear(Number(e.target.value))} className="w-full p-2 border rounded">
                                    {serviceYearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                                </select>
                            </div>
                            <div><label className="font-semibold block mb-1 text-sm">Buscar por publicador:</label><input type="search" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="..." className="w-full p-2 border rounded" /></div>
                            <div><label className="font-semibold block mb-1 text-sm">Buscar Territorio:</label><input type="number" value={filterTerritory} onChange={e => setFilterTerritory(e.target.value)} placeholder="Núm." className="w-full p-2 border rounded" /></div>
                            <div><label className="font-semibold block mb-1 text-sm">Estado:</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2 border rounded"><option value="all">Todos</option><option value="assigned">Asignado</option><option value="completed">Completado</option><option value="empty">Sin asignar</option></select></div>
                            <div>
                                <button
                                    onClick={handleViewGlobalMap}
                                    className="w-full p-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700"
                                >
                                    Ver Mapa Global
                                </button>
                            </div>
                        </div>
                    </header>
                    {totalPages > 1 && (
                        <div className="hidden md:flex justify-center flex-wrap items-center gap-2 mb-4">
                            <button onClick={() => setVueltaPage(p => Math.max(1, p - 1))} disabled={vueltaPage === 1} className="px-3 py-1 bg-white border rounded disabled:opacity-50">Anterior (Vueltas)</button>
                            <span className="font-semibold text-sm">Página de Vueltas: {vueltaPage} de {totalPages}</span>
                            <button onClick={() => setVueltaPage(p => Math.min(totalPages, p + 1))} disabled={vueltaPage === totalPages} className="px-3 py-1 bg-white border rounded disabled:opacity-50">Siguiente (Vueltas)</button>
                        </div>
                    )}
                    <div className="md:hidden"><MobileCards /></div>
                    <div className="hidden md:block space-y-6">
                        <div className="bg-white p-2 sm:p-4 rounded-lg shadow-md"><DesktopTable startTerr={1} endTerr={20}/></div>
                        <div className="bg-white p-2 sm:p-4 rounded-lg shadow-md"><DesktopTable startTerr={21} endTerr={40}/></div>
                    </div>
                </>
            )}

            {activeTab === 'mapas' && (
                <MapManager maps={territoryMaps} onUpload={onUploadMap} onDelete={onDeleteMap} canManage={canManage} setViewingMapUrl={setViewingMapUrl} />
            )}
        </div>
    );
};

export default Territorios;
