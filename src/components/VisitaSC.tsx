import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    Publisher, LMMeetingSchedule, VisitaSCData, ModalInfo,
    AttendanceRecord, TerritoryRecord, TerritoryResponsible, ServiceReport,
    MeetingDetails, MealPlan, PredicacionData, PastoreoVisit,
    TerritoryMap, TerritoryMarker
} from '../types';
import { MONTHS, SERVICE_YEAR_MONTHS } from '../constants';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

import PublisherRecordModal from './PublisherRecordModal';
import DashboardCursos from './DashboardCursos';
import InteractiveMap from './InteractiveMap';
import { QRCodeSVG } from 'qrcode.react';
import { getCalculatedStatus, getPreviousMonthAndYear } from '../utils';

// --- Atomic UI Helpers ---

const SectionCard = ({ title, icon, description, onClick, color }: any) => {
    const colorClasses: any = {
        blue: 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200',
        orange: 'bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-200',
        green: 'bg-green-50 hover:bg-green-100 text-green-600 border-green-200',
        purple: 'bg-purple-50 hover:bg-purple-100 text-purple-600 border-purple-200'
    };

    return (
        <button
            onClick={onClick}
            className={`w-full p-6 rounded-[2rem] border-2 transition-all text-left flex items-start gap-4 active:scale-95 group ${colorClasses[color]}`}
        >
            <span className="text-3xl p-3 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">{icon}</span>
            <div>
                <h4 className="font-black uppercase tracking-tight text-lg">{title}</h4>
                <p className="text-xs font-semibold opacity-70 leading-relaxed">{description}</p>
            </div>
        </button>
    );
};

const ReportButton = ({ icon, label, onClick }: any) => (
    <button
        onClick={onClick}
        className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center gap-4 transition-colors border border-white/5 group"
    >
        <span className="text-xl">{icon}</span>
        <span className="text-sm font-bold opacity-80 group-hover:opacity-100 transition-opacity">{label}</span>
        <span className="ml-auto opacity-30">📥</span>
    </button>
);

const MeetingMiniRow = ({ label, details, dark }: { label: string, details?: MeetingDetails & { dia?: string }, dark?: boolean }) => (
    <div className={`flex justify-between items-center p-3 rounded-2xl ${dark ? 'bg-white/5 border border-white/10' : 'bg-slate-100'}`}>
        <div className="flex flex-col">
            <span className={`font-bold ${dark ? 'text-white' : 'text-slate-800'}`}>{label}</span>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{details?.lugar || '---'}</span>
        </div>
        <span className={`font-black px-3 py-1 rounded-full text-[10px] ${dark ? 'text-blue-400 bg-blue-400/10' : 'text-slate-500 bg-slate-100'}`}>{details?.dia || '---'}</span>
    </div>
);

// Resumen de asistencia del año de servicio actual (septiembre a agosto),
// en el MISMO formato que "Reporte Anual Asistencia" (AsistenciaReporte.tsx):
// dos tablas (entre semana / fin de semana), dos años de servicio lado a lado
// y fila de Totales Anuales. Solo lectura (sin edición), pensado para la
// Vista de Presentación. Se define fuera de PresentationView por ser un
// bloque de solo lectura autocontenido (mismo criterio de estabilidad usado
// en el resto del archivo).
interface AnnualMonthData {
    numReuniones: number;
    asistenciaTotal: number;
    promedioSemanal: string;
}
interface AnnualYearData {
    entreSemana: { [key: string]: AnnualMonthData };
    finDeSemana: { [key: string]: AnnualMonthData };
}

const AnnualAttendanceSummary: React.FC<{ attendanceRecords: AttendanceRecord[] }> = ({ attendanceRecords }) => {
    const { serviceYear } = getPreviousMonthAndYear();
    const [selectedServiceYear, setSelectedServiceYear] = useState(serviceYear);

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => serviceYear - i), [serviceYear]);

    const processDataForServiceYear = (endYear: number): AnnualYearData => {
        const startYear = endYear - 1;
        const data: AnnualYearData = { entreSemana: {}, finDeSemana: {} };

        SERVICE_YEAR_MONTHS.forEach((month, index) => {
            const calendarYear = index < 4 ? startYear : endYear;
            const record = attendanceRecords.find(r => r.ano === calendarYear && r.mes === month);

            const calculateMonthData = (prefix: 'es' | 'fs'): AnnualMonthData => {
                if (!record) return { numReuniones: 0, asistenciaTotal: 0, promedioSemanal: '' };
                let total = 0;
                let count = 0;
                for (let i = 1; i <= 5; i++) {
                    const valueStr = (record as any)[`${prefix}_sem${i}`];
                    if (valueStr && String(valueStr).trim() !== '') {
                        const value = parseInt(valueStr, 10);
                        if (!isNaN(value) && value > 0) {
                            total += value;
                            count++;
                        }
                    }
                }
                return {
                    numReuniones: count,
                    asistenciaTotal: total,
                    promedioSemanal: count > 0 ? (total / count).toFixed(2) : '',
                };
            };

            data.entreSemana[month] = calculateMonthData('es');
            data.finDeSemana[month] = calculateMonthData('fs');
        });
        return data;
    };

    const year1End = selectedServiceYear;
    const year2End = selectedServiceYear + 1;
    const year1Data = useMemo(() => processDataForServiceYear(year1End), [attendanceRecords, year1End]);
    const year2Data = useMemo(() => processDataForServiceYear(year2End), [attendanceRecords, year2End]);

    const renderTable = (type: 'entreSemana' | 'finDeSemana', label: string) => {
        let totalReunionesY1 = 0, totalAsistenciaY1 = 0;
        let totalReunionesY2 = 0, totalAsistenciaY2 = 0;
        const defaultMonthData: AnnualMonthData = { numReuniones: 0, asistenciaTotal: 0, promedioSemanal: '' };

        const rows = SERVICE_YEAR_MONTHS.map(month => {
            const d1 = year1Data[type][month] || defaultMonthData;
            const d2 = year2Data[type][month] || defaultMonthData;
            totalReunionesY1 += d1.numReuniones;
            totalAsistenciaY1 += d1.asistenciaTotal;
            totalReunionesY2 += d2.numReuniones;
            totalAsistenciaY2 += d2.asistenciaTotal;
            return (
                <tr key={month} className="border-t border-white/5">
                    <td className="p-2 text-left font-bold text-white" translate="no">{month}</td>
                    <td className="p-2 text-center text-slate-300">{d1.numReuniones || ''}</td>
                    <td className="p-2 text-center text-slate-300">{d1.asistenciaTotal || ''}</td>
                    <td className="p-2 text-center font-semibold text-blue-300 border-r-2 border-r-white/10">{d1.promedioSemanal || ''}</td>
                    <td className="p-2 text-left font-bold text-white" translate="no">{month}</td>
                    <td className="p-2 text-center text-slate-300">{d2.numReuniones || ''}</td>
                    <td className="p-2 text-center text-slate-300">{d2.asistenciaTotal || ''}</td>
                    <td className="p-2 text-center font-semibold text-blue-300">{d2.promedioSemanal || ''}</td>
                </tr>
            );
        });

        const avgY1 = totalReunionesY1 > 0 ? (totalAsistenciaY1 / totalReunionesY1).toFixed(2) : '0.00';
        const avgY2 = totalReunionesY2 > 0 ? (totalAsistenciaY2 / totalReunionesY2).toFixed(2) : '0.00';

        return (
            <div className="space-y-2">
                <h4 className="font-black text-blue-400 uppercase text-xs tracking-widest">{label}</h4>
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full text-xs border-collapse">
                        <thead className="bg-white/5">
                            <tr className="text-slate-400 uppercase tracking-widest text-[9px]">
                                <th className="p-2 text-center align-middle">Año de servicio<span className="block text-sm font-black text-blue-400 normal-case tracking-normal">{year1End}</span></th>
                                <th className="p-2 align-middle">Núm. reuniones</th>
                                <th className="p-2 align-middle">Asistencia total</th>
                                <th className="p-2 align-middle border-r-2 border-r-white/10">Prom. semanal</th>
                                <th className="p-2 text-center align-middle">Año de servicio<span className="block text-sm font-black text-blue-400 normal-case tracking-normal">{year2End}</span></th>
                                <th className="p-2 align-middle">Núm. reuniones</th>
                                <th className="p-2 align-middle">Asistencia total</th>
                                <th className="p-2 align-middle">Prom. semanal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows}
                            <tr className="bg-white/5 font-bold border-t border-white/10">
                                <td colSpan={2} className="p-2 text-left text-white">Totales Anuales</td>
                                <td className="p-2 text-center text-rose-300 font-extrabold">{totalAsistenciaY1 || ''}</td>
                                <td className="p-2 text-center text-rose-300 font-extrabold border-r-2 border-r-white/10">{avgY1}</td>
                                <td colSpan={2} className="p-2 text-left text-white">Totales Anuales</td>
                                <td className="p-2 text-center text-rose-300 font-extrabold">{totalAsistenciaY2 || ''}</td>
                                <td className="p-2 text-center text-rose-300 font-extrabold">{avgY2}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">Registro de Asistencia a las Reuniones</h3>
                <select
                    value={selectedServiceYear}
                    onChange={e => setSelectedServiceYear(Number(e.target.value))}
                    className="bg-white/10 border border-white/10 text-white text-sm font-bold rounded-xl px-3 py-2 outline-none"
                >
                    {years.map(y => <option key={y} value={y} className="text-black">{y}</option>)}
                </select>
            </div>
            {renderTable('entreSemana', 'Reunión de entre semana')}
            {renderTable('finDeSemana', 'Reunión del fin de semana')}
        </div>
    );
};

