import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Publisher, MeetingAssignmentSchedule, ModalInfo, DayAssignment, MeetingConfig } from '../App';
import ShareModal from './ShareModal';

interface AsignacionesReunionProps {
    publishers: Publisher[];
    schedules: MeetingAssignmentSchedule[];
    onSaveSchedule: (schedule: Omit<MeetingAssignmentSchedule, 'id'>) => Promise<void>;
    onShowModal: (info: ModalInfo) => void;
    canManageSchedule: boolean;
    meetingConfig: MeetingConfig;
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

type AssignmentKey = keyof DayAssignment;

// Helper to format HH:mm to h:mm a.m./p.m.
const formatTime = (time: string): string => {
    if (!time) return '';
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

// Main Component
const AsignacionesReunion: React.FC<AsignacionesReunionProps> = ({
    publishers,
    schedules,
    onSaveSchedule,
    onShowModal,
    canManageSchedule,
    meetingConfig
}) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
    const [isLoading, setIsLoading] = useState(false);
    const [shareModalContent, setShareModalContent] = useState<{ title: string; text: string; } | null>(null);

    // --- ROBUST STATE MANAGEMENT (mirrors VidaYMinisterio) ---
    const [draftSchedule, setDraftSchedule] = useState<MeetingAssignmentSchedule | null>(null);
    const [editableSchedule, setEditableSchedule] = useState<MeetingAssignmentSchedule | null>(null);

    const scheduleForSelectedMonth = useMemo(() => {
        return schedules.find(s => s.year === selectedYear && s.month === selectedMonth);
    }, [schedules, selectedYear, selectedMonth]);

    // Reset local states when changing month/year
    useEffect(() => {
        setDraftSchedule(null);
        setEditableSchedule(null);
    }, [selectedYear, selectedMonth]);

    // The single source of truth for what's displayed.
    const currentSchedule = useMemo(() => {
        return draftSchedule || editableSchedule || scheduleForSelectedMonth;
    }, [draftSchedule, editableSchedule, scheduleForSelectedMonth]);


    const activePublishers = useMemo(() => publishers.filter(p => p.Estatus === 'Activo'), [publishers]);
    const malePublishers = useMemo(() => activePublishers.filter(p => p.Sexo === 'Hombre'), [activePublishers]);

    const getPublisherName = useCallback((id: string | null) => {
        if (!id) return '';
        const pub = activePublishers.find(p => p.id === id);
        return pub ? [pub.Nombre, pub.Apellido].filter(Boolean).join(' ') : 'N/A';
    }, [activePublishers]);

    const getEligiblePublishers = useCallback((role: string) => {
        let eligible = malePublishers.filter(p => p.asignacionesDisponibles?.includes(role));

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
                    message: 'No se pudo generar el programa. Faltan participantes clave:\n\n' + errors.join('\n') + '\n\n**Solución:**\n1. Vaya a la pestaña "Publicadores".\n2. Edite los perfiles de los hermanos para asignarles su privilegio (Anciano, Siervo Ministerial).\n3. En la sección "Privilegios de Asignación", marque las casillas de las tareas que pueden atender.'
                });
                setIsLoading(false);
                return;
            }
            
            const getDatesForMonthProgram = (month: number, year: number, dayOfWeek: number) => {
                const dates: Date[] = [];
                let date = new Date(Date.UTC(year, month, 1));
            
                while (date.getUTCDay() !== dayOfWeek) {
                    date.setUTCDate(date.getUTCDate() + 1);
                }
            
                while (date.getUTCMonth() === month) {
                    dates.push(new Date(date));
                    date.setUTCDate(date.getUTCDate() + 7);
                }

                const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
                if (firstDayOfMonth.getUTCDay() !== dayOfWeek) {
                     let tempDate = new Date(firstDayOfMonth);
                     tempDate.setUTCDate(tempDate.getUTCDate() - (tempDate.getUTCDay() - dayOfWeek + 7) % 7);
                     if (tempDate.getUTCMonth() !== month) {
                         let thursdayOfWeek = new Date(tempDate);
                         thursdayOfWeek.setUTCDate(thursdayOfWeek.getUTCDate() + (4 - thursdayOfWeek.getUTCDay() + 7) % 7);
                         if(thursdayOfWeek.getUTCMonth() === month) {
                            dates.unshift(tempDate);
                         }
                     }
                }
                
                return dates.sort((a,b) => a.getTime() - b.getTime());
            };

