import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Publisher, MeetingAssignmentSchedule, ModalInfo, DayAssignment } from '../App';
import ShareModal from './ShareModal';

interface AsignacionesReunionProps {
    publishers: Publisher[];
    schedules: MeetingAssignmentSchedule[];
    onSaveSchedule: (schedule: Omit<MeetingAssignmentSchedule, 'id'>) => Promise<void>;
    onUpdatePublisherAssignments: (publisherId: string, assignments: string[]) => Promise<void>;
    onShowModal: (info: ModalInfo) => void;
    canConfig: boolean;
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ALL_ASSIGNMENT_ROLES = ['Presidente', 'Acomodador en la puerta Principal', 'Acomodador de la puerta del Auditorio', 'Acomodador de los Asistentes', 'Micrófono', 'Vigilante', 'Conductor de la Atalaya', 'Lector de la Atalaya'];
const ROLE_KEY_TO_NAME: Record<string, string> = {
    presidente: 'Presidente',
    acomodadoresPrincipal: 'Acomodador en la puerta Principal',
    acomodadoresAuditorio: 'Acomodador de la puerta del Auditorio',
    acomodadoresSala: 'Acomodador de los Asistentes',
    microfonos: 'Micrófono',
    vigilantes: 'Vigilante',
    conductorAtalaya: 'Conductor de la Atalaya',
    lectorAtalaya: 'Lector de la Atalaya'
};
const MALE_ONLY_ROLES = ['Presidente', 'Acomodador en la puerta Principal', 'Acomodador de la puerta del Auditorio', 'Acomodador de los Asistentes', 'Micrófono', 'Vigilante', 'Conductor de la Atalaya', 'Lector de la Atalaya'];


type AssignmentKey = keyof DayAssignment;

const AsignacionesReunion: React.FC<AsignacionesReunionProps> = ({
    publishers,
    schedules,
    onSaveSchedule,
    onUpdatePublisherAssignments,
    onShowModal,
    canConfig
}) => {
    const [activeTab, setActiveTab] = useState<'schedule' | 'config'>('schedule');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editableSchedule, setEditableSchedule] = useState<MeetingAssignmentSchedule | null>(null);
    const [shareModalContent, setShareModalContent] = useState<{ title: string; text: string; } | null>(null);
    const [newlyGeneratedSchedule, setNewlyGeneratedSchedule] = useState<MeetingAssignmentSchedule | null>(null);
    const [isPublic, setIsPublic] = useState(false);

    const activePublishers = useMemo(() => publishers.filter(p => p.Estatus === 'Activo'), [publishers]);
    const malePublishers = useMemo(() => activePublishers.filter(p => p.Sexo === 'Hombre'), [activePublishers]);

    const scheduleForSelectedMonth = useMemo(() => {
        // Prioritize showing the newly generated schedule for immediate feedback.
        if (newlyGeneratedSchedule && newlyGeneratedSchedule.year === selectedYear && newlyGeneratedSchedule.month === selectedMonth) {
            return newlyGeneratedSchedule;
        }
        return schedules.find(s => s.year === selectedYear && s.month === selectedMonth);
    }, [schedules, selectedYear, selectedMonth, newlyGeneratedSchedule]);

    useEffect(() => {
        setIsEditing(false);
        setEditableSchedule(null);
        setNewlyGeneratedSchedule(null);
        setIsPublic(scheduleForSelectedMonth?.isPublic || false);
    }, [selectedMonth, selectedYear, activeTab, scheduleForSelectedMonth]);
    
    const getEligiblePublishers = useCallback((role: string) => {
        // Start with male publishers who are configured for the role
        let eligible = malePublishers.filter(p => p.asignacionesDisponibles?.includes(role));

        // Apply specific privilege rules
        if (role === 'Conductor de la Atalaya') {
            eligible = eligible.filter(p => p.Privilegio === 'Anciano');
        } else if (role === 'Presidente') {
            eligible = eligible.filter(p => p.Privilegio === 'Anciano' || p.Privilegio === 'Siervo Ministerial');
        }

        return eligible;
    }, [malePublishers]);