// Registro de Asignación de Territorio, en el MISMO formato que la pestaña
// "Registro de Asignaciones" de Territorios.tsx: tabla estilo S-13 en escritorio
// (territorio + última fecha completada + columnas "Asignado a"/"Fecha asignó"/
// "Fecha completó" por cada vuelta) y tarjetas por territorio en móvil.
// Es de solo lectura: sin edición, sin paginación de vueltas (se muestran todas).
const TerritoryRegistroReadOnly: React.FC<{ territoryRecords: TerritoryRecord[]; territoryResponsible?: TerritoryResponsible | null; }> = ({ territoryRecords, territoryResponsible }) => {
    const territoryData = useMemo(() => {
        const data: { [terrNum: number]: { [vueltaNum: number]: TerritoryRecord } } = {};
        territoryRecords.forEach(r => {
            const terr = Number(r.terrNum);
            const vuelta = Number(r.vueltaNum);
            if (!terr || !vuelta) return;
            if (!data[terr]) data[terr] = {};
            data[terr][vuelta] = r;
        });
        return data;
    }, [territoryRecords]);

    const territoryNumbers = useMemo(() => Object.keys(territoryData).map(Number).sort((a, b) => a - b), [territoryData]);
    const maxVuelta = useMemo(() => {
        const all = territoryRecords.map(r => Number(r.vueltaNum) || 0);
        return all.length > 0 ? Math.max(...all) : 1;
    }, [territoryRecords]);
    const vueltasRange = useMemo(() => Array.from({ length: maxVuelta }, (_, i) => i + 1), [maxVuelta]);

    const getLastCompletedDate = (terrNum: number) => {
        const vueltas = Object.values(territoryData[terrNum] || {})
            .filter(v => v.completedDate)
            .sort((a, b) => new Date(b.completedDate!).getTime() - new Date(a.completedDate!).getTime());
        return vueltas.length > 0 ? vueltas[0].completedDate : '---';
    };

    if (territoryNumbers.length === 0) {
        return <div className="p-8 text-center text-slate-500 font-bold">No hay registros de territorio.</div>;
    }

    return (
        <div>
            {territoryResponsible?.publisherName && (
                <div className="mb-3 text-right text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Responsable de territorios: <span className="text-white">{territoryResponsible.publisherName}</span>
                </div>
            )}

            {/* Vista escritorio: tabla estilo S-13, igual que en Territorios */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full border-collapse text-xs">
                    <thead className="bg-white/5">
                        <tr className="text-slate-400 uppercase tracking-widest text-[9px]">
                            <th rowSpan={2} className="p-2 border border-white/10 align-middle">Núm. de terr.</th>
                            <th rowSpan={2} className="p-2 border border-white/10 align-middle">Última fecha completado</th>
                            {vueltasRange.map(v => <th colSpan={2} key={v} className="p-2 border border-white/10 font-black text-amber-300 normal-case">Vuelta {v}: Asignado a</th>)}
                        </tr>
                        <tr className="text-slate-400 uppercase tracking-widest text-[9px]">
                            {vueltasRange.map(v => (
                                <React.Fragment key={v}>
                                    <th className="p-2 border border-white/10 font-normal">Fecha asignó</th>
                                    <th className="p-2 border border-white/10 font-normal">Fecha completó</th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {territoryNumbers.map(terrNum => {
                            const vueltas = territoryData[terrNum];
                            return (
                                <React.Fragment key={terrNum}>
                                    <tr className="border-t-2 border-white/10">
                                        <td rowSpan={2} className="p-2 border border-white/10 font-black text-center align-middle text-white">{terrNum}</td>
                                        <td rowSpan={2} className="p-2 border border-white/10 text-center align-middle text-slate-400">{getLastCompletedDate(terrNum)}</td>
                                        {vueltasRange.map(v => (
                                            <td colSpan={2} key={v} className="p-2 border border-white/10 text-center font-bold text-amber-300 align-bottom">
                                                {vueltas[v]?.asignadoA || '\u00A0'}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        {vueltasRange.map(v => (
                                            <React.Fragment key={v}>
                                                <td className="p-2 border border-white/10 text-center text-slate-400">{vueltas[v]?.assignedDate || '\u00A0'}</td>
                                                <td className="p-2 border border-white/10 text-center text-slate-400">{vueltas[v]?.completedDate || '\u00A0'}</td>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Vista móvil: cards por territorio, igual que en Territorios */}
            <div className="md:hidden space-y-4">
                {territoryNumbers.map(terrNum => (
                    <div key={terrNum} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                        <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-3">
                            <h3 className="font-black text-lg text-white">Territorio #{terrNum}</h3>
                        </div>
                        <p className="text-xs font-bold text-slate-400 -mt-2 mb-3">
                            Última fecha en que se completó: {getLastCompletedDate(terrNum)}
                        </p>
                        <div className="space-y-2">
                            {vueltasRange.map(v => {
                                const vueltaData = territoryData[terrNum][v];
                                if (!vueltaData) return null;
                                return (
                                    <div key={v} className="p-3 rounded-xl border border-white/10 bg-white/5">
                                        <p className="font-bold text-white">
                                            Vuelta {v}: <span className="text-amber-300">{vueltaData.asignadoA || <span className="text-slate-500 italic font-normal">Sin asignar</span>}</span>
                                        </p>
                                        {vueltaData.asignadoA && (
                                            <p className="text-xs mt-1 text-slate-400">
                                                Asignado: {vueltaData.assignedDate || '---'} | Completado: {vueltaData.completedDate || '---'}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface PresentationViewProps {
    publishers: Publisher[];
    draft: VisitaSCData | null;
    selectedDate: string;
    onClose: () => void;
    serviceReports: ServiceReport[];
    attendanceRecords: AttendanceRecord[];
    territoryRecords: TerritoryRecord[];
    territoryResponsible?: TerritoryResponsible | null;
    territoryMaps: TerritoryMap[];
    territoryMarkers: TerritoryMarker[];
    onShowModal: (info: ModalInfo) => void;
    onDownload: () => void;
    getPublisherName: (id: string) => string;
}

const PresentationView: React.FC<PresentationViewProps> = ({ publishers, draft, selectedDate, onClose, serviceReports, attendanceRecords, territoryRecords, territoryResponsible, territoryMaps, territoryMarkers, onShowModal, onDownload, getPublisherName }) => {
    const [step, setStep] = useState(0);
    const [cardFilters, setCardFilters] = useState({
        group: 'todos',
        status: 'todos',
        gender: 'todos',
        family: 'todos',
        name: ''
    });
    const [selectedPublisherForModal, setSelectedPublisherForModal] = useState<Publisher | null>(null);
    const [presModal, setPresModal] = useState<'discursos' | 'reuniones' | 'hospitalidad' | 'predicacion' | 'asistencia' | 'cursos' | 'territorios' | 'emergencia' | null>(null);
    const [territorioTab, setTerritorioTab] = useState<'registro' | 'mapa'>('registro');
    const currentServiceYear = useMemo(() => {
        const now = new Date();
        return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
    }, []);

    const familyOptions = useMemo(() => {
        let filteredPublishers = publishers;
        if (cardFilters.group !== 'todos') {
            const fGroup = String(cardFilters.group).trim().toLowerCase();
            filteredPublishers = publishers.filter(p => String(p.Grupo || '').trim().toLowerCase() === fGroup);
        }
        const families = filteredPublishers
            .map(p => p.Familia)
            .filter(f => f && typeof f === 'string' && f.trim().length > 0);
        return [...new Set(families)].sort();
    }, [publishers, cardFilters.group]);

    const groupOptions = useMemo(() => {
        const groups = publishers
            .map(p => p.Grupo)
            .filter(g => g !== undefined && g !== null && String(g).trim() !== '');
        const uniqueGroups = [...new Set(groups)].map(String);
        return uniqueGroups.sort((a, b) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });
    }, [publishers]);
    
    const publishersWithStatus = useMemo(() => {
        return publishers.map(p => ({
            ...p,
            calculatedStatus: getCalculatedStatus(p, serviceReports, MONTHS)
        }));
    }, [publishers, serviceReports]);

    const filteredCards = useMemo(() => {
        return publishersWithStatus.filter(p => {
            const pGroup = String(p.Grupo || '').trim().toLowerCase();
            const fGroup = String(cardFilters.group || '').trim().toLowerCase();
            const matchesGroup = fGroup === 'todos' || pGroup === fGroup;

            const pSexo = String(p.Sexo || '').trim().toLowerCase();
            const fGender = cardFilters.gender.toLowerCase();
            let matchesGender = fGender === 'todos';
            if (!matchesGender) {
                if (fGender === 'varones') matchesGender = ['hombre', 'h', 'varón', 'varon'].includes(pSexo);
                else if (fGender === 'mujeres') matchesGender = ['mujer', 'm'].includes(pSexo);
            }

            const pFamily = String(p.Familia || '').trim().toLowerCase();
            const fFamily = String(cardFilters.family || '').trim().toLowerCase();
            const matchesFamily = fFamily === 'todos' || pFamily === fFamily;

            const pFullName = `${p.Nombre} ${p.Apellido}`.toLowerCase();
            const fName = cardFilters.name.toLowerCase().trim();
            const matchesName = !fName || pFullName.includes(fName);

            let matchesStatus = true;
            if (cardFilters.status === 'todos') {
                // Excluir inactivos (calculados) por defecto según solicitud del usuario
                matchesStatus = p.calculatedStatus !== 'inactivo';
            } else {
                const fStatus = cardFilters.status.toLowerCase();
                if (fStatus === 'activos') matchesStatus = p.calculatedStatus === 'activo';
                else if (fStatus === 'irregulares') matchesStatus = p.calculatedStatus === 'irregular';
            }

            const isBaja = p.Baja === true || String(p.Baja || '').toLowerCase().trim().startsWith('s') || p.Baja === 'sí' || p.Baja === '1';
            return matchesGroup && matchesGender && matchesStatus && matchesFamily && matchesName && !isBaja;
        });
    }, [cardFilters, publishersWithStatus]);

    const homeButtons = [
        { id: 'discursos', title: 'Discursos del SC', desc: 'Martes, Público y Conclusión', color: 'from-blue-600 to-blue-900', shadow: 'shadow-blue-500/30', action: () => setPresModal('discursos') },
        { id: 'reuniones', title: 'Reuniones', desc: 'Horarios durante la visita', color: 'from-violet-600 to-violet-900', shadow: 'shadow-violet-500/30', action: () => setPresModal('reuniones') },
        { id: 'hospitalidad', title: 'Hospitalidad', desc: 'Plan de alimentos y dirección', color: 'from-orange-500 to-orange-800', shadow: 'shadow-orange-500/30', action: () => setPresModal('hospitalidad') },
        { id: 'tarjetas', title: 'Tarjetas de Registro', desc: 'Tarjetas S-21 de publicadores', color: 'from-emerald-600 to-emerald-900', shadow: 'shadow-emerald-500/30', action: () => setStep(1) },
        { id: 'predicacion', title: 'Plan de Predicación', desc: 'Actividad diaria y territorios', color: 'from-cyan-600 to-cyan-900', shadow: 'shadow-cyan-500/30', action: () => setPresModal('predicacion') },
        { id: 'vym', title: 'Vida y Ministerio', desc: 'Programa de la reunión semanal', color: 'from-indigo-600 to-purple-800', shadow: 'shadow-indigo-500/30', action: () => setStep(2) },
        { id: 'asistencia', title: 'Asistencia Anual', desc: 'Promedios de asistencia del año de servicio', color: 'from-rose-600 to-rose-900', shadow: 'shadow-rose-500/30', action: () => setPresModal('asistencia') },
        { id: 'cursos', title: 'Cursos Bíblicos', desc: 'Cursos por publicador y precursor', color: 'from-teal-600 to-teal-900', shadow: 'shadow-teal-500/30', action: () => setPresModal('cursos') },
        { id: 'territorios', title: 'Territorios', desc: 'Registro de asignación y mapa interactivo', color: 'from-amber-600 to-amber-900', shadow: 'shadow-amber-500/30', action: () => setPresModal('territorios') },
        { id: 'emergencia', title: 'Directorio para Emergencias', desc: 'Contactos de emergencia de publicadores', color: 'from-red-600 to-red-900', shadow: 'shadow-red-500/30', action: () => setPresModal('emergencia') },
    ];

    const steps = [
        {
            title: 'Inicio',
            content: (
                <div className="w-full max-w-5xl mx-auto px-4 py-4 animate-in zoom-in-95 duration-500">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl md:text-6xl font-black text-white leading-tight">
                            {draft?.scName || 'Visita del SC'}
                        </h2>
                        {draft?.scWifeName && <p className="text-slate-400 font-bold mt-1 text-lg">y su esposa {draft.scWifeName}</p>}
                        <p className="text-slate-500 font-bold mt-2 uppercase tracking-widest text-xs">
                            Semana: {selectedDate} • Congregación Cerro de la Silla
                        </p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {homeButtons.map(btn => (
                            <button
                                key={btn.id}
                                onClick={btn.action}
                                className={`bg-gradient-to-br ${btn.color} p-5 md:p-8 rounded-[2rem] text-white text-left flex flex-col gap-3 shadow-2xl ${btn.shadow} hover:scale-[1.04] active:scale-95 transition-all duration-200`}
                            >
                                <div>
                                    <p className="font-black text-sm md:text-lg leading-tight">{btn.title}</p>
                                    <p className="text-white/50 text-[10px] mt-1 font-medium hidden md:block">{btn.desc}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )
        },
        {
            title: 'Tarjetas de Publicador',
            content: (
                <div className="flex flex-col w-full max-w-7xl py-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6 shrink-0">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setStep(0)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all">← Inicio</button>
                            <h3 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter">Tarjetas de Registro</h3>
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                            <select className="bg-white/10 text-white p-3 rounded-2xl text-xs border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none" value={cardFilters.group} onChange={(e) => setCardFilters({ ...cardFilters, group: e.target.value })}>
                                <option value="todos" className="text-black">Todos los Grupos</option>
                                {groupOptions.map(g => (<option key={g} value={g} className="text-black">Grupo {g}</option>))}
                            </select>
                            <select className="bg-white/10 text-white p-3 rounded-2xl text-xs border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none" value={cardFilters.status} onChange={(e) => setCardFilters({ ...cardFilters, status: e.target.value })}>
                                <option value="todos" className="text-black">Todos (Activos e Irregulares)</option>
                                <option value="activos" className="text-black">Activos</option>
                                <option value="irregulares" className="text-black">Irregulares</option>
                            </select>
                            <select className="bg-white/10 text-white p-3 rounded-2xl text-xs border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none" value={cardFilters.gender} onChange={(e) => setCardFilters({ ...cardFilters, gender: e.target.value })}>
                                <option value="todos" className="text-black">Ambos Sexos</option>
                                <option value="varones" className="text-black">Varones</option>
                                <option value="mujeres" className="text-black">Mujeres</option>
                            </select>
                            <select className="bg-white/10 text-white p-3 rounded-2xl text-xs border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none" value={cardFilters.family} onChange={(e) => setCardFilters({ ...cardFilters, family: e.target.value })}>
                                <option value="todos" className="text-black">Todas las Familias</option>
                                {familyOptions.map(f => (<option key={f} value={f} className="text-black">{f}</option>))}
                            </select>
                            <div className="relative flex-1 md:flex-none">
                                <input type="text" placeholder="Buscar por Nombre..." className="bg-white/10 text-white px-4 py-3 rounded-2xl text-xs border border-white/10 focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64" value={cardFilters.name} onChange={(e) => setCardFilters({ ...cardFilters, name: e.target.value })} />
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-x-auto flex gap-4 md:gap-8 pb-10 snap-x scrollbar-hide min-h-0">
                        {filteredCards.length === 0 ? (
                            <div className="w-full flex items-center justify-center text-slate-500 font-bold text-2xl uppercase tracking-widest border-4 border-dashed border-white/5 rounded-[4rem] min-h-[400px]">No se encontraron tarjetas con estos filtros</div>
                        ) : filteredCards.map(p => (
                            <div key={p.id} className="min-w-[300px] md:min-w-[420px] min-h-[580px] bg-slate-900 border border-white/10 rounded-[2.5rem] md:rounded-[4rem] p-6 md:p-10 flex flex-col items-center justify-between snap-center shadow-2xl hover:scale-105 transition-transform duration-500 border-t-8 border-t-blue-500 relative group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-blue-500/20 transition-colors"></div>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-blue-500 rounded-full blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                                    <div className="relative w-32 h-32 md:w-48 h-48 rounded-full p-2 bg-slate-800 shadow-2xl">
                                        <img src={p.Foto || 'https://i.imgur.com/83itvIu.png'} alt={p.Nombre} className="w-full h-full rounded-full object-cover border-4 border-blue-500 shadow-inner" />
                                    </div>
                                    <div className={`absolute top-0 right-0 px-4 md:px-6 py-1 md:py-2 rounded-full text-[10px] md:text-xs font-black uppercase text-black shadow-2xl ${p.calculatedStatus === 'activo' ? 'bg-[#39FF14]' : p.calculatedStatus === 'inactivo' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>{p.calculatedStatus}</div>
                                </div>
                                <div className="text-center space-y-2 md:space-y-3 z-10 w-full flex-1 flex flex-col justify-between h-full pt-4">
                                    <div className="space-y-2">
                                        <h4 className="text-2xl md:text-3xl font-black text-white leading-tight group-hover:text-blue-400 transition-colors">{p.Nombre} <br /> {p.Apellido}</h4>
                                        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] pb-4 border-b border-white/5 mx-auto w-10/12">{p.Familia || 'Sin Familia'}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 mt-6">
                                        <div className="bg-white/5 p-4 rounded-3xl border border-white/5 flex flex-col justify-center">
                                            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Privilegios</span>
                                            <div className="flex flex-wrap justify-center gap-1">
                                                {[p.Privilegio, p['Priv Adicional']].filter(priv => priv && priv !== 'Publicador' && priv !== 'Ninguno').map((priv, i) => (<span key={i} className="text-white font-bold text-[10px] bg-blue-500/20 px-2 py-0.5 rounded-full">{priv}</span>))}
                                                {(!p.Privilegio || p.Privilegio === 'Publicador') && (!p['Priv Adicional'] || p['Priv Adicional'] === 'Ninguno') && (<span className="text-white font-bold text-sm">Publicador</span>)}
                                            </div>
                                        </div>
                                        <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                                            <span className="block text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Grupo</span>
                                            <span className="text-white font-bold text-sm">{p.Grupo || 'N/A'}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 md:mt-8 w-full">
                                        <button onClick={() => setSelectedPublisherForModal(p)} className="w-full py-4 md:py-6 bg-blue-600 text-white font-black rounded-2xl md:rounded-3xl hover:bg-blue-500 transition-all uppercase text-xs md:text-sm tracking-widest shadow-xl shadow-blue-500/20 active:scale-95">Ver Tarjeta de Registro</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            title: 'Vida y Ministerio',
            content: (
                <div className="w-full max-w-4xl mx-auto px-3 md:px-4 animate-in slide-in-from-right duration-500">
                    <div className="flex items-center gap-4 mb-6">
                        <button onClick={() => setStep(0)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0">← Inicio</button>
                        <h3 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter">Vida y Ministerio</h3>
                    </div>
                    {!draft?.vymProgram ? (
                        <div className="p-12 text-center bg-white/5 rounded-[3rem] border border-white/10">
                            <p className="text-slate-400 font-bold text-xl">No hay programa VyM generado para esta semana.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-5 md:p-6 rounded-[2rem] text-center shadow-2xl">
                                <h4 className="text-xl md:text-3xl font-black text-white">{draft.vymProgram.weekRange}</h4>
                                <p className="text-white/70 font-bold uppercase tracking-widest text-xs mt-1">Visita del Superintendente de Circuito</p>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Presidente', value: (() => { const pub = publishers.find(pub => pub.id === draft.vymProgram!.presidentId); return pub ? `${pub.Nombre} ${pub.Apellido}` : 'Vacante'; })() },
                                    { label: 'Canción 1', value: draft.vymProgram.song1 || '---' },
                                    { label: 'Canción 2', value: draft.vymProgram.song2 || '---' },
                                    { label: 'Canción 3', value: draft.vymProgram.song3 || '---' },
                                ].map((item, i) => (
                                    <div key={i} className="bg-white/5 border border-white/10 p-3 md:p-4 rounded-2xl text-center">
                                        <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{item.label}</span>
                                        <span className="text-white font-black text-xs md:text-sm">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 md:p-5 rounded-[1.5rem] space-y-3">
                                    <h5 className="font-black text-yellow-400 uppercase text-xs tracking-widest flex items-center gap-2"><span className="w-2 h-2 bg-yellow-400 rounded-full"></span> Tesoros de la Biblia</h5>
                                    {draft.vymProgram.treasuresParts?.map((p: any, i: number) => {
                                        const pub = publishers.find(pub => pub.id === p.assigneeId);
                                        return (
                                            <div key={i} className="bg-white/10 p-4 rounded-xl border border-white/5 shadow-sm">
                                                <span className="block text-white text-[13px] font-black leading-snug mb-2">{p.title}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="block text-yellow-400 font-black text-xs uppercase tracking-wider">{pub ? `${pub.Nombre} ${pub.Apellido}` : 'Vacante'}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="bg-green-500/10 border border-green-500/20 p-4 md:p-5 rounded-[1.5rem] space-y-3">
                                    <h5 className="font-black text-green-400 uppercase text-xs tracking-widest flex items-center gap-2"><span className="w-2 h-2 bg-green-400 rounded-full"></span> Seamos Mejores Maestros</h5>
                                    {draft.vymProgram.studentAssignments?.map((p: any, i: number) => {
                                        const pub = publishers.find(pub => pub.id === p.studentId);
                                        const helperPub = p.helperId ? publishers.find(pub => pub.id === p.helperId) : null;
                                        return (
                                            <div key={i} className="bg-white/10 p-4 rounded-xl border border-white/5 shadow-sm">
                                                <span className="block text-white text-[13px] font-black leading-snug mb-2">{p.title}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="block text-green-400 font-black text-xs uppercase tracking-wider">{pub ? `${pub.Nombre} ${pub.Apellido}` : 'Vacante'}</span>
                                                </div>
                                                {helperPub && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="block text-green-300/70 font-bold text-[10px] uppercase tracking-wider">/ Ayudante: {helperPub.Nombre} {helperPub.Apellido}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/20 p-4 md:p-5 rounded-[1.5rem] space-y-3">
                                    <h5 className="font-black text-blue-400 uppercase text-xs tracking-widest flex items-center gap-2"><span className="w-2 h-2 bg-blue-400 rounded-full"></span> Nuestra Vida Cristiana</h5>
                                    {draft.vymProgram.christianLivingParts?.map((p: any, i: number) => {
                                        const pub = publishers.find(pub => pub.id === p.assigneeId);
                                        return (
                                            <div key={i} className="bg-white/10 p-4 rounded-xl border border-white/5 shadow-sm">
                                                <span className="block text-white text-[13px] font-black leading-snug mb-2">{p.title}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="block text-blue-400 font-black text-xs uppercase tracking-wider">{p.note || (pub ? `${pub.Nombre} ${pub.Apellido}` : 'Vacante')}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {draft.discursoServicioTitulo && (
                                        <div className="bg-blue-600/20 border border-blue-500/30 p-3 rounded-xl">
                                            <span className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">Discurso de Servicio</span>
                                            <span className="block text-white text-xs font-bold mt-1">{draft.discursoServicioTitulo}</span>
                                        </div>
                                    )}
                                    <div className="bg-white/5 p-3 rounded-xl">
                                        <span className="block text-white text-xs font-bold">Canción Final: {draft.vymProgram.song3 || '---'}</span>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl">
                                        <span className="block text-white text-xs font-bold">Oración Final</span>
                                        <span className="block text-blue-400/70 text-[10px] mt-1">{draft?.scName || 'Superintendente de Circuito'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )
        }
    ];

    return (
        <div className="fixed inset-0 bg-slate-950 z-[100] overflow-hidden flex flex-col font-sans">
            {/* Header */}
            <div className="p-4 md:p-6 flex justify-between items-center bg-white/5 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-4">
                    <div>
                        <h2 className="text-white text-xl md:text-2xl font-black uppercase tracking-tighter">Modo Presentación</h2>
                        <p className="text-slate-500 text-[10px] font-bold tracking-widest uppercase">{steps[step].title}</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-white bg-white/10 hover:bg-white/20 px-4 md:px-6 py-1 md:py-2 rounded-xl md:rounded-2xl font-bold transition-all text-xs md:text-base">Cerrar</button>
            </div>

            <div className="flex-1 flex items-start justify-center p-3 md:p-8 overflow-y-auto">
                <div className="w-full flex items-start justify-center pt-4 md:pt-8">
                    {steps[step].content}
                </div>
            </div>

            {step !== 0 && (
                <div className="p-4 md:p-8 flex justify-between items-center text-white/40 uppercase tracking-widest text-[8px] md:text-xs font-black bg-white/5">
                    <button onClick={() => setStep(0)} className="flex items-center gap-2 hover:text-white transition-colors group">
                        <span className="text-xl md:text-3xl group-hover:-translate-x-2 transition-transform">←</span> Inicio
                    </button>
                    <div className="flex gap-2">
                        {steps.map((_, i) => (<div key={i} className={`h-1 md:h-2 transition-all duration-500 rounded-full ${i === step ? 'w-8 md:w-16 bg-blue-500 shadow-lg shadow-blue-500/50' : 'w-2 md:w-4 bg-white/10'}`}></div>))}
                    </div>
                    <div className="invisible text-[8px]">placeholder</div>
                </div>
            )}

            {/* Modal: Discursos */}
            {presModal === 'discursos' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setPresModal(null)}>
                    <div className="bg-slate-900 border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-90 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-blue-700 to-blue-900 p-6 md:p-8 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Discursos del SC</h3>
                                <p className="text-blue-300 text-xs font-bold mt-1">{draft?.scName || 'SC'}{draft?.scWifeName ? ` • ${draft.scWifeName}` : ''}</p>
                            </div>
                            <button onClick={() => setPresModal(null)} className="text-white/60 hover:text-white text-3xl font-thin transition-colors w-10 h-10 flex items-center justify-center">✕</button>
                        </div>
                        <div className="p-6 md:p-8 space-y-4">
                            {[
                                { day: 'Martes', label: 'Discurso de Servicio', title: draft?.discursoMartesTitulo, song: draft?.discursoMartesCancion },
                                { day: 'Domingo', label: 'Discurso Público', title: draft?.discursoDomingoTitulo, song: draft?.discursoDomingoCancion },
                                { day: 'Domingo', label: 'Discurso de Conclusión', title: draft?.discursoConclusionTitulo, song: draft?.discursoConclusionCancion },
                            ].map((d, i) => (
                                <div key={i} className="bg-white/5 border border-white/10 p-5 md:p-6 rounded-2xl">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">{d.day}</span>
                                                    <span className="block text-xs font-bold text-slate-400">{d.label}</span>
                                                </div>
                                                {d.song && <span className="text-blue-500 font-black px-3 py-1 bg-blue-500/10 rounded-full text-xs">Canción {d.song}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-white font-black text-lg md:text-xl leading-tight">{d.title || '---'}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-6 flex justify-end bg-white/5">
                            <button onClick={() => setPresModal(null)} className="px-8 py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-500 transition-all uppercase text-sm tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Reuniones */}
            {presModal === 'reuniones' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setPresModal(null)}>
                    <div className="bg-slate-900 border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-90 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-violet-700 to-violet-900 p-6 md:p-8 flex justify-between items-center">
                            <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Reuniones durante la Visita</h3>
                            <button onClick={() => setPresModal(null)} className="text-white/60 hover:text-white text-3xl font-thin transition-colors w-10 h-10 flex items-center justify-center">✕</button>
                        </div>
                        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { key: 'vym', label: 'Vida y Ministerio', color: 'border-blue-500' },
                                { key: 'precursores', label: 'Reunión con Precursores', color: 'border-green-500' },
                                { key: 'ancianosSiervos', label: 'Ancianos y Siervos', color: 'border-yellow-500' },
                                { key: 'finSemana', label: 'Reunión Pública', color: 'border-purple-500' },
                            ].map(item => {
                                const data = (draft?.reuniones as any)?.[item.key];
                                return (
                                    <div key={item.key} className={`bg-white/5 border-l-4 ${item.color} border border-white/10 p-5 rounded-2xl`}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-white font-black text-sm">{item.label}</span>
                                        </div>
                                        <div className="space-y-1 pl-2">
                                            <p className="text-white/80 font-bold text-lg">{data?.dia || '---'} <span className="text-blue-400 ml-2">{data?.hora || '---'}</span></p>
                                            <p className="text-slate-500 text-xs font-medium">📍 {data?.lugar || '---'}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-6 flex justify-end bg-white/5">
                            <button onClick={() => setPresModal(null)} className="px-8 py-3 bg-violet-600 text-white font-black rounded-2xl hover:bg-violet-500 transition-all uppercase text-sm tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Hospitalidad */}
            {presModal === 'hospitalidad' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setPresModal(null)}>
                    <div className="bg-slate-900 border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-90 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-orange-600 to-orange-800 p-6 md:p-8 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Plan de Hospitalidad</h3>
                                <p className="text-orange-200 text-xs font-bold mt-1">Alimentos y direcciones para la semana</p>
                            </div>
                            <button onClick={() => setPresModal(null)} className="text-white/60 hover:text-white text-3xl font-thin transition-colors w-10 h-10 flex items-center justify-center">✕</button>
                        </div>
                        <div className="p-5 md:p-6 overflow-y-auto max-h-[65vh] space-y-3">
                            {['miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(day => {
                                const data = (draft?.alimentos as any)?.[day];
                                const tel = data?.telefono?.replace(/\D/g, '');
                                const dir = data?.direccion || '';
                                const dayNames: any = { miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
                                return (
                                    <div key={day} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                        <div className="flex items-center gap-3 p-4 border-b border-white/5">
                                            <div className="flex-1">
                                                <span className="block text-[10px] font-black text-orange-400 uppercase tracking-widest">{dayNames[day]}</span>
                                                <span className="block text-white font-black text-lg leading-tight">{data?.familia || 'Sin asignar'}</span>
                                            </div>
                                        </div>
                                        {(dir || tel) && (
                                            <div className="p-4 flex flex-wrap gap-3 items-center">
                                                {dir && (
                                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}`} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-xl font-bold text-xs transition-all">
                                                        <span>📍</span>
                                                        <span className="truncate max-w-[120px] md:max-w-[200px]">{dir}</span>
                                                        <span className="text-[10px] underline shrink-0">Ver Mapa</span>
                                                    </a>
                                                )}
                                                {tel && (
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <a href={`https://wa.me/${tel}`} target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center gap-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-400 px-4 py-2 rounded-xl font-bold text-xs transition-all">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12 1.007C5.936 1.007 1 5.943 1 12.003c0 1.951.497 3.786 1.374 5.377L1 23.01l5.788-1.352A10.954 10.954 0 0012 23c6.06 0 10.997-4.937 10.997-10.997C22.997 5.943 18.06 1.007 12 1.007" />
                                                            </svg>
                                                            WhatsApp
                                                        </a>
                                                        <a href={`tel:${tel}`}
                                                            className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-600/50 border border-white/10 text-slate-300 px-4 py-2 rounded-xl font-bold text-xs transition-all">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.49 10.61a19.79 19.79 0 01-3.07-8.68A2 2 0 012.4 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.87 6.87l1.27-.76a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                                                            </svg>
                                                            Llamar
                                                        </a>
                                                        <span className="text-slate-400 font-bold text-sm">{data.telefono}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-6 flex justify-end bg-white/5">
                            <button onClick={() => setPresModal(null)} className="px-8 py-3 bg-orange-600 text-white font-black rounded-2xl hover:bg-orange-500 transition-all uppercase text-sm tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Plan de Predicación */}
            {presModal === 'predicacion' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setPresModal(null)}>
                    <div className="bg-slate-900 border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-90 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-cyan-700 to-cyan-900 p-6 md:p-8 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Plan de Predicación</h3>
                                <p className="text-cyan-300 text-xs font-bold mt-1">Actividad diaria, capitanes de territorio y territorios</p>
                            </div>
                            <button onClick={() => setPresModal(null)} className="text-white/60 hover:text-white text-3xl font-thin transition-colors w-10 h-10 flex items-center justify-center">✕</button>
                        </div>
                        <div className="p-5 md:p-6 overflow-y-auto max-h-[65vh]">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {['miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map(day => {
                                    const dayData = (draft?.predicacion as any)?.[day];
                                    const dayNames: any = { miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo' };
                                    const pastoreoByDay = draft?.pastoreo?.filter(v => v.dia === dayNames[day]) || [];

                                    const allDayEvents: any[] = [];
                                    ['manana', 'tarde'].forEach(slice => {
                                        if ((day === 'sabado' || day === 'domingo') && slice === 'tarde') return;
                                        const sliceData = dayData?.[slice];
                                        if (sliceData && (sliceData.lugar || sliceData.hora)) {
                                            allDayEvents.push({ ...sliceData, type: 'preach', slice });
                                        }
                                    });
                                    pastoreoByDay.forEach(v => {
                                        allDayEvents.push({ ...v, type: 'pastoreo' });
                                    });

                                    // Sort by time
                                    allDayEvents.sort((a, b) => (a.hora || '00:00').localeCompare(b.hora || '00:00'));

                                    return (
                                        <div key={day} className="bg-white/5 border border-white/10 rounded-[1.5rem] overflow-hidden">
                                            <div className="bg-cyan-800/40 p-4 flex items-center gap-3 border-b border-white/5">
                                                <h4 className="text-white font-black text-lg uppercase tracking-tight">{dayNames[day]}</h4>
                                            </div>
                                            <div className="p-4 space-y-3">
                                                {allDayEvents.map((event, idx) => {
                                                    if (event.type === 'preach') {
                                                        return (
                                                            <div key={`${day}-preach-${event.slice}`} className="bg-white/5 p-3 rounded-xl space-y-1">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-wider">{event.slice === 'manana' ? 'Mañana' : 'Tarde'}</span>
                                                                    <span className="text-cyan-300 font-bold text-xs">{event.hora || ''}</span>
                                                                </div>
                                                                <p className="text-white font-bold text-sm leading-tight">📍 {event.lugar || '---'}</p>
                                                                {event.direccion && <p className="text-slate-400 text-[10px] mt-1 leading-tight">{event.direccion}</p>}
                                                                {event.capitan && <p className="text-slate-400 text-xs"><span className="text-amber-400 font-bold">Asignación:</span> {event.capitan}</p>}
                                                                {event.publicadoresSC && <p className="text-slate-400 text-xs"><span className="text-blue-400 font-bold">Con SC:</span> {event.publicadoresSC}</p>}
                                                                {event.publicadoresEsposa && <p className="text-slate-400 text-xs"><span className="text-pink-400 font-bold">Con esposa:</span> {event.publicadoresEsposa}</p>}
                                                                {event.notas && <p className="text-slate-500 text-xs italic">{event.notas}</p>}
                                                            </div>
                                                        );
                                                    } else {
                                                        return (
                                                            <div key={`${day}-pastoreo-${idx}`} className="bg-purple-900/40 p-3 rounded-xl space-y-1 border border-purple-500/30">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider">Pastoreo</span>
                                                                    <span className="text-purple-300 font-bold text-xs">{event.hora || '---'}</span>
                                                                </div>
                                                                <p className="text-white font-bold text-sm leading-tight">{event.familia}</p>
                                                                <p className="text-slate-400 text-xs"><span className="text-purple-400 font-bold">Acompañante:</span> {getPublisherName(event.acompananteId)}</p>
                                                            </div>
                                                        );
                                                    }
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-6 flex justify-end bg-white/5">
                            <button onClick={() => setPresModal(null)} className="px-8 py-3 bg-cyan-600 text-white font-black rounded-2xl hover:bg-cyan-500 transition-all uppercase text-sm tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Asistencia Anual */}
            {presModal === 'asistencia' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setPresModal(null)}>
                    <div className="bg-slate-900 border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-90 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-rose-700 to-rose-900 p-6 md:p-8 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Asistencia Anual</h3>
                                <p className="text-rose-300 text-xs font-bold mt-1">Promedios de asistencia por mes</p>
                            </div>
                            <button onClick={() => setPresModal(null)} className="text-white/60 hover:text-white text-3xl font-thin transition-colors w-10 h-10 flex items-center justify-center">✕</button>
                        </div>
                        <div className="p-5 md:p-6 overflow-y-auto max-h-[65vh]">
                            <AnnualAttendanceSummary attendanceRecords={attendanceRecords} />
                        </div>
                        <div className="p-6 flex justify-end bg-white/5">
                            <button onClick={() => setPresModal(null)} className="px-8 py-3 bg-rose-600 text-white font-black rounded-2xl hover:bg-rose-500 transition-all uppercase text-sm tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Dashboard de Cursos Bíblicos */}
            {presModal === 'cursos' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setPresModal(null)}>
                    <div className="bg-slate-100 border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden animate-in zoom-in-90 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-teal-700 to-teal-900 p-6 md:p-8 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Cursos Bíblicos</h3>
                                <p className="text-teal-300 text-xs font-bold mt-1">Por publicador, precursores y cuántos informan</p>
                            </div>
                            <button onClick={() => setPresModal(null)} className="text-white/60 hover:text-white text-3xl font-thin transition-colors w-10 h-10 flex items-center justify-center">✕</button>
                        </div>
                        <div className="p-5 md:p-6 overflow-y-auto max-h-[70vh]">
                            <DashboardCursos publishers={publishers} serviceReports={serviceReports} />
                        </div>
                        <div className="p-6 flex justify-end bg-white">
                            <button onClick={() => setPresModal(null)} className="px-8 py-3 bg-teal-600 text-white font-black rounded-2xl hover:bg-teal-500 transition-all uppercase text-sm tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Territorios (Registro de Asignación + Mapa Interactivo) */}
            {presModal === 'territorios' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setPresModal(null)}>
                    <div className="bg-slate-900 border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in-90 duration-300 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-amber-600 to-amber-900 p-6 md:p-8 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Territorios</h3>
                                <p className="text-amber-200 text-xs font-bold mt-1">Registro de asignación y mapa interactivo</p>
                            </div>
                            <button onClick={() => setPresModal(null)} className="text-white/60 hover:text-white text-3xl font-thin transition-colors w-10 h-10 flex items-center justify-center">✕</button>
                        </div>
                        <div className="flex gap-2 px-6 pt-4 shrink-0">
                            <button
                                onClick={() => setTerritorioTab('registro')}
                                className={`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${territorioTab === 'registro' ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                            >
                                📋 Registro de Asignación
                            </button>
                            <button
                                onClick={() => setTerritorioTab('mapa')}
                                className={`px-5 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${territorioTab === 'mapa' ? 'bg-amber-500 text-black' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                            >
                                🗺️ Mapa Interactivo
                            </button>
                        </div>
                        <div className="p-5 md:p-6 overflow-y-auto flex-1">
                            {territorioTab === 'registro' ? (
                                <TerritoryRegistroReadOnly territoryRecords={territoryRecords} territoryResponsible={territoryResponsible} />
                            ) : (
                                <div className="rounded-2xl overflow-hidden bg-white">
                                    <InteractiveMap
                                        maps={territoryMaps}
                                        markers={territoryMarkers}
                                        records={territoryRecords}
                                        canManage={false}
                                        onShowModal={onShowModal}
                                        currentServiceYear={currentServiceYear}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="p-6 flex justify-end bg-white/5 shrink-0">
                            <button onClick={() => setPresModal(null)} className="px-8 py-3 bg-amber-600 text-white font-black rounded-2xl hover:bg-amber-500 transition-all uppercase text-sm tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Directorio para Emergencias */}
            {presModal === 'emergencia' && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4" onClick={() => setPresModal(null)}>
                    <div className="bg-slate-900 border border-white/10 rounded-[3rem] shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-90 duration-300 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-red-700 to-red-900 p-6 md:p-8 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Directorio para Emergencias</h3>
                                <p className="text-red-200 text-xs font-bold mt-1">Contactos de emergencia de publicadores</p>
                            </div>
                            <button onClick={() => setPresModal(null)} className="text-white/60 hover:text-white text-3xl font-thin transition-colors w-10 h-10 flex items-center justify-center">✕</button>
                        </div>
                        <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-3">
                            {publishers
                                .filter(p => !(p.Baja === true || String(p.Baja || '').toLowerCase().trim().startsWith('s') || p.Baja === 'sí' || p.Baja === '1'))
                                .sort((a, b) => `${a.Nombre} ${a.Apellido}`.localeCompare(`${b.Nombre} ${b.Apellido}`))
                                .map(p => {
                                    const emergTel = String(p['Cel de Emergencia'] || '').replace(/\D/g, '');
                                    const ownTel = String(p.Cel || '').replace(/\D/g, '');
                                    return (
                                        <div key={p.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                                            <div className="flex items-center gap-3 p-4 border-b border-white/5">
                                                <div className="flex-1">
                                                    <span className="block text-white font-black text-lg leading-tight">{p.Nombre} {p.Apellido}</span>
                                                    <span className="block text-[10px] font-black text-red-400 uppercase tracking-widest">{p.Familia || 'Sin Familia'}</span>
                                                </div>
                                            </div>
                                            <div className="p-4 flex flex-wrap gap-3 items-center">
                                                <span className="text-slate-300 text-xs font-bold">
                                                    Contacto de emergencia: <span className="text-white">{p['Contacto de Emergencia'] || '---'}</span>
                                                </span>
                                                {emergTel && (
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <a href={`https://wa.me/${emergTel}`} target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center gap-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-400 px-4 py-2 rounded-xl font-bold text-xs transition-all">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12 1.007C5.936 1.007 1 5.943 1 12.003c0 1.951.497 3.786 1.374 5.377L1 23.01l5.788-1.352A10.954 10.954 0 0012 23c6.06 0 10.997-4.937 10.997-10.997C22.997 5.943 18.06 1.007 12 1.007" />
                                                            </svg>
                                                            WhatsApp
                                                        </a>
                                                        <a href={`tel:${emergTel}`}
                                                            className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-600/50 border border-white/10 text-slate-300 px-4 py-2 rounded-xl font-bold text-xs transition-all">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.49 10.61a19.79 19.79 0 01-3.07-8.68A2 2 0 012.4 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.87 6.87l1.27-.76a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                                                            </svg>
                                                            Llamar
                                                        </a>
                                                        <span className="text-slate-400 font-bold text-sm">{p['Cel de Emergencia']}</span>
                                                    </div>
                                                )}
                                                {!emergTel && ownTel && (
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <a href={`https://wa.me/${ownTel}`} target="_blank" rel="noopener noreferrer"
                                                            className="flex items-center gap-2 bg-green-600/20 hover:bg-green-600/40 border border-green-500/30 text-green-400 px-4 py-2 rounded-xl font-bold text-xs transition-all">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12 1.007C5.936 1.007 1 5.943 1 12.003c0 1.951.497 3.786 1.374 5.377L1 23.01l5.788-1.352A10.954 10.954 0 0012 23c6.06 0 10.997-4.937 10.997-10.997C22.997 5.943 18.06 1.007 12 1.007" />
                                                            </svg>
                                                            WhatsApp
                                                        </a>
                                                        <a href={`tel:${ownTel}`}
                                                            className="flex items-center gap-2 bg-slate-700/50 hover:bg-slate-600/50 border border-white/10 text-slate-300 px-4 py-2 rounded-xl font-bold text-xs transition-all">
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.49 10.61a19.79 19.79 0 01-3.07-8.68A2 2 0 012.4 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 7.91a16 16 0 006.87 6.87l1.27-.76a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                                                            </svg>
                                                            Llamar (cel. publicador)
                                                        </a>
                                                        <span className="text-slate-400 font-bold text-sm">{p.Cel}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                        <div className="p-6 flex justify-end bg-white/5 shrink-0">
                            <button onClick={() => setPresModal(null)} className="px-8 py-3 bg-red-600 text-white font-black rounded-2xl hover:bg-red-500 transition-all uppercase text-sm tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPublisherForModal && (
                <div className="relative z-[300]">
                    <PublisherRecordModal
                        publisher={selectedPublisherForModal}
                        serviceReports={serviceReports}
                        onClose={() => setSelectedPublisherForModal(null)}
                    />
                </div>
            )}
        </div>
    );
};

interface VisitaSCProps {
    publishers: Publisher[];
    lmSchedules: LMMeetingSchedule[];
    visitaData: VisitaSCData[];
    onSaveVisita: (data: VisitaSCData) => Promise<void>;
    onShowModal: (info: ModalInfo) => void;
    attendanceRecords: AttendanceRecord[];
    territoryRecords: TerritoryRecord[];
    serviceReports: ServiceReport[];
    territoryResponsible?: TerritoryResponsible | null;
    territoryMaps: TerritoryMap[];
    territoryMarkers: TerritoryMarker[];
}

const VisitaSC: React.FC<VisitaSCProps> = ({
    publishers,
    lmSchedules,
    visitaData,
    onSaveVisita,
    onShowModal,
    attendanceRecords,
    territoryRecords,
    serviceReports,
    territoryResponsible,
    territoryMaps,
    territoryMarkers
}) => {
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [isPresentationMode, setIsPresentationMode] = useState(false);
    const hasInitializedRef = useRef(false);

    // Initial load from URL params
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const dateParam = params.get('date');
        const presParam = params.get('presentacion');

        if (dateParam) {
            setSelectedDate(dateParam);
            const visit = visitaData.find(v => v.fechaInicio === dateParam);
            if (visit) {
                setDraft(JSON.parse(JSON.stringify(visit)));
            }
        } else if (!hasInitializedRef.current && visitaData.length > 0) {
            // Sin fecha en la URL: en vez de mostrar el calendario vacío,
            // se carga automáticamente la visita más relevante (la próxima
            // programada, o si no hay ninguna futura, la última que se
            // programó) para facilitar encontrarla.
            const todayIso = new Date().toISOString().split('T')[0];
            const sorted = [...visitaData].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
            const upcoming = sorted.find(v => v.fechaInicio >= todayIso);
            const defaultVisit = upcoming || sorted[sorted.length - 1];
            if (defaultVisit) {
                setSelectedDate(defaultVisit.fechaInicio);
                setDraft(JSON.parse(JSON.stringify(defaultVisit)));
            }
        }

        if (presParam === '1') {
            setIsPresentationMode(true);
        }
        hasInitializedRef.current = true;
    }, [visitaData]);

    const [isLoading, setIsLoading] = useState(false);

    // Draft state for editing
    const [draft, setDraft] = useState<VisitaSCData | null>(null);
    const [activeModal, setActiveModal] = useState<'meetings' | 'meals' | 'preaching' | 'pastoreo' | 'vym' | null>(null);
    const [programText, setProgramText] = useState('');

    const pdfRef = useRef<HTMLDivElement>(null);

    // Sync draft with selected visit
    const currentVisit = useMemo(() => {
        if (!selectedDate) return null;
        return visitaData.find(v => v.fechaInicio === selectedDate) || null;
    }, [selectedDate, visitaData]);

    const handleDateChange = (date: string) => {
        setSelectedDate(date);
        const visit = visitaData.find(v => v.fechaInicio === date);
        if (visit) {
            setDraft(JSON.parse(JSON.stringify(visit)));
        } else {
            // New visit template
            const startDate = new Date(date + 'T00:00:00');
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 5); // Sunday is 5 days after Tuesday

            const newVisit: VisitaSCData = {
                id: `visita-${date}`,
                fechaInicio: date,
                fechaFin: endDate.toISOString().split('T')[0],
                scName: '',
                scWifeName: '',
                discursoMartesTitulo: '',
                discursoDomingoTitulo: '',
                discursoConclusionTitulo: '',
                reuniones: {
                    vym: { hora: '19:30', lugar: 'Salón del Reino', dia: 'Martes' },
                    precursores: { hora: '18:15', lugar: 'Salón del Reino', dia: 'Viernes' },
                    ancianosSiervos: { hora: '18:15', lugar: 'Salón del Reino', dia: 'Sábado' },
                    finSemana: { hora: '16:30', lugar: 'Salón del Reino', dia: 'Domingo' }
                },
                discursoServicioTitulo: '',
                alimentos: {
                    miercoles: { familia: '', telefono: '', direccion: '' },
                    jueves: { familia: '', telefono: '', direccion: '' },
                    viernes: { familia: '', telefono: '', direccion: '' },
                    sabado: { familia: '', telefono: '', direccion: '' },
                    domingo: { familia: '', telefono: '', direccion: '' }
                },
                predicacion: {
                    miercoles: { manana: { lugar: '', hora: '09:30', publicadoresSC: '', publicadoresEsposa: '', capitan: '', notas: '' }, tarde: { lugar: '', hora: '16:00', publicadoresSC: '', publicadoresEsposa: '', capitan: '', notas: '' } },
                    jueves: { manana: { lugar: '', hora: '09:30', publicadoresSC: '', publicadoresEsposa: '', capitan: '', notas: '' }, tarde: { lugar: '', hora: '16:00', publicadoresSC: '', publicadoresEsposa: '', capitan: '', notas: '' } },
                    viernes: { manana: { lugar: '', hora: '09:30', publicadoresSC: '', publicadoresEsposa: '', capitan: '', notas: '' }, tarde: { lugar: '', hora: '16:00', publicadoresSC: '', publicadoresEsposa: '', capitan: '', notas: '' } },
                    sabado: { manana: { lugar: '', hora: '09:00', publicadoresSC: '', publicadoresEsposa: '', capitan: '', notas: '' }, tarde: { lugar: '', hora: '16:00', publicadoresSC: '', publicadoresEsposa: '', capitan: '', notas: '' } },
                    domingo: { manana: { lugar: '', hora: '09:30', publicadoresSC: '', publicadoresEsposa: '', capitan: '', notas: '' }, tarde: { lugar: '', hora: '16:00', publicadoresSC: '', publicadoresEsposa: '', capitan: '', notas: '' } }
                },
                pastoreo: []
            };
            setDraft(newVisit);
        }
    };



    const handleSaveDraft = async () => {
        if (!draft) return;
        setIsLoading(true);
        try {
            await onSaveVisita(draft);
            onShowModal({ type: 'success', title: 'Éxito', message: 'Datos guardados correctamente.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudieron guardar los datos.' });
        } finally {
            setIsLoading(false);
        }
    };

    const weekDays = useMemo(() => {
        if (!selectedDate) return [];
        const date = new Date(selectedDate + 'T00:00:00');
        const days = [];
        const names = ['Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        for (let i = 0; i < 6; i++) {
            const d = new Date(date);
            d.setDate(date.getDate() + i);
            days.push({
                name: names[i],
                date: d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }),
                iso: d.toISOString().split('T')[0]
            });
        }
        return days;
    }, [selectedDate]);

    const isLinkExpired = useMemo(() => {
        if (!draft?.fechaFin) return false;
        const now = new Date();
        const expiry = new Date(draft.fechaFin + 'T23:59:59');
        return now > expiry;
    }, [draft?.fechaFin]);

    // VyM Program for the selected week
    const currentVyMWeek = useMemo(() => {
        if (!selectedDate) return null;
        const date = new Date(selectedDate + 'T00:00:00');
        const year = date.getFullYear();
        const month = MONTHS[date.getMonth()];
        const schedule = lmSchedules.find(s => s.year === year && s.month === month);
        if (!schedule) return null;

        // Find the week that contains the selected date (Tuesday)
        // Usually the week range is formatted like "1-7 DE DICIEMBRE"
        // Let's try to find a match.
        const dayOfMonth = date.getDate();
        return schedule.weeks.find(w => {
            const range = w.weekRange || '';
            const match = range.match(/^(\d+)/);
            if (match) {
                const startDay = parseInt(match[1]);
                return Math.abs(startDay - dayOfMonth) <= 3; // Basic heuristic
            }
            return false;
        }) || null;
    }, [selectedDate, lmSchedules]);

    const getPublisherName = (id: string) => {
        const p = publishers.find(pub => pub.id === id);
        return p ? `${p.Nombre} ${p.Apellido}` : 'No asignado';
    };

    const generatePDF = async (elementId: string, filename: string) => {
        const element = document.getElementById(elementId);
        if (!element) return;
        setIsLoading(true);
        try {
            const canvas = await html2canvas(element, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'pt', 'letter');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(filename);
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error de PDF', message: 'No se pudo generar el PDF.' });
        } finally {
            setIsLoading(false);
        }
    };

    // --- Sub-components (Modals) moved outside for focus stability ---

    const checkPublisherCards = () => {
        const isBaja = (p: any) => p.Baja === true || p.Baja === 'Sí' || p.Baja === 'S' || p.Baja === '1';
        const activePublishers = publishers.filter(p => !isBaja(p));
        const missingUpdates = activePublishers.filter(p => {
            const reports = serviceReports.filter(r => r.idPublicador === p.id);
            // Check if there is a report for the current or previous month
            const now = new Date();
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthName = MONTHS[lastMonth.getMonth()];
            const hasReport = reports.some(r => (r.anioCalendario === now.getFullYear() && r.mes === MONTHS[now.getMonth()]) || (r.anioCalendario === lastMonth.getFullYear() && r.mes === lastMonthName));
            return !hasReport;
        });

        if (missingUpdates.length > 0) {
            onShowModal({
                type: 'info',
                title: 'Tarjetas Pendientes',
                message: `Faltan de actualizar ${missingUpdates.length} tarjetas de publicador. La descarga continuará.`
            });
        }
    };

    const handleDownloadCards = async () => {
        checkPublisherCards();
        setIsLoading(true);
        try {
            const isBaja = (p: any) => p.Baja === true || p.Baja === 'Sí' || p.Baja === 'S' || p.Baja === '1';
            const activePublishers = publishers.filter(p => !isBaja(p));
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();

            const drawCheckmark = (x: number, y: number) => {
                pdf.setLineWidth(0.5);
                pdf.line(x + 0.5, y - 1, x + 1.5, y);
                pdf.line(x + 1.5, y, x + 3.5, y - 3);
            };

            const drawS21Card = (p: Publisher, serviceYear: number, startY: number) => {
                // Header
                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.text('REGISTRO DE PUBLICADOR DE LA CONGREGACIÓN', pageWidth / 2, startY + 10, { align: 'center' });

                // Personal Info
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Nombre:', 15, startY + 20);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`${p.Nombre} ${p.Apellido} ${p['2do Apellido'] || ''}`, 35, startY + 20);
                pdf.line(35, startY + 21, 120, startY + 21);

                pdf.setFont('helvetica', 'bold');
                pdf.text('Fecha de nacimiento:', 15, startY + 27);
                pdf.setFont('helvetica', 'normal');
                pdf.text(p['Fecha de Nacimiento'] || '---', 55, startY + 27);
                pdf.line(55, startY + 28, 120, startY + 28);

                pdf.setFont('helvetica', 'bold');
                pdf.text('Fecha de bautismo:', 15, startY + 34);
                pdf.setFont('helvetica', 'normal');
                pdf.text(p['Fecha de bautismo'] || '---', 53, startY + 34);
                pdf.line(53, startY + 35, 120, startY + 35);

                // Sex and Hope Checkboxes
                const drawBoxLabeled = (x: number, y: number, label: string, checked: boolean) => {
                    pdf.rect(x, y - 3, 4, 4);
                    if (checked) drawCheckmark(x, y - 0.5);
                    pdf.setFontSize(9);
                    pdf.text(label, x + 6, y);
                };

                drawBoxLabeled(135, startY + 20, 'Hombre', p.Sexo === 'Hombre');
                drawBoxLabeled(175, startY + 20, 'Mujer', p.Sexo === 'Mujer');
                drawBoxLabeled(135, startY + 27, 'Otras ovejas', (p.Esperanza || '').toLowerCase().includes('oveja'));
                drawBoxLabeled(175, startY + 27, 'Ungido', (p.Esperanza || '').toLowerCase().includes('ungido'));

                // Privileges
                drawBoxLabeled(15, startY + 42, 'Anciano', p.Privilegio === 'Anciano');
                drawBoxLabeled(35, startY + 42, 'Siervo ministerial', p.Privilegio === 'Siervo Ministerial');
                drawBoxLabeled(75, startY + 42, 'Precursor regular', p['Priv Adicional'] === 'Precursor Regular');
                drawBoxLabeled(115, startY + 42, 'Precursor especial', p['Priv Adicional'] === 'Precursor Especial');
                drawBoxLabeled(155, startY + 42, 'Misionero que sirve en el campo', p['Priv Adicional'] === 'Misionero');

                // Reports Table
                const monthsInServiceYear = ['Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto'];

                let totalHours = 0;
                let totalCursos = 0;

                const tableBody = monthsInServiceYear.map(month => {
                    // Service year starts in Sept of prev calendar year if month is Sept-Dec
                    const calYear = ['Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].includes(month) ? serviceYear - 1 : serviceYear;
                    const report = serviceReports.find(r => r.idPublicador === p.id && r.mes === month && r.anioCalendario === calYear);

                    if (report?.horas) totalHours += Number(report.horas);
                    if (report?.cursosBiblicos) totalCursos += Number(report.cursosBiblicos);

                    return [
                        month,
                        report?.participacion ? 'X' : '',
                        report?.cursosBiblicos || '',
                        report?.precursorAuxiliar ? 'X' : '',
                        report?.horas || '',
                        report?.notas || ''
                    ];
                });

                autoTable(pdf, {
                    startY: startY + 48,
                    head: [[
                        { content: `Año de servicio\n${serviceYear - 1}-${serviceYear}`, styles: { halign: 'center' } },
                        { content: 'Participación\nen el ministerio', styles: { halign: 'center' } },
                        { content: 'Cursos\nbíblicos', styles: { halign: 'center' } },
                        { content: 'Precursor\nauxiliar', styles: { halign: 'center' } },
                        { content: 'Horas\n(Si es precursor o\nmisionero)', styles: { halign: 'center' } },
                        { content: 'Notas', styles: { halign: 'center' } }
                    ]],
                    body: tableBody,
                    theme: 'grid',
                    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 7, lineWidth: 0.1, fontStyle: 'bold' },
                    styles: { fontSize: 8, cellPadding: 1, halign: 'center', lineWidth: 0.1 },
                    columnStyles: {
                        0: { halign: 'left', cellWidth: 30 },
                        5: { halign: 'left' }
                    },
                    foot: [['', '', '', 'Total', totalHours || '', '']],
                    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 8, fontStyle: 'bold' },
                    willDrawCell: (data: any) => {
                        if (data.section === 'body' && (data.column.index === 1 || data.column.index === 3)) {
                            // Check if raw value is X or if the prepared text contains X
                            const content = Array.isArray(data.cell.text) ? data.cell.text.join('') : data.cell.text;
                            if (content.includes('X')) {
                                data.cell.text = []; // Clear text so it doesn't draw "X"
                            }
                        }
                    },
                    didDrawCell: (data: any) => {
                        if (data.section === 'body' && (data.column.index === 1 || data.column.index === 3)) {
                            // We check the ORIGINAL raw value, not the cleared text
                            if (data.cell.raw === 'X') {
                                const centerX = data.cell.x + data.cell.width / 2 - 2;
                                const centerY = data.cell.y + data.cell.height / 2 + 1;
                                drawCheckmark(centerX, centerY);
                            }
                        }
                    }
                });
            };

            const today = new Date();
            const currentServiceYear = today.getMonth() >= 8 ? today.getFullYear() + 1 : today.getFullYear();
            const prevServiceYear = currentServiceYear - 1;

            for (let i = 0; i < activePublishers.length; i++) {
                const p = activePublishers[i];
                if (i > 0) pdf.addPage();

                // Draw current year card
                drawS21Card(p, currentServiceYear, 5);

                // Draw previous year card separator or add page if it doesn't fit
                // actually better one sheet per year or two cards on same page if they fit
                // The S-21 card is about half page.
                const lastY = (pdf as any).lastAutoTable?.finalY || 0;
                if (lastY + 70 < pdf.internal.pageSize.getHeight()) {
                    pdf.setLineDashPattern([2, 1], 0);
                    pdf.line(10, lastY + 5, pageWidth - 10, lastY + 5);
                    pdf.setLineDashPattern([], 0);
                    drawS21Card(p, prevServiceYear, lastY + 10);
                } else {
                    pdf.addPage();
                    drawS21Card(p, prevServiceYear, 5);
                }
            }
            pdf.save(`Tarjetas_S21_${new Date().getFullYear()}.pdf`);
        } catch (error) {
            console.error(error);
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudieron generar las tarjetas.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadGeneralAttendance = async () => {
        setIsLoading(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const today = new Date();
            const currentServiceYear = today.getMonth() >= 8 ? today.getFullYear() + 1 : today.getFullYear();

            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('REGISTRO DE ASISTENCIA A LAS REUNIONES DE CONGREGACIÓN', pageWidth / 2, 15, { align: 'center' });

            const months = ['Septiembre', 'Octubre', 'Noviembre', 'Diciembre', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto'];

            const drawAttendanceSection = (title: string, y: number, isWeekend: boolean) => {
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text(title, 15, y);

                const tableData = months.map(month => {
                    const calYear = ['Septiembre', 'Octubre', 'Noviembre', 'Diciembre'].includes(month) ? currentServiceYear - 1 : currentServiceYear;
                    const record = attendanceRecords.find(r => r.mes === month && r.ano === calYear);

                    const prefix = isWeekend ? 'fs_sem' : 'es_sem';
                    const values = [1, 2, 3, 4, 5].map(i => Number((record as any)?.[`${prefix}${i}`] || 0)).filter(v => v > 0);
                    const total = values.reduce((a, b) => a + b, 0);
                    const count = values.length;
                    const avg = count > 0 ? (total / count).toFixed(1) : '';

                    return [
                        month,
                        count || '',
                        total || '',
                        avg || '',
                        month, // Empty for 2nd year if needed, but here we show both columns similarly or for two years?
                        '', '', '' // The original format has two columns for two different years usually.
                    ];
                });

                autoTable(pdf, {
                    startY: y + 2,
                    head: [
                        [
                            { content: `Año de servicio\n${currentServiceYear}`, rowSpan: 1 },
                            { content: 'Número de reuniones', rowSpan: 1 },
                            { content: 'Asistencia total', rowSpan: 1 },
                            { content: 'Promedio de asistencia semanal', rowSpan: 1 },
                            { content: `Año de servicio\n${currentServiceYear + 1}`, rowSpan: 1 },
                            { content: 'Número de reuniones', rowSpan: 1 },
                            { content: 'Asistencia total', rowSpan: 1 },
                            { content: 'Promedio de asistencia semanal', rowSpan: 1 }
                        ]
                    ],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 6, halign: 'center', lineWidth: 0.1 },
                    styles: { fontSize: 7, cellPadding: 1, halign: 'center', lineWidth: 0.1 },
                    columnStyles: {
                        0: { halign: 'left' },
                        4: { halign: 'left' }
                    },
                    foot: [['Promedio de asistencia mensual', '', '', '', 'Promedio de asistencia mensual', '', '', '']],
                    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontSize: 7, fontStyle: 'bold' }
                });
                return (pdf as any).lastAutoTable?.finalY + 10 || y + 50;
            };

            let currentY = 25;
            currentY = drawAttendanceSection('Reunión de entre semana', currentY, false);
            drawAttendanceSection('Reunión del fin de semana', currentY, true);

            const marginX = 15;
            const footerY = pdf.internal.pageSize.height - 10;
            pdf.setFontSize(8);
            pdf.text(`S-88-S 12/18`, marginX, footerY);
            // No territoryResponsible for attendance report, so this part is skipped as per original context.

            pdf.save('Asistencia_Anual.pdf');
        } catch (error) {
            console.error(error);
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo generar el reporte de asistencia.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadTerritoryRecord = async () => {
        setIsLoading(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'letter', true);
            const pageWidth = pdf.internal.pageSize.getWidth();
            const today = new Date();
            const currentServiceYear = today.getMonth() >= 8 ? today.getFullYear() + 1 : today.getFullYear();

            const drawTerritoryPage = (startNum: number, endNum: number, isSecondPage: boolean, isHistory: boolean) => {
                if (isSecondPage || isHistory) pdf.addPage();

                pdf.setFontSize(14);
                pdf.setFont('helvetica', 'bold');
                pdf.text('REGISTRO DE ASIGNACIÓN DE TERRITORIO', pageWidth / 2, 10, { align: 'center' });

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Año de servicio:', 10, 18);
                pdf.setFont('helvetica', 'normal');
                pdf.text(currentServiceYear.toString(), 40, 18);
                pdf.line(40, 19, 60, 19);

                const territories = Array.from({ length: endNum - startNum + 1 }, (_, i) => startNum + i);
                const tableBody: any[] = [];

                // Determine the "Current" and "History" blocks based on max progress
                const totalMaxVuelta = territoryRecords.length > 0 ? Math.max(...territoryRecords.map(r => Number(r.vueltaNum) || 0)) : 1;
                const recentBlockStart = Math.max(1, Math.floor((totalMaxVuelta - 1) / 4) * 4 + 1);
                const historyBlockStart = recentBlockStart > 4 ? recentBlockStart - 4 : -1;

                territories.forEach(num => {
                    const allRecords = [...territoryRecords]
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

                    const records: (TerritoryRecord | undefined)[] = [];
                    for (let v = 0; v < 4; v++) {
                        const targetVuelta = currentBlockStart + v;
                        const rec = allRecords.filter(r => Number(r.vueltaNum) === targetVuelta).pop();
                        records.push(rec);
                    }

                    // Col 1: Ultima fecha en que se completo*
                    const prevVueltaNum = currentBlockStart - 1;
                    const lastCompRecord = allRecords.filter(r => Number(r.vueltaNum) === prevVueltaNum).pop();
                    const lastComp = lastCompRecord?.completedDate || '';

                    // Each territory takes TWO physical rows
                    const row1 = [
                        { content: num.toString(), rowSpan: 2, styles: { valign: 'middle', fontStyle: 'bold', fontSize: 10, halign: 'center' } },
                        { content: lastComp, rowSpan: 2, styles: { valign: 'middle', fontSize: 7.5, halign: 'center' } },
                        { content: records[0]?.asignadoA || '', colSpan: 2, styles: { minCellHeight: 5.5 } },
                        { content: records[1]?.asignadoA || '', colSpan: 2, styles: { minCellHeight: 5.5 } },
                        { content: records[2]?.asignadoA || '', colSpan: 2, styles: { minCellHeight: 5.5 } },
                        { content: records[3]?.asignadoA || '', colSpan: 2, styles: { minCellHeight: 5.5 } }
                    ];
                    const row2 = [
                        { content: records[0]?.assignedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: records[0]?.completedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: records[1]?.assignedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: records[1]?.completedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: records[2]?.assignedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: records[2]?.completedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: records[3]?.assignedDate || '', styles: { minCellHeight: 5.5 } },
                        { content: records[3]?.completedDate || '', styles: { minCellHeight: 5.5 } }
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

            pdf.save('Registro_Territorios_S13.pdf');
        } catch (error) {
            console.error(error);
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo generar el registro de territorios.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadEmergencyData = async () => {
        setIsLoading(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();

            const grouped = publishers.reduce((acc: any, p) => {
                const group = p.Grupo || 'Sin Grupo';
                if (!acc[group]) acc[group] = [];
                acc[group].push(p);
                return acc;
            }, {});

            Object.keys(grouped).sort((a, b) => Number(a) - Number(b)).forEach((group, index) => {
                if (index > 0) pdf.addPage();

                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`DATOS DE EMERGENCIA - GRUPO ${group}`, pageWidth / 2, 20, { align: 'center' });

                const tableData = grouped[group]
                    .sort((a: any, b: any) => {
                        const famA = (a.Familia || '').toLowerCase();
                        const famB = (b.Familia || '').toLowerCase();
                        if (famA !== famB) return famA.localeCompare(famB);
                        return (a.Nombre + a.Apellido).toLowerCase().localeCompare((b.Nombre + b.Apellido).toLowerCase());
                    })
                    .map((p: any) => [
                        `${p.Nombre} ${p.Apellido}`,
                        p.Familia || '---',
                        p['Contacto de Emergencia'] || '---',
                        p['Cel de Emergencia'] || '---',
                        p.Cel || '---'
                    ]);

                autoTable(pdf, {
                    startY: 30,
                    head: [['Publicador', 'Familia', 'Contacto Emergencia', 'Tel. Emergencia', 'Tel. Publicador']],
                    body: tableData,
                    theme: 'grid',
                    headStyles: { fillColor: [200, 0, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
                    styles: { fontSize: 8 }
                });
            });

            pdf.save('Datos_Emergencia_Grupales.pdf');
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo generar el PDF de emergencia.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateVyMProgram = () => {
        if (!programText.trim() || !draft) return;
        setIsLoading(true);

        try {
            const lines = programText.split('\n').map(l => l.trim()).filter(Boolean);
            const weekBoundaries = lines.reduce<number[]>((acc, line, index) => {
                const dateRegex = /^(\d{1,2}(?:-\d{1,2})? DE [A-ZÁÉÍÓÚÑ]+)/i;
                if (dateRegex.test(line)) {
                    acc.push(index);
                }
                return acc;
            }, []);

            if (weekBoundaries.length === 0) {
                throw new Error("No se encontraron fechas de semana en el texto.");
            }

            const weekLines = lines.slice(weekBoundaries[0]); // Take the first week found

            let currentWeek: any = {
                weekRange: lines[weekBoundaries[0]], bibleReadingSource: null, song1: null, song2: null, song3: null,
                presidentId: null, finalPrayerId: null,
                treasuresParts: [], studentAssignments: [], christianLivingParts: [],
                hasCbs: false, cbsConductorId: null, cbsReaderId: null, cbsSource: null,
            };

            let currentSection: 'INIT' | 'TESOROS' | 'MAESTROS' | 'VIDA_CRISTIANA' = 'INIT';

            for (let j = 0; j < weekLines.length; j++) {
                const line = weekLines[j];
                if (/TESOROS DE LA BIBLIA/.test(line)) { currentSection = 'TESOROS'; continue; }
                if (/SEAMOS MEJORES MAESTROS/.test(line)) { currentSection = 'MAESTROS'; continue; }
                if (/NUESTRA VIDA CRISTIANA/.test(line)) { currentSection = 'VIDA_CRISTIANA'; continue; }
                if (/Lectura semanal de la Biblia: (.*)/i.test(line) || /Lectura semanal: (.*)/i.test(line)) {
                    currentWeek.bibleReadingSource = RegExp.$1.trim();
                    continue;
                }
                if (/^C(a|á)n(c|t)i(c|o)o?\s+(\d+)/i.test(line)) {
                    const songNumber = RegExp.$4;
                    if (!currentWeek.song1) currentWeek.song1 = songNumber;
                    else if (!currentWeek.song2) currentWeek.song2 = songNumber;
                    else currentWeek.song3 = songNumber;
                    continue;
                }

                const isNumberedLine = /^\d+\./.test(line);
                if (isNumberedLine) {
                    let duration = '';
                    let lineWithDuration = '';
                    let durationLineIndex = -1;
                    for (let k = j; k < weekLines.length; k++) {
                        const potentialLine = weekLines[k];
                        const durationMatch = potentialLine.match(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i);
                        if (durationMatch) {
                            duration = durationMatch[1].trim();
                            lineWithDuration = potentialLine;
                            durationLineIndex = k;
                            break;
                        }
                        if (k > j && (/^\d+\./.test(potentialLine) || /SEAMOS MEJORES MAESTROS|NUESTRA VIDA CRISTIANA|TESOROS DE LA BIBLIA|^C(a|á)n(c|t)i(c|o)o?\s+\d+/.test(potentialLine) || /Palabras de conclusión/.test(potentialLine))) break;
                    }

                    if (duration) {
                        let title = line.replace(/^\d+\.\s*/, '').trim();
                        let references: string | null = null;
                        switch (currentSection) {
                            case 'TESOROS': {
                                let partType = 'discurso_tesoros';
                                if (/Busquemos perlas escondidas/i.test(title)) partType = 'perlas';
                                else if (/Lectura de la Biblia/i.test(title)) {
                                    partType = 'lectura_biblia';
                                    references = lineWithDuration.replace(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i, '').trim();
                                }
                                currentWeek.treasuresParts.push({ title, duration, references, type: partType, assigneeId: null });
                                break;
                            }
                            case 'MAESTROS': {
                                const isDiscourse = /discurso/i.test(title);
                                const contentFromDurationLine = lineWithDuration.replace(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i, '').trim();
                                const refMatch = contentFromDurationLine.match(/^(.*?)\s*(\(.*\))$/);
                                if (refMatch) { title = refMatch[1].trim(); references = refMatch[2].trim(); }
                                else { title = contentFromDurationLine; references = ''; }
                                currentWeek.studentAssignments.push({ title, duration, references, type: isDiscourse ? 'discurso_estudiante' : 'demonstration', studentId: null, helperId: isDiscourse ? null : undefined });
                                break;
                            }
                            case 'VIDA_CRISTIANA': {
                                if (/Estudio bíblico de la congregación/i.test(title)) {
                                    currentWeek.hasCbs = true;
                                    references = lineWithDuration.replace(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i, '').trim();
                                    currentWeek.cbsSource = references;
                                } else {
                                    let finalTitle = durationLineIndex === j ? lineWithDuration.replace(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i, '').replace(/^\d+\.\s*/, '').trim() : [title, lineWithDuration.replace(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i, '').trim()].filter(Boolean).join(' ');
                                    const isVideo = /presentación de video/i.test(finalTitle);
                                    currentWeek.christianLivingParts.push({ title: isVideo ? finalTitle.replace(/\(presentación de video\)/i, '').trim() : finalTitle, duration, references: null, assigneeId: isVideo ? null : undefined, note: isVideo ? '(Presentación de video)' : null });
                                }
                                break;
                            }
                        }
                        if (durationLineIndex > j) j = durationLineIndex;
                    }
                }
            }

            setDraft({ ...draft, vymProgram: currentWeek });
            onShowModal({ type: 'success', title: 'Generado', message: 'Se ha generado el borrador del programa VyM para la visita.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: (error as Error).message });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadFullVisitProgram = async () => {
        if (!draft) return;
        setIsLoading(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'letter');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 15;

            // --- Page 1: General Info and Meetings ---
            pdf.setFontSize(18);
            pdf.setFont('helvetica', 'bold');
            pdf.text('PROGRAMA DE LA VISITA DEL SUPERINTENDENTE', pageWidth / 2, 20, { align: 'center' });

            pdf.setFontSize(12);
            pdf.text(`Congregación Cerro de la Silla`, pageWidth / 2, 28, { align: 'center' });
            pdf.text(`Semana del ${draft.fechaInicio} al ${draft.fechaFin}`, pageWidth / 2, 34, { align: 'center' });

            pdf.line(margin, 40, pageWidth - margin, 40);

            pdf.setFontSize(14);
            pdf.text('REUNIONES DURANTE LA VISITA DEL SC', margin, 50);

            const meetingData = [
                ['Reunión', 'Día', 'Hora', 'Lugar'],
                ['Vida y Ministerio (Martes)', draft.reuniones.vym.dia || 'Martes', draft.reuniones.vym.hora, draft.reuniones.vym.lugar],
                ['Reunión con Precursores', draft.reuniones.precursores.dia || 'Viernes', draft.reuniones.precursores.hora, draft.reuniones.precursores.lugar],
                ['Ancianos y Siervos', draft.reuniones.ancianosSiervos.dia || 'Sábado', draft.reuniones.ancianosSiervos.hora, draft.reuniones.ancianosSiervos.lugar],
                ['Reunión de fin de semana', draft.reuniones.finSemana.dia || 'Domingo', draft.reuniones.finSemana.hora, draft.reuniones.finSemana.lugar]
            ];

            autoTable(pdf, {
                startY: 55,
                head: [meetingData[0]],
                body: meetingData.slice(1),
                theme: 'grid',
                headStyles: { fillColor: [50, 50, 150] as any }
            });

            pdf.setFontSize(14);
            pdf.text('PLAN DE PREDICACIÓN', margin, (pdf as any).lastAutoTable.finalY + 15);

            const preachingData: any[] = [];
            ['miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].forEach(day => {
                const dayDataManana = (draft.predicacion as any)[day]?.manana;
                const dayDataTarde = (draft.predicacion as any)[day]?.tarde;

                if (dayDataManana) {
                    preachingData.push([
                        day.charAt(0).toUpperCase() + day.slice(1) + ' (Mañana)',
                        `${dayDataManana.lugar || '---'}${dayDataManana.direccion ? `\n${dayDataManana.direccion}` : ''}`,
                        dayDataManana.hora || '---',
                        dayDataManana.publicadoresSC || '---',
                        dayDataManana.publicadoresEsposa || '---',
                        dayDataManana.capitan || '---'
                    ]);
                }

                if (dayDataTarde) {
                    preachingData.push([
                        day.charAt(0).toUpperCase() + day.slice(1) + ' (Tarde)',
                        `${dayDataTarde.lugar || '---'}${dayDataTarde.direccion ? `\n${dayDataTarde.direccion}` : ''}`,
                        dayDataTarde.hora || '---',
                        dayDataTarde.publicadoresSC || '---',
                        dayDataTarde.publicadoresEsposa || '---',
                        dayDataTarde.capitan || '---'
                    ]);
                }
            });

            autoTable(pdf, {
                startY: (pdf as any).lastAutoTable.finalY + 20,
                head: [['Día', 'Encuentro', 'Hora', 'Acomp. SC', 'Acomp. Esposa', 'Asignación de Territorio']],
                body: preachingData,
                theme: 'grid',
                headStyles: { fillColor: [50, 150, 50] as any },
                styles: { fontSize: 8 }
            });

            pdf.setFontSize(14);
            pdf.text('VISITAS DE PASTOREO', margin, (pdf as any).lastAutoTable.finalY + 15);

            const pastoreoData = draft.pastoreo.map(v => [v.dia, v.hora, v.familia, getPublisherName(v.acompananteId), v.asunto]);
            autoTable(pdf, {
                startY: (pdf as any).lastAutoTable.finalY + 20,
                head: [['Día', 'Hora', 'Familia', 'Acompañante', 'Notas/Razón']],
                body: pastoreoData.length ? pastoreoData : [['---', '---', '---', '---', '---']],
                theme: 'grid',
                headStyles: { fillColor: [150, 50, 150] as any },
                styles: { fontSize: 8 }
            });

            // --- Page 2: Meals and VyM ---
            pdf.addPage();
            pdf.setFontSize(16);
            pdf.text('PROGRAMA DE ALIMENTOS', pageWidth / 2, 20, { align: 'center' });

            const mealsOrder = ['miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
            const mealData = mealsOrder.map(day => {
                const data = (draft.alimentos as any)[day];
                return [
                    day.charAt(0).toUpperCase() + day.slice(1),
                    data?.familia || '---',
                    data?.direccion || '---',
                    data?.telefono || '---'
                ];
            });

            autoTable(pdf, {
                startY: 30,
                head: [['Día', 'Anfitrión', 'Dirección', 'Teléfono']],
                body: mealData,
                theme: 'grid',
                headStyles: { fillColor: [200, 100, 0] as any }
            });

            if (draft.vymProgram) {
                pdf.setFontSize(16);
                pdf.text('PROGRAMA VIDA Y MINISTERIO (SEMANA DE VISITA)', pageWidth / 2, (pdf as any).lastAutoTable.finalY + 15, { align: 'center' });

                const vym = draft.vymProgram;
                const vymData: any[] = [
                    ['Asignación', 'Participante'],
                    ['Canción inicial', vym.song1 || '---'],
                    ['Presidente', getPublisherName(vym.presidentId)],
                    ['Oración Inicial', getPublisherName(vym.presidentId)], // Simplified
                    ['Tesoros (10 min)', getPublisherName(vym.treasuresParts[0]?.assigneeId)],
                    ['Busquemos perlas (10 min)', getPublisherName(vym.treasuresParts[1]?.assigneeId)],
                    ['Lectura de la Biblia (4 min)', getPublisherName(vym.treasuresParts[2]?.assigneeId)],
                ];

                vym.studentAssignments.forEach((a: any) => {
                    vymData.push([a.title, getPublisherName(a.studentId)]);
                });

                vymData.push(['Canción intermedio', vym.song2 || '---']);

                vym.christianLivingParts.forEach((a: any) => {
                    vymData.push([a.title, a.note || getPublisherName(a.assigneeId)]);
                });

                vymData.push([`Discurso de Servicio: ${draft.discursoServicioTitulo || ''}`, '30 min.']);
                vymData.push(['Canción final', `Canción ${vym.song3 || '---'}`]);
                vymData.push(['Oración de conclusión', 'Superintendente']);

                autoTable(pdf, {
                    startY: (pdf as any).lastAutoTable.finalY + 20,
                    head: [vymData[0]],
                    body: vymData.slice(1),
                    theme: 'striped',
                    headStyles: { fillColor: [100, 100, 100] as any },
                    bodyStyles: { minCellHeight: 8 }, // Increased space
                    columnStyles: {
                        0: { cellWidth: 100 },
                        1: { cellWidth: 70 }
                    }
                });

                // Add speech titles summary
                const speechY = (pdf as any).lastAutoTable.finalY + 15;
                if (speechY < pdf.internal.pageSize.getHeight() - 40) {
                    pdf.setFontSize(14);
                    pdf.text('TEMAS DE LOS DISCURSOS', margin, speechY);
                    pdf.setFontSize(10);
                    pdf.text(`Martes (Reunión): ${draft.discursoMartesTitulo || '---'}`, margin, speechY + 7);
                    pdf.text(`Viernes/Sábado (Ancianos/Precursores): ---`, margin, speechY + 14);
                    pdf.text(`Domingo (Reunión de fin de semana): ${draft.discursoDomingoTitulo || '---'}`, margin, speechY + 21);
                    pdf.text(`Conclusión: ${draft.discursoConclusionTitulo || '---'}`, margin, speechY + 28);
                }
            }

            pdf.save(`Programa_Visita_SC_${draft.fechaInicio}.pdf`);
            onShowModal({ type: 'success', title: 'Éxito', message: 'Programa completo generado correctamente.' });
        } catch (error) {
            console.error(error);
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo generar el programa completo.' });
        } finally {
            setIsLoading(false);
        }
    };

    // --- Main Render ---

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fade-in p-2 sm:p-0">
            {/* Header / Date Selector */}
            <div className="glass p-8 rounded-[2.5rem] shadow-2xl border border-white/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div>
                        <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-2">Visita del <span className="text-blue-600">Superintendente</span></h2>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Nombre del Superintendente de Circuito</label>
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    type="text"
                                    value={draft?.scName || ''}
                                    onChange={(e) => setDraft({ ...draft!, scName: e.target.value })}
                                    placeholder="Nombre del SC..."
                                    className="w-full p-3 bg-white/50 border-2 border-slate-100 rounded-xl focus:border-blue-500 transition-all outline-none font-bold"
                                />
                                <input
                                    type="text"
                                    value={draft?.scWifeName || ''}
                                    onChange={(e) => setDraft({ ...draft!, scWifeName: e.target.value })}
                                    placeholder="Nombre de la esposa..."
                                    className="w-full p-3 bg-white/50 border-2 border-slate-100 rounded-xl focus:border-blue-500 transition-all outline-none font-bold"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Discurso Martes</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={draft?.discursoMartesTitulo || ''}
                                        onChange={(e) => setDraft({ ...draft!, discursoMartesTitulo: e.target.value })}
                                        placeholder="Título martes..."
                                        className="flex-1 p-3 bg-white/50 border-2 border-slate-100 rounded-xl focus:border-blue-500 transition-all outline-none font-bold text-xs"
                                    />
                                    <input
                                        type="text"
                                        value={draft?.discursoMartesCancion || ''}
                                        onChange={(e) => setDraft({ ...draft!, discursoMartesCancion: e.target.value })}
                                        placeholder="Canción #"
                                        className="w-24 p-3 bg-white/50 border-2 border-slate-100 rounded-xl focus:border-blue-500 transition-all outline-none font-bold text-xs"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Título del discurso público</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={draft?.discursoDomingoTitulo || ''}
                                        onChange={(e) => setDraft({ ...draft!, discursoDomingoTitulo: e.target.value })}
                                        placeholder="Título público..."
                                        className="flex-1 p-3 bg-white/50 border-2 border-slate-100 rounded-xl focus:border-blue-500 transition-all outline-none font-bold text-xs"
                                    />
                                    <input
                                        type="text"
                                        value={draft?.discursoDomingoCancion || ''}
                                        onChange={(e) => setDraft({ ...draft!, discursoDomingoCancion: e.target.value })}
                                        placeholder="Canción #"
                                        className="w-24 p-3 bg-white/50 border-2 border-slate-100 rounded-xl focus:border-blue-500 transition-all outline-none font-bold text-xs"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-1">Título del discurso de conclusión</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={draft?.discursoConclusionTitulo || ''}
                                        onChange={(e) => setDraft({ ...draft!, discursoConclusionTitulo: e.target.value })}
                                        placeholder="Título conclusión..."
                                        className="flex-1 p-3 bg-white/50 border-2 border-slate-100 rounded-xl focus:border-blue-500 transition-all outline-none font-bold text-xs"
                                    />
                                    <input
                                        type="text"
                                        value={draft?.discursoConclusionCancion || ''}
                                        onChange={(e) => setDraft({ ...draft!, discursoConclusionCancion: e.target.value })}
                                        placeholder="Canción #"
                                        className="w-24 p-3 bg-white/50 border-2 border-slate-100 rounded-xl focus:border-blue-500 transition-all outline-none font-bold text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        {visitaData.length > 0 && (
                            <div className="w-full flex flex-col items-end gap-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Buscar visita programada</label>
                                <select
                                    value={selectedDate && visitaData.some(v => v.fechaInicio === selectedDate) ? selectedDate : ''}
                                    onChange={(e) => e.target.value && handleDateChange(e.target.value)}
                                    className="w-full max-w-xs text-sm font-bold p-3 bg-white border-none shadow-md rounded-xl focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                >
                                    <option value="">Seleccione una visita...</option>
                                    {[...visitaData]
                                        .sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio))
                                        .map(v => (
                                            <option key={v.fechaInicio} value={v.fechaInicio}>
                                                {v.fechaInicio} al {v.fechaFin}{v.scName ? ` — ${v.scName}` : ''}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        )}
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">O elija la fecha de inicio (Martes)</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => handleDateChange(e.target.value)}
                            className="text-xl font-bold p-4 bg-white border-none shadow-xl rounded-2xl focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                        />
                        {draft?.fechaFin && (
                            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase">Vence el: {draft.fechaFin} (Último día de visita)</p>
                        )}
                    </div>
                </div>
            </div>

            {!selectedDate ? (
                <div className="text-center py-24 bg-slate-50 rounded-[3rem] border-4 border-dashed border-slate-200">
                    <span className="text-6xl mb-4 block">📅</span>
                    <h3 className="text-2xl font-bold text-slate-400">Seleccione una fecha para comenzar la planeación</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Management Cards */}
                    <div className="lg:col-span-1 space-y-6">
                        <SectionCard
                            title="1. Programa de Reuniones"
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                            description="Horarios y lugares para las dif. reuniones con el SC."
                            onClick={() => setActiveModal('meetings')}
                            color="blue"
                        />
                        <SectionCard
                            title="2. Programa Reunión VyM"
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                            description="Genera y edita el programa de la semana de visita."
                            onClick={() => setActiveModal('vym')}
                            color="blue"
                        />
                        <SectionCard
                            title="3. Alimentos"
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>}
                            description="Familias anfitrionas para las comidas (Mié-Dom)."
                            onClick={() => setActiveModal('meals')}
                            color="orange"
                        />
                        <SectionCard
                            title="4. Predicación"
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>}
                            description="Plan diario de predicación y acompañantes."
                            onClick={() => setActiveModal('preaching')}
                            color="green"
                        />
                        <SectionCard
                            title="5. Visitas de Pastoreo"
                            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                            description="Organiza las visitas a los necesitados."
                            onClick={() => setActiveModal('pastoreo')}
                            color="purple"
                        />

                        {/* Reports Section */}
                        <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl space-y-6 text-white">
                            <h3 className="text-xl font-black uppercase tracking-widest border-b border-white/10 pb-4">Documentación SC</h3>
                            <div className="space-y-4">
                                <ReportButton icon="📋" label="Programa Completo de Visita" onClick={handleDownloadFullVisitProgram} />
                                <ReportButton icon="💳" label="Tarjetas de Publicador (S-21)" onClick={handleDownloadCards} />
                                <ReportButton icon="📊" label="Registro Anual Asistencia (S-88)" onClick={handleDownloadGeneralAttendance} />
                                <ReportButton icon="🗺️" label="Registro de Territorios (S-13)" onClick={handleDownloadTerritoryRecord} />
                                <ReportButton icon="🚨" label="Datos de Emergencia por Grupo" onClick={handleDownloadEmergencyData} />
                                <div className="pt-4 border-t border-white/5">
                                    <button
                                        onClick={() => setIsPresentationMode(true)}
                                        className="w-full p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl font-black uppercase text-xs tracking-tighter hover:scale-[1.02] transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center gap-3"
                                    >
                                        <span className="text-xl">📺</span> Vista de Presentación
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveDraft}
                            disabled={isLoading}
                            className="w-full py-6 bg-blue-600 text-white font-black text-xl rounded-[2rem] shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:bg-slate-300"
                        >
                            {isLoading ? 'Guardando...' : '💾 Guardar Todo'}
                        </button>
                    </div>

                    {/* Right Column: Previews & Programs */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* 2. Vida y Ministerio Preview */}
                        <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100" id="vym-week-pdf">
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Vida y Ministerio <span className="text-blue-500 font-light">| Semana de Visita</span></h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            const url = window.location.href; // In a real app this would be a specific shareable URL
                                            navigator.clipboard.writeText(url);
                                            onShowModal({ type: 'success', title: 'Enlace Copiado', message: 'El enlace a la presentación ha sido copiado al portapapeles. Puede pegarlo para generar un código QR.' });
                                        }}
                                        className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors flex items-center gap-2 font-bold text-xs"
                                    >
                                        🔗 Copiar Link
                                    </button>
                                    <button onClick={() => generatePDF('vym_program_full', 'Programa_VyM_Visita.pdf')} className="p-3 bg-blue-50 text-blue-600 rounded-2xl hover:bg-blue-100 transition-colors">📥</button>
                                </div>
                            </div>

                            {!(draft?.vymProgram || currentVyMWeek) ? (
                                <div className="p-12 text-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                                    <p className="text-slate-400 font-bold">No se encontró programa de VyM para esta semana. Por favor genere uno usando el botón de la izquierda o asegúrese de que el programa del mes esté generado.</p>
                                </div>
                            ) : (
                                <div id="vym_program_full" className="space-y-6 p-4">
                                    {(() => {
                                        const displayVym = draft?.vymProgram || currentVyMWeek;
                                        if (!displayVym) return null;
                                        return (
                                            <>
                                                <div className="bg-blue-600 text-white p-6 rounded-3xl text-center shadow-lg">
                                                    <h4 className="text-3xl font-black">{displayVym.weekRange}</h4>
                                                    <p className="opacity-80 font-bold uppercase tracking-widest text-sm mt-1">Visita del Superintendente de Circuito</p>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex justify-between border-b py-2"><span className="font-bold">Presidente:</span> <span>{getPublisherName(displayVym.presidentId)}</span></div>
                                                    <div className="flex justify-between border-b py-2"><span className="font-bold">Canción Inicial:</span> <span>{displayVym.song1}</span></div>

                                                    <div className="py-4">
                                                        <h5 className="font-black text-yellow-600 uppercase text-xs mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-yellow-400 rounded-full"></span> Tesoros de la Biblia</h5>
                                                        {displayVym.treasuresParts?.map((p: any, i: number) => (
                                                            <div key={i} className="flex flex-col md:flex-row md:justify-between items-start md:items-center py-2 border-b border-slate-50 gap-1 md:gap-4">
                                                                <span className="text-sm font-bold text-slate-700 leading-tight">{p.title}</span>
                                                                <span className="text-xs font-black text-yellow-600 bg-yellow-50 px-2 py-1 rounded-md uppercase tracking-tighter shrink-0">{getPublisherName(p.assigneeId)}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="py-4">
                                                        <h5 className="font-black text-green-600 uppercase text-xs mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-green-400 rounded-full"></span> Maestros</h5>
                                                        {displayVym.studentAssignments?.map((p: any, i: number) => (
                                                            <div key={i} className="flex flex-col md:flex-row md:justify-between items-start md:items-center py-2 border-b border-slate-50 gap-1 md:gap-4">
                                                                <span className="text-sm font-bold text-slate-700 leading-tight">{p.title}</span>
                                                                <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-1 rounded-md uppercase tracking-tighter shrink-0">
                                                                    {getPublisherName(p.studentId)}
                                                                    {p.helperId && ` / ${getPublisherName(p.helperId)}`}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="py-4 bg-slate-50 p-4 rounded-2xl border-l-4 border-blue-500">
                                                        <h5 className="font-black text-blue-600 uppercase text-xs mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-blue-400 rounded-full"></span> Nuestra Vida Cristiana</h5>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-sm py-1 font-bold"><span>Canción:</span> <span>{displayVym.song2}</span></div>
                                                            {displayVym.christianLivingParts?.map((p: any, i: number) => (
                                                                <div key={i} className="flex flex-col md:flex-row md:justify-between items-start md:items-center py-2 border-b border-slate-50/10 gap-1 md:gap-4">
                                                                    <span className="text-sm font-bold text-slate-700 leading-tight">{p.title}</span>
                                                                    <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-tighter shrink-0">{p.note || getPublisherName(p.assigneeId)}</span>
                                                                </div>
                                                            ))}
                                                            <div className="bg-blue-100 p-4 rounded-xl mt-4 border-2 border-blue-200">
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <span className="font-black text-blue-800 uppercase text-xs">DISCURSO DE SERVICIO</span>
                                                                    <span className="text-blue-600 font-black">30 MIN.</span>
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    placeholder="Título del discurso..."
                                                                    value={draft?.discursoServicioTitulo}
                                                                    onChange={(e) => setDraft({ ...draft!, discursoServicioTitulo: e.target.value })}
                                                                    className="w-full bg-white/50 p-2 rounded-lg border-2 border-transparent focus:border-blue-400 outline-none font-bold text-slate-700"
                                                                />
                                                            </div>
                                                            <div className="flex justify-between text-sm py-1 font-bold"><span>Canción:</span> <span>{displayVym.song3 || '---'}</span></div>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between border-t border-b py-4 font-black text-slate-800">
                                                        <span>Oración Final</span>
                                                        <span className="text-blue-600">{draft?.scName || 'Superintendente de Circuito'}</span>
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        {/* Combined Weekly Program Preview */}
                        <div className="bg-slate-50 p-8 rounded-[3rem] border-2 border-slate-100" id="full-weekly-program">
                            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter mb-8 flex justify-between items-center">
                                Plan General de la Visita
                                <button onClick={() => generatePDF('full_visit_program', 'Plan_Completo_Visita.pdf')} className="text-sm bg-white p-3 rounded-2xl shadow-sm">Descargar Todo</button>
                            </h3>

                            <div id="full_visit_program" className="bg-white rounded-[2rem] p-10 shadow-lg space-y-12">
                                <div className="text-center">
                                    <p className="text-xl font-bold text-blue-600 uppercase tracking-widest">Semana de Visita del SC</p>
                                    <p className="text-slate-400 mt-2 font-medium">Congregación Cerro de la Silla</p>

                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 text-left border-y border-slate-100 py-6">
                                        <div className="p-4 md:p-0 bg-slate-50 md:bg-transparent rounded-2xl border border-slate-200 md:border-none">
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">Discurso Martes</span>
                                            <span className="text-sm font-bold text-slate-700 block leading-tight">{draft?.discursoMartesTitulo || '---'}</span>
                                            {draft?.discursoMartesCancion && <span className="text-[10px] text-slate-500 font-bold mt-1 block">Canción {draft.discursoMartesCancion}</span>}
                                        </div>
                                        <div className="p-4 md:p-0 bg-slate-50 md:bg-transparent rounded-2xl border border-slate-200 md:border-none">
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">Discurso Público</span>
                                            <span className="text-sm font-bold text-slate-700 block leading-tight">{draft?.discursoDomingoTitulo || '---'}</span>
                                            {draft?.discursoDomingoCancion && <span className="text-[10px] text-slate-500 font-bold mt-1 block">Canción {draft.discursoDomingoCancion}</span>}
                                        </div>
                                        <div className="p-4 md:p-0 bg-slate-50 md:bg-transparent rounded-2xl border border-slate-200 md:border-none">
                                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">Discurso Conclusión</span>
                                            <span className="text-sm font-bold text-slate-700 block leading-tight">{draft?.discursoConclusionTitulo || '---'}</span>
                                            {draft?.discursoConclusionCancion && <span className="text-[10px] text-slate-500 font-bold mt-1 block">Canción {draft.discursoConclusionCancion}</span>}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-slate-400 text-xs">Reuniones de Entre Semana</h4>
                                        <div className="space-y-4">
                                            <MeetingMiniRow label="Vida y Ministerio" details={draft?.reuniones.vym} />
                                            <MeetingMiniRow label="Reunión con Precursores" details={draft?.reuniones.precursores} />
                                            <MeetingMiniRow label="Ancianos y Siervos" details={draft?.reuniones.ancianosSiervos} />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="font-black uppercase tracking-widest text-slate-400 text-xs">Reunión de Fin de Semana</h4>
                                        <MeetingMiniRow label="Reunión Pública" details={draft?.reuniones.finSemana} />
                                    </div>
                                </div>

                                {/* Preaching & Meals Summary */}
                                <div className="space-y-6">
                                    <h4 className="font-black uppercase tracking-widest text-blue-600 text-center text-sm">CRONOGRAMA DIARIO</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                        {['Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map((day) => {
                                            const dayKey = day.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                                            const meal = (draft?.alimentos as any)?.[dayKey];
                                            const preachingManana = (draft?.predicacion as any)?.[dayKey]?.manana;
                                            const preachingTarde = (draft?.predicacion as any)?.[dayKey]?.tarde;
                                            const pastoreoVisits = draft?.pastoreo?.filter(v => v.dia === day) || [];

                                            return (
                                                <div key={day} className="bg-slate-50 p-4 rounded-2xl space-y-3">
                                                    <div className="text-center border-b pb-2">
                                                        <span className="block font-black text-slate-900 text-sm">{day}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold">{weekDays.find(d => d.name === day)?.date}</span>
                                                    </div>
                                                    <div className="space-y-3">
                                                        {(() => {
                                                            const dailyEvents: any[] = [];
                                                            if (preachingManana?.lugar) {
                                                                dailyEvents.push({
                                                                    hora: preachingManana.hora || '09:00',
                                                                    type: 'preach',
                                                                    label: 'PREDICACIÓN EN LA MAÑANA',
                                                                    lugar: preachingManana.lugar,
                                                                    direccion: preachingManana.direccion,
                                                                    capitan: preachingManana.capitan,
                                                                    color: 'green'
                                                                });
                                                            }
                                                            if (preachingTarde?.lugar && day !== 'Sábado' && day !== 'Domingo') {
                                                                dailyEvents.push({
                                                                    hora: preachingTarde.hora || '16:00',
                                                                    type: 'preach',
                                                                    label: 'TARDE',
                                                                    lugar: preachingTarde.lugar,
                                                                    direccion: preachingTarde.direccion,
                                                                    capitan: preachingTarde.capitan,
                                                                    color: 'blue'
                                                                });
                                                            }
                                                            pastoreoVisits.forEach(v => {
                                                                dailyEvents.push({
                                                                    hora: v.hora || '00:00',
                                                                    type: 'pastoreo',
                                                                    label: 'PASTOREO',
                                                                    familia: v.familia,
                                                                    color: 'purple'
                                                                });
                                                            });

                                                            const sortedEvents = dailyEvents.sort((a, b) => (a.hora || '00:00').localeCompare(b.hora || '00:00'));

                                                            return (
                                                                <>
                                                                    {sortedEvents.map((evt, idx) => (
                                                                        <div key={idx} className={`${evt.color === 'green' ? 'bg-green-100/60 border-green-200' : evt.color === 'blue' ? 'bg-blue-100/60 border-blue-200' : 'bg-purple-100/60 border-purple-200'} p-3 rounded-xl border shadow-sm`}>
                                                                            <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                                                                                <span className={`text-[9px] font-black ${evt.color === 'green' ? 'text-green-700' : evt.color === 'blue' ? 'text-blue-700' : 'text-purple-700'} uppercase tracking-tight`}>{evt.label}</span>
                                                                                <span className="text-[10px] font-black text-slate-900 bg-white/70 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">{evt.hora}</span>
                                                                            </div>
                                                                            <span className="text-xs block font-bold text-slate-800 leading-tight mb-1">{evt.type === 'preach' ? evt.lugar : evt.familia}</span>
                                                                            {evt.direccion && <span className="text-[10px] text-slate-500 font-medium block leading-tight mb-1">{evt.direccion}</span>}
                                                                            {evt.capitan && <span className="text-[10px] text-slate-500 font-bold block">Cap: {evt.capitan}</span>}
                                                                        </div>
                                                                    ))}
                                                                    <div className="bg-orange-100/60 border border-orange-200 p-3 rounded-xl shadow-sm">
                                                                        <span className="text-[10px] font-black text-orange-700 block mb-1 uppercase tracking-tight">COMIDA</span>
                                                                        <span className="text-xs block font-bold text-slate-800 leading-tight">{meal?.familia || 'No asignado'}</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="text-center pt-10 border-t">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Vista de Presentación</p>
                                    <div className="w-40 h-40 bg-slate-200 mx-auto rounded-2xl flex flex-col items-center justify-center text-slate-400 font-black overflow-hidden relative">
                                        {isLinkExpired ? (
                                            <div className="absolute inset-0 bg-red-100 flex flex-col items-center justify-center text-red-500 p-2">
                                                <span className="text-2xl">⚡</span>
                                                <span className="text-[10px] uppercase font-black">Visita Finalizada</span>
                                                <span className="text-[9px] mt-1">QR Deshabilitado</span>
                                            </div>
                                        ) : (
                                            <div className="p-2 bg-white rounded-xl">
                                                <QRCodeSVG
                                                    value={`${window.location.origin}/?view=visitaSC&presentacion=1&date=${selectedDate}`}
                                                    size={120}
                                                    level="H"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-3 font-medium">QR válido hasta: <span className="font-black text-slate-600">{draft?.fechaFin || '---'}</span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals Container */}
            {activeModal === 'meetings' && <MeetingsModal draft={draft} setDraft={setDraft} onClose={() => setActiveModal(null)} />}
            {activeModal === 'meals' && <MealsModal draft={draft} setDraft={setDraft} onClose={() => setActiveModal(null)} />}
            {activeModal === 'preaching' && <PreachingModal draft={draft} setDraft={setDraft} onClose={() => setActiveModal(null)} />}
            {activeModal === 'pastoreo' && <PastoreoModal draft={draft} setDraft={setDraft} publishers={publishers} onClose={() => setActiveModal(null)} />}
            {activeModal === 'vym' && (
                <VyMProgramModal
                    draft={draft}
                    setDraft={setDraft}
                    programText={programText}
                    setProgramText={setProgramText}
                    onGenerate={handleGenerateVyMProgram}
                    onClose={() => setActiveModal(null)}
                    publishers={publishers}
                    getPublisherName={getPublisherName}
                />
            )}
            {isPresentationMode && draft && (
                <PresentationView
                    publishers={publishers}
                    draft={draft}
                    selectedDate={selectedDate}
                    onClose={() => setIsPresentationMode(false)}
                    serviceReports={serviceReports}
                    attendanceRecords={attendanceRecords}
                    territoryRecords={territoryRecords}
                    territoryResponsible={territoryResponsible}
                    territoryMaps={territoryMaps}
                    territoryMarkers={territoryMarkers}
                    onShowModal={onShowModal}
                    onDownload={handleDownloadFullVisitProgram}
                    getPublisherName={getPublisherName}
                />
            )}
        </div>
    );
};

interface VyMModalProps extends ModalProps {
    programText: string;
    setProgramText: (t: string) => void;
    onGenerate: () => void;
    publishers: Publisher[];
    getPublisherName: (id: string) => string;
}

const VyMProgramModal: React.FC<VyMModalProps> = ({ draft, setDraft, programText, setProgramText, onGenerate, onClose, publishers, getPublisherName }) => {

    const handleEditChange = (path: string, value: string) => {
        if (!draft?.vymProgram) return;
        const newVym = JSON.parse(JSON.stringify(draft.vymProgram));
        const keys = path.split('.');
        let current = newVym;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        setDraft({ ...draft, vymProgram: newVym });
    };

    const getEligible = (role: string) => {
        return publishers.filter(p => {
            const isBaja = p.Baja === true || p.Baja === 'Sí' || p.Baja === 'S' || p.Baja === '1';
            return p.Estatus === 'Activo' && !isBaja;
        }).sort((a, b) => a.Nombre.localeCompare(b.Nombre));
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-blue-600 p-6 text-white flex justify-between items-center shrink-0">
                    <h3 className="text-2xl font-black uppercase tracking-tight">Programa Reunión VyM</h3>
                    <button onClick={onClose}>✕</button>
                </div>
                <div className="p-8 overflow-y-auto space-y-6">
                    {!draft?.vymProgram ? (
                        <div className="space-y-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Pegue aquí el programa de la Guía de Actividades</label>
                            <textarea
                                value={programText}
                                onChange={(e) => setProgramText(e.target.value)}
                                className="w-full h-64 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-500 font-medium"
                                placeholder="Ej: 22-28 DE DICIEMBRE | Lectura semanal: ..."
                            />
                            <button onClick={onGenerate} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl">Generar Programa</button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl">
                                <span className="font-bold text-blue-800">{draft.vymProgram.weekRange}</span>
                                <button onClick={() => setDraft({ ...draft, vymProgram: undefined })} className="text-xs text-red-500 font-bold uppercase underline">Borrar y empezar de nuevo</button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase">Presidente</label>
                                    <select
                                        value={draft.vymProgram.presidentId || ''}
                                        onChange={(e) => handleEditChange('presidentId', e.target.value)}
                                        className="w-full p-3 border-2 border-slate-100 rounded-xl"
                                    >
                                        <option value="">Vacante</option>
                                        {getEligible('vym_presidente').map(p => <option key={p.id} value={p.id}>{p.Nombre} {p.Apellido}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {['song1', 'song2', 'song3'].map(s => (
                                        <div key={s}>
                                            <label className="text-[10px] font-black text-slate-400 uppercase">Canción {s.slice(-1)}</label>
                                            <input type="text" value={draft.vymProgram![s] || ''} onChange={(e) => handleEditChange(s, e.target.value)} className="w-full p-3 border-2 border-slate-100 rounded-xl" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-black text-xs text-yellow-600 uppercase tracking-widest">Tesoros</h4>
                                {draft.vymProgram.treasuresParts.map((p: any, i: number) => (
                                    <div key={i} className="flex gap-4 items-center">
                                        <span className="text-xs font-bold w-48 truncate">{p.title}</span>
                                        <select
                                            value={p.assigneeId || ''}
                                            onChange={(e) => handleEditChange(`treasuresParts.${i}.assigneeId`, e.target.value)}
                                            className="flex-1 p-2 border rounded-lg text-sm"
                                        >
                                            <option value="">Vacante</option>
                                            {getEligible('vym_tesoros').map(p => <option key={p.id} value={p.id}>{p.Nombre} {p.Apellido}</option>)}
                                        </select>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-black text-xs text-green-600 uppercase tracking-widest">Maestros</h4>
                                {draft.vymProgram.studentAssignments.map((p: any, i: number) => (
                                    <div key={i} className="flex flex-col gap-1">
                                        <div className="flex gap-4 items-center">
                                            <span className="text-xs font-bold w-48 truncate">{p.title}</span>
                                            <select
                                                value={p.studentId || ''}
                                                onChange={(e) => handleEditChange(`studentAssignments.${i}.studentId`, e.target.value)}
                                                className="flex-1 p-2 border rounded-lg text-sm"
                                            >
                                                <option value="">Vacante</option>
                                                {getEligible('vym_revisita').map(p => <option key={p.id} value={p.id}>{p.Nombre} {p.Apellido}</option>)}
                                            </select>
                                        </div>
                                        {p.type !== 'discurso_estudiante' && (
                                            <div className="flex gap-4 items-center pl-4">
                                                <span className="text-[10px] font-bold w-44 truncate text-slate-400 uppercase">/ Ayudante</span>
                                                <select
                                                    value={p.helperId || ''}
                                                    onChange={(e) => handleEditChange(`studentAssignments.${i}.helperId`, e.target.value)}
                                                    className="flex-1 p-2 border rounded-lg text-sm"
                                                >
                                                    <option value="">Vacante</option>
                                                    {getEligible('vym_revisita').filter(pub => pub.id !== p.studentId).map(pub => <option key={pub.id} value={pub.id}>{pub.Nombre} {pub.Apellido}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-black text-xs text-blue-600 uppercase tracking-widest">Vida Cristiana</h4>
                                {draft.vymProgram.christianLivingParts.map((p: any, i: number) => (
                                    <div key={i} className="flex gap-4 items-center">
                                        <span className="text-xs font-bold w-48 truncate">{p.title}</span>
                                        {p.note ? <span className="text-xs italic text-slate-400">{p.note}</span> : (
                                            <select
                                                value={p.assigneeId || ''}
                                                onChange={(e) => handleEditChange(`christianLivingParts.${i}.assigneeId`, e.target.value)}
                                                className="flex-1 p-2 border rounded-lg text-sm"
                                            >
                                                <option value="">Vacante</option>
                                                {getEligible('vym_vida_cristiana').map(p => <option key={p.id} value={p.id}>{p.Nombre} {p.Apellido}</option>)}
                                            </select>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-slate-50 flex justify-end shrink-0">
                    <button onClick={onClose} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl">Cerrar</button>
                </div>
            </div>
        </div>
    );
};

// --- Modal Components Defined Outside to prevent focus loss ---

interface ModalProps {
    draft: VisitaSCData | null;
    setDraft: (d: VisitaSCData) => void;
    onClose: () => void;
}

const MeetingsModal: React.FC<ModalProps> = ({ draft, setDraft, onClose }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                <h3 className="text-2xl font-black uppercase tracking-tight">Horarios de Reuniones</h3>
                <button onClick={onClose} className="hover:rotate-90 transition-transform">✕</button>
            </div>
            <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {Object.entries(draft?.reuniones || {}).map(([key, value]) => (
                        <div key={key} className="space-y-4 border-b border-slate-100 pb-6">
                            <label className="text-sm font-black text-slate-700 capitalize flex justify-between">
                                <span>
                                    {key === 'vym' ? 'Vida y Ministerio' :
                                        key === 'precursores' ? 'Reunión Precursores' :
                                            key === 'ancianosSiervos' ? 'Ancianos y Siervos' : 'Reunión Pública'}
                                </span>
                            </label>
                            <div className="grid grid-cols-3 gap-4">
                                <input
                                    type="text"
                                    placeholder="Día"
                                    value={value.dia}
                                    onChange={(e) => setDraft({ ...draft!, reuniones: { ...draft!.reuniones, [key]: { ...value, dia: e.target.value } } })}
                                    className="p-5 border-2 border-slate-100 rounded-2xl focus:border-blue-500 transition-colors text-xl font-black"
                                />
                                <input
                                    type="text"
                                    placeholder="Hora"
                                    value={value.hora}
                                    onChange={(e) => setDraft({ ...draft!, reuniones: { ...draft!.reuniones, [key]: { ...value, hora: e.target.value } } })}
                                    className="p-5 border-2 border-slate-100 rounded-2xl focus:border-blue-500 transition-colors text-xl font-black"
                                />
                                <input
                                    type="text"
                                    placeholder="Lugar"
                                    value={value.lugar}
                                    onChange={(e) => setDraft({ ...draft!, reuniones: { ...draft!.reuniones, [key]: { ...value, lugar: e.target.value } } })}
                                    className="p-5 border-2 border-slate-100 rounded-2xl focus:border-blue-500 transition-colors text-xl font-black"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end">
                <button onClick={onClose} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200">Aceptar</button>
            </div>
        </div>
    </div>
);

const MealsModal: React.FC<ModalProps> = ({ draft, setDraft, onClose }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="bg-orange-600 p-6 text-white flex justify-between items-center">
                <h3 className="text-2xl font-black uppercase tracking-tight">Programa de Alimentos</h3>
                <button onClick={onClose}>✕</button>
            </div>
            <div className="p-8 overflow-y-auto max-h-[70vh]">
                <div className="space-y-6">
                    {['miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map((day) => (
                        <div key={day} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border-b border-slate-100 pb-4">
                            <div className="font-black text-slate-400 uppercase tracking-widest text-xs">{day}</div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Familia</label>
                                <input
                                    type="text"
                                    value={(draft?.alimentos as any)?.[day]?.familia}
                                    onChange={(e) => setDraft({ ...draft!, alimentos: { ...draft!.alimentos, [day]: { ...(draft!.alimentos as any)[day], familia: e.target.value } } })}
                                    className="w-full p-3 border-2 border-slate-100 rounded-lg focus:border-orange-500 font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</label>
                                <input
                                    type="text"
                                    value={(draft?.alimentos as any)?.[day]?.telefono}
                                    onChange={(e) => setDraft({ ...draft!, alimentos: { ...draft!.alimentos, [day]: { ...(draft!.alimentos as any)[day], telefono: e.target.value } } })}
                                    className="w-full p-3 border-2 border-slate-100 rounded-lg focus:border-orange-500 font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Dirección</label>
                                <input
                                    type="text"
                                    value={(draft?.alimentos as any)?.[day]?.direccion}
                                    onChange={(e) => setDraft({ ...draft!, alimentos: { ...draft!.alimentos, [day]: { ...(draft!.alimentos as any)[day], direccion: e.target.value } } })}
                                    className="w-full p-3 border-2 border-slate-100 rounded-lg focus:border-orange-500 font-bold"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button onClick={onClose} className="px-6 py-3 font-bold text-slate-500 rounded-xl">Cerrar</button>
                <button onClick={onClose} className="px-8 py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 transition-all">Guardar</button>
            </div>
        </div>
    </div>
);

const PreachingModal: React.FC<ModalProps> = ({ draft, setDraft, onClose }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden">
            <div className="bg-green-600 p-6 text-white flex justify-between items-center">
                <h3 className="text-2xl font-black uppercase tracking-tight">Plan de Predicación</h3>
                <button onClick={onClose}>✕</button>
            </div>
            <div className="p-8 overflow-y-auto max-h-[80vh]">
                <div className="space-y-8">
                    {['miercoles', 'jueves', 'viernes', 'sabado', 'domingo'].map((day) => (
                        <div key={day} className="space-y-4 bg-slate-50 p-6 rounded-2xl">
                            <h4 className="font-black text-slate-800 uppercase tracking-widest">{day}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {['manana', 'tarde'].map((slice) => {
                                    if ((day === 'sabado' || day === 'domingo') && slice === 'tarde') return null;

                                    return (
                                        <div key={slice} className="space-y-4 bg-white p-4 rounded-xl shadow-sm">
                                            <div className="flex justify-between items-center border-b pb-2">
                                                <span className="font-bold text-green-700 uppercase text-xs">{slice === 'manana' ? 'Mañana' : 'Tarde'}</span>
                                            </div>
                                            <div className="space-y-4">
                                                <input
                                                    type="text"
                                                    placeholder="Punto de encuentro"
                                                    value={(draft?.predicacion as any)?.[day]?.[slice]?.lugar}
                                                    onChange={(e) => setDraft({ ...draft!, predicacion: { ...draft!.predicacion, [day]: { ...(draft!.predicacion as any)[day], [slice]: { ...(draft!.predicacion as any)[day][slice], lugar: e.target.value } } } })}
                                                    className="w-full text-lg font-bold p-3 bg-slate-50 border-2 border-slate-100 focus:border-green-500 focus:bg-white rounded-xl transition-all"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Dirección del lugar"
                                                    value={(draft?.predicacion as any)?.[day]?.[slice]?.direccion || ''}
                                                    onChange={(e) => setDraft({ ...draft!, predicacion: { ...draft!.predicacion, [day]: { ...(draft!.predicacion as any)[day], [slice]: { ...(draft!.predicacion as any)[day][slice], direccion: e.target.value } } } })}
                                                    className="w-full text-sm font-medium p-3 bg-slate-50 border-2 border-slate-100 focus:border-green-500 rounded-xl transition-all"
                                                />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-400 uppercase">Acompañan al SC</label>
                                                        <input
                                                            type="text"
                                                            value={(draft?.predicacion as any)?.[day]?.[slice]?.publicadoresSC}
                                                            onChange={(e) => setDraft({ ...draft!, predicacion: { ...draft!.predicacion, [day]: { ...(draft!.predicacion as any)[day], [slice]: { ...(draft!.predicacion as any)[day][slice], publicadoresSC: e.target.value } } } })}
                                                            className="w-full text-base font-bold p-3 bg-slate-50 border-2 border-slate-100 rounded-xl"
                                                            placeholder="Nombres..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-400 uppercase">Acompañan Esposa SC</label>
                                                        <input
                                                            type="text"
                                                            value={(draft?.predicacion as any)?.[day]?.[slice]?.publicadoresEsposa}
                                                            onChange={(e) => setDraft({ ...draft!, predicacion: { ...draft!.predicacion, [day]: { ...(draft!.predicacion as any)[day], [slice]: { ...(draft!.predicacion as any)[day][slice], publicadoresEsposa: e.target.value } } } })}
                                                            className="w-full text-base font-bold p-3 bg-slate-50 border-2 border-slate-100 rounded-xl"
                                                            placeholder="Nombres..."
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 gap-4">
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-400 uppercase">Capitán de territorio</label>
                                                        <input
                                                            type="text"
                                                            value={(draft?.predicacion as any)?.[day]?.[slice]?.capitan}
                                                            onChange={(e) => setDraft({ ...draft!, predicacion: { ...draft!.predicacion, [day]: { ...(draft!.predicacion as any)[day], [slice]: { ...(draft!.predicacion as any)[day][slice], capitan: e.target.value } } } })}
                                                            className="w-full text-base font-bold p-3 bg-slate-50 border-2 border-slate-100 rounded-xl"
                                                            placeholder="Nombre del hermano que dirige..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black text-slate-400 uppercase">Notas</label>
                                                        <textarea
                                                            value={(draft?.predicacion as any)?.[day]?.[slice]?.notas}
                                                            onChange={(e) => setDraft({ ...draft!, predicacion: { ...draft!.predicacion, [day]: { ...(draft!.predicacion as any)[day], [slice]: { ...(draft!.predicacion as any)[day][slice], notas: e.target.value } } } })}
                                                            className="w-full text-sm font-medium p-3 bg-slate-50 border-2 border-slate-100 rounded-xl h-24"
                                                            placeholder="Notas adicionales..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end gap-3">
                <button onClick={onClose} className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200">Guardar Plan de Predicación</button>
            </div>
        </div>
    </div>
);

interface PastoreoModalProps extends ModalProps {
    publishers: Publisher[];
}

const PastoreoModal: React.FC<PastoreoModalProps> = ({ draft, setDraft, onClose, publishers }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden">
            <div className="bg-purple-600 p-6 text-white flex justify-between items-center">
                <h3 className="text-2xl font-black uppercase tracking-tight">Visitas de Pastoreo</h3>
                <button onClick={onClose}>✕</button>
            </div>
            <div className="p-8">
                <div className="space-y-4 mb-8">
                    {draft?.pastoreo.map((visit, index) => (
                        <div key={index} className="flex gap-4 items-end bg-slate-50 p-4 rounded-2xl relative">
                            <div className="flex-1 space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <select
                                        value={visit.dia}
                                        onChange={(e) => {
                                            const newP = [...draft!.pastoreo];
                                            newP[index].dia = e.target.value;
                                            setDraft({ ...draft!, pastoreo: newP });
                                        }}
                                        className="p-3 rounded-lg border-2 border-slate-100 text-base font-bold"
                                    >
                                        <option value="">Seleccionar día</option>
                                        <option value="Martes">Martes</option>
                                        <option value="Miércoles">Miércoles</option>
                                        <option value="Jueves">Jueves</option>
                                        <option value="Viernes">Viernes</option>
                                        <option value="Sábado">Sábado</option>
                                        <option value="Domingo">Domingo</option>
                                    </select>
                                    <input
                                        type="time"
                                        value={visit.hora}
                                        onChange={(e) => {
                                            const newP = [...draft!.pastoreo];
                                            newP[index].hora = e.target.value;
                                            setDraft({ ...draft!, pastoreo: newP });
                                        }}
                                        className="p-3 rounded-lg border-2 border-slate-100 text-base font-bold"
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Familia a visitar"
                                    value={visit.familia}
                                    onChange={(e) => {
                                        const newP = [...draft!.pastoreo];
                                        newP[index].familia = e.target.value;
                                        setDraft({ ...draft!, pastoreo: newP });
                                    }}
                                    className="w-full p-3 rounded-lg border-2 border-slate-100 text-base font-bold"
                                />
                                <input
                                    type="text"
                                    placeholder="Razón de la visita / Notas"
                                    value={visit.asunto}
                                    onChange={(e) => {
                                        const newP = [...draft!.pastoreo];
                                        newP[index].asunto = e.target.value;
                                        setDraft({ ...draft!, pastoreo: newP });
                                    }}
                                    className="w-full p-3 rounded-lg border-2 border-slate-100 text-base font-bold"
                                />
                                <select
                                    value={visit.acompananteId}
                                    onChange={(e) => {
                                        const newP = [...draft!.pastoreo];
                                        newP[index].acompananteId = e.target.value;
                                        setDraft({ ...draft!, pastoreo: newP });
                                    }}
                                    className="w-full p-3 rounded-lg border-2 border-slate-100 text-base font-bold"
                                >
                                    <option value="">Acompañante (Anciano/SM)</option>
                                    {publishers.filter(p => p.Privilegio === 'Anciano' || p.Privilegio === 'Siervo Ministerial').map(p => (
                                        <option key={p.id} value={p.id}>{p.Nombre} {p.Apellido}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={() => {
                                    const newP = draft!.pastoreo.filter((_, i) => i !== index);
                                    setDraft({ ...draft!, pastoreo: newP });
                                }}
                                className="bg-red-100 text-red-600 p-2 rounded-xl h-fit hover:bg-red-200"
                            >
                                🗑️
                            </button>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => {
                        setDraft({ ...draft!, pastoreo: [...draft!.pastoreo, { dia: '', hora: '', familia: '', asunto: '', acompananteId: '' }] })
                    }}
                    className="w-full py-4 border-2 border-dashed border-purple-200 rounded-3xl text-purple-600 font-bold hover:bg-purple-50 transition-colors"
                >
                    + Agregar Visita de Pastoreo
                </button>
            </div>
            <div className="p-6 bg-slate-50 flex justify-end">
                <button onClick={onClose} className="px-8 py-3 bg-purple-600 text-white font-bold rounded-xl">Hecho</button>
            </div>
        </div>
    </div>
);

export default VisitaSC;
