  import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Publisher, LMMeetingSchedule, ModalInfo, LMWeekAssignment } from '../types';
import { MONTHS } from '../constants';
import { buildS140Pdf, estimateWeekMinutes } from './s140Pdf';

declare const jspdf: any;
declare const db: any;

// Define props
interface VidaYMinisterioProps {
    publishers: Publisher[];
    lmSchedules: LMMeetingSchedule[];
    onSaveSchedule: (schedule: Omit<LMMeetingSchedule, 'id'> & { month: string; year: number }) => Promise<void>;
    onUpdatePublisherVyMAssignments: (publisherId: string, assignments: { [key: string]: boolean }) => Promise<void>;
    onShowModal: (info: ModalInfo) => void;
    canConfig: boolean;
}

const MALE_ASSIGNMENTS = {
    'Presidente': 'vym_presidente',
    'Oracion': 'vym_oracion',
    'Discurso Tesoros': 'vym_tesoros',
    'Conductor Perlas': 'vym_perlas',
    'Discurso Vida Cristiana': 'vym_vida_cristiana',
    'Conductor Estudio Bíblico': 'vym_conductor_ebc',
    // Instrucciones S-38 (8/26), párr. 9: la presenta el presidente u otro anciano o siervo ministerial competente.
    '¿Qué dirías? (Análisis)': 'vym_que_dirias',
};

const STUDENT_ASSIGNMENTS = {
    'Lectura de la Biblia': 'vym_lectura',
    // S-38 (8/26) párr. 7, 8, 10 y 11 (escenificación): estudiante (hermano o hermana).
    'SMM Demostraciones (Conversaciones, Revisitas, Discípulos, Creencias)': 'vym_revisita', // Todas las asignaciones de estudiante que no son discurso.
    // S-38 (8/26) párr. 11 (si es discurso) y 12: solo estudiante varón.
    'SMM Discurso (Creencias / Discurso)': 'vym_discurso_estudiante',
};

// Las instrucciones S-38-S 8/26 aplican desde el año de servicio 2027 (septiembre 2026 en adelante).
// Duración total que debe tener la reunión de entre semana, con canciones y oraciones (minutos).
const MEETING_TARGET_MIN = 105;
const fmtDuration = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
const S38_START = { year: 2026, monthIndex: 8 };
const isS38Period = (year: number, month: string) => year * 12 + MONTHS.indexOf(month) >= S38_START.year * 12 + S38_START.monthIndex;
// Asignaciones cuyo ayudante puede ser del mismo sexo o un familiar (S-38 párr. 7 y 11). Revisitas y Discípulos: solo del mismo sexo.
const FAMILY_HELPER_TITLE = /empecemos conversaciones|expliquemos nuestras creencias/i;
// Línea de canción en la guía: "Canción 3 y oración" (también acepta "Cántico").
const SONG_LINE = /^(?:C[aá]ntico|Canci[oó]n)\s+(\d+)/i;
// Encabezado de semana: "5-11 DE OCTUBRE" o "26 DE OCTUBRE A 1 DE NOVIEMBRE", opcionalmente seguido de la lectura semanal ("| ISAÍAS 1-5").
const WEEK_HEADER = /^(\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s+DE\s+[A-ZÁÉÍÓÚÑ]+(?:\s+(?:A|AL|-|–)\s+\d{1,2}\s+DE\s+[A-ZÁÉÍÓÚÑ]+)?)\s*(?:[|—–:-]\s*)?(.*)$/i;
// Referencia bíblica sola en una línea: "ISAÍAS 1-5", "1 CRÓNICAS 20-23", "SALMOS 1-10, 20".
const SCRIPTURE_LINE = /^(?:[1-3]\s*)?[A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]+)*\s+\d+[\d\s,:\-–—y]*$/i;
const ANALYSIS_TITLE = /qu[eé]\s+dir[ií]as/i;

const ALL_ASSIGNMENT_KEYS = { ...MALE_ASSIGNMENTS, ...STUDENT_ASSIGNMENTS };

// Se define fuera de VidaYMinisterio (y de ScheduleView) para que tenga una
// identidad estable entre renders. Antes se declaraba dentro de ScheduleView,
// que a su vez se declaraba dentro de VidaYMinisterio: al escribir una letra
// en cualquier campo, React recreaba estas funciones-componente por completo
// en cada tecla, las trataba como un tipo nuevo, y desmontaba/remontaba todo
// el árbol (incluyendo el <input> activo), lo que sacaba el cursor del campo.
const EditableAssignmentRow: React.FC<{ label: React.ReactNode, time?: string, children: React.ReactNode }> = ({ label, time, children }) => (
    <div className="grid grid-cols-12 gap-2 py-2 border-b">
        <div className="col-span-1 text-right text-gray-500">{time}</div>
        <div className="col-span-7 flex items-center">{label}</div>
        <div className="col-span-4 text-right">{children}</div>
    </div>
);

// Se define fuera de VidaYMinisterio por la misma razón que EditableAssignmentRow
// (identidad estable entre renders) y porque maneja su propio estado (useState),
// lo cual requiere que sea un componente real y no una función de renderizado
// invocada en línea.
interface ConfigViewProps {
    publishers: Publisher[]; // publicadores activos
    onUpdatePublisherVyMAssignments: (publisherId: string, assignments: { [key: string]: boolean }) => Promise<void>;
    onShowModal: (info: ModalInfo) => void;
    onShareWhatsApp: () => void;
}