            const specialEventDates = new Set(meetingConfig.specialEvents.map(e => e.date));
            const monthIndex = MONTHS.indexOf(selectedMonth);
            
            const midweekMeetings = getDatesForMonthProgram(monthIndex, selectedYear, meetingConfig.midweekDay);
            const weekendMeetings = getDatesForMonthProgram(monthIndex, selectedYear, meetingConfig.weekendDay);

            const allMeetingDates = [...midweekMeetings, ...weekendMeetings]
                .filter(date => !specialEventDates.has(date.toISOString().slice(0, 10)))
                .sort((a,b) => a.getTime() - b.getTime());

            const assignmentCounters: { [role: string]: number } = {};
            ALL_ASSIGNMENT_ROLES.forEach(role => { assignmentCounters[role] = 0; });
            const groupCounters = { midweekAseo: 0, weekendAseo: 0, weekendHospitality: 0 };
            
            const newScheduleData: MeetingAssignmentSchedule['schedule'] = {};
            const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

            for (const meetingDate of allMeetingDates) {
                const isMidweek = meetingDate.getUTCDay() === meetingConfig.midweekDay;
                const dateKeyPrefix = isMidweek ? 'midweek' : 'weekend';
                const dateKey = `${dateKeyPrefix}-${meetingDate.toISOString().slice(0, 10)}`;

                const assignmentsForDay: DayAssignment = {};
                const assignedThisDay = new Set<string>();

                const getNextAvailable = (role: string, count: number): (string | null)[] => {
                    // FIX: This was an incorrect array destructuring. eligible[role] is already the array of candidates.
                    const candidates = eligible[role];
                    if (!candidates || candidates.length === 0) return Array(count).fill(null);
                
                    const result: string[] = [];
                    let attempts = 0;
                    let currentOffset = assignmentCounters[role];
                
                    while (result.length < count && attempts < candidates.length * 2) {
                        const person = candidates[currentOffset % candidates.length];
                        if (!assignedThisDay.has(person.id)) {
                             result.push(person.id);
                             assignedThisDay.add(person.id);
                        }
                        currentOffset++;
                        attempts++;
                    }
                
                    assignmentCounters[role] = currentOffset;
                    
                     while (result.length < count) {
                        result.push(null);
                    }
                
                    return result;
                };

                const getNextGroup = (queueName: 'midweekAseo' | 'weekendAseo' | 'weekendHospitality'): string | null => {
                    if (groups.length === 0) return null;
                    const currentIndex = groupCounters[queueName];
                    groupCounters[queueName] = (currentIndex + 1) % groups.length;
                    return groups[currentIndex];
                };

                if (isMidweek) {
                    assignmentsForDay.fechaReunion = `${dayNames[meetingConfig.midweekDay]} ${meetingDate.getUTCDate()}`;
                    assignmentsForDay.reunionHorario = formatTime(meetingConfig.midweekTime);
                    assignmentsForDay.vigilanciaHorario = '8:20-8:50 p. m.';
                    assignmentsForDay.vigilantes = getNextAvailable('Vigilante', 3);
                    assignmentsForDay.acomodadoresSala = getNextAvailable('Acomodador de los Asistentes', 2);
                    assignmentsForDay.microfonos = getNextAvailable('Micrófono', 2);
                    assignmentsForDay.acomodadoresPrincipal = getNextAvailable('Acomodador en la puerta Principal', 1);
                    assignmentsForDay.acomodadoresAuditorio = getNextAvailable('Acomodador de la puerta del Auditorio', 1);
                    assignmentsForDay.aseo = getNextGroup('midweekAseo');
                } else { 
                    assignmentsForDay.fechaReunion = `${dayNames[meetingConfig.weekendDay]} ${meetingDate.getUTCDate()}`;
                    assignmentsForDay.reunionHorario = formatTime(meetingConfig.weekendTime);
                    assignmentsForDay.vigilanciaHorario = '4:15-4:50 p. m.';
                    [assignmentsForDay.conductorAtalaya] = getNextAvailable('Conductor de la Atalaya', 1);
                    [assignmentsForDay.presidente] = getNextAvailable('Presidente', 1);
                    [assignmentsForDay.lectorAtalaya] = getNextAvailable('Lector de la Atalaya', 1);
                    assignmentsForDay.vigilantes = getNextAvailable('Vigilante', 3);
                    assignmentsForDay.acomodadoresSala = getNextAvailable('Acomodador de los Asistentes', 2);
                    assignmentsForDay.microfonos = getNextAvailable('Micrófono', 2);
                    assignmentsForDay.acomodadoresPrincipal = getNextAvailable('Acomodador en la puerta Principal', 1);
                    assignmentsForDay.acomodadoresAuditorio = getNextAvailable('Acomodador de la puerta del Auditorio', 1);
                    assignmentsForDay.aseo = getNextGroup('weekendAseo');
                    assignmentsForDay.hospitalidad = getNextGroup('weekendHospitality');
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
            
            setDraftSchedule(generatedScheduleObject);
            onShowModal({ type: 'success', title: 'Borrador Generado', message: 'El borrador del programa se ha generado. Revíselo y guárdelo. Luego podrá publicarlo.' });

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

    const handleSaveDraft = async () => {
        if (!draftSchedule) return;
        setIsLoading(true);
        try {
            const { id, ...dataToSave } = draftSchedule;
            await onSaveSchedule(dataToSave);
            setDraftSchedule(null); // Clear the draft state
            onShowModal({ type: 'success', title: 'Guardado', message: 'El programa se ha guardado correctamente. Ahora puede publicarlo.' });
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
        }
    };

    const handleSaveChanges = async () => {
        if (!editableSchedule) return;
        setIsLoading(true);
        try {
            const { id, ...dataToSave } = editableSchedule;
            await onSaveSchedule(dataToSave);
            setEditableSchedule(null);
            onShowModal({ type: 'success', title: 'Guardado', message: 'El programa se ha guardado correctamente.' });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: `No se pudo guardar el programa: ${(error as Error).message}` });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCancelEdit = () => {
        setEditableSchedule(null);
    };

    const handleToggleVisibility = async () => {
        if (draftSchedule || editableSchedule || !scheduleForSelectedMonth) {
            onShowModal({ type: 'error', title: 'Error', message: 'Primero debe guardar los cambios antes de cambiar la visibilidad.' });
            return;
        }
        setIsLoading(true);
        try {
            const newVisibility = !scheduleForSelectedMonth.isPublic;
            const { id, ...dataToSave } = { ...scheduleForSelectedMonth, isPublic: newVisibility };
            
            await onSaveSchedule(dataToSave as Omit<MeetingAssignmentSchedule, 'id'>);
            
            onShowModal({ type: 'success', title: 'Visibilidad Actualizada', message: `El programa ahora está ${newVisibility ? 'público' : 'oculto'}.` });
        } catch (error) {
            onShowModal({ type: 'error', title: 'Error', message: 'No se pudo actualizar la visibilidad.' });
        } finally {
            setIsLoading(false);
        }
    };
    
    const checkForConflicts = useCallback((schedule: MeetingAssignmentSchedule, dateKey: string, publisherId: string) => {
        if (!publisherId) return;

        const conflictMessages: string[] = [];
        const pubName = getPublisherName(publisherId);
        if (!pubName || pubName === 'N/A') return;

        const dayAssignments = schedule.schedule[dateKey];
        if (!dayAssignments) return;

        let assignmentsThisDay = 0;
        for (const assigned of Object.values(dayAssignments)) {
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
                
                for (const assigned of Object.values(adjacentDayAssignments)) {
                    const publisherIds = Array.isArray(assigned) ? assigned : (assigned ? [assigned] : []);
                    if(publisherIds.includes(publisherId)) {
                        conflictMessages.push(`Tiene una asignación en la reunión ${meetingLabel} (${adjacentDayAssignments.fechaReunion}).`);
                        return;
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
    
        setEditableSchedule(prev => {
            if (!prev) return null;
            const newSchedule = JSON.parse(JSON.stringify(prev));
            const dayAssignments = newSchedule.schedule[dateKey] || {};
    
            if (Array.isArray(dayAssignments[role])) {
                (dayAssignments[role] as (string | null)[])[index] = value || null;
            } else {
                (dayAssignments as any)[role] = value || null;
            }
            newSchedule.schedule[dateKey] = dayAssignments;
            
            setTimeout(() => checkForConflicts(newSchedule, dateKey, value), 0);
            return newSchedule;
        });
    };
    
    const generateShareText = useCallback((assignment: DayAssignment) => {
        if (!assignment) return ''; // Robustness check
        const parts: string[] = [];
        const isMidweek = !assignment.conductorAtalaya;

        parts.push(`*Programa de Acomodadores y Vigilancia*`);
        parts.push(`*${assignment.fechaReunion || ''} de ${selectedMonth}*`);
        parts.push(`*Horario:* ${assignment.reunionHorario || ''}`);

        const addAssignment = (label: string, id: string | (string|null)[] | undefined | null) => {
            if (!id) return;
            const names = Array.isArray(id) ? id.map(getPublisherName).filter(Boolean).join(', ') : getPublisherName(id);
            if (names) parts.push(`*${label}:* ${names}`);
        };

        if (isMidweek) {
            parts.push('\n*ASIGNACIONES ENTRE SEMANA:*');
        } else {
            parts.push('\n*ASIGNACIONES FIN DE SEMANA:*');
            addAssignment('Presidente', assignment.presidente);
            addAssignment('Conductor de La Atalaya', assignment.conductorAtalaya);
            addAssignment('Lector de La Atalaya', assignment.lectorAtalaya);
        }
        
        addAssignment('Acomodador (P. Principal)', assignment.acomodadoresPrincipal);
        addAssignment('Acomodador (P. Auditorio)', assignment.acomodadoresAuditorio);
        addAssignment('Acomodadores (Asistentes)', assignment.acomodadoresSala);
        addAssignment('Micrófonos', assignment.microfonos);
        addAssignment('Vigilantes', assignment.vigilantes);
        
        if (assignment.aseo) parts.push(`*Aseo:* Grupo ${assignment.aseo}`);
        if (!isMidweek && assignment.hospitalidad) {
            parts.push(`*Hospitalidad:* Grupo ${assignment.hospitalidad}`);
        }

        return parts.join('\n');
    }, [selectedMonth, getPublisherName]);

    const handleShareClick = (assignment: DayAssignment) => {
        const text = generateShareText(assignment);
        setShareModalContent({
            title: `Compartir Asignaciones - ${assignment.fechaReunion}`,
            text: text
        });
    };
    
    const ScheduleView = ({ schedule, isEditing }: { schedule: MeetingAssignmentSchedule | null, isEditing: boolean }) => {
        const tableData = useMemo(() => {
            if (!schedule?.schedule || !meetingConfig) return [];
            
            const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
            const weekendDayName = dayNames[meetingConfig.weekendDay];
            const midweekDayName = dayNames[meetingConfig.midweekDay];

            const weekendMeetings = Object.entries(schedule.schedule)
                .filter(([key]) => key.startsWith('weekend'))
                .sort(([keyA], [keyB]) => new Date(keyA.substring(8)).getTime() - new Date(keyB.substring(8)).getTime());
            
            const ROLE_COUNTS: Record<string, number> = {
                acomodadoresPrincipal: 1,
                acomodadoresAuditorio: 1,
                acomodadoresSala: 2,
                microfonos: 2,
                vigilantes: 3,
            };

            const getAssignmentsWithRole = (roleKey: keyof DayAssignment, roleAbbr: string, dateKeyForRole: string, assignment: DayAssignment | undefined) => {
                let ids = (assignment as any)?.[roleKey] as (string|null)[] | string | undefined;

                if (typeof ids === 'string') ids = [ids];
                else if (!Array.isArray(ids)) ids = [];
                
                const requiredCount = ROLE_COUNTS[roleKey as string] || 1;
                const paddedIds = [...ids];
                while (paddedIds.length < requiredCount) {
                    paddedIds.push(null);
                }
                
                return paddedIds.map((id, index) => ({ id, name: getPublisherName(id), role: roleAbbr, originalRoleKey: roleKey, originalIndex: index, dateKey: dateKeyForRole }));
            };

            return weekendMeetings.map(([dateKey, assignmentUntyped]) => {
                const assignment = assignmentUntyped as DayAssignment;
                const weekendMeetDate = new Date(dateKey.substring(dateKey.indexOf('-') + 1) + 'T12:00:00Z');
                
                const dayDiff = meetingConfig.weekendDay - meetingConfig.midweekDay;
                const midweekMeetDate = new Date(weekendMeetDate);
                midweekMeetDate.setUTCDate(weekendMeetDate.getUTCDate() - (dayDiff >= 0 ? dayDiff : dayDiff + 7));
                
                const midweekDateKey = `midweek-${midweekMeetDate.toISOString().slice(0, 10)}`;
                const midweekAssignment = schedule.schedule[midweekDateKey];
                
                const midweekAssignments = midweekAssignment ? [
                    ...getAssignmentsWithRole('acomodadoresPrincipal', 'AP', midweekDateKey, midweekAssignment),
                    ...getAssignmentsWithRole('acomodadoresAuditorio', 'APA', midweekDateKey, midweekAssignment),
                    ...getAssignmentsWithRole('acomodadoresSala', 'AA', midweekDateKey, midweekAssignment),
                    ...getAssignmentsWithRole('microfonos', 'AM', midweekDateKey, midweekAssignment),
                    ...getAssignmentsWithRole('vigilantes', 'V', midweekDateKey, midweekAssignment),
                ] : [];

                 const weekendAssignments = [
                    ...getAssignmentsWithRole('acomodadoresPrincipal', 'AP', dateKey, assignment),
                    ...getAssignmentsWithRole('acomodadoresAuditorio', 'APA', dateKey, assignment),
                    ...getAssignmentsWithRole('acomodadoresSala', 'AA', dateKey, assignment),
                    ...getAssignmentsWithRole('microfonos', 'AM', dateKey, assignment),
                    ...getAssignmentsWithRole('vigilantes', 'V', dateKey, assignment),
                ];

                return {
                    weekDateRange: `${midweekDayName} ${midweekMeetDate.getUTCDate()}\n${weekendDayName} ${weekendMeetDate.getUTCDate()}`,
                    presidente: { id: assignment.presidente, name: getPublisherName(assignment.presidente) },
                    lectorAtalaya: { id: assignment.lectorAtalaya, name: getPublisherName(assignment.lectorAtalaya) },
                    midweekAssignments,
                    weekendAssignments,
                    aseo: { id: assignment.aseo, name: assignment.aseo ? `Grupo ${assignment.aseo}` : '' },
                    hospitalidad: { id: assignment.hospitalidad, name: assignment.hospitalidad ? `Grupo ${assignment.hospitalidad}` : '' },
                    midweekDateKey: midweekDateKey,
                    weekendDateKey: dateKey,
                    midweekAssignment: schedule.schedule[midweekDateKey],
                    weekendAssignment: assignment
                };
            });
        }, [schedule, getPublisherName, meetingConfig]);

        if (!schedule) {
            return <p className="text-center text-gray-500 py-8">No hay programa generado para este mes. Haga clic en "Generar Programa".</p>;
        }

        const groups = [...new Set(activePublishers.map(p => p.Grupo).filter(Boolean) as string[])].sort();

        const WhatsAppIcon = () => (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 hover:text-green-700" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.487 5.235 3.487 8.413.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 4.315 1.731 6.086l.287.468-1.125 4.089 4.16-1.087.436.26z"/>
            </svg>
        );

        return (
            <div className="space-y-6">
                <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800 flex flex-wrap justify-center gap-x-4 gap-y-1">
                    <span className="font-semibold">Leyenda:</span>
                    <span><strong>(AP)</strong>: P. Principal</span>
                    <span><strong>(APA)</strong>: P. Auditorio</span>
                    <span><strong>(AA)</strong>: Asistentes</span>
                    <span><strong>(AM)</strong>: Micrófonos</span>
                    <span><strong>(V)</strong>: Vigilancia</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[1200px] text-sm">
                        <thead className="bg-blue-900 text-white">
                            <tr>
                                <th className="p-2 border-2 border-white w-32">Semana</th>
                                <th className="p-2 border-2 border-white">Presidente (FS)</th>
                                <th className="p-2 border-2 border-white">Acomodadores, Micrófonos, Vigilancia (ES)</th>
                                <th className="p-2 border-2 border-white">Acomodadores, Micrófonos, Vigilancia (FS)</th>
                                <th className="p-2 border-2 border-white">Lector (FS)</th>
                                <th className="p-2 border-2 border-white">Aseo y Hospitalidad (FS)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((week) => (
                                <tr key={week.weekDateRange} className="align-top">
                                    <td className="p-3 border-2 border-gray-300 font-bold text-white bg-blue-700 whitespace-pre-line text-center">
                                         <div className="flex justify-center items-center gap-2">
                                            {week.midweekAssignment && (
                                                <button onClick={() => handleShareClick(week.midweekAssignment)} title={`Compartir asignaciones para ${week.midweekAssignment.fechaReunion}`} className="p-1 bg-white/20 rounded-full"><WhatsAppIcon/></button>
                                            )}
                                            <span className="flex-grow">{week.weekDateRange}</span>
                                            {week.weekendAssignment && (
                                                <button onClick={() => handleShareClick(week.weekendAssignment)} title={`Compartir asignaciones para ${week.weekendAssignment.fechaReunion}`} className="p-1 bg-white/20 rounded-full"><WhatsAppIcon/></button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-2 border-2 border-gray-300 text-center">
                                        {isEditing ? (
                                            <select value={week.presidente.id || ''} onChange={e => handleEditChange(week.weekendDateKey, 'presidente', e.target.value)} className="w-full p-1 border rounded text-xs bg-yellow-50">
                                                <option value="">--</option>
                                                {getEligiblePublishers('Presidente').map(p => <option key={p.id} value={p.id}>{getPublisherName(p.id)}</option>)}
                                            </select>
                                        ) : week.presidente.name}
                                    </td>
                                    <td className="p-2 border-2 border-gray-300">
                                        {week.midweekAssignments.map(item => (
                                            <div key={`${item.originalRoleKey}-${item.originalIndex}-${item.dateKey}`} className="flex items-center gap-1 mb-1">
                                                <span className="font-semibold w-8">({item.role})</span>
                                                {isEditing ? (
                                                     <select value={item.id || ''} onChange={e => handleEditChange(item.dateKey, item.originalRoleKey as AssignmentKey, e.target.value, item.originalIndex)} className="w-full p-1 border rounded text-xs bg-yellow-50">
                                                        <option value="">--</option>
                                                        {getEligiblePublishers(ROLE_KEY_TO_NAME[item.originalRoleKey]).map(p => <option key={p.id} value={p.id}>{getPublisherName(p.id)}</option>)}
                                                    </select>
                                                ) : <p>{item.name}</p>}
                                            </div>
                                        ))}
                                    </td>
                                     <td className="p-2 border-2 border-gray-300">
                                        {week.weekendAssignments.map(item => (
                                            <div key={`${item.originalRoleKey}-${item.originalIndex}-${item.dateKey}`} className="flex items-center gap-1 mb-1">
                                                <span className="font-semibold w-8">({item.role})</span>
                                                {isEditing ? (
                                                     <select value={item.id || ''} onChange={e => handleEditChange(item.dateKey, item.originalRoleKey as AssignmentKey, e.target.value, item.originalIndex)} className="w-full p-1 border rounded text-xs bg-yellow-50">
                                                        <option value="">--</option>
                                                        {getEligiblePublishers(ROLE_KEY_TO_NAME[item.originalRoleKey]).map(p => <option key={p.id} value={p.id}>{getPublisherName(p.id)}</option>)}
                                                    </select>
                                                ) : <p>{item.name}</p>}
                                            </div>
                                        ))}
                                    </td>
                                    <td className="p-2 border-2 border-gray-300 text-center">
                                         {isEditing ? (
                                            <select value={week.lectorAtalaya.id || ''} onChange={e => handleEditChange(week.weekendDateKey, 'lectorAtalaya', e.target.value)} className="w-full p-1 border rounded text-xs bg-yellow-50">
                                                <option value="">--</option>
                                                {getEligiblePublishers('Lector de la Atalaya').map(p => <option key={p.id} value={p.id}>{getPublisherName(p.id)}</option>)}
                                            </select>
                                        ) : week.lectorAtalaya.name}
                                    </td>
                                    <td className="p-2 border-2 border-gray-300 text-center">
                                        {isEditing ? (
                                            <>
                                                <select value={week.aseo.id || ''} onChange={e => handleEditChange(week.weekendDateKey, 'aseo', e.target.value)} className="w-full p-1 border rounded text-xs mb-1 bg-yellow-50" title="Aseo">
                                                    <option value="">Aseo: --</option>{groups.map(g => <option key={g} value={g}>Grupo {g}</option>)}
                                                </select>
                                                <select value={week.hospitalidad.id || ''} onChange={e => handleEditChange(week.weekendDateKey, 'hospitalidad', e.target.value)} className="w-full p-1 border rounded text-xs bg-yellow-50" title="Hospitalidad">
                                                    <option value="">Hosp: --</option>{groups.map(g => <option key={g} value={g}>Grupo {g}</option>)}
                                                </select>
                                            </>
                                        ) : (
                                            <div className="whitespace-pre-line">
                                                {week.aseo.name ? <div>{week.aseo.name}</div> : null}
                                                {week.hospitalidad.name ? <div>{week.hospitalidad.name}</div> : null}
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

    return (
        <div className="container mx-auto max-w-7xl">
            {shareModalContent && <ShareModal title={shareModalContent.title} textContent={shareModalContent.text} onClose={() => setShareModalContent(null)} />}
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Generar Programa de Acomodadores</h1>
                    <div className="flex flex-wrap justify-center gap-2">
                         {editableSchedule ? (
                            <>
                                <button onClick={handleSaveChanges} disabled={isLoading || !canManageSchedule} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                                    {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                                <button onClick={handleCancelEdit} disabled={isLoading || !canManageSchedule} className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 disabled:bg-gray-400">
                                    Cancelar
                                </button>
                            </>
                         ) : draftSchedule ? (
                            <>
                               <button onClick={handleSaveDraft} disabled={isLoading || !canManageSchedule} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                                    {isLoading ? 'Guardando...' : 'Guardar Borrador'}
                                </button>
                                <button onClick={handleDiscardDraft} disabled={isLoading || !canManageSchedule} className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 disabled:bg-gray-400">
                                    Descartar
                                </button>
                            </>
                         ) : (
                            <>
                                {canManageSchedule && (
                                    <button onClick={handleGenerateSchedule} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                                        {isLoading ? 'Generando...' : 'Generar Programa'}
                                    </button>
                                )}
                                {scheduleForSelectedMonth && canManageSchedule && (
                                    <button onClick={handleEditClick} disabled={isLoading} className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 disabled:bg-gray-400">
                                        Editar Programa
                                    </button>
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
                
                {canManageSchedule && !draftSchedule && !editableSchedule && scheduleForSelectedMonth && (
                     <div className="flex justify-center items-center gap-4 mb-6 p-3 bg-gray-100 rounded-lg">
                        <span className="font-semibold">Estado del Programa:</span>
                        <span className={`px-3 py-1 text-sm font-bold rounded-full ${scheduleForSelectedMonth.isPublic ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {scheduleForSelectedMonth.isPublic ? 'Visible' : 'Oculto'}
                        </span>
                        <button onClick={handleToggleVisibility} disabled={isLoading} className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                            {scheduleForSelectedMonth.isPublic ? 'Ocultar Programa' : 'Hacer Público'}
                        </button>
                    </div>
                )}
                
                <div className="mt-6">
                    <ScheduleView schedule={currentSchedule} isEditing={!!editableSchedule} />
                </div>
            </div>
        </div>
    );
};

export default AsignacionesReunion;