    const handleGenerateSchedule = async () => {
        setIsLoading(true);
        onShowModal({ type: 'info', title: 'Generando Programa', message: 'Calculando asignaciones equitativas, por favor espere...' });
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
            const eligible: { [role: string]: Publisher[] } = {};
            ALL_ASSIGNMENT_ROLES.forEach(role => {
                eligible[role] = getEligiblePublishers(role);
            });

            const errors = [];
            const rolesToCheck: { [key: string]: { description: string, min: number } } = {
                'Presidente': { description: "Ancianos o Siervos Ministeriales", min: 1 },
                'Conductor de la Atalaya': { description: "Ancianos", min: 1 },
                'Lector de la Atalaya': { description: "hermanos", min: 1 },
                'Acomodador en la puerta Principal': { description: "hermanos", min: 1 },
                'Acomodador de la puerta del Auditorio': { description: "hermanos", min: 1 },
                'Acomodador de los Asistentes': { description: "hermanos", min: 2 },
                'Micrófono': { description: "hermanos", min: 2 },
                'Vigilante': { description: "hermanos", min: 3 }
            };

            for (const [role, criteria] of Object.entries(rolesToCheck)) {
                if (eligible[role].length < criteria.min) {
                    if (criteria.min === 1) {
                        errors.push(`• No hay ${criteria.description} elegibles para '${role}'.`);
                    } else {
                        errors.push(`• Se necesitan al menos ${criteria.min} ${criteria.description} para '${role}'. Se encontraron ${eligible[role].length}.`);
                    }
                }
            }

            const groups = [...new Set(activePublishers.map(p => p.Grupo).filter(Boolean) as string[])];
            if (groups.length === 0) {
                errors.push("• No hay grupos de servicio configurados para las asignaciones de Aseo y Hospitalidad.");
            }

            if (errors.length > 0) {
                onShowModal({
                    type: 'error',
                    title: 'Faltan Participantes Elegibles',
                    message: 'No se pudo generar el programa. Faltan participantes clave:\n\n' + errors.join('\n') + '\n\n**Solución:**\n1. Vaya a la pestaña "Publicadores" y asegúrese de que los hermanos tengan asignado su privilegio (Anciano, Siervo Ministerial).\n2. Vaya a "Configuración de Participantes" y active las casillas de las asignaciones que pueden atender.'
                });
                return;
            }

            const getDatesForWeekday = (month: number, year: number, day: number) => {
                const dates = [];
                const date = new Date(year, month, 1);
                while (date.getMonth() === month) {
                    if (date.getDay() === day) { // 0=Sun, 1=Mon, ..., 6=Sat
                        dates.push(new Date(date));
                    }
                    date.setDate(date.getDate() + 1);
                }
                return dates;
            };

            const monthIndex = MONTHS.indexOf(selectedMonth);
            const tuesdays = getDatesForWeekday(monthIndex, selectedYear, 2);
            const saturdays = getDatesForWeekday(monthIndex, selectedYear, 6);
            const allMeetingDates = [...tuesdays, ...saturdays].sort((a,b) => a.getTime() - b.getTime());

            const queues: { [key: string]: any[] } = {
                ...Object.fromEntries(ALL_ASSIGNMENT_ROLES.map(role => [role, [...eligible[role]]])),
                tuesdayAseo: [...groups],
                saturdayAseo: [...groups],
                saturdayHospitality: [...groups]
            };
            
            const newScheduleData: MeetingAssignmentSchedule['schedule'] = {};

            for (const meetingDate of allMeetingDates) {
                const isTuesday = meetingDate.getDay() === 2;
                const dateKey = `${isTuesday ? 'tuesday' : 'saturday'}-${meetingDate.toISOString().slice(0, 10)}`;
                const assignmentsForDay: DayAssignment = {};
                const assignedThisDay = new Set<string>();

                const getNextAvailable = (role: string, count: number) => {
                    const queue = queues[role];
                    if (!queue || queue.length === 0) return Array(count).fill(null);
                    
                    const result: (string|null)[] = [];
                    let attempts = 0;
                    while(result.length < count && attempts < queue.length * 2) {
                        let person = queue.shift();
                        queue.push(person);
                        if (person && !assignedThisDay.has(person.id)) {
                            result.push(person.id);
                            assignedThisDay.add(person.id);
                        }
                        attempts++;
                    }
                    while(result.length < count) result.push(null);
                    return result;
                };

                const getNextGroup = (queueName: string) => {
                    const queue = queues[queueName];
                    if (!queue || queue.length === 0) return null;
                    const group = queue.shift();
                    queue.push(group);
                    return group;
                };

                if (isTuesday) {
                    assignmentsForDay.fechaReunion = `Martes ${meetingDate.getDate()}`;
                    assignmentsForDay.reunionHorario = '7:30 p. m.';
                    assignmentsForDay.vigilanciaHorario = '8:20-8:50 p. m.';
                    assignmentsForDay.acomodadoresPrincipal = getNextAvailable('Acomodador en la puerta Principal', 1);
                    assignmentsForDay.acomodadoresAuditorio = getNextAvailable('Acomodador de la puerta del Auditorio', 1);
                    assignmentsForDay.acomodadoresSala = getNextAvailable('Acomodador de los Asistentes', 2);
                    assignmentsForDay.microfonos = getNextAvailable('Micrófono', 2);
                    assignmentsForDay.vigilantes = getNextAvailable('Vigilante', 3);
                    assignmentsForDay.aseo = getNextGroup('tuesdayAseo');
                } else { // Saturday
                    assignmentsForDay.fechaReunion = `Sábado ${meetingDate.getDate()}`;
                    assignmentsForDay.reunionHorario = '4:30 p. m.';
                    assignmentsForDay.vigilanciaHorario = '4:15-4:50 p. m.';
                    
                    assignmentsForDay.conductorAtalaya = getNextAvailable('Conductor de la Atalaya', 1)[0] || undefined;
                    assignmentsForDay.presidente = getNextAvailable('Presidente', 1)[0] || undefined;
                    assignmentsForDay.lectorAtalaya = getNextAvailable('Lector de la Atalaya', 1)[0] || undefined;

                    assignmentsForDay.acomodadoresPrincipal = getNextAvailable('Acomodador en la puerta Principal', 1);
                    assignmentsForDay.acomodadoresAuditorio = getNextAvailable('Acomodador de la puerta del Auditorio', 1);
                    assignmentsForDay.acomodadoresSala = getNextAvailable('Acomodador de los Asistentes', 2);
                    assignmentsForDay.microfonos = getNextAvailable('Micrófono', 2);
                    assignmentsForDay.vigilantes = getNextAvailable('Vigilante', 3);
                    assignmentsForDay.aseo = getNextGroup('saturdayAseo');
                    assignmentsForDay.hospitalidad = getNextGroup('saturdayHospitality');
                }
                newScheduleData[dateKey] = assignmentsForDay;
            }

            const generatedScheduleObject: MeetingAssignmentSchedule = {
                id: `${selectedYear}-${selectedMonth}`,
                year: selectedYear,
                month: selectedMonth,
                schedule: newScheduleData,
                isPublic: false,
            };
            setNewlyGeneratedSchedule(generatedScheduleObject);
            setIsPublic(false);
            onShowModal({ type: 'success', title: 'Programa Generado', message: 'El borrador del programa se ha generado como "Oculto". Revíselo, guárdelo y luego publíquelo.' });

        } catch (error) {
            console.error("Error al generar el programa:", error);
            onShowModal({
                type: 'error',
                title: 'Error Inesperado',
                message: `Ocurrió un error al generar el programa. Esto puede deberse a una configuración compleja o un problema temporal. Por favor, inténtelo de nuevo.\n\nDetalles: ${(error as Error).message}`
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveGeneratedSchedule = async () => {
        if (!newlyGeneratedSchedule) return;
        setIsLoading(true);
        try {
            const { id, ...dataToSave } = newlyGeneratedSchedule;
            await onSaveSchedule(dataToSave);
            setNewlyGeneratedSchedule(null);
            onShowModal({ type: 'success', title: 'Guardado', message: 'El nuevo programa se ha guardado correctamente. Ahora puede hacerlo público.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: `No se pudo guardar el programa: ${(error as Error).message}` });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDiscardGeneratedSchedule = () => {
        setNewlyGeneratedSchedule(null);
    };

    const handleToggleVisibility = async () => {
        const scheduleToUpdate = scheduleForSelectedMonth;
        if (!scheduleToUpdate) {
            onShowModal({ type: 'error', title: 'Error', message: 'No hay un programa guardado para este mes para poder cambiar su visibilidad.' });
            return;
        }
        setIsLoading(true);
        try {
            const newVisibility = !isPublic;
            const { id, ...dataToSave } = scheduleToUpdate;
            await onSaveSchedule({ ...dataToSave, isPublic: newVisibility });
            setIsPublic(newVisibility);
            onShowModal({ type: 'success', title: 'Visibilidad Actualizada', message: `El programa ahora está ${newVisibility ? 'público' : 'oculto'}.` });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo actualizar la visibilidad.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const getPublisherName = useCallback((id: string | null) => {
        if (!id) return '';
        const pub = activePublishers.find(p => p.id === id);
        return pub ? [pub.Nombre, pub.Apellido].filter(Boolean).join(' ') : 'N/A';
    }, [activePublishers]);
    
    const checkForConflicts = useCallback((schedule: MeetingAssignmentSchedule, dateKey: string, role: string, publisherId: string) => {
        if (!publisherId) return;

        const conflictMessages: string[] = [];
        const pubName = getPublisherName(publisherId);
        if (!pubName || pubName === 'N/A') return;

        const dayAssignments = schedule.schedule[dateKey];
        if (!dayAssignments) return;

        let assignmentsThisDay = 0;
        for (const [roleKey, assigned] of Object.entries(dayAssignments)) {
             const publisherIds = Array.isArray(assigned) ? assigned : (assigned ? [assigned] : []);
             assignmentsThisDay += publisherIds.filter(id => id === publisherId).length;
        }

        if (assignmentsThisDay > 1) {
            conflictMessages.push(`Tiene más de una asignación en la misma reunión.`);
        }
        
        const sortedDateKeys = Object.keys(schedule.schedule).sort((a, b) => 
            new Date(a.substring(a.indexOf('-') + 1)).getTime() - new Date(b.substring(b.indexOf('-') + 1)).getTime()
        );
        const currentIndex = sortedDateKeys.indexOf(dateKey);

        const checkAdjacentMeeting = (adjacentIndex: number, meetingLabel: string) => {
            if (adjacentIndex >= 0 && adjacentIndex < sortedDateKeys.length) {
                const adjacentDateKey = sortedDateKeys[adjacentIndex];
                const adjacentDayAssignments = schedule.schedule[adjacentDateKey];
                if (!adjacentDayAssignments) return;
                
                for (const [roleKey, assigned] of Object.entries(adjacentDayAssignments)) {
                    const publisherIds = Array.isArray(assigned) ? assigned : (assigned ? [assigned] : []);
                    if(publisherIds.includes(publisherId)) {
                        conflictMessages.push(`Tiene una asignación en la reunión ${meetingLabel} (${adjacentDayAssignments.fechaReunion}).`);
                        return; // Found a conflict, no need to check other roles
                    }
                }
            }
        };

        checkAdjacentMeeting(currentIndex - 1, 'anterior');
        checkAdjacentMeeting(currentIndex + 1, 'siguiente');
        
        if (conflictMessages.length > 0) {
            onShowModal({
                type: 'info',
                title: 'Posible Conflicto de Asignación',
                message: `¡Atención! ${pubName} podría tener un conflicto:\n\n• ${conflictMessages.join('\n• ')}`
            });
        }
    }, [getPublisherName, onShowModal]);

    const handleEditChange = (dateKey: string, role: AssignmentKey, value: string, index: number = 0) => {
        if (!editableSchedule) return;

        const newSchedule = JSON.parse(JSON.stringify(editableSchedule));
        const dayAssignments = newSchedule.schedule[dateKey] || {};

        if (Array.isArray(dayAssignments[role])) {
            (dayAssignments[role] as string[])[index] = value;
        } else {
            (dayAssignments as any)[role] = value;
        }
        newSchedule.schedule[dateKey] = dayAssignments;
        setEditableSchedule(newSchedule);
        
        // Check for conflicts after state update
        checkForConflicts(newSchedule, dateKey, role, value);
    };
    
    const handleSaveChanges = async () => {
        if (!editableSchedule) return;
        setIsLoading(true);
        try {
            const { id, ...dataToSave } = editableSchedule;
            await onSaveSchedule({...dataToSave, isPublic});
            setIsEditing(false);
            setEditableSchedule(null);
            onShowModal({ type: 'success', title: 'Guardado', message: 'Los cambios se han guardado correctamente.' });
        } catch(error) {
            onShowModal({ type: 'error', title: 'Error', message: `No se pudo guardar: ${(error as Error).message}` });
        } finally {
            setIsLoading(false);
        }
    };
    
    const ScheduleView = () => {
        const currentSchedule = isEditing ? editableSchedule : (newlyGeneratedSchedule || scheduleForSelectedMonth);

        const displayData = useMemo(() => {
            if (!currentSchedule?.schedule) return [];

            const saturdayMeetings = Object.entries(currentSchedule.schedule)
                .filter(([key]) => key.startsWith('saturday'))
                .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

            return saturdayMeetings.map(([dateKey, assignment]) => {
                const satDate = new Date(dateKey.substring(dateKey.indexOf('-') + 1) + 'T00:00:00');
                const tueDate = new Date(satDate);
                tueDate.setDate(satDate.getDate() - 4);
                const sunDate = new Date(satDate);
                sunDate.setDate(satDate.getDate() + 1);
                const tueDateKey = `tuesday-${tueDate.toISOString().slice(0, 10)}`;

                const getAssignmentsWithRole = (roleKey: keyof DayAssignment, roleAbbr: string) => {
                    const ids = (assignment as any)[roleKey] as string[] | undefined;
                    return (ids || []).map((id, index) => ({ id, name: getPublisherName(id), role: roleAbbr, originalRoleKey: roleKey, originalIndex: index, dateKey }));
                };

                const acomodadoresYMicrofonos = [
                    ...getAssignmentsWithRole('acomodadoresPrincipal', 'AP'),
                    ...getAssignmentsWithRole('acomodadoresAuditorio', 'APA'),
                    ...getAssignmentsWithRole('acomodadoresSala', 'AA'),
                    ...getAssignmentsWithRole('microfonos', 'AM'),
                    ...getAssignmentsWithRole('vigilantes', 'V'),
                ];

                return {
                    weekDateRange: `Martes ${tueDate.getDate()} de ${MONTHS[tueDate.getMonth()].toLowerCase()}\nDomingo ${sunDate.getDate()} de ${MONTHS[sunDate.getMonth()].toLowerCase()}`,
                    presidente: { id: assignment.presidente, name: getPublisherName(assignment.presidente) },
                    lectorAtalaya: { id: assignment.lectorAtalaya, name: getPublisherName(assignment.lectorAtalaya) },
                    acomodadoresYMicrofonos,
                    aseo: { id: assignment.aseo, name: assignment.aseo ? `Grupo ${assignment.aseo}` : '' },
                    hospitalidad: { id: assignment.hospitalidad, name: assignment.hospitalidad ? `Grupo ${assignment.hospitalidad}` : '' },
                    tuesdayDateKey: tueDateKey,
                    saturdayDateKey: dateKey,
                };
            });
        }, [currentSchedule, getPublisherName]);

        if (!currentSchedule) {
            return <p className="text-center text-gray-500 py-8">No hay programa generado para este mes. Haga clic en "Generar Programa".</p>;
        }

        const groups = [...new Set(activePublishers.map(p => p.Grupo).filter(Boolean) as string[])].sort();

        return (
            <div className="space-y-6">
                <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800 flex flex-wrap justify-center gap-x-4 gap-y-1">
                    <span className="font-semibold">Leyenda:</span>
                    <span><strong>(AP)</strong>: Acomodador Puerta Principal</span>
                    <span><strong>(APA)</strong>: Acomodador Puerta Auditorio</span>
                    <span><strong>(AA)</strong>: Acomodador de Asistentes (Sala)</span>
                    <span><strong>(AM)</strong>: Micrófonos</span>
                    <span><strong>(V)</strong>: Vigilantes</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[1000px] text-sm">
                        <thead className="bg-blue-900 text-white">
                            <tr>
                                <th className="p-2 border-2 border-white w-1/5"></th>
                                <th className="p-2 border-2 border-white">Presidente Reunión fin de semana</th>
                                <th className="p-2 border-2 border-white">Acomodadores, micrófonos y vigilantes (ambos días)</th>
                                <th className="p-2 border-2 border-white">Lector de La Atalaya</th>
                                <th className="p-2 border-2 border-white">Aseo Y Hospitalidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.map((week) => (
                                <tr key={week.weekDateRange} className="align-top">
                                    <td className="p-3 border-2 border-gray-300 font-bold text-white bg-blue-700 whitespace-pre-line text-center">{week.weekDateRange}</td>
                                    <td className="p-3 border-2 border-gray-300 text-center">
                                        {isEditing ? (
                                            <select value={week.presidente.id || ''} onChange={e => handleEditChange(week.saturdayDateKey, 'presidente', e.target.value)} className="w-full p-1 border rounded text-xs">
                                                <option value="">N/A</option>
                                                {getEligiblePublishers('Presidente').map(p => <option key={p.id} value={p.id}>{getPublisherName(p.id)}</option>)}
                                            </select>
                                        ) : week.presidente.name}
                                    </td>
                                    <td className="p-3 border-2 border-gray-300">
                                        {week.acomodadoresYMicrofonos.map(item => (
                                            <div key={`${item.originalRoleKey}-${item.originalIndex}`}>
                                                {isEditing ? (
                                                    <select value={item.id || ''} onChange={e => handleEditChange(week.saturdayDateKey, item.originalRoleKey as AssignmentKey, e.target.value, item.originalIndex)} className="w-full p-1 border rounded text-xs mb-1">
                                                        <option value="">N/A</option>
                                                        {getEligiblePublishers(ROLE_KEY_TO_NAME[item.originalRoleKey]).map(p => <option key={p.id} value={p.id}>{getPublisherName(p.id)}</option>)}
                                                    </select>
                                                ) : <p>{item.name} ({item.role})</p>}
                                            </div>
                                        ))}
                                    </td>
                                    <td className="p-3 border-2 border-gray-300 text-center">
                                         {isEditing ? (
                                            <select value={week.lectorAtalaya.id || ''} onChange={e => handleEditChange(week.saturdayDateKey, 'lectorAtalaya', e.target.value)} className="w-full p-1 border rounded text-xs">
                                                <option value="">N/A</option>
                                                {getEligiblePublishers('Lector de la Atalaya').map(p => <option key={p.id} value={p.id}>{getPublisherName(p.id)}</option>)}
                                            </select>
                                        ) : week.lectorAtalaya.name}
                                    </td>
                                    <td className="p-3 border-2 border-gray-300 text-center">
                                        {isEditing ? (
                                            <>
                                                <select value={week.aseo.id || ''} onChange={e => handleEditChange(week.saturdayDateKey, 'aseo', e.target.value)} className="w-full p-1 border rounded text-xs mb-1">
                                                    <option value="">N/A</option>{groups.map(g => <option key={g} value={g}>Grupo {g}</option>)}
                                                </select>
                                                <select value={week.hospitalidad.id || ''} onChange={e => handleEditChange(week.saturdayDateKey, 'hospitalidad', e.target.value)} className="w-full p-1 border rounded text-xs">
                                                    <option value="">N/A</option>{groups.map(g => <option key={g} value={g}>Grupo {g}</option>)}
                                                </select>
                                            </>
                                        ) : (
                                            <div className="whitespace-pre-line">
                                                {week.aseo.name ? <div>Aseo: {week.aseo.name}</div> : null}
                                                {week.hospitalidad.name ? <div>Hospitalidad: {week.hospitalidad.name}</div> : null}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };
    
    const ConfigView = () => {
        const [assignments, setAssignments] = useState(() => 
            Object.fromEntries(activePublishers.map(p => [p.id, p.asignacionesDisponibles || []]))
        );

        const handleToggle = (pubId: string, role: string) => {
            setAssignments(prev => {
                const current = prev[pubId] || [];
                const newAssignments = current.includes(role) 
                    ? current.filter(r => r !== role) 
                    : [...current, role];
                return { ...prev, [pubId]: newAssignments };
            });
        };

        const handleSave = async () => {
            setIsLoading(true);
            try {
                const promises = Object.entries(assignments).map(([pubId, roles]) => 
                    onUpdatePublisherAssignments(pubId, roles as string[])
                );
                await Promise.all(promises);
                onShowModal({type: 'success', title: 'Guardado', message: 'Configuración de participantes guardada.'});
            } finally {
                setIsLoading(false);
            }
        };

        return (
            <div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                         <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Publicador</th>
                                {ALL_ASSIGNMENT_ROLES.map(role => (
                                    <th key={role} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{role}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {malePublishers.map(pub => (
                                <tr key={pub.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{[pub.Nombre, pub.Apellido].filter(Boolean).join(' ')}</td>
                                    {ALL_ASSIGNMENT_ROLES.map(role => (
                                        <td key={role} className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={assignments[pub.id]?.includes(role) || false}
                                                onChange={() => handleToggle(pub.id, role)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="text-right mt-6">
                    <button onClick={handleSave} disabled={isLoading} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                        {isLoading ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-7xl">
            {shareModalContent && <ShareModal title={shareModalContent.title} textContent={shareModalContent.text} onClose={() => setShareModalContent(null)} />}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Generar Programa de Acomodadores</h1>
                    <div className="flex flex-wrap justify-center gap-2">
                        {newlyGeneratedSchedule ? (
                            <>
                                <button onClick={handleSaveGeneratedSchedule} disabled={isLoading} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                                    {isLoading ? 'Guardando...' : 'Guardar Programa'}
                                </button>
                                <button onClick={handleDiscardGeneratedSchedule} disabled={isLoading} className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 disabled:bg-gray-400">
                                    Descartar
                                </button>
                            </>
                        ) : isEditing ? (
                             <>
                                <button onClick={handleSaveChanges} disabled={isLoading} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                                    {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                                <button onClick={() => { setIsEditing(false); setEditableSchedule(null); }} className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600">
                                    Cancelar
                                </button>
                             </>
                         ) : (
                            <>
                                <button onClick={handleGenerateSchedule} disabled={isLoading || !canConfig} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                                    {isLoading ? 'Generando...' : 'Generar Programa'}
                                </button>
                                <button onClick={() => { setIsEditing(true); setEditableSchedule(JSON.parse(JSON.stringify(scheduleForSelectedMonth))); }} disabled={!scheduleForSelectedMonth || isLoading || !canConfig} className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 disabled:bg-gray-400">
                                    Editar Programa
                                </button>
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
                
                {canConfig && !newlyGeneratedSchedule && (
                     <div className="flex justify-center items-center gap-4 mb-6 p-3 bg-gray-100 rounded-lg">
                        <span className="font-semibold">Estado del Programa:</span>
                        <span className={`px-3 py-1 text-sm font-bold rounded-full ${isPublic ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {isPublic ? 'Visible' : 'Oculto'}
                        </span>
                        <button onClick={handleToggleVisibility} disabled={isLoading || !scheduleForSelectedMonth} className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                            {isPublic ? 'Ocultar Programa' : 'Hacer Público'}
                        </button>
                    </div>
                )}
                
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8">
                        <button onClick={() => setActiveTab('schedule')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab==='schedule' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300'}`}>Programa Mensual</button>
                        {canConfig && <button onClick={() => setActiveTab('config')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab==='config' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300'}`}>Configuración de Participantes</button>}
                    </nav>
                </div>

                <div className="mt-6">
                    {activeTab === 'schedule' ? <ScheduleView /> : <ConfigView />}
                </div>
            </div>
        </div>
    );
};

export default AsignacionesReunion;
