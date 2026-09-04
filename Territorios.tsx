import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { TerritoryRecord, TerritoryMap, TerritoryResponsible, DailyTerritoryAssignment, Publisher, ModalInfo, TerritoryMarker, Campaign } from '../types';
import { compressImage } from '../utils';
import Tooltip from './Tooltip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_AVATAR, DEFAULT_MAP_ERROR } from '../constants';
import InteractiveMap from './InteractiveMap';

interface TerritoriosProps {
    records: TerritoryRecord[];
    onSave: (record: Omit<TerritoryRecord, 'id'>) => Promise<void>;
    onDelete: (record: Partial<TerritoryRecord>) => Promise<void>;
    territoryMaps: TerritoryMap[];
    onUploadMap: (territoryId: string, imageFile: Blob) => Promise<void>;
    onDeleteMap: (mapId: string, mapUrl: string) => Promise<void>;
    canManage: boolean;
    onShowModal: (info: ModalInfo) => void;
    onDownload?: (url: string, fileName: string) => Promise<void>;
    territoryResponsible: TerritoryResponsible | null;
    onSaveTerritoryResponsible: (publisherId: string, publisherName: string) => Promise<void>;
    dailyAssignments: DailyTerritoryAssignment[];
    onSaveDailyAssignment: (assignment: Omit<DailyTerritoryAssignment, 'id' | 'createdAt'>) => Promise<void>;
    onUpdateDailyAssignment: (id: string, assignment: Partial<DailyTerritoryAssignment>) => Promise<void>;
    onDeleteDailyAssignment: (id: string) => Promise<void>;
    publishers: Publisher[];
    isCommitteeMember: boolean;
    territoryMarkers: TerritoryMarker[];
    onSaveTerritoryMarker: (marker: Omit<TerritoryMarker, 'id'> & { id?: string }) => Promise<void>;
    onDeleteTerritoryMarker: (id: string) => Promise<void>;
    campaigns: Campaign[];
    onSaveCampaign: (campaign: Omit<Campaign, 'id'> & { id?: string }) => Promise<void>;
    onDeleteCampaign: (id: string) => Promise<void>;
}

interface TerritoryData {
    [terrNum: number]: {
        vueltas: { [vueltaNum: number]: TerritoryRecord };
    };
}


// Helper to get the current service year
const getCurrentServiceYear = () => {
    const now = new Date();
    // September is month index 8
    return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
};

const getServiceYearForDate = (dateString: string) => {
    if (!dateString) return getCurrentServiceYear();
    // Create date from string (YYYY-MM-DD), ensuring local timezone interpretation isn't an issue for month extraction
    // Ideally use split to avoid timezone off-by-one errors with Date constructor
    const [year, month] = dateString.split('-').map(Number);
    // Month in split is 1-indexed (01 = Jan), so Sept is 09.
    // Logic: If month >= 9 (Sept), service year is year + 1. Else year.
    return month >= 9 ? year + 1 : year;
};

