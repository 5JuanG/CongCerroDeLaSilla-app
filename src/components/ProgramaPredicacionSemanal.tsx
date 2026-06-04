
import React, { useState, useMemo } from 'react';
import { FieldServiceSchedule, Publisher, ModalInfo, TerritoryMarker, TerritoryMap, TerritoryRecord } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_AVATAR } from '../constants';

interface ProgramaPredicacionSemanalProps {
    schedules: FieldServiceSchedule[];
    publishers: Publisher[];
    territoryMarkers: TerritoryMarker[];
    territoryMaps: TerritoryMap[];
    territoryRecords: TerritoryRecord[];
    onSave: (schedule: Omit<FieldServiceSchedule, 'id'> & { id?: string }) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onShowModal: (info: ModalInfo) => void;
    canManage: boolean;
}

const ProgramaPredicacionSemanal: React.FC<ProgramaPredicacionSemanalProps> = ({
    schedules,
    publishers,
    territoryMarkers,
    territoryMaps,
    territoryRecords,
    onSave,
    onDelete,
    onShowModal,
    canManage
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<Partial<FieldServiceSchedule> | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'document' | 'cards'>('document');

    const filteredSchedules = useMemo(() => {
        return schedules
            .filter(s => s.date.includes(searchTerm) || s.meetingPlace.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                const dateCmp = a.date.localeCompare(b.date);
                if (dateCmp !== 0) return dateCmp;
                return (a.time || '').localeCompare(b.time || '');
            });
    }, [schedules, searchTerm]);

    const handleOpenModal = (schedule?: FieldServiceSchedule) => {
        setEditingSchedule(schedule || {
            date: new Date().toISOString().split('T')[0],
            meetingPlace: 'Salón del Reino',
            captainId: '',
            captainName: '',
            time: '09:00',
            period: 'Mañana',
            modality: 'Predicación de casa en casa',
            suggestedTerritories: [],
            notes: ''
        });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSchedule?.date || !editingSchedule?.meetingPlace || !editingSchedule?.captainId) {
            onShowModal({ type: 'error', title: 'Faltan Datos', message: 'Por favor complete todos los campos obligatorios.' });
            return;
        }

        try {
            await onSave(editingSchedule as FieldServiceSchedule);
            setIsModalOpen(false);
            setEditingSchedule(null);
            onShowModal({ type: 'success', title: 'Éxito', message: 'Programa de predicación guardado correctamente.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo guardar el programa.' });
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Está seguro de que desea eliminar este programa?')) {
            try {
                await onDelete(id);
                onShowModal({ type: 'success', title: 'Eliminado', message: 'Programa eliminado correctamente.' });
            } catch (error) {
                onShowModal({ type: 'error', title: 'Error', message: 'No se pudo eliminar el programa.' });
            }
        }
    };

    const generateSuggestions = (place: string): number[] => {
        let baseTerritory: number | null = null;
        const hostPublisher = publishers.find(p => p.esLugarEncuentro && `FAM. ${p.Familia || p.Apellido}, ${p.Dirección || ''}` === place);
        
        if (hostPublisher && hostPublisher.territorioCasa) {
            baseTerritory = hostPublisher.territorioCasa;
        }

        if (!baseTerritory) return [];

        const homeMarker = territoryMarkers.find(m => m.terrNum === baseTerritory);
        
        const availableNearby = territoryMarkers
            .filter(m => m.terrNum !== baseTerritory && m.status === 'available')
            .map(m => {
                const dist = homeMarker ? Math.sqrt(Math.pow(m.x - homeMarker.x, 2) + Math.pow(m.y - homeMarker.y, 2)) : 999;
                return { terrNum: m.terrNum, dist };
            })
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 2)
            .map(m => m.terrNum);

        const suggested = [];
        if (homeMarker && homeMarker.status === 'available') {
            suggested.push(baseTerritory);
        }
        
        return [...suggested, ...availableNearby].slice(0, 3).sort((a, b) => a - b);
    };

    const toggleTerritory = (num: number) => {
        if (!editingSchedule) return;
        const current = editingSchedule.suggestedTerritories || [];
        if (current.includes(num)) {
            setEditingSchedule({ ...editingSchedule, suggestedTerritories: current.filter(t => t !== num) });
        } else {
            setEditingSchedule({ ...editingSchedule, suggestedTerritories: [...current, num].sort((a, b) => a - b) });
        }
    };

    const generateWeeklyPDF = (schedulesToExport: FieldServiceSchedule[]) => {
        const doc = new jsPDF('p', 'mm', 'letter');
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Sort ascending by date then time
        const sortedSchedules = [...schedulesToExport].sort((a, b) => {
            const dtA = `${a.date}T${a.time || '00:00'}`;
            const dtB = `${b.date}T${b.time || '00:00'}`;
            return dtA.localeCompare(dtB);
        });

        // Group schedules by period
        const grouped = {
            'PREDICACIÓN POR LA MAÑANA': sortedSchedules.filter(s => s.period === 'Mañana'),
            'PREDICACIÓN POR LA TARDE': sortedSchedules.filter(s => s.period === 'Tarde'),
            'PREDICACIÓN POR LA NOCHE': sortedSchedules.filter(s => s.period === 'Noche')
        };

        // Title
        doc.setFillColor(0, 32, 96); // Dark Blue from image
        doc.rect(20, 10, pageWidth - 40, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('PROGRAMA DE PREDICACIÓN DE CASA EN CASA', pageWidth / 2, 17, { align: 'center' });

        let currentY = 25;

        Object.entries(grouped).forEach(([title, items]) => {
            if (items.length === 0) return;

            autoTable(doc, {
                startY: currentY,
                head: [[{ content: title, colSpan: 5, styles: { fillColor: [0, 32, 96], halign: 'center' } }],
                       ['DIA/FECHA', 'LUGAR DE ENCUENTRO', 'CAPITÁN', 'HORARIO', 'NOTAS']],
                body: items.map(s => [
                    new Date(s.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase(),
                    s.meetingPlace.toUpperCase(),
                    s.captainName.toUpperCase(),
                    s.time.toUpperCase(),
                    (s.notes || s.modality).toUpperCase()
                ]),
                theme: 'grid',
                styles: { 
                    fontSize: 8, 
                    cellPadding: 3, 
                    halign: 'center', 
                    valign: 'middle',
                    lineColor: [200, 200, 200],
                    lineWidth: 0.1
                },
                headStyles: { 
                    fillColor: [0, 32, 96], 
                    textColor: [255, 255, 255],
                    fontStyle: 'bold'
                },
                columnStyles: {
                    0: { cellWidth: 40 },
                    1: { cellWidth: 60 },
                    2: { cellWidth: 35 },
                    3: { cellWidth: 20 },
                    4: { cellWidth: 'auto' }
                }
            });

            currentY = (doc as any).lastAutoTable.finalY + 10;
        });

        doc.save(`Programa_Semanal_Predicacion_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const generateIndividualPDF = async (schedule: FieldServiceSchedule) => {
        const doc = new jsPDF('p', 'mm', 'letter');
        const pageWidth = doc.internal.pageSize.getWidth();
        const captain = publishers.find(p => p.id === schedule.captainId);

        // Fix squashing: Define constants for photo size
        const PHOTO_SIZE = 40;
        const MARGIN = 20;

        // Header
        doc.setFillColor(0, 32, 96);
        doc.rect(0, 0, pageWidth, 35, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text('PROGRAMA DE PREDICACIÓN DIARIO', pageWidth / 2, 18, { align: 'center' });
        doc.setFontSize(10);
        doc.text(`CONGREGACIÓN CERRO DE LA SILLA`, pageWidth / 2, 25, { align: 'center' });

        let y = 45;
        doc.setTextColor(0, 32, 96);
        doc.setFontSize(14);
        doc.text('INFORMACIÓN DEL ENCUENTRO', MARGIN, y);
        y += 8;

        autoTable(doc, {
            startY: y,
            body: [
                ['FECHA:', new Date(schedule.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
                ['LUGAR:', schedule.meetingPlace],
                ['HORARIO:', `${schedule.time} (${schedule.period})`],
                ['MODALIDAD:', schedule.modality],
                ['NOTAS:', schedule.notes || '---']
            ],
            theme: 'plain',
            styles: { fontSize: 11, cellPadding: 2 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
        });

        y = (doc as any).lastAutoTable.finalY + 15;

        // Captain section with photo
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('CAPITÁN ASIGNADO', MARGIN, y);
        y += 10;

        if (captain) {
            if (captain.Foto) {
                try {
                    const img = new Image();
                    img.src = captain.Foto;
                    await new Promise(resolve => {
                        img.onload = resolve;
                        img.onerror = resolve;
                    });
                    
                    let imgWidth = PHOTO_SIZE;
                    let imgHeight = PHOTO_SIZE;
                    if (img.width && img.height) {
                        const ratio = img.width / img.height;
                        if (ratio > 1) { // Landscape
                            imgHeight = PHOTO_SIZE / ratio;
                        } else { // Portrait
                            imgWidth = PHOTO_SIZE * ratio;
                        }
                    }
                    doc.addImage(captain.Foto, 'WEBP', MARGIN, y, imgWidth, imgHeight, undefined, 'FAST');
                } catch (e) {}
            }
            const textX = captain.Foto ? MARGIN + PHOTO_SIZE + 10 : MARGIN;
            doc.setFontSize(13);
            doc.text(`${captain.Nombre} ${captain.Apellido}`, textX, y + 10);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Teléfono: ${captain.Cel || '---'}`, textX, y + 18);
            y += PHOTO_SIZE + 15;
        } else {
            y += 10;
        }

        // Territory Section
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('TERRITORIOS SUGERIDOS', MARGIN, y);
        y += 10;

        const terrs = schedule.suggestedTerritories.join(', ') || 'Sin sugerencias';
        doc.setFontSize(16);
        doc.setTextColor(37, 99, 235);
        doc.text(terrs, MARGIN, y);
        y += 15;

        // Vuelta & Progress Information
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const serviceYear = currentMonth >= 8 ? currentYear + 1 : currentYear;
        
        const yearRecords = territoryRecords.filter(r => r.serviceYear === serviceYear);
        let maxVuelta = yearRecords.length > 0 ? Math.max(...yearRecords.map(r => r.vueltaNum)) : 1;
        
        // Damping logic: si la vuelta más alta tiene pocos registros (<5) y la anterior tiene más, quedarse en la anterior
        if (maxVuelta > 1) {
            const countInMax = yearRecords.filter(r => r.vueltaNum === maxVuelta).length;
            if (countInMax < 5) {
                const countInPrev = yearRecords.filter(r => r.vueltaNum === maxVuelta - 1).length;
                if (countInPrev > 5) maxVuelta = maxVuelta - 1;
            }
        }
        
        const workedTerritories = yearRecords.filter(r => r.vueltaNum === maxVuelta && r.completedDate).map(r => r.terrNum).sort((a, b) => a - b);
        const allTerrs = Array.from({ length: 40 }, (_, i) => i + 1);
        const unworkedTerritories = allTerrs.filter(n => !workedTerritories.includes(n)).sort((a, b) => a - b);

        doc.setFontSize(14);
        doc.setTextColor(0, 32, 96);
        doc.setFont('helvetica', 'bold');
        doc.text(`PROGRESO - VUELTA EN CURSO: #${maxVuelta}`, MARGIN, y);
        y += 10;

        autoTable(doc, {
            startY: y,
            body: [
                ['TRABAJADOS:', workedTerritories.join(', ') || 'Ninguno'],
                ['DISPONIBLES:', unworkedTerritories.join(', ') || 'Ninguno']
            ],
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35, fillColor: [240, 245, 255] } }
        });

        // Map Section on Second Page
        doc.addPage();
        doc.setFillColor(0, 32, 96);
        doc.rect(0, 0, pageWidth, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('MAPA GLOBAL INTERACTIVO', pageWidth / 2, 16, { align: 'center' });

        const globalMap = territoryMaps.find(m => m.territoryId === 'global');
        if (globalMap) {
            try {
                const img = new Image();
                img.crossOrigin = "anonymous";
                await new Promise((resolve) => {
                    img.onload = resolve;
                    img.onerror = resolve;
                    img.src = globalMap.mapUrl;
                });

                const imgWidth = img.naturalWidth || 1000;
                const imgHeight = img.naturalHeight || 600;
                const aspectRatio = imgHeight / imgWidth;
                const availableWidth = pageWidth - (MARGIN * 2);
                
                // Maximize height for second page
                const finalMapHeight = Math.min(availableWidth * aspectRatio, 220);
                const finalMapWidth = finalMapHeight / aspectRatio;
                const offsetX = (availableWidth - finalMapWidth) / 2;
                const mapY = 35;

                doc.addImage(globalMap.mapUrl, 'WEBP', MARGIN + offsetX, mapY, finalMapWidth, finalMapHeight, undefined, 'FAST');
                
                // Draw markers
                territoryMarkers.forEach(m => {
                    const markerX = MARGIN + offsetX + (m.x / 100) * finalMapWidth;
                    const markerY = mapY + (m.y / 100) * finalMapHeight;
                    
                    doc.setFillColor(
                        m.status === 'completed' ? 34 : (m.status === 'assigned' ? 239 : (m.status === 'delayed' ? 249 : 107)),
                        m.status === 'completed' ? 197 : (m.status === 'assigned' ? 68 : (m.status === 'delayed' ? 115 : 114)),
                        m.status === 'completed' ? 94 : (m.status === 'assigned' ? 68 : (m.status === 'delayed' ? 22 : 128))
                    );
                    doc.circle(markerX, markerY, 2.5, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.setFontSize(6);
                    doc.setFont('helvetica', 'bold');
                    doc.text(m.terrNum.toString(), markerX, markerY, { align: 'center', baseline: 'middle' });
                });

                doc.setFontSize(10);
                doc.setTextColor(100, 100, 100);
                doc.text('Leyenda: Verde (Completado), Rojo (Asignado), Naranja (Atrasado), Gris (Disponible)', pageWidth / 2, mapY + finalMapHeight + 10, { align: 'center' });
            } catch (e) {}
        }

        doc.save(`Hoja_Trabajo_${schedule.date}_${schedule.captainName.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <div className="space-y-6 fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Programa Semanal de Predicación</h2>
                    <p className="text-slate-500 text-sm">Gestiona los lugares de encuentro y capitanes asignados.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0 items-stretch sm:items-center">
                    <input 
                        type="text" 
                        placeholder="Buscar por fecha o lugar..." 
                        className="w-full sm:w-auto px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    
                    {/* Selector de tipo de vista */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                        <button
                            type="button"
                            onClick={() => setViewMode('document')}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                viewMode === 'document' 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span>📄</span> <span className="whitespace-nowrap">Documento</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('cards')}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                viewMode === 'cards' 
                                    ? 'bg-white text-blue-600 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <span>🎴</span> <span className="whitespace-nowrap">Tarjetas</span>
                        </button>
                    </div>

                    <div className="flex gap-2">
                        <button 
                            type="button"
                            onClick={() => generateWeeklyPDF(filteredSchedules)}
                            className="flex-1 sm:flex-none justify-center px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2"
                        >
                            <span className="text-lg">📥</span> <span className="whitespace-nowrap">PDF Semanal</span>
                        </button>
                        {canManage && (
                            <button 
                                type="button"
                                onClick={() => handleOpenModal()}
                                className="flex-1 sm:flex-none justify-center px-4 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
                            >
                                <span>+</span> <span className="whitespace-nowrap">Nuevo Día</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {viewMode === 'document' ? (
                <div className="bg-white rounded-3xl p-6 md:p-10 shadow-xl border border-slate-100 max-w-5xl mx-auto my-2 fade-in relative overflow-hidden">
                    {/* Línea decorativa superior */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-900 via-blue-700 to-blue-950"></div>
                    
                    {/* Membrete del documento */}
                    <div className="border-b-2 border-slate-200 pb-6 mb-6 text-center">
                        <span className="text-[10px] font-black text-blue-800 tracking-[0.25em] uppercase block mb-1">CONGREGACIÓN CERRO DE LA SILLA</span>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">PROGRAMA DE TRABAJO DE PREDICACIÓN</h2>
                        <p className="text-slate-400 text-xs mt-1 font-semibold uppercase tracking-wider">Planificación de Lugares de Encuentro y Territorios Sugeridos</p>
                    </div>

                    {/* Tabla de Programa */}
                    {filteredSchedules.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <span className="text-3xl block mb-2">🔍</span>
                            No se encontraron programas de predicación.
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-100">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase text-[11px] tracking-wider">
                                        <th className="py-4 px-4 whitespace-nowrap">Día / Fecha</th>
                                        <th className="py-4 px-4">Lugar de Encuentro</th>
                                        <th className="py-4 px-4">Capitán Asignado</th>
                                        <th className="py-4 px-4">Modalidad / Notas</th>
                                        <th className="py-4 px-4">Territorios</th>
                                        <th className="py-4 px-4 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-700">
                                    {filteredSchedules.map((s) => (
                                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <div className="font-bold text-slate-800 text-sm">
                                                    {new Date(s.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
                                                </div>
                                                <div className="text-xs text-blue-600 font-extrabold mt-0.5 flex items-center gap-1">
                                                    <span>🕒</span> <span>{s.time}</span> <span className="px-1.5 py-0.5 bg-blue-50 text-[10px] rounded">{s.period}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-start gap-2 max-w-[200px] md:max-w-xs">
                                                    <span className="text-slate-400 text-base mt-0.5">📍</span>
                                                    <span className="font-semibold text-slate-700 leading-snug break-words">{s.meetingPlace}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                                        {s.captainName ? s.captainName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '👤'}
                                                    </div>
                                                    <span className="font-bold text-slate-800 text-xs">{s.captainName || 'Sin asignar'}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="font-semibold text-slate-700 text-xs">{s.modality}</div>
                                                {s.notes && <div className="text-[11px] text-slate-400 italic mt-0.5 max-w-[150px] md:max-w-xs break-words">{s.notes}</div>}
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex flex-wrap gap-1 max-w-[120px] md:max-w-[200px]">
                                                    {s.suggestedTerritories && s.suggestedTerritories.length > 0 ? (
                                                        s.suggestedTerritories.map(t => (
                                                            <span key={t} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[11px] font-black border border-blue-100 shadow-sm">
                                                                {t}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-xs text-slate-400 font-medium">Ninguno</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex justify-center items-center gap-1.5">
                                                    <button 
                                                        type="button"
                                                        onClick={() => generateIndividualPDF(s)}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 shadow-sm border border-slate-200/40"
                                                        title="Hoja de Trabajo PDF"
                                                    >
                                                        📄 <span className="hidden sm:inline">Hoja</span>
                                                    </button>
                                                    {canManage && (
                                                        <>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleOpenModal(s)}
                                                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all border border-slate-200/40 shadow-sm"
                                                                title="Editar"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleDelete(s.id)}
                                                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all border border-red-100/40 shadow-sm"
                                                                title="Eliminar"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSchedules.map(s => (
                        <div key={s.id} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 hover:shadow-xl transition-all group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 group-hover:bg-blue-100 transition-all"></div>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                            {s.period}
                                        </span>
                                        <h3 className="text-xl font-black text-slate-800 mt-2">
                                            {new Date(s.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', weekday: 'short' })}
                                        </h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-blue-600">{s.time}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <span className="text-lg">📍</span>
                                        <p className="text-sm font-medium">{s.meetingPlace}</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <span className="text-lg">👤</span>
                                        <p className="text-sm font-medium">Capitán: <span className="text-slate-800 font-bold">{s.captainName}</span></p>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-600">
                                        <span className="text-lg">🗺️</span>
                                        <p className="text-sm font-medium">Territorios: <span className="text-blue-600 font-bold">{s.suggestedTerritories.join(', ') || 'Ninguno'}</span></p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => generateIndividualPDF(s)}
                                        className="flex-1 py-2 bg-slate-100 text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        📄 Hoja Trabajo
                                    </button>
                                    {canManage && (
                                        <>
                                            <button 
                                                type="button"
                                                onClick={() => handleOpenModal(s)}
                                                className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all"
                                            >
                                                ✏️
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => handleDelete(s.id)}
                                                className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                                            >
                                                🗑️
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <h2 className="text-2xl font-black text-slate-800">
                                {editingSchedule?.id ? 'Editar' : 'Nuevo'} Programa
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Fecha</label>
                                    <input 
                                        type="date" 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                                        value={editingSchedule?.date || ''}
                                        onChange={e => setEditingSchedule({ ...editingSchedule!, date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Horario</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="time" 
                                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                                            value={editingSchedule?.time || '09:00'}
                                            onChange={e => setEditingSchedule({ ...editingSchedule!, time: e.target.value })}
                                            required
                                        />
                                        <select 
                                            className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                                            value={editingSchedule?.period || 'Mañana'}
                                            onChange={e => setEditingSchedule({ ...editingSchedule!, period: e.target.value as any })}
                                        >
                                            <option value="Mañana">Mañana</option>
                                            <option value="Tarde">Tarde</option>
                                            <option value="Noche">Noche</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Capitán Asignado</label>
                                <select 
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                                    value={editingSchedule?.captainId || ''}
                                    onChange={e => {
                                        const p = publishers.find(pub => pub.id === e.target.value);
                                        const currentPlace = editingSchedule?.meetingPlace || '';
                                        let newPlace = currentPlace;
                                        let suggested = editingSchedule?.suggestedTerritories || [];

                                        if (p && p.esLugarEncuentro && (!currentPlace || currentPlace === 'Salón del Reino' || currentPlace.startsWith('Casa de'))) {
                                            newPlace = `FAM. ${p.Familia || p.Apellido}, ${p.Dirección || ''}`;
                                            suggested = generateSuggestions(newPlace);
                                        }

                                        setEditingSchedule({ 
                                            ...editingSchedule!, 
                                            captainId: e.target.value, 
                                            captainName: p ? `${p.Nombre} ${p.Apellido}` : '',
                                            meetingPlace: newPlace,
                                            suggestedTerritories: suggested
                                        });
                                    }}
                                    required
                                >
                                    <option value="">Seleccione un capitán...</option>
                                    {publishers
                                        .filter(p => p.Sexo === 'Hombre' && p.asignacionesDisponibles?.includes('Capitán para Predicación'))
                                        .map(p => (
                                        <option key={p.id} value={p.id}>{p.Nombre} {p.Apellido} {p.esLugarEncuentro ? '🏠' : ''}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Lugar de Encuentro</label>
                                <select 
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                                    value={
                                        (editingSchedule?.meetingPlace && 
                                        !['Salón del Reino', 'Por Grupos'].includes(editingSchedule.meetingPlace) && 
                                        !editingSchedule.meetingPlace.startsWith('FAM.')) ? 'Otro' : (editingSchedule?.meetingPlace || '')
                                    }
                                    onChange={e => {
                                        const place = e.target.value === 'Otro' ? 'Lugar personalizado...' : e.target.value;
                                        const suggested = generateSuggestions(place);
                                        setEditingSchedule({ ...editingSchedule!, meetingPlace: place, suggestedTerritories: suggested });
                                    }}
                                    required
                                >
                                    <option value="">Seleccione lugar...</option>
                                    <option value="Salón del Reino">Salón del Reino</option>
                                    <option value="Por Grupos">Por Grupos</option>
                                    <optgroup label="Hogares de Hermanos">
                                        {publishers.filter(p => p.esLugarEncuentro).map(p => (
                                            <option key={p.id} value={`FAM. ${p.Familia || p.Apellido}, ${p.Dirección || ''}`}>
                                                FAM. {p.Familia || p.Apellido}, {p.Dirección || ''}
                                            </option>
                                        ))}
                                    </optgroup>
                                    <option value="Otro">Otro (Escriba lugar personalizado)</option>
                                </select>
                            </div>

                            {(editingSchedule?.meetingPlace && 
                              !['Salón del Reino', 'Por Grupos'].includes(editingSchedule.meetingPlace) && 
                              !editingSchedule.meetingPlace.startsWith('FAM.')) && (
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold mt-2"
                                    placeholder="Escriba el lugar personalizado..."
                                    value={editingSchedule.meetingPlace === 'Lugar personalizado...' ? '' : editingSchedule.meetingPlace}
                                    onChange={e => setEditingSchedule({ ...editingSchedule!, meetingPlace: e.target.value })}
                                    required
                                />
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Modalidad</label>
                                    <select 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                                        value={editingSchedule?.modality || 'Casa en Casa'}
                                        onChange={e => setEditingSchedule({ ...editingSchedule!, modality: e.target.value as any })}
                                    >
                                        <option value="Casa en Casa">Casa en Casa</option>
                                        <option value="Paradas de Autobús">Paradas de Autobús</option>
                                        <option value="Predicación por Carta">Predicación por Carta</option>
                                        <option value="Testimonio Público">Testimonio Público</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Notas / Otros</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                                        placeholder="Ej: Predicación por cartas, pública..."
                                        value={editingSchedule?.notes || ''}
                                        onChange={e => setEditingSchedule({ ...editingSchedule!, notes: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Asignar Territorios (Manual/Auto)</label>
                                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                                        <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 mb-3">
                                            {Array.from({ length: 40 }, (_, i) => i + 1).map(num => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => toggleTerritory(num)}
                                                    className={`w-full aspect-square flex items-center justify-center rounded-lg text-[10px] font-black transition-all ${
                                                        (editingSchedule?.suggestedTerritories || []).includes(num)
                                                            ? 'bg-blue-600 text-white shadow-md scale-110'
                                                            : 'bg-white text-slate-400 border border-slate-100 hover:border-blue-300'
                                                    }`}
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                            Territorios seleccionados: {(editingSchedule?.suggestedTerritories || []).join(', ') || 'Ninguno'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex flex-col sm:flex-row gap-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="w-full sm:flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="w-full sm:flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 shadow-xl shadow-blue-200 transition-all"
                                >
                                    {editingSchedule?.id ? 'Actualizar' : 'Guardar Programa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgramaPredicacionSemanal;