const ConfigView: React.FC<ConfigViewProps> = ({ publishers, onUpdatePublisherVyMAssignments, onShowModal, onShareWhatsApp }) => {
    const [assignments, setAssignments] = useState(() =>
        Object.fromEntries(publishers.map(p => {
            const pubAssignments = Object.fromEntries(
                Object.values(ALL_ASSIGNMENT_KEYS).map(key => [key, !!(p as any)[key]])
            );
            return [p.id, pubAssignments];
        }))
    );
    const [isSaving, setIsSaving] = useState(false);
    const [nameFilter, setNameFilter] = useState('');
    const [genderFilter, setGenderFilter] = useState<'todos' | 'Hombre' | 'Mujer'>('todos');
    const [privilegeFilter, setPrivilegeFilter] = useState('todos');

    const handleToggle = (pubId: string, roleKey: string) => {
        setAssignments(prev => ({
            ...prev,
            [pubId]: { ...prev[pubId], [roleKey]: !prev[pubId][roleKey] }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const promises = Object.entries(assignments).map(([pubId, roles]) =>
                onUpdatePublisherVyMAssignments(pubId, roles)
            );
            await Promise.all(promises);
            onShowModal({ type: 'success', title: 'Guardado', message: 'Configuración de participantes guardada.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: `No se pudo guardar: ${(error as Error).message}` });
        } finally {
            setIsSaving(false);
        }
    };

    const filteredPublishers = useMemo(() => {
        return publishers
            .filter(p => {
                const fullName = `${p.Nombre} ${p.Apellido}`.toLowerCase();
                const matchesName = !nameFilter.trim() || fullName.includes(nameFilter.trim().toLowerCase());
                const matchesGender = genderFilter === 'todos' || p.Sexo === genderFilter;
                const matchesPrivilege = privilegeFilter === 'todos'
                    || p.Privilegio === privilegeFilter
                    || (privilegeFilter === 'Publicador' && !p.Privilegio);
                return matchesName && matchesGender && matchesPrivilege;
            })
            .sort((a, b) => `${a.Nombre} ${a.Apellido}`.localeCompare(`${b.Nombre} ${b.Apellido}`));
    }, [publishers, nameFilter, genderFilter, privilegeFilter]);

    const assignmentEntries = Object.entries(ALL_ASSIGNMENT_KEYS); // [label, roleKey][]

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 className="text-xl font-bold">Configuración de Participantes</h2>
                <div className="flex gap-2">
                    <button onClick={onShareWhatsApp} className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>
                        Compartir
                    </button>
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>

            {/* Filtros para localizar candidatos rápidamente al asignar discursos/demostraciones */}
            <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <input
                    type="text"
                    value={nameFilter}
                    onChange={e => setNameFilter(e.target.value)}
                    placeholder="Buscar por nombre..."
                    className="p-2 border rounded-md text-sm flex-1 min-w-[160px]"
                />
                <select value={genderFilter} onChange={e => setGenderFilter(e.target.value as 'todos' | 'Hombre' | 'Mujer')} className="p-2 border rounded-md text-sm">
                    <option value="todos">Sexo: Todos</option>
                    <option value="Hombre">Hombres</option>
                    <option value="Mujer">Mujeres</option>
                </select>
                <select value={privilegeFilter} onChange={e => setPrivilegeFilter(e.target.value)} className="p-2 border rounded-md text-sm">
                    <option value="todos">Privilegio: Todos</option>
                    <option value="Anciano">Ancianos</option>
                    <option value="Siervo Ministerial">Siervos Ministeriales</option>
                    <option value="Publicador">Publicadores (sin privilegio)</option>
                </select>
            </div>

            {/* Escritorio: tabla con encabezado y columna de nombres fijos (sticky) al hacer scroll */}
            <div className="hidden md:block overflow-auto border rounded-lg" style={{ maxHeight: '70vh' }}>
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase sticky left-0 top-0 bg-gray-50 z-20">Publicador</th>
                            {assignmentEntries.map(([label, key]) => (
                                <th key={key} className="px-3 py-3 text-center font-medium text-gray-500 uppercase sticky top-0 bg-gray-50 z-10" style={{ minWidth: '100px' }}>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredPublishers.map(pub => (
                            <tr key={pub.id}>
                                <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900 sticky left-0 bg-white z-10">{[pub.Nombre, pub.Apellido].join(' ')}</td>
                                {assignmentEntries.map(([, key]) => (
                                    <td key={key} className="px-3 py-2 text-center">
                                        <input
                                            type="checkbox"
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={assignments[pub.id]?.[key] || false}
                                            onChange={() => handleToggle(pub.id, key)}
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {filteredPublishers.length === 0 && (
                            <tr>
                                <td colSpan={assignmentEntries.length + 1} className="px-3 py-6 text-center text-gray-500">
                                    No hay publicadores que coincidan con el filtro.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Móvil: una card por publicador en vez de tabla */}
            <div className="md:hidden space-y-3">
                {filteredPublishers.map(pub => (
                    <div key={pub.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                        <h3 className="font-bold text-gray-800 mb-3">{[pub.Nombre, pub.Apellido].join(' ')}</h3>
                        <div className="grid grid-cols-2 gap-2">
                            {assignmentEntries.map(([label, key]) => (
                                <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        checked={assignments[pub.id]?.[key] || false}
                                        onChange={() => handleToggle(pub.id, key)}
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
                {filteredPublishers.length === 0 && (
                    <p className="text-center text-gray-500 py-6">No hay publicadores que coincidan con el filtro.</p>
                )}
            </div>
        </div>
    );
};






const VidaYMinisterio: React.FC<VidaYMinisterioProps> = ({
    publishers,
    lmSchedules,
    onSaveSchedule,
    onUpdatePublisherVyMAssignments,
    onShowModal,
    canConfig
}) => {
    const [activeTab, setActiveTab] = useState('schedule');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);

    // State Management
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editableSchedule, setEditableSchedule] = useState<LMMeetingSchedule | null>(null);
    const [draftSchedule, setDraftSchedule] = useState<LMMeetingSchedule | null>(null);

    const [isPublic, setIsPublic] = useState(false);
    const [programText, setProgramText] = useState('');

    const activePublishers = useMemo(() => publishers.filter(p => p.Estatus === 'Activo'), [publishers]);

    const scheduleForSelectedMonth = useMemo(() => {
        return lmSchedules.find(s => s.year === selectedYear && s.month === selectedMonth);
    }, [lmSchedules, selectedYear, selectedMonth]);

    useEffect(() => {
        setIsEditing(false);
        setEditableSchedule(null);
        setDraftSchedule(null);
        const currentSchedule = lmSchedules.find(s => s.year === selectedYear && s.month === selectedMonth);
        setIsPublic(currentSchedule?.isPublic || false);
    }, [selectedMonth, selectedYear, activeTab, lmSchedules]);

    // Hora de inicio de la reunión de entre semana (Configuración general); se usa para calcular los tiempos del programa.
    const [midweekTime, setMidweekTime] = useState<string>('19:30');
    useEffect(() => {
        let alive = true;
        try {
            if (typeof db !== 'undefined') {
                db.collection('settings').doc('meeting_config').get()
                    .then((doc: any) => { const t = doc?.data()?.midweekTime; if (alive && t) setMidweekTime(t); })
                    .catch(() => { /* se queda con 19:30 */ });
            }
        } catch { /* sin acceso a la configuración: 19:30 */ }
        return () => { alive = false; };
    }, []);

    const cleanPart = (v: any) => (v && String(v).trim().toUpperCase() !== 'N/A' ? String(v).trim() : '');
    // Nombre completo (Nombre, Apellido, 2do Apellido y Apellido de casada) para distinguir a cada publicador en los select.
    const getPublisherFullName = useCallback((id: string | null | undefined): string => {
        if (!id) return '';
        const pub = publishers.find(p => p.id === id);
        return pub ? [pub.Nombre, pub.Apellido, pub['2do Apellido'], pub['Apellido de casada']].map(cleanPart).filter(Boolean).join(' ') : 'N/A';
    }, [publishers]);
    // Nombres cortos (Nombre y Apellido); si dos publicadores coinciden, se agrega el 2do apellido.
    const duplicatedShortNames = useMemo(() => {
        const seen = new Map<string, number>();
        publishers.forEach(p => { const k = `${p.Nombre} ${p.Apellido}`.trim().toLowerCase(); seen.set(k, (seen.get(k) || 0) + 1); });
        return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
    }, [publishers]);
    const getPublisherName = useCallback((id: string | null | undefined): string => {
        if (!id) return '';
        const pub = publishers.find(p => p.id === id);
        if (!pub) return 'N/A';
        const short = [pub.Nombre, pub.Apellido].filter(Boolean).join(' ');
        const second = cleanPart(pub['2do Apellido']);
        return duplicatedShortNames.has(short.toLowerCase()) && second ? `${short} ${second}` : short;
    }, [publishers, duplicatedShortNames]);

    const getEligiblePublishers = useCallback((roleKey: string, gender?: 'Hombre' | 'Mujer') => {
        // La pestaña "Configuración" (checkboxes por publicador y tipo de
        // asignación) es la única fuente de verdad sobre quién puede recibir
        // cada asignación. Antes, este filtro además exigía Privilegio
        // Anciano/Siervo Ministerial o Sexo Hombre según el roleKey, lo que
        // ocultaba del select a publicadores ya marcados en Configuración
        // (p. ej. si no tenían el campo Privilegio capturado). Se quita esa
        // restricción duplicada; solo se conserva el filtro opcional por
        // sexo, usado para emparejar ayudante/estudiante del mismo sexo.
        let eligible = activePublishers.filter(p => (p as any)[roleKey]);

        if (gender) {
            eligible = eligible.filter(p => p.Sexo === gender);
        }
        return eligible.sort((a, b) => `${a.Nombre} ${a.Apellido}`.localeCompare(`${b.Nombre} ${b.Apellido}`));
    }, [activePublishers]);

    const handleToggleVisibility = async () => {
        if (!scheduleForSelectedMonth) {
            onShowModal({ type: 'error', title: 'Error', message: 'No hay un programa guardado para este mes para poder cambiar su visibilidad.' });
            return;
        }
        setIsLoading(true);
        try {
            const newVisibility = !isPublic;
            const { id, ...dataToSave } = scheduleForSelectedMonth;
            await onSaveSchedule({ ...dataToSave, isPublic: newVisibility });
            setIsPublic(newVisibility);
            onShowModal({ type: 'success', title: 'Visibilidad Actualizada', message: `El programa ahora está ${newVisibility ? 'Público y visible para todos' : 'Oculto y solo visible para administradores'}.` });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo actualizar la visibilidad.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveChanges = async () => {
        if (!editableSchedule) return;
        setIsLoading(true);
        try {
            await onSaveSchedule(editableSchedule);
            setIsEditing(false);
            setEditableSchedule(null);
            onShowModal({ type: 'success', title: 'Guardado', message: 'Los cambios se han guardado.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: `No se pudo guardar: ${(error as Error).message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditableSchedule(null);
    };

    const handleEditChange = (weekIndex: number, assignmentKey: string, value: string) => {
        if (!editableSchedule) return;
        setEditableSchedule(prev => {
            if (!prev) return null;
            const newSchedule = JSON.parse(JSON.stringify(prev));
            if (!newSchedule.weeks[weekIndex]) {
                newSchedule.weeks[weekIndex] = {};
            }
            const keys = assignmentKey.split('.');
            let current = newSchedule.weeks[weekIndex];
            for (let i = 0; i < keys.length - 1; i++) {
                current[keys[i]] = current[keys[i]] || (Array.isArray(current[keys[i + 1]]) ? [] : {});
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return newSchedule;
        });
    };

    // Semanas en las que la guía pide cambiar la sección "Nuestra vida cristiana" (p. ej. informe del Cuerpo Gobernante,
    // informe de diseño y construcción): se puede agregar una asignación con su título, duración y responsable, o quitar una.
    const handleAddChristianLivingPart = (weekIndex: number) => {
        setEditableSchedule(prev => {
            if (!prev) return null;
            const ns = JSON.parse(JSON.stringify(prev));
            const week = ns.weeks[weekIndex];
            if (!week) return prev;
            week.christianLivingParts = [...(week.christianLivingParts || []), { title: 'Nueva asignación', duration: '5 mins.', references: '', assigneeId: '', custom: true }];
            return ns;
        });
    };
    const handleRemoveChristianLivingPart = (weekIndex: number, partIndex: number) => {
        setEditableSchedule(prev => {
            if (!prev) return null;
            const ns = JSON.parse(JSON.stringify(prev));
            const week = ns.weeks[weekIndex];
            if (!week || !week.christianLivingParts) return prev;
            week.christianLivingParts.splice(partIndex, 1);
            return ns;
        });
    };

    // Ajusta la duración del estudio bíblico para que la reunión dure en total MEETING_TARGET_MIN.
    const handleFitCbsDuration = (weekIndex: number) => {
        setEditableSchedule(prev => {
            if (!prev) return null;
            const ns = JSON.parse(JSON.stringify(prev));
            const week = ns.weeks[weekIndex];
            if (!week || !week.hasCbs) return prev;
            const est = estimateWeekMinutes(week);
            week.cbsDuration = `${Math.max(5, MEETING_TARGET_MIN - (est.total - est.cbs))} mins.`;
            return ns;
        });
    };

    const handleGenerateSchedule = async () => {
        if (!programText.trim()) {
            onShowModal({ type: 'error', title: 'Falta Información', message: 'Por favor, pegue el programa de la Guía de Actividades en el cuadro de texto.' });
            return;
        }
        setIsLoading(true);
        onShowModal({ type: 'info', title: 'Generando Programa', message: 'Procesando y asignando...' });
        await new Promise(res => setTimeout(res, 50));

        try {
            const lines = programText.normalize('NFC').replace(/[\u00a0\u2007\u202f]/g, ' ').split('\n').map(l => l.trim().replace(/^[•·▪◦‣⁃●*\-–—]+\s*/, '')).filter(Boolean);
            const weekBoundaries = lines.reduce<number[]>((acc, line, index) => {
                if (/^(\d{1,2}(?:-\d{1,2})? DE [A-ZÁÉÍÓÚÑ]+)/i.test(line)) {
                    acc.push(index);
                }
                return acc;
            }, []);

            if (weekBoundaries.length === 0) {
                throw new Error("No se encontraron fechas de semana en el texto (Ej: '1-7 DE DICIEMBRE').");
            }

            const useS38 = isS38Period(selectedYear, selectedMonth);
            const parsedWeeks: LMWeekAssignment[] = [];

            for (let i = 0; i < weekBoundaries.length; i++) {
                const weekStartIndex = weekBoundaries[i];
                const weekEndIndex = i + 1 < weekBoundaries.length ? weekBoundaries[i + 1] : lines.length;
                const weekLines = lines.slice(weekStartIndex, weekEndIndex);

                // La fecha queda sola en weekRange; si la lectura semanal viene en el encabezado, se toma de ahí.
                const headerMatch = lines[weekStartIndex].match(WEEK_HEADER);
                let weeklyReading: string | null = null;
                if (headerMatch && headerMatch[2] && !SONG_LINE.test(headerMatch[2].trim())) {
                    weeklyReading = headerMatch[2].replace(/^Lectura semanal( de la Biblia)?\s*[:|–—-]?\s*/i, '').trim() || null;
                }
                if (!weeklyReading) {
                    // Lectura semanal en las líneas siguientes: "Lectura semanal: X" o la referencia sola ("ISAÍAS 1-5") antes de la primera canción/sección.
                    for (let k = 1; k < weekLines.length; k++) {
                        const l = weekLines[k];
                        const labeled = l.match(/Lectura semanal(?: de la Biblia)?\s*[:|–—-]\s*(.+)/i);
                        if (labeled) { weeklyReading = labeled[1].trim(); break; }
                        if (SONG_LINE.test(l) || /TESOROS DE LA BIBLIA|SEAMOS MEJORES MAESTROS|NUESTRA VIDA CRISTIANA/i.test(l) || /^\d+\./.test(l)) break;
                        if (SCRIPTURE_LINE.test(l) && l.length <= 60) { weeklyReading = l; break; }
                    }
                }

                let currentWeek: any = {
                    weekRange: headerMatch ? headerMatch[1].trim() : lines[weekStartIndex], bibleReadingSource: weeklyReading, song1: null, song2: null, song3: null,
                    presidentId: null, finalPrayerId: null,
                    treasuresParts: [], studentAssignments: [], christianLivingParts: [],
                    hasCbs: false, cbsConductorId: null, cbsReaderId: null, cbsSource: null,
                };

                let currentSection: 'INIT' | 'TESOROS' | 'MAESTROS' | 'VIDA_CRISTIANA' = 'INIT';

                // Respaldo: si la canción no está al inicio de una línea (o viene junto a otro texto), se toma de cualquier "Canción N" de la semana, en orden.
                const anySongs = [...weekLines.join('\n').matchAll(/(?:Canci[oó]n|C[aá]ntico)\s+(?:n[úu]m(?:ero|\.)?\s*)?(\d{1,3})/gi)].map(m => m[1]);

                for (let j = 0; j < weekLines.length; j++) {
                    const line = weekLines[j];

                    if (/TESOROS DE LA BIBLIA/.test(line)) { currentSection = 'TESOROS'; continue; }
                    if (/SEAMOS MEJORES MAESTROS/.test(line)) { currentSection = 'MAESTROS'; continue; }
                    if (/NUESTRA VIDA CRISTIANA/.test(line)) { currentSection = 'VIDA_CRISTIANA'; continue; }

                    if (/Lectura semanal(?: de la Biblia)?\s*[:|–—-]/i.test(line)) {
                        continue; // ya se tomó arriba
                    }

                    const songMatch = line.match(SONG_LINE);
                    if (songMatch) {
                        const songNumber = songMatch[1];
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

                        // Look for duration from current line forward
                        for (let k = j; k < weekLines.length; k++) {
                            const potentialLine = weekLines[k];
                            const durationMatch = potentialLine.match(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i);
                            if (durationMatch) {
                                duration = durationMatch[1].trim();
                                lineWithDuration = potentialLine;
                                durationLineIndex = k;
                                break;
                            }
                            // Stop looking if we hit the next numbered item or section
                            if (k > j && (/^\d+\./.test(potentialLine) || /SEAMOS MEJORES MAESTROS|NUESTRA VIDA CRISTIANA|TESOROS DE LA BIBLIA/.test(potentialLine) || SONG_LINE.test(potentialLine) || /Palabras de conclusión/.test(potentialLine))) {
                                break;
                            }
                        }

                        if (duration) {
                            let title = line.replace(/^\d+\.\s*/, '').trim();
                            let references: string | null = null;

                            switch (currentSection) {
                                case 'TESOROS': {
                                    let partType = 'discurso_tesoros';
                                    if (/Busquemos perlas escondidas/i.test(title)) {
                                        partType = 'perlas';
                                    } else if (/Lectura de la Biblia/i.test(title)) {
                                        partType = 'lectura_biblia';
                                        references = lineWithDuration.replace(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i, '').trim();
                                    }
                                    // For "discurso_tesoros" (first part), references remains null, as per user request.
                                    currentWeek.treasuresParts.push({ title, duration, references, type: partType, assigneeId: null });
                                    break;
                                }
                                case 'MAESTROS': {
                                    const isDiscourse = /discurso/i.test(title);
                                    const contentFromDurationLine = lineWithDuration.replace(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i, '').trim();
                                    const refMatch = contentFromDurationLine.match(/^(.*?)\s*(\(.*\))$/);
                                    if (refMatch) {
                                        title = refMatch[1].trim();
                                        references = refMatch[2].trim();
                                    } else {
                                        title = contentFromDurationLine;
                                        references = '';
                                    }
                                    // "¿Qué dirías?" no es asignación de estudiante: la presenta un anciano o siervo ministerial
                                    // como análisis con el auditorio (S-38 8/26, párr. 9). No lleva ayudante.
                                    const isAnalysis = useS38 && !isDiscourse && ANALYSIS_TITLE.test(title);
                                    currentWeek.studentAssignments.push({
                                        title, duration, references,
                                        number: Number((line.match(/^(\d+)\./) || [])[1]) || null, // núm. de la parte en la Guía (4, 5, 6, 7)
                                        type: isAnalysis ? 'que_dirias' : (isDiscourse ? 'discurso_estudiante' : 'demonstration'),
                                        studentId: null,
                                        helperId: (isDiscourse || isAnalysis) ? null : undefined,
                                    });
                                    break;
                                }
                                case 'VIDA_CRISTIANA': {
                                    if (/Estudio bíblico de la congregación/i.test(title)) {
                                        currentWeek.hasCbs = true;
                                        references = lineWithDuration.replace(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i, '').trim();
                                        currentWeek.cbsSource = references;
                                    } else {
                                        let finalTitle = '';
                                        // If the duration is on the same line as the numbered item title
                                        if (durationLineIndex === j) {
                                            finalTitle = lineWithDuration
                                                .replace(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i, '')
                                                .replace(/^\d+\.\s*/, '')
                                                .trim();
                                        } else { // If duration is on a subsequent line
                                            const extraInfo = lineWithDuration.replace(/\(\s*(\d{1,2}\s*mins?\.?)\s*\)/i, '').trim();
                                            // `title` here is the clean title from the numbered line
                                            finalTitle = [title, extraInfo].filter(Boolean).join(' ');
                                        }

                                        const isVideo = /presentación de video/i.test(finalTitle);
                                        let note = null;
                                        let assignmentTitle = finalTitle;
                                        if (isVideo) {
                                            assignmentTitle = finalTitle.replace(/\(presentación de video\)/i, '').trim();
                                            note = '(Presentación de video)';
                                        }
                                        currentWeek.christianLivingParts.push({
                                            title: assignmentTitle,
                                            duration,
                                            references: null,
                                            assigneeId: isVideo ? null : undefined,
                                            note: note
                                        });
                                    }
                                    break;
                                }
                            }

                            // Advance the main loop counter
                            if (durationLineIndex > j) {
                                j = durationLineIndex;
                            }
                        }
                    }
                }
                const missingSongs = (['song1', 'song2', 'song3'] as const).filter(k => !currentWeek[k]);
                if (missingSongs.length > 0) {
                    if (anySongs.length >= 3) {
                        if (!currentWeek.song1) currentWeek.song1 = anySongs[0];
                        if (!currentWeek.song2) currentWeek.song2 = anySongs[1];
                        if (!currentWeek.song3) currentWeek.song3 = anySongs[2];
                    } else if (missingSongs.length === 3) {
                        missingSongs.forEach((k, i) => { if (anySongs[i]) currentWeek[k] = anySongs[i]; });
                    }
                }
                parsedWeeks.push(currentWeek);
            }

            const queues: Record<string, any[]> = {};
            for (const key of Object.values(ALL_ASSIGNMENT_KEYS)) {
                queues[key] = [...getEligiblePublishers(key)];
            }
            const studentFemaleQueue = [...getEligiblePublishers('vym_revisita', 'Mujer')];
            const studentMaleQueue = [...getEligiblePublishers('vym_revisita', 'Hombre')];
            const allStudentEligible = getEligiblePublishers('vym_revisita');

            let assignedLastWeek = new Set<string>();

            for (const week of parsedWeeks) {
                const assignedThisNight = new Set<string>();

                const assignNext = (queueKey: string): string | null => {
                    const queue = queues[queueKey];
                    if (!queue || queue.length === 0) return null;

                    let candidatePool = queue.filter(p => !assignedThisNight.has(p.id) && !assignedLastWeek.has(p.id));
                    if (candidatePool.length === 0) {
                        candidatePool = queue.filter(p => !assignedThisNight.has(p.id));
                    }
                    if (candidatePool.length === 0) {
                        candidatePool = queue; // Allow repeats if absolutely necessary
                    }
                    if (candidatePool.length === 0) return null;

                    const person = candidatePool[0];
                    const mainQueueIndex = queue.findIndex(p => p.id === person.id);
                    if (mainQueueIndex > -1) {
                        const [p] = queue.splice(mainQueueIndex, 1);
                        queue.push(p);
                    }

                    assignedThisNight.add(person.id);
                    return person.id;
                };

                const assignStudentAndHelper = (assignment: any, allowFamilyHelper: boolean) => {
                    let studentId: string | null = null;
                    let helperId: string | null = null;

                    const assignFromQueue = (queue: Publisher[]) => {
                        let studentPool = queue.filter(p => !assignedThisNight.has(p.id));
                        if (studentPool.length === 0) studentPool = queue;
                        if (studentPool.length === 0) return;

                        const student = studentPool.shift()!;
                        studentId = student.id;
                        assignedThisNight.add(student.id);
                        const originalIndex = queue.findIndex(p => p.id === student.id);
                        if (originalIndex > -1) {
                            const [s] = queue.splice(originalIndex, 1);
                            queue.push(s);
                        }

                        let helperPool = queue.filter(p => p.id !== student.id && !assignedThisNight.has(p.id));
                        if (helperPool.length === 0) helperPool = queue.filter(p => p.id !== student.id);
                        if (helperPool.length > 0) {
                            const helper = helperPool.shift()!;
                            helperId = helper.id;
                            assignedThisNight.add(helper.id);
                            const originalHelperIndex = queue.findIndex(p => p.id === helper.id);
                            if (originalHelperIndex > -1) {
                                const [h] = queue.splice(originalHelperIndex, 1);
                                queue.push(h);
                            }
                        } else if (allowFamilyHelper && student.Familia) {
                            // Sin ayudante del mismo sexo disponible: un familiar también es válido (S-38 párr. 7 y 11).
                            const familyHelper = allStudentEligible.find(p =>
                                p.id !== student.id && p.Familia && p.Familia === student.Familia && !assignedThisNight.has(p.id)
                            );
                            if (familyHelper) {
                                helperId = familyHelper.id;
                                assignedThisNight.add(familyHelper.id);
                            }
                        }
                    };

                    if (studentMaleQueue.length >= studentFemaleQueue.length) {
                        assignFromQueue(studentMaleQueue);
                    } else {
                        assignFromQueue(studentFemaleQueue);
                    }

                    assignment.studentId = studentId;
                    assignment.helperId = helperId;
                };

                week.presidentId = assignNext('vym_presidente');

                for (const part of week.treasuresParts) {
                    if (part.type === 'discurso_tesoros') part.assigneeId = assignNext('vym_tesoros');
                    else if (part.type === 'perlas') part.assigneeId = assignNext('vym_perlas');
                    else if (part.type === 'lectura_biblia') part.assigneeId = assignNext('vym_lectura');
                }

                for (const asig of week.studentAssignments) {
                    if (asig.type === 'discurso_estudiante') {
                        asig.studentId = assignNext('vym_discurso_estudiante');
                    } else if (asig.type === 'que_dirias') {
                        // Si aún no hay nadie marcado en "¿Qué dirías?", se toma de los ancianos/siervos de Vida Cristiana.
                        asig.studentId = assignNext(queues['vym_que_dirias']?.length ? 'vym_que_dirias' : 'vym_vida_cristiana');
                    } else if (asig.helperId !== null) {
                        assignStudentAndHelper(asig, useS38 && FAMILY_HELPER_TITLE.test(asig.title));
                    }
                }

                for (const part of week.christianLivingParts) {
                    if (part.assigneeId === undefined) {
                        part.assigneeId = assignNext('vym_vida_cristiana');
                    }
                }

                if (week.hasCbs) {
                    week.cbsConductorId = assignNext('vym_conductor_ebc');
                    week.cbsReaderId = assignNext('vym_lectura');
                }

                week.finalPrayerId = assignNext('vym_oracion');

                assignedLastWeek = new Set(assignedThisNight);
            }

            const finalSchedule: LMMeetingSchedule = {
                id: `${selectedYear}-${selectedMonth}`, year: selectedYear, month: selectedMonth,
                weeks: parsedWeeks, isPublic: false
            };

            setDraftSchedule(finalSchedule);
            onShowModal({ type: 'success', title: 'Borrador Generado', message: 'Se ha creado un borrador del programa. Por favor, revísalo y guárdalo.' });

        } catch (error) {
            console.error("Error generating schedule:", error);
            onShowModal({ type: 'error', title: 'Error de Procesamiento', message: `No se pudo procesar el programa. Revisa el formato del texto. Error: ${(error as Error).message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!draftSchedule) return;
        setIsLoading(true);
        try {
            await onSaveSchedule(draftSchedule);
            setDraftSchedule(null);
            onShowModal({ type: 'success', title: 'Guardado', message: 'El programa se ha guardado correctamente.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: `No se pudo guardar el borrador: ${(error as Error).message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDiscardDraft = () => {
        setDraftSchedule(null);
    };

    const handleEditClick = () => {
        if (scheduleForSelectedMonth) {
            setEditableSchedule(JSON.parse(JSON.stringify(scheduleForSelectedMonth)));
            setIsEditing(true);
        }
    };

    const handleExportPdf = async () => {
        const scheduleToPrint = draftSchedule || editableSchedule || scheduleForSelectedMonth;
        if (!scheduleToPrint) {
            onShowModal({ type: 'error', title: 'Error', message: 'No hay contenido para exportar a PDF.' });
            return;
        }
        setIsLoading(true);
        try {
            // @ts-ignore
            const { jsPDF } = jspdf;
            const pdf = buildS140Pdf(jsPDF, scheduleToPrint, getPublisherName, { midweekTime });
            pdf.save(`Programa_VyM_${selectedMonth}_${selectedYear}.pdf`);
            onShowModal({ type: 'success', title: 'Éxito', message: 'PDF generado correctamente.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error de PDF', message: `No se pudo generar el PDF: ${(error as Error).message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const ScheduleView = () => {
        const currentSchedule = draftSchedule || editableSchedule || scheduleForSelectedMonth;

        if (!canConfig && !currentSchedule?.isPublic) {
            return <div className="text-center p-8 bg-gray-50 rounded-lg"><p className="text-gray-500">El programa para este mes aún no está disponible públicamente.</p></div>;
        }

        const renderSelect = (weekIndex: number, assignmentKey: string, roleKey: string, gender?: 'Hombre' | 'Mujer', helperForStudentId?: string) => {
            let studentGender: 'Hombre' | 'Mujer' | undefined;
            if (helperForStudentId && (editableSchedule || draftSchedule)?.weeks[weekIndex]) {
                const student = publishers.find(p => p.id === helperForStudentId);
                studentGender = student?.Sexo as 'Hombre' | 'Mujer' | undefined;
            }

            const eligible = getEligiblePublishers(roleKey, studentGender || gender);
            const value = assignmentKey.split('.').reduce((o: any, i) => o?.[i], (editableSchedule || draftSchedule)?.weeks[weekIndex]) || '';

            return (
                <select
                    value={value}
                    onChange={e => handleEditChange(weekIndex, assignmentKey, e.target.value)}
                    className="w-full p-1 border rounded text-sm bg-yellow-50"
                    title={getPublisherFullName(value)}
                >
                    <option value="">-- Vacante --</option>
                    {eligible.map(p => (
                        <option key={p.id} value={p.id}>{getPublisherFullName(p.id)}</option>
                    ))}
                </select>
            );
        };

        const renderInput = (weekIndex: number, assignmentKey: string, placeholder: string) => (
            <input
                type="text"
                value={assignmentKey.split('.').reduce((o: any, i) => o?.[i], (editableSchedule || draftSchedule)?.weeks[weekIndex]) || ''}
                onChange={e => handleEditChange(weekIndex, assignmentKey, e.target.value)}
                className="w-full p-1 border rounded text-sm bg-yellow-50"
                placeholder={placeholder}
            />
        );

        if (!currentSchedule?.weeks?.length) {
            return <p className="text-center text-gray-500 py-8">No hay programa disponible o generado para este mes.</p>;
        }

        return (
            <div className="space-y-8">
                {currentSchedule.weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-600">
                        <h3 className="font-bold text-xl text-blue-800 mb-2">
                            {isEditing ? renderInput(weekIndex, 'weekRange', 'Ej: 1-7 DE DICIEMBRE') : week.weekRange}
                        </h3>

                        {(week.bibleReadingSource || isEditing) &&
                            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-center my-4">
                                <span className="font-bold block text-sm uppercase tracking-wider">Lectura Semanal</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={week.bibleReadingSource || ''}
                                        onChange={e => handleEditChange(weekIndex, 'bibleReadingSource', e.target.value)}
                                        className="w-full max-w-xs mx-auto p-1 border rounded text-lg text-center bg-yellow-50 mt-1"
                                        placeholder="Ej: 1 Crónicas 1-3"
                                    />
                                ) : (
                                    <span className="text-lg font-medium block mt-1">{week.bibleReadingSource}</span>
                                )}
                            </div>
                        }

                        <div className="text-sm">
                            <EditableAssignmentRow label={<>Canción {isEditing ? <input type="text" value={week.song1 || ''} onChange={e => handleEditChange(weekIndex, 'song1', e.target.value)} className="w-12 inline-block p-1 border rounded text-sm bg-yellow-50" /> : week.song1} y oración</>}>
                                {isEditing ? renderSelect(weekIndex, 'presidentId', 'vym_presidente') : (
                                    <span className="flex items-center justify-end">
                                        <strong>{getPublisherName(week.presidentId)} (Presidente)</strong>
                                        <ReminderButton publisherId={week.presidentId} details={{ date: week.weekRange, role: 'Presidente' }} />
                                    </span>
                                )}
                            </EditableAssignmentRow>

                            <div className="bg-yellow-100 text-yellow-800 font-bold p-2 my-2 rounded-md">TESOROS DE LA BIBLIA</div>
                            {(week.treasuresParts || []).map((part: any, partIndex: number) => {
                                let roleKey = '';
                                let gender: 'Hombre' | 'Mujer' | undefined;
                                if (part.type === 'discurso_tesoros') roleKey = 'vym_tesoros';
                                else if (part.type === 'perlas') roleKey = 'vym_perlas';
                                else if (part.type === 'lectura_biblia') { roleKey = 'vym_lectura'; gender = 'Hombre'; }

                                return (
                                    <EditableAssignmentRow key={partIndex} label={
                                        <div>
                                            <div>{isEditing ? renderInput(weekIndex, `treasuresParts.${partIndex}.title`, 'Título') : part.title}</div>
                                            {isEditing ? (
                                                <input type="text" value={part.references || ''} onChange={e => handleEditChange(weekIndex, `treasuresParts.${partIndex}.references`, e.target.value)} className="w-full mt-1 p-1 border rounded text-xs bg-yellow-50" placeholder="Referencias" />
                                            ) : (
                                                partIndex >= 2 && part.references && <div className="text-xs text-gray-500 mt-1">{part.references}</div>
                                            )}
                                        </div>
                                    } time={part.duration}>
                                        {isEditing && roleKey ? renderSelect(weekIndex, `treasuresParts.${partIndex}.assigneeId`, roleKey, gender) : (
                                            <span className="flex items-center justify-end">
                                                {getPublisherName(part.assigneeId)}
                                                <ReminderButton publisherId={part.assigneeId} details={{ date: week.weekRange, title: part.title, source: part.references, ...(part.type === 'lectura_biblia' ? { s89: true, number: partIndex + 1, studentId: part.assigneeId } : {}) }} />
                                            </span>
                                        )}
                                    </EditableAssignmentRow>
                                );
                            })}

                            <div className="bg-green-100 text-green-800 font-bold p-2 my-2 rounded-md">SEAMOS MEJORES MAESTROS</div>
                            {(week.studentAssignments || []).map((asig: any, asigIndex: number) => {
                                const studentId = currentSchedule?.weeks[weekIndex]?.studentAssignments?.[asigIndex]?.studentId;
                                const isDiscourse = asig.type === 'discurso_estudiante';
                                const isAnalysis = asig.type === 'que_dirias';
                                const studentRoleKey = isAnalysis ? 'vym_que_dirias' : (isDiscourse ? 'vym_discurso_estudiante' : 'vym_revisita');
                                const studentGender = (isDiscourse || isAnalysis) ? 'Hombre' : undefined;

                                return (
                                    <EditableAssignmentRow key={asigIndex} label={
                                        <div>
                                            <div>{isEditing ? renderInput(weekIndex, `studentAssignments.${asigIndex}.title`, 'Título') : asig.title}</div>
                                            {isEditing ? (
                                                <input type="text" value={asig.references || ''} onChange={e => handleEditChange(weekIndex, `studentAssignments.${asigIndex}.references`, e.target.value)} className="w-full mt-1 p-1 border rounded text-xs bg-yellow-50" placeholder="Referencias" />
                                            ) : (
                                                asig.references && <div className="text-xs text-gray-500 mt-1">{asig.references}</div>
                                            )}
                                        </div>
                                    } time={`${asig.duration || ''}`}>
                                        <div className="flex flex-col items-end">
                                            <div className="flex items-center">
                                                {isEditing ? renderSelect(weekIndex, `studentAssignments.${asigIndex}.studentId`, studentRoleKey, studentGender) : getPublisherName(asig.studentId)}
                                                {!isEditing && <ReminderButton publisherId={asig.studentId} details={{ date: week.weekRange, title: asig.title, source: asig.references, helperId: asig.helperId, s89: true, number: asig.number ?? asigIndex + 4, studentId: asig.studentId }} />}
                                            </div>
                                            {!isAnalysis && (asig.helperId !== null || isEditing) && (
                                                <div className="flex items-center text-sm text-gray-600 mt-1">
                                                    <span className="mr-1">/ Ayudante:</span>
                                                    {isEditing ? renderSelect(weekIndex, `studentAssignments.${asigIndex}.helperId`, 'vym_revisita', undefined, studentId) : (
                                                        <>
                                                            {getPublisherName(asig.helperId)}
                                                            <ReminderButton publisherId={asig.helperId} details={{ date: week.weekRange, title: `${asig.title} (Ayudante)`, source: asig.references, role: 'Ayudante', s89: true, forHelper: true, number: asig.number ?? asigIndex + 4, studentId: asig.studentId }} />
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </EditableAssignmentRow>
                                );
                            })}

                            <div className="bg-red-100 text-red-800 font-bold p-2 my-2 rounded-md">NUESTRA VIDA CRISTIANA</div>
                            <EditableAssignmentRow label={<>Canción {isEditing ? <input type="text" value={week.song2 || ''} onChange={e => handleEditChange(weekIndex, 'song2', e.target.value)} className="w-12 inline-block p-1 border rounded text-sm bg-yellow-50" /> : week.song2}</>}><span></span></EditableAssignmentRow>
                            {(week.christianLivingParts || []).map((part: any, partIndex: number) => (
                                <EditableAssignmentRow key={partIndex} label={
                                    <div>
                                        <div>{isEditing ? renderInput(weekIndex, `christianLivingParts.${partIndex}.title`, 'Título') : part.title}</div>
                                        {isEditing ? (
                                            <input type="text" value={part.references || ''} onChange={e => handleEditChange(weekIndex, `christianLivingParts.${partIndex}.references`, e.target.value)} className="w-full mt-1 p-1 border rounded text-xs bg-yellow-50" placeholder="Referencias" />
                                        ) : (
                                            part.references && <div className="text-xs text-gray-500 mt-1">{part.references}</div>
                                        )}
                                        {isEditing && (
                                            <div className="flex items-center gap-2 mt-1">
                                                <input type="text" value={part.duration || ''} onChange={e => handleEditChange(weekIndex, `christianLivingParts.${partIndex}.duration`, e.target.value)} className="w-32 p-1 border rounded text-xs bg-yellow-50" placeholder="Duración (ej. 5 mins.)" />
                                                <button type="button" onClick={() => handleRemoveChristianLivingPart(weekIndex, partIndex)} className="text-xs text-red-600 hover:underline" title="Quitar esta asignación de la semana">Quitar</button>
                                            </div>
                                        )}
                                    </div>
                                } time={`${part.duration || ''}`}>
                                    {part.note ? <em className="text-gray-500">{part.note}</em> : (isEditing ? renderSelect(weekIndex, `christianLivingParts.${partIndex}.assigneeId`, 'vym_vida_cristiana') : (
                                        <span className="flex items-center justify-end">
                                            {getPublisherName(part.assigneeId)}
                                            <ReminderButton publisherId={part.assigneeId} details={{ date: week.weekRange, title: part.title, source: part.references }} />
                                        </span>
                                    ))}
                                </EditableAssignmentRow>
                            ))}
                            {isEditing && (
                                <div className="my-2">
                                    <button type="button" onClick={() => handleAddChristianLivingPart(weekIndex)} className="px-3 py-1 text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-md hover:bg-red-100">
                                        ➕ Agregar asignación a Nuestra vida cristiana
                                    </button>
                                    <p className="text-xs text-gray-500 mt-1">Para cuando la guía pide agregar un informe u otra parte (p. ej. Informe del Cuerpo Gobernante). Escribe el título, la duración y elige quién la presenta.</p>
                                </div>
                            )}
                            {week.hasCbs && <EditableAssignmentRow
                                label={<div>
                                    <div>Estudio bíblico de la congregación</div>
                                    {week.cbsSource && <div className="text-xs text-gray-500 italic">{isEditing ? renderInput(weekIndex, 'cbsSource', 'Referencia') : week.cbsSource}</div>}
                                    {isEditing && (() => {
                                        const est = estimateWeekMinutes(week);
                                        const ok = est.total === MEETING_TARGET_MIN;
                                        return (
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                                <span>Duración:</span>
                                                <input type="text" value={week.cbsDuration ?? '30 mins.'} onChange={e => handleEditChange(weekIndex, 'cbsDuration', e.target.value)} className="w-24 p-1 border rounded bg-yellow-50" placeholder="30 mins." />
                                                <span className={ok ? 'text-green-700 font-semibold' : 'text-amber-700 font-semibold'}>Reunión estimada: {fmtDuration(est.total)}</span>
                                                {!ok && (
                                                    <button type="button" onClick={() => handleFitCbsDuration(weekIndex)} className="px-2 py-0.5 border border-amber-300 bg-amber-50 text-amber-800 rounded hover:bg-amber-100">
                                                        Ajustar a {fmtDuration(MEETING_TARGET_MIN)}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>}
                                time={week.cbsDuration || '30 min.'}>
                                <div>
                                    <div className="flex items-center justify-end mb-1">
                                        <span className="mr-1">Conductor:</span>
                                        {isEditing ? renderSelect(weekIndex, 'cbsConductorId', 'vym_conductor_ebc') : (
                                            <>
                                                {getPublisherName(week.cbsConductorId)}
                                                <ReminderButton publisherId={week.cbsConductorId} details={{ date: week.weekRange, title: 'Estudio Bíblico (Conductor)', source: week.cbsSource }} />
                                            </>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-end">
                                        <span className="mr-1">Lector:</span>
                                        {isEditing ? renderSelect(weekIndex, 'cbsReaderId', 'vym_lectura', 'Hombre') : (
                                            <>
                                                {getPublisherName(week.cbsReaderId)}
                                                <ReminderButton publisherId={week.cbsReaderId} details={{ date: week.weekRange, title: 'Estudio Bíblico (Lector)', source: week.cbsSource }} />
                                            </>
                                        )}
                                    </div>
                                </div>
                            </EditableAssignmentRow>}
                            <EditableAssignmentRow label="Palabras de conclusión" time="3 min.">
                                <span className="flex items-center justify-end">
                                    <strong>{getPublisherName(week.presidentId)}</strong>
                                    {/* Usually president does conclusion, no specific reminder needed if separate from president assignment? Or maybe redundancy is fine. */}
                                </span>
                            </EditableAssignmentRow>
                            <EditableAssignmentRow label={<>Canción {isEditing ? <input type="text" value={week.song3 || ''} onChange={e => handleEditChange(weekIndex, 'song3', e.target.value)} className="w-12 inline-block p-1 border rounded text-sm bg-yellow-50" /> : week.song3} y oración</>}>
                                {isEditing ? renderSelect(weekIndex, 'finalPrayerId', 'vym_oracion') : (
                                    <span className="flex items-center justify-end">
                                        {getPublisherName(week.finalPrayerId)}
                                        <ReminderButton publisherId={week.finalPrayerId} details={{ date: week.weekRange, title: 'Oración Final', role: 'Oración Final' }} />
                                    </span>
                                )}
                            </EditableAssignmentRow>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const handleShareWhatsApp = () => {
        const scheduleToShare = draftSchedule || editableSchedule || scheduleForSelectedMonth;

        if (!scheduleToShare) {
            onShowModal({ type: 'error', title: 'Error', message: 'No hay programa disponible para compartir.' });
            return;
        }

        let message = `PROGRAMA VIDA Y MINISTERIO - ${selectedMonth} ${selectedYear}\n\n`;

        scheduleToShare.weeks.forEach(week => {
            message += `SEMANA ${week.weekRange}\n`;
            if (week.bibleReadingSource) message += `Lectura: ${week.bibleReadingSource}\n`;
            message += `Presidente: ${getPublisherName(week.presidentId)}\n`;
            message += `Oración inicial: ${getPublisherName(week.presidentId) || 'Presidente'}\n\n`;

            message += `TESOROS DE LA BIBLIA\n`;
            week.treasuresParts.forEach(part => {
                message += `• ${part.title}: ${getPublisherName(part.assigneeId)}\n`;
            });
            message += `\n`;

            message += `SEAMOS MEJORES MAESTROS\n`;
            week.studentAssignments.forEach(asig => {
                const studentName = getPublisherName(asig.studentId);
                const assistantName = asig.helperId ? ` / ${getPublisherName(asig.helperId)}` : '';
                message += `• ${asig.title}: ${studentName}${assistantName}\n`;
            });
            message += `\n`;

            message += `NUESTRA VIDA CRISTIANA\n`;
            week.christianLivingParts.forEach(part => {
                const assignee = part.note || getPublisherName(part.assigneeId);
                message += `• ${part.title}: ${assignee}\n`;
            });
            if (week.hasCbs) {
                message += `• Estudio Bíblico: ${getPublisherName(week.cbsConductorId)} / ${getPublisherName(week.cbsReaderId)}\n`;
            }
            message += `Oración final: ${getPublisherName(week.finalPrayerId)}\n`;
            message += `----------------------------------\n\n`;
        });

        const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    // Abre WhatsApp directo al celular del publicador (si lo tiene capturado) o con el selector de contactos.
    const openWhatsApp = (publisher: Publisher, message: string) => {
        const phone = publisher.Cel ? String(publisher.Cel).replace(/\D/g, '') : '';
        const clean = phone.length === 10 ? '52' + phone : phone;
        const url = clean
            ? `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
            : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    // Mismo formato del formulario S-89-S (Asignación para la reunión Vida y Ministerio Cristianos). Siempre en la sala principal.
    const buildS89Message = (studentName: string, helperName: string, date: string, number: number | string, title?: string) =>
        `*ASIGNACIÓN PARA LA REUNIÓN*\n*VIDA Y MINISTERIO CRISTIANOS*\n\n` +
        `*Nombre:* ${studentName}\n` +
        `*Ayudante:* ${helperName || '—'}\n` +
        `*Fecha:* ${date}\n` +
        `*Intervención núm.:* ${number}${title ? ` (${title})` : ''}\n` +
        `*Se presentará en:*\n` +
        `✅ Sala principal\n⬜ Sala auxiliar núm. 1\n⬜ Sala auxiliar núm. 2\n\n` +
        `*Nota al estudiante:* En la Guía de actividades encontrará la información que necesita para su intervención. ` +
        `Repase también las indicaciones que se describen en las Instrucciones para la reunión Vida y Ministerio Cristianos (S-38).\n\n` +
        `S-89-S 11/23`;

    const handleSendReminder = (publisherId: string, assignmentDetails: { date: string, title?: string, role?: string, helperId?: string, room?: string, source?: string, s89?: boolean, forHelper?: boolean, number?: number | string, studentId?: string }) => {
        const publisher = publishers.find(p => p.id === publisherId);
        if (!publisher) return;
        const fullName = (p?: Publisher | null) => p ? [p.Nombre, p.Apellido].filter(Boolean).join(' ') : '';

        if (assignmentDetails.s89) {
            const student = publishers.find(p => p.id === assignmentDetails.studentId) || publisher;
            const helper = assignmentDetails.forHelper ? publisher : (assignmentDetails.helperId ? publishers.find(p => p.id === assignmentDetails.helperId) : null);
            const cleanTitle = (assignmentDetails.title || '').replace(/\s*\(Ayudante\)\s*$/i, '');
            openWhatsApp(publisher, buildS89Message(fullName(student), fullName(helper), assignmentDetails.date, assignmentDetails.number ?? '', cleanTitle));
            return;
        }

        const helper = assignmentDetails.helperId ? publishers.find(p => p.id === assignmentDetails.helperId) : null;
        const helperName = helper ? `${helper.Nombre} ${helper.Apellido}` : 'Nadie';

        const message = `ASIGNACION PARA LA REUNION VIDA Y MINISTERIO CRISTIANOS\n\n` +
            `Nombre: ${publisher.Nombre} ${publisher.Apellido}\n` +
            `Ayudante: ${helperName}\n` +
            `Fecha: ${assignmentDetails.date}\n` +
            `Intervención núm.: ${assignmentDetails.title || assignmentDetails.role || 'Asignación'}\n` +
            `Se presentará en:\n` +
            `✅ Sala principal\n⬜ Sala auxiliar núm. 1\n⬜ Sala auxiliar núm. 2\n\n` +
            (assignmentDetails.source ? `Fuente: ${assignmentDetails.source}\n` : '') +
            `Nota: En la Guía de actividades encontrará la información que necesita para su intervención. Repase también las indicaciones que se describen en las Instrucciones para la reunión Vida y Ministerio Cristianos (S-38).\n`;
        openWhatsApp(publisher, message);
    };

    const ReminderButton = ({ publisherId, details }: { publisherId: string, details: any }) => {
        if (!publisherId || !canConfig) return null;
        return (
            <button
                onClick={() => handleSendReminder(publisherId, details)}
                className="ml-2 p-1 text-green-500 hover:text-green-600 rounded-full hover:bg-green-50 inline-flex items-center"
                title="Enviar recordatorio por WhatsApp"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                </svg>
            </button>
        );
    };


    return (
        <div className="container mx-auto max-w-7xl p-4">
            <div className="bg-white p-6 rounded-lg shadow-md">
                {canConfig && (
                    <div className="mb-4 border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide pb-0.5" aria-label="Tabs">
                            <button onClick={() => setActiveTab('schedule')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'schedule' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Programa</button>
                            <button onClick={() => setActiveTab('config')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'config' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Configuración</button>
                        </nav>
                    </div>
                )}

                {activeTab === 'config' && canConfig ? (
                    <ConfigView
                        publishers={activePublishers}
                        onUpdatePublisherVyMAssignments={onUpdatePublisherVyMAssignments}
                        onShowModal={onShowModal}
                        onShareWhatsApp={handleShareWhatsApp}
                    />
                ) :
                    (
                        <>
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                                <h1 className="text-2xl font-bold text-gray-800">Programa Vida y Ministerio</h1>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {canConfig && (
                                        <>
                                            {draftSchedule ? (
                                                <>
                                                    <button onClick={handleSaveDraft} disabled={isLoading} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Guardar Borrador</button>
                                                    <button onClick={handleDiscardDraft} className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600">Descartar</button>
                                                </>
                                            ) : isEditing ? (
                                                <>
                                                    <button onClick={handleSaveChanges} disabled={isLoading} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Guardar Cambios</button>
                                                    <button onClick={handleCancelEdit} className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600">Cancelar</button>
                                                </>
                                            ) : (
                                                <>
                                                    {scheduleForSelectedMonth && <button onClick={handleEditClick} className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600">Editar Programa</button>}
                                                    <button onClick={handleShareWhatsApp} disabled={isLoading || !(draftSchedule || editableSchedule || scheduleForSelectedMonth)} className="px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:bg-gray-400 flex items-center gap-2">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" /></svg>
                                                        WhatsApp
                                                    </button>
                                                    <button onClick={handleExportPdf} disabled={isLoading || !(draftSchedule || editableSchedule || scheduleForSelectedMonth)} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-gray-400">Exportar a PDF</button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="p-2 border rounded-md">
                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-md">
                                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            {canConfig && !draftSchedule && !isEditing && scheduleForSelectedMonth && (
                                <div className="flex justify-center items-center gap-4 mb-6 p-3 bg-gray-100 rounded-lg">
                                    <span className="font-semibold">Estado:</span>
                                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${isPublic ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {isPublic ? 'Público' : 'Oculto'}
                                    </span>
                                    <button onClick={handleToggleVisibility} disabled={isLoading} className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                                        {isPublic ? 'Ocultar' : 'Hacer Público'}
                                    </button>
                                </div>
                            )}

                            {canConfig && !draftSchedule && !isEditing && (
                                <div className="p-4 border rounded-lg bg-gray-50 mb-6">
                                    <label htmlFor="program-text" className="block text-sm font-medium text-gray-700 mb-2">Pegue aquí el programa de la Guía de Actividades:</label>
                                    <textarea id="program-text" value={programText} onChange={e => setProgramText(e.target.value)} rows={5} className="w-full p-2 border rounded-md shadow-sm" placeholder="Ej: 22-28 DE DICIEMBRE | Lectura semanal: ... | Canción ... | TESOROS DE LA BIBLIA | 1. Discurso (10 min.) ..."></textarea>
                                    <div className="text-right mt-2">
                                        <button onClick={handleGenerateSchedule} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                                            {isLoading ? 'Generando...' : 'Generar Programa'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {ScheduleView()}
                        </>
                    )}
            </div>
        </div>
    );
};

export default VidaYMinisterio;