const MapManager: React.FC<{
    maps: TerritoryMap[];
    onUpload: (territoryId: string, imageFile: Blob) => Promise<void>;
    onDelete: (mapId: string, mapUrl: string) => Promise<void>;
    canManage: boolean;
    setViewingMapUrl: (url: string | null) => void;
    onShowModal: (info: ModalInfo) => void;
    onDownload?: (url: string, fileName: string) => Promise<void>;
}> = ({ maps, onUpload, onDelete, canManage, setViewingMapUrl, onShowModal, onDownload }) => {
    const [selectedTerritoryId, setSelectedTerritoryId] = useState('global');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleUpload = async () => {
        if (!selectedFile) {
            onShowModal({ type: 'error', title: 'Archivo Faltante', message: 'Por favor, seleccione un archivo de imagen para subir.' });
            return;
        }
        setIsUploading(true);
        onShowModal({ type: 'info', title: 'Procesando', message: 'Comprimiendo imagen, espere un momento...' });

        try {
            const compressedBlob = await compressImage(selectedFile, 1920); // Higher resolution for maps
            await onUpload(selectedTerritoryId, compressedBlob);
            onShowModal({ type: 'success', title: 'Éxito', message: `Mapa para el territorio ${selectedTerritoryId} subido correctamente.` });
            setSelectedFile(null);
            const fileInput = document.getElementById('map-file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error de Carga', message: `No se pudo subir el mapa: ${(error as Error).message}` });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (map: TerritoryMap) => {
        if (window.confirm(`¿Está seguro de que desea eliminar el mapa del territorio ${map.territoryId}?`)) {
            try {
                await onDelete(map.id, map.mapUrl);
                onShowModal({ type: 'success', title: 'Eliminado', message: 'El mapa se ha eliminado.' })
            } catch (error) {
                console.error("Error deleting map:", error);
                onShowModal({ type: 'error', title: 'Error', message: 'No se pudo eliminar el mapa.' });
            }
        }
    };

    const sortedMaps = useMemo(() => {
        return [...maps].sort((a, b) => {
            if (a.territoryId === 'global') return -1;
            if (b.territoryId === 'global') return 1;
            
            if (a.territoryId === 'global-numerado') return -1;
            if (b.territoryId === 'global-numerado') return 1;

            const aIsZona = a.territoryId.startsWith('zona-');
            const bIsZona = b.territoryId.startsWith('zona-');
            
            if (aIsZona && bIsZona) {
                return parseInt(a.territoryId.replace('zona-', ''), 10) - parseInt(b.territoryId.replace('zona-', ''), 10);
            }
            if (aIsZona) return -1;
            if (bIsZona) return 1;

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
                                <option value="global">Global (Interactivo sin números)</option>
                                <option value="global-numerado">Global Numerado (Referencia)</option>
                                <optgroup label="Zonas de Predicación">
                                    {Array.from({ length: 15 }, (_, i) => i + 1).map(num => <option key={`zona-${num}`} value={`zona-${num}`}>Zona {num}</option>)}
                                </optgroup>
                                <optgroup label="Territorios Individuales">
                                    {Array.from({ length: 40 }, (_, i) => i + 1).map(num => <option key={num} value={num.toString()}>{num}</option>)}
                                </optgroup>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="map-file-input" className="block text-sm font-medium text-gray-700">Archivo de Imagen</label>
                            <input id="map-file-input" type="file" onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)} accept="image/png, image/jpeg, image/webp" className="mt-1 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                        </div>
                        <button onClick={handleUpload} disabled={isUploading || !selectedFile} className="w-full md:w-auto bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400">
                            {isUploading ? 'Subiendo...' : 'Subir Mapa'}
                        </button>
                    </div>
                </div>
            )}

            <div>
                <h2 className="text-xl font-bold mb-4">Galería de Mapas</h2>
                {sortedMaps.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {sortedMaps.map(map => (
                            <div key={map.id} className="group relative border rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                                <img src={map.mapUrl} alt={`Mapa ${map.territoryId}`} onClick={() => setViewingMapUrl(map.mapUrl)} className="w-full h-32 object-cover cursor-pointer" onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_MAP_ERROR; }} />
                                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-center py-1 text-sm font-bold">
                                    {map.territoryId === 'global' ? 'Global' : 
                                     map.territoryId === 'global-numerado' ? 'Global Numerado' :
                                     map.territoryId.startsWith('zona-') ? `Zona ${map.territoryId.replace('zona-', '')}` :
                                     `Terr. ${map.territoryId}`}
                                </div>
                                {canManage && (
                                    <button onClick={() => handleDelete(map)} className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                                )}
                                {onDownload && (
                                    <button
                                        onClick={() => onDownload(map.mapUrl, `mapa_${map.territoryId}.webp`)}
                                        className="absolute top-1 left-1 bg-white text-blue-600 rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                        title="Descargar Mapa"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
                                        </svg>
                                    </button>
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

// Removed internal InteractiveMap component


const Territorios: React.FC<TerritoriosProps> = ({
    records,
    onSave,
    onDelete,
    territoryMaps,
    onUploadMap,
    onDeleteMap,
    canManage,
    onShowModal,
    onDownload,
    territoryResponsible,
    onSaveTerritoryResponsible,
    dailyAssignments,
    onSaveDailyAssignment,
    onUpdateDailyAssignment,
    onDeleteDailyAssignment,
    publishers,
    isCommitteeMember,
    territoryMarkers,
    onSaveTerritoryMarker,
    onDeleteTerritoryMarker,
    campaigns = [],
    onSaveCampaign,
    onDeleteCampaign
}) => {
    const [activeTab, setActiveTab] = useState('registro');
    const [currentServiceYear, setCurrentServiceYear] = useState(getCurrentServiceYear());
    const [vueltaPage, setVueltaPage] = useState(-1); // -1 means "go to last page" (set after data loads)
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterTerritory, setFilterTerritory] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<Partial<TerritoryRecord> | null>(null);
    const [viewingMapUrl, setViewingMapUrl] = useState<string | null>(null);
    const [isResponsibleModalOpen, setIsResponsibleModalOpen] = useState(false);
    const [isDailyAssignmentModalOpen, setIsDailyAssignmentModalOpen] = useState(false);
    const [editingDailyAssignment, setEditingDailyAssignment] = useState<Partial<DailyTerritoryAssignment> | null>(null);
    const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);

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

    // Fix 1: Reset to page 1 immediately when the user switches service year to avoid
    // landing on a page that doesn't exist for the new year (e.g., going from 2026
    // which has 4 pages to 2027 which only has 1 page would leave vueltaPage = 4,
    // showing a blank table).
    useEffect(() => {
        setVueltaPage(1);
    }, [currentServiceYear]);

    // Auto-jump to last page whenever totalPages changes (e.g., year switches or data loads)
    useEffect(() => {
        setVueltaPage(totalPages);
    }, [totalPages]);

    const handleOpenModal = (terrNum: number, vueltaNum: number) => {
        if (!canManage) return; // Prevent opening modal if user can't manage
        const record = territoryData[terrNum]?.vueltas[vueltaNum];
        setEditingRecord(record || { terrNum, vueltaNum, serviceYear: currentServiceYear });
        setIsModalOpen(true);
    };

    const getCampaignHighlight = useCallback((terrNum: number, vueltaNum: number) => {
        const vueltaData = territoryData[terrNum]?.vueltas[vueltaNum];
        if (!vueltaData || !vueltaData.assignedDate) return { highlightClass: '', label: '' };

        const date = vueltaData.assignedDate;
        const currentCampaign = (campaigns || []).find(c => date >= c.startDate && date <= c.endDate);

        if (!currentCampaign) return { highlightClass: '', label: '' };

        // Obtenemos todos los registros de este territorio que caen en este periodo de campaña específico
        const recordsInThisCampaign = (Object.values(territoryData[terrNum].vueltas) as TerritoryRecord[])
            .filter(v => v.assignedDate && v.assignedDate >= currentCampaign.startDate && v.assignedDate <= currentCampaign.endDate)
            .sort((a, b) => a.assignedDate!.localeCompare(b.assignedDate!));

        const relativeTurnIndex = recordsInThisCampaign.findIndex(v => v.vueltaNum === vueltaNum);
        const relativeTurn = relativeTurnIndex !== -1 ? relativeTurnIndex + 1 : 1;

        let colorClass = '';
        if (relativeTurn === 1) colorClass = 'bg-yellow-300 text-black font-bold border-2 border-yellow-500';
        else if (relativeTurn === 2) colorClass = 'bg-lime-400 text-black font-bold border-2 border-lime-600';
        else if (relativeTurn === 3) colorClass = 'bg-cyan-300 text-black font-bold border-2 border-cyan-500';
        else if (relativeTurn === 4) colorClass = 'bg-pink-300 text-black font-bold border-2 border-pink-500';
        else colorClass = 'bg-purple-600 text-white font-bold border-2 border-purple-800';

        return {
            highlightClass: colorClass,
            label: `Camp. V${relativeTurn}`
        };
    }, [campaigns, territoryData]);

    const handleSave = async (recordToSave: Partial<TerritoryRecord>) => {
        if (!recordToSave.terrNum || !recordToSave.vueltaNum || !recordToSave.serviceYear) {
            onShowModal({ type: 'error', title: 'Error', message: "Faltan datos esenciales (territorio, vuelta o año de servicio)." });
            return;
        }

        if (recordToSave.assignedDate && recordToSave.completedDate) {
            if (new Date(recordToSave.assignedDate) > new Date(recordToSave.completedDate)) {
                onShowModal({ type: 'error', title: 'Error de Fechas', message: 'La fecha de asignación no puede ser posterior a la fecha de completado.' });
                return;
            }
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
            
            // Sync with marker: Find the marker for this territory and update its status
            const marker = territoryMarkers.find(m => m.terrNum === recordToSave.terrNum);
            if (marker) {
                let newStatus: 'available' | 'assigned' | 'completed' = 'available';
                if (recordToSave.assignedDate && !recordToSave.completedDate) {
                    newStatus = 'assigned';
                } else if (recordToSave.completedDate) {
                    newStatus = 'completed';
                }
                
                await onSaveTerritoryMarker({ ...marker, status: newStatus });
            }

            onShowModal({ type: 'success', title: 'Guardado', message: 'Registro guardado y mapa actualizado.' });
            setIsModalOpen(false);
            setEditingRecord(null);
        } catch (error) {
            console.error("Failed to save:", error);
            onShowModal({ type: 'error', title: 'Error', message: "Hubo un error al guardar el registro." });
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
                onShowModal({ type: 'success', title: 'Eliminado', message: 'Registro eliminado con éxito.' });
                setIsModalOpen(false);
                setEditingRecord(null);
            } catch (error) {
                console.error("Failed to delete:", error);
                onShowModal({ type: 'error', title: 'Error', message: "Hubo un error al eliminar el registro." });
            }
        }
    };

    const handleResetCompletedMarkers = async () => {
        const completedMarkers = territoryMarkers.filter(m => m.status === 'completed');
        if (completedMarkers.length === 0) return;

        await Promise.all(
            completedMarkers.map(marker => 
                onSaveTerritoryMarker({ ...marker, status: 'available' })
            )
        );
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

    // Calculate territories worked in a specific round
    const getWorkedTerritories = useCallback((vuelta: number) => {
        if (vuelta <= 0) return [];
        const worked: number[] = [];
        const currentYearRecords = records.filter(r => r.serviceYear === currentServiceYear);
        
        for (let terrNum = 1; terrNum <= 40; terrNum++) {
            const record = currentYearRecords.find(
                r => r.terrNum === terrNum && r.vueltaNum === vuelta && r.completedDate
            );
            if (record) {
                worked.push(terrNum);
            }
        }
        return worked.sort((a, b) => a - b);
    }, [records, currentServiceYear]);

    const currentVueltaWorked = useMemo(() => {
        const yearRecords = records.filter(r => r.serviceYear === currentServiceYear);
        if (yearRecords.length === 0) return [];
        
        const vueltas = yearRecords.map(r => r.vueltaNum);
        let maxV = Math.max(...vueltas);
        
        // Damping: if max vuelta has only 1 record and previous has many, stay in previous
        const countInMax = yearRecords.filter(r => r.vueltaNum === maxV).length;
        if (maxV > 1 && countInMax === 1) {
            const countInPrev = yearRecords.filter(r => r.vueltaNum === maxV - 1).length;
            if (countInPrev > 5) maxV = maxV - 1;
        }

        return getWorkedTerritories(maxV);
    }, [getWorkedTerritories, records, currentServiceYear]);

    const previousVueltaWorked = useMemo(() => {
        const currentYearRecords = records.filter(r => r.serviceYear === currentServiceYear);
        const maxVuelta = currentYearRecords.length > 0 ? Math.max(...currentYearRecords.map(r => r.vueltaNum)) : 0;
        return getWorkedTerritories(maxVuelta - 1);
    }, [getWorkedTerritories, records, currentServiceYear]);

    const [viewingVueltaMode, setViewingVueltaMode] = useState<'current' | 'previous'>('current');

    const handleViewGlobalMap = () => {
        const map = territoryMaps.find(m => m.territoryId === 'global-numerado') || territoryMaps.find(m => m.territoryId === 'global');
        if (map) {
            setViewingMapUrl(map.mapUrl);
        } else {
            onShowModal({
                type: 'info',
                title: 'Mapa no Encontrado',
                message: 'No se ha subido un mapa global (numerado o normal) de territorios.'
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

    const displayedAssignments = useMemo(() => {
        const sorted = [...dailyAssignments].sort((a, b) => {
            const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });

        const pending = sorted.filter(a => !a.completedDate);

        // Find the latest assignment by the responsible
        let latestByResponsible = null;
        if (territoryResponsible) {
            latestByResponsible = sorted.find(a =>
                publishers.find(p => p.id === territoryResponsible.publisherId)?.Nombre === a.captain
            );
        }

        // If no responsible or no assignment by them, use the latest overall
        const latestEntry = latestByResponsible || sorted[0];

        // Combine pending and latest, avoiding duplicates
        const combined = [...pending];
        if (latestEntry && !combined.some(a => a.id === latestEntry.id)) {
            combined.unshift(latestEntry);
        }

        return combined;
    }, [dailyAssignments, territoryResponsible, publishers]);

    // WhatsApp notification function
    const sendWhatsAppNotification = useCallback((assignment: DailyTerritoryAssignment) => {
        const publisher = publishers.find(p => p.Nombre === assignment.captain);
        const phone = publisher?.Telefono || publisher?.['Teléfono'] || '';

        const message = `🗺️ *Asignación de Territorio*

📅 Fecha: ${assignment.date}
🔄 Vuelta: ${assignment.vueltaNum}
📍 Territorios: ${assignment.territories.join(', ')}
👤 Capitán: ${assignment.captain}
${assignment.assignedDate ? `\n📆 Asignado: ${assignment.assignedDate}` : ''}
${assignment.observations ? `\n📝 Observaciones: ${assignment.observations}` : ''}

¡Que Jehová bendiga tu servicio!`;

        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = phone
            ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodedMessage}`
            : `https://wa.me/?text=${encodedMessage}`;

        window.open(whatsappUrl, '_blank');
    }, [publishers]);

    // PDF Export function (S-13-S 1/22 Format)
    const exportToPDF = useCallback(() => {
        try {
            const pdf = new jsPDF('p', 'mm', 'letter', true);
            const pageWidth = pdf.internal.pageSize.getWidth();
            const today = new Date();
            const serviceYearY = today.getMonth() >= 8 ? today.getFullYear() + 1 : today.getFullYear();

            const drawTerritoryPage = (startNum: number, endNum: number, isSecondPage: boolean, isHistory: boolean) => {
                if (isSecondPage || isHistory) pdf.addPage();

                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.text('REGISTRO DE ASIGNACIÓN DE TERRITORIO', pageWidth / 2, 10, { align: 'center' });

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Año de servicio:', 10, 18);
                pdf.setFont('helvetica', 'normal');
                pdf.text(serviceYearY.toString(), 40, 18);
                pdf.line(40, 19, 60, 19);

                const territories = Array.from({ length: endNum - startNum + 1 }, (_, i) => startNum + i);
                const tableBody: any[] = [];

                // Determine the "Current" and "History" blocks based on max progress
                const totalMaxVuelta = records.length > 0 ? Math.max(...records.map(r => Number(r.vueltaNum) || 0)) : 1;
                const recentBlockStart = Math.max(1, Math.floor((totalMaxVuelta - 1) / 4) * 4 + 1);
                const historyBlockStart = recentBlockStart > 4 ? recentBlockStart - 4 : -1;

                territories.forEach(num => {
                    const allRecordsForTerr = [...records]
                        .filter(r => String(r.terrNum) == String(num))
                        .sort((a, b) => {
                            const yearA = Number(a.serviceYear) || 0;
                            const yearB = Number(b.serviceYear) || 0;
                            if (yearA !== yearB) return yearA - yearB;
                            return (Number(a.vueltaNum) || 0) - (Number(b.vueltaNum) || 0);
                        });

                    // Map records to Stable Round Numbers
                    const currentBlockStart = isHistory ? historyBlockStart : recentBlockStart;

                    if (currentBlockStart === -1 && isHistory) {
                        const emptyRow = [
                            { content: num.toString(), rowSpan: 2, styles: { valign: 'middle', fontStyle: 'bold', fontSize: 10, halign: 'center' } },
                            { content: '', rowSpan: 2 },
                            { content: '', colSpan: 2 }, { content: '', colSpan: 2 }, { content: '', colSpan: 2 }, { content: '', colSpan: 2 }
                        ];
                        tableBody.push(emptyRow, ['', '', '', '', '', '', '', '']);
                        return;
                    }

                    const recordsToDraw: (TerritoryRecord | undefined)[] = [];
                    for (let v = 0; v < 4; v++) {
                        const targetVuelta = currentBlockStart + v;
                        const rec = allRecordsForTerr.filter(r => Number(r.vueltaNum) === targetVuelta).pop();
                        recordsToDraw.push(rec);
                    }

                    // Col 1: Ultima fecha en que se completo*
                    const prevVueltaNum = currentBlockStart - 1;
                    const lastCompRecord = allRecordsForTerr.filter(r => Number(r.vueltaNum) === prevVueltaNum).pop();
                    const lastComp = lastCompRecord?.completedDate || '';

                    const row1 = [
                        { content: num.toString(), rowSpan: 2, styles: { valign: 'middle', fontStyle: 'bold', fontSize: 10, halign: 'center' } },
                        { content: lastComp, rowSpan: 2, styles: { valign: 'middle', fontSize: 7.5, halign: 'center' } },
                        { content: recordsToDraw[0]?.asignadoA || '', colSpan: 2, styles: { minCellHeight: 5.5 } },
                        { content: recordsToDraw[1]?.asignadoA || '', colSpan: 2, styles: { minCellHeight: 5.5 } },
                        { content: recordsToDraw[2]?.asignadoA || '', colSpan: 2, styles: { minCellHeight: 5.5 } },
                        { content: recordsToDraw[3]?.asignadoA || '', colSpan: 2, styles: { minCellHeight: 5.5 } }
                    ];
                    const row2 = [
                        { content: recordsToDraw[0]?.assignedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: recordsToDraw[0]?.completedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: recordsToDraw[1]?.assignedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: recordsToDraw[1]?.completedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: recordsToDraw[2]?.assignedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: recordsToDraw[2]?.completedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: recordsToDraw[3]?.assignedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: recordsToDraw[3]?.completedDate || '', styles: { minCellHeight: 5.5 } }
                    ];
                    tableBody.push(row1, row2);
                });

                autoTable(pdf, {
                    startY: 22,
                    margin: { left: 10, right: 10, bottom: 20 },
                    head: [
                        [
                            { content: 'Núm.\nde terr.', rowSpan: 2, styles: { valign: 'middle' } },
                            { content: 'Última fecha\nen que se\ncompletó*', rowSpan: 2, styles: { valign: 'middle' } },
                            { content: 'Asignado a', colSpan: 2 },
                            { content: 'Asignado a', colSpan: 2 },
                            { content: 'Asignado a', colSpan: 2 },
                            { content: 'Asignado a', colSpan: 2 }
                        ],
                        [
                            { content: 'Fecha en que\nse asignó', styles: { fontSize: 5.5 } },
                            { content: 'Fecha en que\nse completó', styles: { fontSize: 5.5 } },
                            { content: 'Fecha en que\nse asignó', styles: { fontSize: 5.5 } },
                            { content: 'Fecha en que\nse completó', styles: { fontSize: 5.5 } },
                            { content: 'Fecha en que\nse asignó', styles: { fontSize: 5.5 } },
                            { content: 'Fecha en que\nse completó', styles: { fontSize: 5.5 } },
                            { content: 'Fecha en que\nse asignó', styles: { fontSize: 5.5 } },
                            { content: 'Fecha en que\nse completó', styles: { fontSize: 5.5 } }
                        ]
                    ],
                    body: tableBody,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [240, 240, 240],
                        textColor: [0, 0, 0],
                        fontStyle: 'bold',
                        halign: 'center',
                        lineWidth: 0.1,
                        lineColor: [100, 100, 100],
                        fontSize: 8,
                        minCellHeight: 5,
                        cellPadding: 0.8
                    },
                    bodyStyles: {
                        fontSize: 7.5,
                        textColor: [0, 0, 0],
                        lineWidth: 0.1,
                        lineColor: [150, 150, 150],
                        minCellHeight: 5.5,
                        cellPadding: 0.6,
                        overflow: 'ellipsize'
                    },
                    styles: {
                        fontSize: 7.5,
                        cellPadding: 1,
                        halign: 'center',
                        lineWidth: 0.2,
                        textColor: [0, 0, 0],
                        overflow: 'ellipsize'
                    },
                    columnStyles: {
                        0: { cellWidth: 12 },
                        1: { cellWidth: 20 },
                        2: { cellWidth: 20.5 },
                        3: { cellWidth: 20.5 },
                        4: { cellWidth: 20.5 },
                        5: { cellWidth: 20.5 },
                        6: { cellWidth: 20.5 },
                        7: { cellWidth: 20.5 },
                        8: { cellWidth: 20.5 },
                        9: { cellWidth: 20.5 }
                    }
                });

                pdf.setFontSize(7.5);
                pdf.setFont('helvetica', 'normal');
                const lastY = (pdf as any).lastAutoTable?.finalY || 200;
                pdf.text('*Cuando comience una nueva página, anote en esta columna la última fecha en que los territorios se completaron.', 10, lastY + 4);
                const footerY = pdf.internal.pageSize.height - 6;
                pdf.setFontSize(7);
                pdf.text(`S-13-S 1/22`, 10, footerY);
                if (territoryResponsible?.publisherName) {
                    pdf.text(`Responsable: ${territoryResponsible.publisherName}`, pdf.internal.pageSize.width - 10, footerY, { align: 'right' });
                }

                if (isHistory) {
                    pdf.setFont('helvetica', 'bold');
                    pdf.text('(Datos Anteriores)', pageWidth - 40, 14);
                }
            };

            // Page 1: Territories 1-20 (Recent)
            drawTerritoryPage(1, 20, false, false);
            // Page 2: Territories 21-40 (Recent)
            drawTerritoryPage(21, 40, true, false);
            // Page 3: Territories 1-20 (History)
            drawTerritoryPage(1, 20, false, true);
            // Page 4: Territories 21-40 (History)
            drawTerritoryPage(21, 40, true, true);

            pdf.save(`registro-territorios-S13-${today.getFullYear()}.pdf`);
            onShowModal({ type: 'success', title: 'PDF Generado', message: 'El registro S-13 se ha descargado correctamente.' });
        } catch (error) {
            console.error(error);
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo generar el registro de territorios.' });
        }
    }, [records, onShowModal]);

    // Calculate comprehensive territory statistics
    const calculateTerritoryStats = useMemo(() => {
        const currentYearRecords = records.filter(r => r.serviceYear === currentServiceYear);
        
        // Apply damping: if max vuelta has only 1 record and previous has >5, use previous
        let maxVuelta = Math.max(...currentYearRecords.map(r => r.vueltaNum), 0);
        if (maxVuelta > 1) {
            const countInMax = currentYearRecords.filter(r => r.vueltaNum === maxVuelta).length;
            if (countInMax === 1) {
                const countInPrev = currentYearRecords.filter(r => r.vueltaNum === maxVuelta - 1).length;
                if (countInPrev > 5) maxVuelta = maxVuelta - 1;
            }
        }

        const completed = currentYearRecords.filter(
            r => r.vueltaNum === maxVuelta && r.completedDate
        ).length;

        const pending = 40 - completed;
        const percentage = completed > 0 ? Math.round((completed / 40) * 100) : 0;

        // Captain statistics
        const captainStats: Record<string, { count: number; completed: number }> = {};
        dailyAssignments.forEach(a => {
            if (!captainStats[a.captain]) {
                captainStats[a.captain] = { count: 0, completed: 0 };
            }
            captainStats[a.captain].count++;
            if (a.completedDate) {
                captainStats[a.captain].completed++;
            }
        });

        const topCaptains = Object.entries(captainStats)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Calculate average completion time
        const completedAssignments = dailyAssignments.filter(a => a.assignedDate && a.completedDate);
        let avgDays = 0;
        if (completedAssignments.length > 0) {
            const totalDays = completedAssignments.reduce((sum, a) => {
                const assigned = new Date(a.assignedDate!);
                const completed = new Date(a.completedDate!);
                const days = Math.floor((completed.getTime() - assigned.getTime()) / (1000 * 60 * 60 * 24));
                return sum + days;
            }, 0);
            avgDays = Math.round(totalDays / completedAssignments.length);
        }

        // Territories not worked in current round
        const notWorkedThisRound: number[] = [];
        for (let i = 1; i <= 40; i++) {
            const hasCurrentRound = currentYearRecords.find(
                r => r.terrNum === i && r.vueltaNum === maxVuelta
            );
            if (!hasCurrentRound) {
                notWorkedThisRound.push(i);
            }
        }

        // Pending assignments over 30 days
        const now = new Date();
        const oldPendingAssignments = dailyAssignments.filter(a => {
            if (a.completedDate) return false;
            const assigned = new Date(a.assignedDate);
            const daysDiff = Math.floor((now.getTime() - assigned.getTime()) / (1000 * 60 * 60 * 24));
            return daysDiff > 30;
        });

        return {
            totalTerritories: 40,
            completed,
            pending,
            percentage,
            currentRound: maxVuelta,
            topCaptains,
            avgCompletionDays: avgDays,
            notWorkedThisRound,
            oldPendingCount: oldPendingAssignments.length,
            totalAssignments: dailyAssignments.length,
            completedAssignments: dailyAssignments.filter(a => a.completedDate).length,
            pendingAssignments: dailyAssignments.filter(a => !a.completedDate).length
        };
    }, [records, dailyAssignments, currentServiceYear]);

    const CrudModal = () => {
        const [record, setRecord] = useState(editingRecord);
        const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

        if (!isModalOpen || !record) return null;

        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setRecord(prev => ({ ...prev, [e.target.id]: e.target.value }));
        };

        const executeDelete = async () => {
            try {
                await onDelete(record);
                onShowModal({ type: 'success', title: 'Eliminado', message: 'Registro eliminado con éxito.' });
                setIsModalOpen(false);
                setEditingRecord(null);
            } catch (error) {
                console.error("Failed to delete:", error);
                onShowModal({ type: 'error', title: 'Error', message: "Hubo un error al eliminar el registro." });
            }
        };

        if (showDeleteConfirm) {
            return (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 text-center">
                        <div className="mb-4">
                            <svg className="mx-auto mb-4 w-12 h-12 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            <h3 className="mb-5 text-lg font-normal text-gray-500">¿Estás seguro de que deseas eliminar este registro?</h3>
                            <button onClick={executeDelete} type="button" className="text-white bg-red-600 hover:bg-red-800 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-sm inline-flex items-center px-5 py-2.5 text-center mr-2">
                                Sí, eliminar
                            </button>
                            <button onClick={() => setShowDeleteConfirm(false)} type="button" className="text-gray-500 bg-white hover:bg-gray-100 focus:ring-4 focus:outline-none focus:ring-gray-200 rounded-lg border border-gray-200 text-sm font-medium px-5 py-2.5 hover:text-gray-900 focus:z-10">
                                No, cancelar
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                    <div className="p-4 border-b flex justify-between items-center">
                        <h2 className="text-xl font-bold">Territorio {record.terrNum} (Vuelta {record.vueltaNum})</h2>
                        <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">&times;</button>
                    </div>
                    <div className="p-4 space-y-4">
                        <div><label htmlFor="asignadoA" className="block text-sm font-medium">Asignado a:</label><input type="text" id="asignadoA" value={record.asignadoA || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded" /></div>
                        <div><label htmlFor="assignedDate" className="block text-sm font-medium">Fecha en que se asignó:</label><input type="date" id="assignedDate" value={record.assignedDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded" /></div>
                        <div><label htmlFor="completedDate" className="block text-sm font-medium">Fecha en que se completó:</label><input type="date" id="completedDate" value={record.completedDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded" /></div>
                        <div><label htmlFor="observations" className="block text-sm font-medium">Observaciones:</label><textarea id="observations" value={record.observations || ''} onChange={handleChange} rows={3} className="mt-1 w-full p-2 border rounded" /></div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-between">
                        {record.id ? (
                            <button type="button" onClick={() => setShowDeleteConfirm(true)} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Eliminar</button>
                        ) : <div></div>}
                        <div>
                            <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded mr-2">Cancelar</button>
                            <button onClick={() => handleSave(record)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Guardar</button>
                        </div>
                    </div>
                </div>
            </div>
        )
    };

    const ResponsibleModal = () => {
        const [selectedPublisherId, setSelectedPublisherId] = useState('');

        if (!isResponsibleModalOpen) return null;

        const handleAssign = async () => {
            const publisher = publishers.find(p => p.id === selectedPublisherId);
            if (!publisher) {
                onShowModal({ type: 'error', title: 'Error', message: 'Por favor seleccione un publicador.' });
                return;
            }

            const fullName = [publisher.Nombre, publisher.Apellido, publisher['2do Apellido']]
                .filter(Boolean)
                .join(' ');

            try {
                await onSaveTerritoryResponsible(publisher.id, fullName || publisher.Nombre || 'Sin nombre');
                setIsResponsibleModalOpen(false);
                setSelectedPublisherId('');
            } catch (error) {
                // Error already handled by the handler
            }
        };

        const malePublishers = publishers
            .filter(p => p.Sexo === 'Hombre' && p.Nombre)
            .sort((a, b) => (a.Nombre || '').localeCompare(b.Nombre || ''));

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                    <div className="p-4 border-b">
                        <h2 className="text-xl font-bold">Asignar Responsable de Territorio</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        <div>
                            <label htmlFor="publisher-select" className="block text-sm font-medium mb-2">
                                Seleccionar Publicador (Varones):
                            </label>
                            <select
                                id="publisher-select"
                                value={selectedPublisherId}
                                onChange={(e) => setSelectedPublisherId(e.target.value)}
                                className="w-full p-2 border rounded"
                            >
                                <option value="">-- Seleccione --</option>
                                {malePublishers.map(p => {
                                    const fullName = [p.Nombre, p.Apellido, p['2do Apellido']] // Simplified for males usually
                                        .filter(Boolean)
                                        .join(' ');
                                    return (
                                        <option key={p.id} value={p.id}>{fullName}</option>
                                    );
                                })}
                            </select>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-end gap-2">
                        <button
                            onClick={() => setIsResponsibleModalOpen(false)}
                            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleAssign}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Asignar
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const DailyAssignmentModal = () => {
        const today = new Date().toISOString().split('T')[0];
        const [formData, setFormData] = useState<Partial<DailyTerritoryAssignment>>({
            date: today,
            vueltaNum: 1,
            territories: [],
            captain: '',
            assignedDate: today,
            completedDate: '',
            observations: '',
            ...editingDailyAssignment
        });

        useEffect(() => {
            if (editingDailyAssignment) {
                setFormData({ ...editingDailyAssignment });
            } else {
                setFormData({
                    date: today,
                    vueltaNum: 1,
                    territories: [],
                    captain: '',
                    assignedDate: today,
                    completedDate: '',
                    observations: ''
                });
            }
        }, [editingDailyAssignment, isDailyAssignmentModalOpen]);

        useEffect(() => {
            if (editingDailyAssignment) return; // Don't auto-update if editing an existing assignment

            if (!formData.territories || formData.territories.length === 0) return;

            // Calculate Service Year based on the assignment date
            const targetServiceYear = getServiceYearForDate(formData.date!);

            // Auto-deduce vuelta number — ONLY within the target service year to avoid
            // carrying over high vuelta numbers from previous years into the new year.
            let maxNextVuelta = 1;

            formData.territories.forEach(terrNum => {
                // Filter records for this specific territory within the TARGET service year only
                const specificRecords = records.filter(r =>
                    String(r.terrNum) == String(terrNum) &&
                    r.serviceYear === targetServiceYear
                );

                const vueltas = specificRecords.map(r => Number(r.vueltaNum)).sort((a, b) => b - a);

                if (vueltas.length > 0) {
                    const lastVuelta = vueltas[0];
                    const lastRecord = specificRecords.find(r => Number(r.vueltaNum) === lastVuelta);

                    if (lastRecord?.completedDate) {
                        maxNextVuelta = Math.max(maxNextVuelta, lastVuelta + 1);
                    } else {
                        maxNextVuelta = Math.max(maxNextVuelta, lastVuelta);
                    }
                }
            });

            setFormData(prev => ({ ...prev, vueltaNum: maxNextVuelta }));
        }, [formData.territories, formData.date, records]);

        if (!isDailyAssignmentModalOpen) return null;

        const handleSaveAssignment = async () => {
            if (!formData.territories || formData.territories.length === 0) {
                onShowModal({ type: 'error', title: 'Error', message: 'Debe seleccionar al menos un territorio.' });
                return;
            }
            if (!formData.captain) {
                onShowModal({ type: 'error', title: 'Error', message: 'Debe asignar un capitán.' });
                return;
            }

            if (formData.assignedDate && formData.completedDate) {
                if (new Date(formData.assignedDate) > new Date(formData.completedDate)) {
                    onShowModal({ type: 'error', title: 'Error de Fechas', message: 'La fecha de asignación no puede ser posterior a la fecha de completado.' });
                    return;
                }
            }

            // Explicitly construct the object to ensure all fields are saved, especially empty strings
            const assignmentData: any = {
                date: formData.date,
                vueltaNum: formData.vueltaNum,
                territories: formData.territories,
                captain: formData.captain,
                assignedDate: formData.assignedDate || '',
                completedDate: formData.completedDate || '', // Ensure this is saved even if empty
                observations: formData.observations || ''
            };

            try {
                if (formData.id) {
                    await onUpdateDailyAssignment(formData.id, assignmentData);
                } else {
                    await onSaveDailyAssignment(assignmentData);
                }

                // Sync with Main Registry (Grid)
                if (formData.territories && formData.territories.length > 0) {
                    const targetServiceYear = getServiceYearForDate(formData.date!);

                    for (const terrNum of formData.territories) {
                        // Find existing record in the FULL records list
                        const existingRecord = records.find(r =>
                            r.terrNum === terrNum &&
                            r.vueltaNum === formData.vueltaNum &&
                            r.serviceYear === targetServiceYear
                        );

                        const recordToSave: Omit<TerritoryRecord, 'id'> = {
                            terrNum: terrNum,
                            vueltaNum: formData.vueltaNum!,
                            serviceYear: targetServiceYear,
                            asignadoA: formData.captain || '',
                            assignedDate: formData.assignedDate || '',
                            completedDate: formData.completedDate || '',
                            observations: formData.observations || '',
                            ...(existingRecord?.id ? { id: existingRecord.id } : {})
                        } as any;

                        await onSave(recordToSave);

                        // Fix 3: Sync map marker status so the interactive map reflects
                        // the assignment/completion state without needing a separate action.
                        const marker = territoryMarkers.find(m => m.terrNum === terrNum);
                        if (marker) {
                            let newMarkerStatus: 'available' | 'assigned' | 'completed' = 'available';
                            if (formData.assignedDate && !formData.completedDate) {
                                newMarkerStatus = 'assigned';
                            } else if (formData.completedDate) {
                                newMarkerStatus = 'completed';
                            }
                            await onSaveTerritoryMarker({ ...marker, status: newMarkerStatus });
                        }
                    }
                }

                setIsDailyAssignmentModalOpen(false);
                setEditingDailyAssignment(null);
            } catch (error) {
                // Error already handled
                console.error("Error saving daily assignment:", error);
            }
        };

        const handleDeleteAssignment = async () => {
            if (!formData.id) return;
            if (window.confirm('¿Está seguro de que desea eliminar esta asignación?')) {
                try {
                    await onDeleteDailyAssignment(formData.id);
                    setIsDailyAssignmentModalOpen(false);
                    setEditingDailyAssignment(null);
                } catch (error) {
                    // Error already handled
                }
            }
        };

        const toggleTerritory = (terrNum: number) => {
            const current = formData.territories || [];
            if (current.includes(terrNum)) {
                setFormData({ ...formData, territories: current.filter(t => t !== terrNum) });
            } else {
                setFormData({ ...formData, territories: [...current, terrNum].sort((a, b) => a - b) });
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4 overflow-y-auto">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8">
                    <div className="p-4 border-b">
                        <h2 className="text-xl font-bold">
                            {formData.id ? 'Editar' : 'Nueva'} Asignación de Territorios
                        </h2>
                    </div>
                    <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Fecha:</label>
                                <input
                                    type="date"
                                    value={formData.date || ''}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Número de Vuelta:</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.vueltaNum || 1}
                                    onChange={(e) => setFormData({ ...formData, vueltaNum: parseInt(e.target.value) || 1 })}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Territorios a Trabajar (Seleccione múltiples):
                            </label>
                            <div className="border rounded p-3 max-h-40 overflow-y-auto bg-gray-50">
                                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                                    {Array.from({ length: 40 }, (_, i) => i + 1).map(num => (
                                        <button
                                            key={num}
                                            type="button"
                                            onClick={() => toggleTerritory(num)}
                                            className={`p-2 rounded text-sm font-medium transition-colors ${(formData.territories || []).includes(num)
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white border hover:bg-gray-100'
                                                }`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                                Seleccionados: {(formData.territories || []).join(', ') || 'Ninguno'}
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Capitán Asignado:</label>
                            <select
                                value={formData.captain || ''}
                                onChange={(e) => setFormData({ ...formData, captain: e.target.value })}
                                className="w-full p-2 border rounded"
                            >
                                <option value="">-- Seleccione --</option>
                                {publishers
                                    .filter(p => p.Nombre && p.Sexo === 'Hombre')
                                    .sort((a, b) => (a.Nombre || '').localeCompare(b.Nombre || ''))
                                    .map(p => (
                                        <option key={p.id} value={p.Nombre}>{p.Nombre} {p.Apellido}</option>
                                    ))
                                }
                            </select>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Fecha de Asignación:</label>
                                <input
                                    type="date"
                                    value={formData.assignedDate || ''}
                                    onChange={(e) => setFormData({ ...formData, assignedDate: e.target.value })}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Fecha de Completado:</label>
                                <input
                                    type="date"
                                    value={formData.completedDate || ''}
                                    onChange={(e) => setFormData({ ...formData, completedDate: e.target.value })}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Observaciones:</label>
                            <textarea
                                value={formData.observations || ''}
                                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                                rows={3}
                                className="w-full p-2 border rounded"
                                placeholder="Notas adicionales..."
                            />
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-between">
                        {formData.id ? (
                            <button
                                onClick={handleDeleteAssignment}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Eliminar
                            </button>
                        ) : <div></div>}
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    setIsDailyAssignmentModalOpen(false);
                                    setEditingDailyAssignment(null);
                                }}
                                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveAssignment}
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const CampaignModal = () => {
        const today = new Date().toISOString().split('T')[0];
        const [formData, setFormData] = useState<Partial<Campaign>>({
            name: '',
            startDate: today,
            endDate: today,
            ...editingCampaign
        });

        useEffect(() => {
            if (editingCampaign) {
                setFormData({ ...editingCampaign });
            } else {
                setFormData({
                    name: '',
                    startDate: today,
                    endDate: today
                });
            }
        }, [isCampaignModalOpen]);

        if (!isCampaignModalOpen) return null;

        const handleSave = async () => {
            if (!formData.name || !formData.startDate || !formData.endDate) {
                onShowModal({ type: 'error', title: 'Error', message: 'Todos los campos son obligatorios.' });
                return;
            }
            if (formData.startDate > formData.endDate) {
                onShowModal({ type: 'error', title: 'Error de Fechas', message: 'La fecha de inicio no puede ser posterior a la de conclusión.' });
                return;
            }
            await onSaveCampaign(formData as Omit<Campaign, 'id'>);
            setIsCampaignModalOpen(false);
            setEditingCampaign(null);
        };

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[60] p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="bg-gradient-to-r from-yellow-500 to-amber-600 p-6">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <span>📢</span> {editingCampaign?.id ? 'Editar Campaña' : 'Nueva Campaña Especial'}
                        </h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Nombre de la Campaña</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                placeholder="Ej: Invitación a la Conmemoración"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Inicio</label>
                                <input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Conclusión</label>
                                <input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                                />
                            </div>
                        </div>
                        {editingCampaign?.id && (
                            <button
                                onClick={async () => {
                                    if (window.confirm('¿Eliminar esta campaña?')) {
                                        await onDeleteCampaign(editingCampaign.id!);
                                        setIsCampaignModalOpen(false);
                                        setEditingCampaign(null);
                                    }
                                }}
                                className="w-full py-2.5 text-red-600 font-bold border-2 border-red-200 rounded-xl hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                            >
                                <span>🗑️</span> Eliminar Campaña
                            </button>
                        )}
                    </div>
                    <div className="bg-gray-50 p-6 flex gap-3">
                        <button
                            onClick={() => { setIsCampaignModalOpen(false); setEditingCampaign(null); }}
                            className="flex-1 py-3 text-gray-600 font-bold bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200"
                        >
                            Guardar
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const DesktopTable = ({ startTerr, endTerr }: { startTerr: number, endTerr: number }) => {
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
                            const cellClasses = canManage ? 'cursor-pointer hover:bg-blue-50' : '';

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
                                            const { highlightClass, label } = getCampaignHighlight(terrNum, vueltaNum);
                                            return (
                                                <td colSpan={2} key={vueltaNum} onClick={() => handleOpenModal(terrNum, vueltaNum)} className={`p-1 md:p-2 border border-gray-400 text-center font-semibold align-bottom ${cellClasses} ${highlightClass}`}>
                                                    <div className="flex flex-col items-center">
                                                        <span>{vueltaData?.asignadoA || '\u00A0'}</span>
                                                        {label && <span className="text-[7px] leading-tight px-1 bg-black/20 rounded mt-0.5 whitespace-nowrap">{label}</span>}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    <tr className="h-8">
                                        {vueltasRange.map(vueltaNum => {
                                            const { highlightClass } = getCampaignHighlight(terrNum, vueltaNum);
                                            const vueltaData = terrData.vueltas[vueltaNum];
                                            return (
                                                <React.Fragment key={vueltaNum}>
                                                    <td onClick={() => handleOpenModal(terrNum, vueltaNum)} className={`p-1 md:p-2 border border-gray-400 text-center ${cellClasses} ${highlightClass}`}>{vueltaData?.assignedDate || '\u00A0'}</td>
                                                    <td onClick={() => handleOpenModal(terrNum, vueltaNum)} className={`p-1 md:p-2 border border-gray-400 text-center ${cellClasses} ${highlightClass}`}>{vueltaData?.completedDate || '\u00A0'}</td>
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
                                const cellClasses = canManage ? 'cursor-pointer' : '';
                                const { highlightClass, label } = getCampaignHighlight(terrNum, vueltaNum);
                                const cardBgClass = highlightClass !== '' ? highlightClass : 'bg-gray-50 border-gray-200';

                                return (
                                    <div key={vueltaNum} onClick={() => handleOpenModal(terrNum, vueltaNum)} className={`p-3 rounded-md border ${cardBgClass} ${cellClasses}`}>
                                        <p className={`font-semibold ${highlightClass ? 'text-black' : 'text-gray-800'}`}>
                                            Vuelta {vueltaNum}: {vueltaData?.asignadoA || <span className="text-gray-400 italic">Sin asignar</span>}
                                            {label && <span className="ml-2 text-[10px] bg-black/10 px-1 rounded">{label}</span>}
                                        </p>
                                        {vueltaData?.asignadoA && (
                                            <p className={`text-xs mt-1 ${highlightClass ? 'text-gray-800' : 'text-gray-600'}`}>
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
                <div className="fixed inset-0 bg-black bg-opacity-75 overflow-y-auto z-50 p-4" onClick={() => setViewingMapUrl(null)}>
                    <div className="min-h-full flex flex-col justify-center items-center py-8">
                        <img src={viewingMapUrl} alt="Mapa de territorio" className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()} />

                        {/* Round Indicator for Global Map */}
                        {['global', 'global-numerado'].includes(territoryMaps.find(m => m.mapUrl === viewingMapUrl)?.territoryId || '') && (
                            <div className="absolute top-4 left-4 z-10 bg-blue-600/90 text-white px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm border border-blue-400/50" onClick={(e) => e.stopPropagation()}>
                                <p className="text-xs uppercase tracking-wider opacity-80 font-semibold mb-1">Vuelta Actual</p>
                                <p className="text-2xl font-black">{calculateTerritoryStats.currentRound}</p>
                                {territoryMaps.find(m => m.territoryId === 'global-numerado') && (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const map = territoryMaps.find(m => m.territoryId === 'global-numerado');
                                            if (map) setViewingMapUrl(map.mapUrl);
                                        }}
                                        className="mt-2 w-full py-1 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold transition-colors"
                                    >
                                        Ver Numerado
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Show worked territories indicator for global map */}
                        {['global', 'global-numerado'].includes(territoryMaps.find(m => m.mapUrl === viewingMapUrl)?.territoryId || '') && (
                            <div
                                className="mt-4 backdrop-blur-md bg-black/70 text-white px-6 py-4 rounded-xl shadow-2xl max-w-4xl border border-white/20"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 border-b border-white/20 pb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: viewingVueltaMode === 'current' ? '#39FF14' : '#00D1FF', boxShadow: viewingVueltaMode === 'current' ? '0 0 10px #39FF14' : '0 0 10px #00D1FF' }}></div>
                                        <h3 className="text-lg font-bold tracking-wide">
                                            Territorios Trabajados: {viewingVueltaMode === 'current' ? `Vuelta ${calculateTerritoryStats.currentRound}` : `Vuelta ${calculateTerritoryStats.currentRound - 1}`}
                                        </h3>
                                    </div>
                                    <div className="flex bg-white/10 p-1 rounded-lg border border-white/10">
                                        <button 
                                            onClick={() => setViewingVueltaMode('previous')}
                                            disabled={calculateTerritoryStats.currentRound <= 1}
                                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-black transition-all ${viewingVueltaMode === 'previous' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white disabled:opacity-30'}`}
                                        >
                                            V. Anterior
                                        </button>
                                        <button 
                                            onClick={() => setViewingVueltaMode('current')}
                                            className={`px-3 py-1 rounded-md text-[10px] uppercase font-black transition-all ${viewingVueltaMode === 'current' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            V. Actual
                                        </button>
                                    </div>
                                </div>
                                
                                {((viewingVueltaMode === 'current' ? currentVueltaWorked : previousVueltaWorked).length > 0) ? (
                                    <>
                                        <div className="flex flex-wrap gap-2 justify-center max-h-[20vh] overflow-y-auto p-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}>
                                            {(viewingVueltaMode === 'current' ? currentVueltaWorked : previousVueltaWorked).map(terrNum => (
                                                <span
                                                    key={terrNum}
                                                    className="px-3 py-1 rounded-full font-bold text-sm transition-transform hover:scale-110 cursor-default"
                                                    style={{
                                                        backgroundColor: viewingVueltaMode === 'current' ? 'rgba(57, 255, 20, 0.2)' : 'rgba(0, 209, 255, 0.2)',
                                                        border: `1px solid ${viewingVueltaMode === 'current' ? '#39FF14' : '#00D1FF'}`,
                                                        color: viewingVueltaMode === 'current' ? '#39FF14' : '#00D1FF',
                                                        boxShadow: `0 0 5px ${viewingVueltaMode === 'current' ? 'rgba(57, 255, 20, 0.3)' : 'rgba(0, 209, 255, 0.3)'}`
                                                    }}
                                                >
                                                    {terrNum}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-300 mt-3 text-center uppercase tracking-wider font-semibold">
                                            Total: {(viewingVueltaMode === 'current' ? currentVueltaWorked : previousVueltaWorked).length} completados
                                        </p>
                                    </>
                                ) : (
                                    <div className="py-6 text-center text-gray-400 italic text-sm">
                                        No hay territorios registrados como completados en esta vuelta.
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-4 flex gap-4" onClick={(e) => e.stopPropagation()}>
                            {onDownload && (
                                <button
                                    onClick={() => {
                                        const map = territoryMaps.find(m => m.mapUrl === viewingMapUrl);
                                        const termNum = map ? map.territoryId : 'desconocido';
                                        onDownload(viewingMapUrl, `mapa_territorio_${termNum}.webp`);
                                    }}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 shadow-lg flex items-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
                                    </svg>
                                    Descargar Mapa
                                </button>
                            )}
                            <button onClick={() => setViewingMapUrl(null)} className="px-6 py-2 bg-white text-gray-800 rounded-full font-bold hover:bg-gray-100 shadow-lg">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <CrudModal />
            <ResponsibleModal />
            <DailyAssignmentModal />
            <CampaignModal />
            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto pb-1 scrollbar-hide" aria-label="Tabs">
                    <button onClick={() => setActiveTab('registro')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'registro' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Registro de Asignaciones
                    </button>
                    <button onClick={() => setActiveTab('mapas')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'mapas' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Mapas de Territorio
                    </button>
                    <button onClick={() => setActiveTab('estadisticas')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'estadisticas' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Estadísticas
                    </button>
                    <button onClick={() => setActiveTab('mapa')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'mapa' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Mapa Interactivo
                    </button>
                </nav>
            </div>

            {activeTab === 'mapa' && (
                <div className="fade-in-up">
                    <InteractiveMap 
                        maps={territoryMaps} 
                        markers={territoryMarkers} 
                        records={records}
                        onSaveMarker={onSaveTerritoryMarker} 
                        onDeleteMarker={onDeleteTerritoryMarker}
                        onSaveRecord={onSave}
                        onDeleteRecord={onDelete}
                        onResetCompletedMarkers={handleResetCompletedMarkers}
                        canManage={canManage} 
                        onShowModal={onShowModal} 
                        currentServiceYear={currentServiceYear}
                    />
                </div>
            )}

            {activeTab === 'registro' && (
                <>
                    {/* Territory Responsible Section */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg shadow-md mb-4 border border-blue-200">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Responsable de Asignación de Territorio</h3>
                                {territoryResponsible ? (() => {
                                    const responsiblePublisher = publishers.find(p => p.id === territoryResponsible.publisherId);
                                    const photoUrl = responsiblePublisher?.Foto || DEFAULT_AVATAR;
                                    return (
                                        <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                            <img
                                                src={photoUrl}
                                                alt="Responsable"
                                                className="w-12 h-12 rounded-full object-cover border-2 border-blue-200"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    if (target.src !== DEFAULT_AVATAR) {
                                                        target.src = DEFAULT_AVATAR;
                                                    }
                                                }}
                                            />
                                            <div className="text-sm text-gray-700">
                                                <p className="font-bold text-blue-800 text-lg">{territoryResponsible.publisherName}</p>
                                                <p className="text-xs text-gray-500 font-medium">Asignado el: {territoryResponsible.assignedDate}</p>
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <p className="text-sm text-gray-600 italic bg-white p-3 rounded-lg border border-gray-200">No hay responsable asignado</p>
                                )}
                            </div>
                            {isCommitteeMember && (
                                <button
                                    onClick={() => setIsResponsibleModalOpen(true)}
                                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                                >
                                    {territoryResponsible ? 'Cambiar Responsable' : 'Asignar Responsable'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Campañas Section */}
                    <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-4 rounded-lg shadow-md mb-6 border border-yellow-200">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Campañas Especiales</h3>
                                <p className="text-xs text-amber-700 font-medium italic">Los registros en estas fechas se resaltarán: Vuelta 1 (Amarillo), Vuelta 2 (Verde Limón), etc.</p>
                            </div>
                            {isCommitteeMember && (
                                <button
                                    onClick={() => { setEditingCampaign(null); setIsCampaignModalOpen(true); }}
                                    className="px-3 py-1.5 bg-amber-500 text-white text-sm font-bold rounded-lg hover:bg-amber-600 transition-all shadow-sm"
                                >
                                    + Nueva Campaña
                                </button>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {(campaigns || []).length > 0 ? (
                                (campaigns || []).map(campaign => (
                                    <div
                                        key={campaign.id}
                                        onClick={() => isCommitteeMember && (setEditingCampaign(campaign), setIsCampaignModalOpen(true))}
                                        className={`flex items-center gap-3 bg-white p-3 rounded-xl border border-amber-100 shadow-sm transition-all ${isCommitteeMember ? 'cursor-pointer hover:border-amber-300 hover:shadow-md' : ''}`}
                                    >
                                        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-xl">📢</div>
                                        <div>
                                            <p className="font-bold text-amber-900 text-sm">{campaign.name}</p>
                                            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                                                {campaign.startDate} al {campaign.endDate}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-amber-700 italic">No hay campañas activas registradas.</p>
                            )}
                        </div>
                    </div>

                    {/* Daily Assignments Section */}
                    <div className="bg-white p-4 rounded-lg shadow-md mb-6 border">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                            <h3 className="text-lg font-bold text-gray-800">Territorios Asignados</h3>
                            <div className="flex gap-2 flex-wrap">
                                {dailyAssignments.length > 0 && (
                                    <button
                                        onClick={exportToPDF}
                                        className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 transition-colors whitespace-nowrap flex items-center gap-2"
                                        title="Exportar a PDF"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                        Exportar PDF
                                    </button>
                                )}
                                {canManage && (
                                    <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                                        <button
                                            onClick={() => {
                                                setEditingDailyAssignment({
                                                    date: new Date().toISOString().split('T')[0],
                                                    assignedDate: new Date().toISOString().split('T')[0],
                                                    completedDate: new Date().toISOString().split('T')[0],
                                                    observations: 'Registro de trabajo anterior.'
                                                } as any);
                                                setIsDailyAssignmentModalOpen(true);
                                            }}
                                            className="flex-1 sm:flex-initial px-3 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all active:scale-95 shadow-md text-xs sm:text-sm whitespace-nowrap"
                                        >
                                            + Registrar Trabajo Terminado
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditingDailyAssignment(null);
                                                setIsDailyAssignmentModalOpen(true);
                                            }}
                                            className="flex-1 sm:flex-initial px-3 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all active:scale-95 shadow-md text-xs sm:text-sm whitespace-nowrap"
                                        >
                                            + Nueva Asignación
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {displayedAssignments.length > 0 ? (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {displayedAssignments.map(assignment => (
                                    <div
                                        key={assignment.id}
                                        className="p-3 bg-gray-50 rounded border hover:bg-blue-50 transition-colors"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                                            <div
                                                className={`flex-1 ${canManage ? 'cursor-pointer' : ''}`}
                                                onClick={() => {
                                                    if (canManage) {
                                                        setEditingDailyAssignment(assignment);
                                                        setIsDailyAssignmentModalOpen(true);
                                                    }
                                                }}
                                            >
                                                <p className="font-semibold text-gray-800">
                                                    {assignment.date} - Vuelta {assignment.vueltaNum}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Capitán: <span className="font-medium">{assignment.captain}</span>
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    Territorios: {assignment.territories.join(', ')}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendWhatsAppNotification(assignment);
                                                    }}
                                                    className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors flex items-center gap-1 text-sm"
                                                    title="Notificar por WhatsApp"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                                    </svg>
                                                    WhatsApp
                                                </button>
                                                {assignment.completedDate && (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full whitespace-nowrap">
                                                        ✓ Completado
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-gray-500 py-4">No hay asignaciones registradas</p>
                        )}
                    </div>

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
                                    className="w-full p-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 mb-2"
                                >
                                    Ver Mapa Global
                                </button>
                                {territoryMaps.find(m => m.territoryId === 'global-numerado') && (
                                    <button
                                        onClick={() => {
                                            const map = territoryMaps.find(m => m.territoryId === 'global-numerado');
                                            if (map) setViewingMapUrl(map.mapUrl);
                                        }}
                                        className="w-full p-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700"
                                    >
                                        Ver Mapa Global Numerado
                                    </button>
                                )}
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
                        <div className="bg-white p-2 sm:p-4 rounded-lg shadow-md"><DesktopTable startTerr={1} endTerr={20} /></div>
                        <div className="bg-white p-2 sm:p-4 rounded-lg shadow-md"><DesktopTable startTerr={21} endTerr={40} /></div>
                    </div>
                </>
            )
            }

            {
                activeTab === 'mapas' && (
                    <MapManager maps={territoryMaps} onUpload={onUploadMap} onDelete={onDeleteMap} canManage={canManage} setViewingMapUrl={setViewingMapUrl} onShowModal={onShowModal} onDownload={onDownload} />
                )
            }

            {
                activeTab === 'estadisticas' && (
                    <div className="space-y-6">
                        <header className="bg-white p-4 rounded-lg shadow-md mb-6">
                            <h1 className="text-xl sm:text-2xl font-bold text-center">ESTADÍSTICAS DE TERRITORIO</h1>
                            <p className="text-center text-gray-500 text-sm mt-1">Año de Servicio {currentServiceYear}</p>
                        </header>

                        {/* Quick Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
                                <p className="text-sm text-gray-500 font-medium">Progreso Vuelta {calculateTerritoryStats.currentRound}</p>
                                <p className="text-2xl font-bold text-gray-800">{calculateTerritoryStats.percentage}%</p>
                                <p className="text-xs text-gray-400 mt-1">{calculateTerritoryStats.completed} de {calculateTerritoryStats.totalTerritories} completados</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
                                <p className="text-sm text-gray-500 font-medium">Asignaciones Diarias</p>
                                <p className="text-2xl font-bold text-gray-800">{calculateTerritoryStats.totalAssignments}</p>
                                <p className="text-xs text-gray-400 mt-1">{calculateTerritoryStats.completedAssignments} completadas / {calculateTerritoryStats.pendingAssignments} pendientes</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
                                <p className="text-sm text-gray-500 font-medium">Tiempo Promedio</p>
                                <p className="text-2xl font-bold text-gray-800">{calculateTerritoryStats.avgCompletionDays} días</p>
                                <p className="text-xs text-gray-400 mt-1">Para completar un territorio</p>
                            </div>
                            <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-red-500">
                                <p className="text-sm text-gray-500 font-medium">Pendientes Críticos</p>
                                <p className="text-2xl font-bold text-gray-800">{calculateTerritoryStats.oldPendingCount}</p>
                                <p className="text-xs text-gray-400 mt-1">Más de 30 días sin completar</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Progress Bar and Details */}
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Cobertura de la Vuelta Actual</h3>
                                <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                                    <div
                                        className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                                        style={{ width: `${calculateTerritoryStats.percentage}%` }}
                                    ></div>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Territorios Completados</span>
                                        <span className="font-bold text-green-600">{calculateTerritoryStats.completed}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Territorios Pendientes</span>
                                        <span className="font-bold text-red-500">{calculateTerritoryStats.pending}</span>
                                    </div>
                                    <div className="pt-4 border-t">
                                        <h4 className="text-sm font-bold text-gray-700 mb-2">No trabajados en esta vuelta:</h4>
                                        <div className="flex flex-wrap gap-1">
                                            {calculateTerritoryStats.notWorkedThisRound.length > 0 ? (
                                                calculateTerritoryStats.notWorkedThisRound.map(num => (
                                                    <span key={num} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border">
                                                        {num}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-green-600 font-medium">¡Todos los territorios han sido asignados!</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Top Captains */}
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h3 className="text-lg font-bold text-gray-800 mb-4">Capitanes con Más Asignaciones</h3>
                                {calculateTerritoryStats.topCaptains.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left border-b">
                                                    <th className="pb-2 font-bold text-gray-600">Capitán</th>
                                                    <th className="pb-2 font-bold text-gray-600 text-center">Asignaciones</th>
                                                    <th className="pb-2 font-bold text-gray-600 text-center">Efectividad</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {calculateTerritoryStats.topCaptains.map((cap, i) => (
                                                    <tr key={cap.name} className="hover:bg-gray-50">
                                                        <td className="py-3 font-medium text-gray-800">{i + 1}. {cap.name}</td>
                                                        <td className="py-3 text-center text-gray-600">{cap.count}</td>
                                                        <td className="py-3 text-center">
                                                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                                                                {Math.round((cap.completed / cap.count) * 100)}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-center text-gray-500 py-10 italic">No hay datos de capitanes todavía.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Territorios;