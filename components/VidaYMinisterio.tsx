
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Publisher, LMMeetingSchedule, ModalInfo, LMWeekAssignment, MONTHS } from '../App';

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
    'Lector Estudio Bíblico': 'vym_lector_ebc',
};

const STUDENT_ASSIGNMENTS = {
    'Lectura de la Biblia': 'vym_lectura',
    'Primera Conversación': 'vym_primera_conversacion',
    'Revisita': 'vym_revisita',
    'Curso Bíblico': 'vym_curso_biblico',
    'Discurso de Estudiante': 'vym_discurso_estudiante',
};

const ALL_ASSIGNMENT_KEYS = { ...MALE_ASSIGNMENTS, ...STUDENT_ASSIGNMENTS };

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
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editableSchedule, setEditableSchedule] = useState<LMMeetingSchedule | null>(null);
    const [isPublic, setIsPublic] = useState(false);

    const activePublishers = useMemo(() => publishers.filter(p => p.Estatus === 'Activo'), [publishers]);

    const scheduleForSelectedMonth = useMemo(() => {
        return lmSchedules.find(s => s.year === selectedYear && s.month === selectedMonth);
    }, [lmSchedules, selectedYear, selectedMonth]);
    
    useEffect(() => {
        setIsEditing(false);
        setEditableSchedule(null);
        setIsPublic(scheduleForSelectedMonth?.isPublic || false);
    }, [selectedMonth, selectedYear, activeTab, scheduleForSelectedMonth]);
    
    const getPublisherName = useCallback((id: string | null | undefined): string => {
        if (!id) return '';
        const pub = publishers.find(p => p.id === id);
        return pub ? [pub.Nombre, pub.Apellido].filter(Boolean).join(' ') : 'N/A';
    }, [publishers]);

    const getEligiblePublishers = useCallback((roleKey: string, gender?: 'Hombre' | 'Mujer') => {
        let eligible = activePublishers.filter(p => (p as any)[roleKey]);
        if (gender) {
            eligible = eligible.filter(p => p.Sexo === gender);
        }
        return eligible.sort((a,b) => a.Nombre.localeCompare(b.Nombre));
    }, [activePublishers]);
    
    const handleSaveChanges = async () => {
        if (!editableSchedule) return;
        setIsLoading(true);
        try {
            const scheduleToSave = { ...editableSchedule, isPublic };
            await onSaveSchedule(scheduleToSave);
            setIsEditing(false);
            setEditableSchedule(null);
            onShowModal({ type: 'success', title: 'Guardado', message: 'Los cambios se han guardado.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: `No se pudo guardar: ${(error as Error).message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditChange = (weekIndex: number, assignmentKey: string, value: string) => {
        if (!editableSchedule) return;
        setEditableSchedule(prev => {
            if (!prev) return null;
            const newSchedule = JSON.parse(JSON.stringify(prev));
            if (!newSchedule.weeks[weekIndex]) {
                newSchedule.weeks[weekIndex] = {};
            }
            newSchedule.weeks[weekIndex][assignmentKey] = value;
            return newSchedule;
        });
    };

    const ScheduleView = () => {
        const currentSchedule = isEditing ? editableSchedule : scheduleForSelectedMonth;
    
        if (!canConfig && !currentSchedule?.isPublic) {
            return <div className="text-center p-8 bg-gray-50 rounded-lg"><p className="text-gray-500">El programa para este mes aún no está disponible públicamente.</p></div>;
        }

        const renderSelect = (weekIndex: number, assignmentKey: string, roleKey: string, gender?: 'Hombre' | 'Mujer') => (
            <select 
                value={currentSchedule?.weeks?.[weekIndex]?.[assignmentKey] || ''} 
                onChange={e => handleEditChange(weekIndex, assignmentKey, e.target.value)}
                className="w-full p-1 border rounded text-xs"
            >
                <option value="">-- Asignar --</option>
                {getEligiblePublishers(roleKey, gender).map(p => (
                    <option key={p.id} value={p.id}>{getPublisherName(p.id)}</option>
                ))}
            </select>
        );
        
        const renderInput = (weekIndex: number, assignmentKey: string, placeholder: string) => (
            <input
                type="text"
                value={currentSchedule?.weeks?.[weekIndex]?.[assignmentKey] || ''}
                onChange={e => handleEditChange(weekIndex, assignmentKey, e.target.value)}
                className="w-full p-1 border rounded text-xs"
                placeholder={placeholder}
            />
        );
    
        return (
            <div>
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                    <h2 className="text-xl font-bold">Programa de {selectedMonth}, {selectedYear}</h2>
                    {canConfig && (
                        isEditing ? (
                            <div className="flex gap-2">
                                <button onClick={handleSaveChanges} disabled={isLoading} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Guardar</button>
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600">Cancelar</button>
                            </div>
                        ) : (
                            <button onClick={() => { if(currentSchedule) { setIsEditing(true); setEditableSchedule(JSON.parse(JSON.stringify(currentSchedule))); }}} disabled={!currentSchedule} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">Editar</button>
                        )
                    )}
                </div>
                 {!currentSchedule?.weeks?.length ? (
                     <p className="text-center text-gray-500 py-8">No hay programa disponible o generado para este mes.</p>
                 ) : (
                     <div className="space-y-6">
                         {currentSchedule.weeks.map((week, weekIndex) => (
                             <div key={weekIndex} className="bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500">
                                 <h3 className="font-bold text-lg text-blue-800 mb-3">{isEditing ? renderInput(weekIndex, 'weekRange', 'Ej: 4-10 de Enero') : week.weekRange}</h3>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                    {isEditing ? <div className="flex items-center gap-2"><label>Público:</label><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} /></div> : null }
                                    <p><b>Presidente:</b> {isEditing ? renderSelect(weekIndex, 'presidente', ALL_ASSIGNMENT_KEYS.Presidente, 'Hombre') : getPublisherName(week.presidente)}</p>
                                    <p><b>Lectura de la Biblia:</b> {isEditing ? renderSelect(weekIndex, 'lecturaBiblia', ALL_ASSIGNMENT_KEYS['Lectura de la Biblia']) : getPublisherName(week.lecturaBiblia)}</p>
                                    {/* Add other fields here based on your data structure */}
                                    <p><b>Discurso (Tesoros):</b> {isEditing ? renderSelect(weekIndex, 'tesorosTalk', ALL_ASSIGNMENT_KEYS['Discurso Tesoros'], 'Hombre') : getPublisherName(week.tesorosTalk)}</p>
                                    <p><b>Perlas Escondidas:</b> {isEditing ? renderSelect(weekIndex, 'perlas', ALL_ASSIGNMENT_KEYS['Conductor Perlas'], 'Hombre') : getPublisherName(week.perlas)}</p>
                                    <p><b>Análisis de video (Maestros):</b> {isEditing ? renderInput(weekIndex, 'videoMaestros', 'Título del video') : week.videoMaestros}</p>
                                    <p><b>Discurso (Vida Cristiana):</b> {isEditing ? renderSelect(weekIndex, 'vidaCristianaTalk', ALL_ASSIGNMENT_KEYS['Discurso Vida Cristiana'], 'Hombre') : getPublisherName(week.vidaCristianaTalk)}</p>
                                    <p><b>Conductor EBC:</b> {isEditing ? renderSelect(weekIndex, 'ebcConductor', ALL_ASSIGNMENT_KEYS['Conductor Estudio Bíblico'], 'Hombre') : getPublisherName(week.ebcConductor)}</p>
                                    <p><b>Lector EBC:</b> {isEditing ? renderSelect(weekIndex, 'ebcLector', ALL_ASSIGNMENT_KEYS['Lector Estudio Bíblico'], 'Hombre') : getPublisherName(week.ebcLector)}</p>
                                 </div>
                             </div>
                         ))}
                     </div>
                 )}
            </div>
        );
    };

    const ConfigView = () => {
        const [assignments, setAssignments] = useState(() =>
            Object.fromEntries(activePublishers.map(p => {
                const pubAssignments = Object.fromEntries(
                    Object.values(ALL_ASSIGNMENT_KEYS).map(key => [key, !!(p as any)[key]])
                );
                return [p.id, pubAssignments];
            }))
        );
    
        const handleToggle = (pubId: string, roleKey: string) => {
            setAssignments(prev => ({
                ...prev,
                [pubId]: { ...prev[pubId], [roleKey]: !prev[pubId][roleKey] }
            }));
        };
    
        const handleSave = async () => {
            setIsLoading(true);
            try {
                const promises = Object.entries(assignments).map(([pubId, roles]) =>
                    onUpdatePublisherVyMAssignments(pubId, roles)
                );
                await Promise.all(promises);
                onShowModal({ type: 'success', title: 'Guardado', message: 'Configuración de participantes guardada.' });
            } finally {
                setIsLoading(false);
            }
        };
    
        return (
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Configuración de Participantes de Vida y Ministerio</h2>
                    <button onClick={handleSave} disabled={isLoading} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                        {isLoading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Publicador</th>
                                {Object.keys(ALL_ASSIGNMENT_KEYS).map(label => <th key={label} className="px-3 py-3 text-center font-medium text-gray-500 uppercase" style={{minWidth: '100px'}}>{label}</th>)}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {activePublishers.map(pub => (
                                <tr key={pub.id}>
                                    <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900 sticky left-0 bg-white">{[pub.Nombre, pub.Apellido].join(' ')}</td>
                                    {Object.values(ALL_ASSIGNMENT_KEYS).map(key => (
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
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto max-w-7xl p-4">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="p-2 border rounded-md">
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-md">
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {canConfig && (
                    <div className="mb-4 border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            <button onClick={() => setActiveTab('schedule')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'schedule' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Programa</button>
                            <button onClick={() => setActiveTab('config')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'config' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Configuración de Participantes</button>
                        </nav>
                    </div>
                )}
                
                {activeTab === 'config' && canConfig ? <ConfigView /> : <ScheduleView />}
            </div>
        </div>
    );
};

export default VidaYMinisterio;
