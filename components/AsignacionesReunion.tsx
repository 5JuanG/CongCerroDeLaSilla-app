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

    const activePublishers = useMemo(() => publishers.filter(p => p.Estatus === 'Activo'), [publishers]);
    const malePublishers = useMemo(() => activePublishers.filter(p => p.Sexo === 'Hombre'), [activePublishers]);

    const scheduleForSelectedMonth = useMemo(() => {
        return schedules.find(s => s.year === selectedYear && s.month === selectedMonth);
    }, [schedules, selectedYear, selectedMonth]);

    useEffect(() => {
        setIsEditing(false);
        setEditableSchedule(null);
    }, [selectedMonth, selectedYear, activeTab]);
    
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

        const eligible: { [role: string]: Publisher[] } = {};
        ALL_ASSIGNMENT_ROLES.forEach(role => {
            eligible[role] = getEligiblePublishers(role);
        });

        const errors = [];
        if (eligible['Presidente'].length === 0) {
            errors.push("• No hay Ancianos o Siervos Ministeriales elegibles para 'Presidente'.");
        }
        if (eligible['Conductor de la Atalaya'].length === 0) {
            errors.push("• No hay Ancianos elegibles para 'Conductor de la Atalaya'.");
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
            setIsLoading(false);
            return;
        }

        onShowModal({ type: 'info', title: 'Generando Programa', message: 'Calculando asignaciones equitativas, por favor espere...' });

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

        // Queues for rotation
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
            let assignedThisDay = new Set<string>();

            const getNextAvailable = (role: string, count: number, excludeIds: Set<string> = new Set()) => {
                const queue = queues[role];
                if (!queue || queue.length === 0) return Array(count).fill(null);
                
                const result: (string|null)[] = [];
                let attempts = 0;
                while(result.length < count && attempts < queue.length * 2) {
                    let person = queue.shift();
                    queue.push(person);
                    if (person && !assignedThisDay.has(person.id) && !excludeIds.has(person.id)) {
                        result.push(person.id);
                        assignedThisDay.add(person.id);
                    }
                    attempts++;
                }
                // Fill with null if not enough people found
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
                
                const conductorId = getNextAvailable('Conductor de la Atalaya', 1)[0];
                assignmentsForDay.conductorAtalaya = conductorId || undefined;
                
                const exclusionSet = new Set<string>();
                if(conductorId) exclusionSet.add(conductorId);
                
                const presidenteId = getNextAvailable('Presidente', 1, exclusionSet)[0];
                assignmentsForDay.presidente = presidenteId || undefined;
                if(presidenteId) exclusionSet.add(presidenteId);
                
                const lectorId = getNextAvailable('Lector de la Atalaya', 1, exclusionSet)[0];
                assignmentsForDay.lectorAtalaya = lectorId || undefined;

                assignmentsForDay.acomodadoresPrincipal = getNextAvailable('Acomodador en la puerta Principal', 1, exclusionSet);
                assignmentsForDay.acomodadoresAuditorio = getNextAvailable('Acomodador de la puerta del Auditorio', 1, exclusionSet);
                assignmentsForDay.acomodadoresSala = getNextAvailable('Acomodador de los Asistentes', 2, exclusionSet);
                assignmentsForDay.microfonos = getNextAvailable('Micrófono', 2, exclusionSet);
                assignmentsForDay.vigilantes = getNextAvailable('Vigilante', 3, exclusionSet);
                assignmentsForDay.aseo = getNextGroup('saturdayAseo');
                assignmentsForDay.hospitalidad = getNextGroup('saturdayHospitality');
            }
            newScheduleData[dateKey] = assignmentsForDay;
        }

        try {
            await onSaveSchedule({ year: selectedYear, month: selectedMonth, schedule: newScheduleData });
        } finally {
            setIsLoading(false);
        }
    };
    
    const getPublisherName = useCallback((id: string | null) => {
        if (!id) return '';
        const pub = activePublishers.find(p => p.id === id);
        return pub ? [pub.Nombre, pub.Apellido, pub['2do Apellido'], pub['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ') : 'N/A';
    }, [activePublishers]);
    
    const checkForConflicts = useCallback((schedule: MeetingAssignmentSchedule, currentDateKey: string, publisherId: string) => {
        if (!publisherId) return;

        const conflictMessages: string[] = [];
        const pubName = getPublisherName(publisherId);
        if (!pubName || pubName === 'N/A') return;

        const sortedDateKeys = Object.keys(schedule.schedule).sort((a, b) => 
            new Date(a.substring(a.indexOf('-') + 1)).getTime() - new Date(b.substring(b.indexOf('-') + 1)).getTime()
        );
        const currentIndex = sortedDateKeys.indexOf(currentDateKey);

        const findConflictsInDay = (dateKey: string): { role: string; count: number }[] => {
            const dayAssignments = schedule.schedule[dateKey];
            const assignmentsFound: { role: string; count: number }[] = [];
            if (!dayAssignments) return [];

            for (const [roleKey, assigned] of Object.entries(dayAssignments)) {
                const roleName = ROLE_KEY_TO_NAME[roleKey];
                if (!roleName) continue;

                const publisherIds = Array.isArray(assigned) ? assigned : (assigned ? [assigned] : []);
                const count = publisherIds.filter(id => id === publisherId).length;
                if (count > 0) {
                    assignmentsFound.push({ role: roleName, count });
                }
            }
            return assignmentsFound;
        };

        // 1. Same Day Conflicts
        const sameDayAssignments = findConflictsInDay(currentDateKey);
        const totalSameDayCount = sameDayAssignments.reduce((sum, a) => sum + a.count, 0);
        if (totalSameDayCount > 1) {
            const conflictingRoles = sameDayAssignments.map(a => a.role).join(', ');
            conflictMessages.push(`En la misma reunión tiene otras asignaciones: ${conflictingRoles}.`);
        }

        // 2. Previous Meeting Conflicts
        if (currentIndex > 0) {
            const prevDateKey = sortedDateKeys[currentIndex - 1];
            const prevDayAssignments = findConflictsInDay(prevDateKey);
            if (prevDayAssignments.length > 0) {
                const conflictingRoles = prevDayAssignments.map(a => a.role).join(', ');
                const prevMeetingDate = schedule.schedule[prevDateKey].fechaReunion;
                conflictMessages.push(`En la reunión anterior (${prevMeetingDate}), tiene asignado: ${conflictingRoles}.`);
            }
        }

        // 3. Next Meeting Conflicts
        if (currentIndex < sortedDateKeys.length - 1) {
            const nextDateKey = sortedDateKeys[currentIndex + 1];
            const nextDayAssignments = findConflictsInDay(nextDateKey);
            if (nextDayAssignments.length > 0) {
                const conflictingRoles = nextDayAssignments.map(a => a.role).join(', ');
                const nextMeetingDate = schedule.schedule[nextDateKey].fechaReunion;
                conflictMessages.push(`En la reunión siguiente (${nextMeetingDate}), tiene asignado: ${conflictingRoles}.`);
            }
        }

        if (conflictMessages.length > 0) {
            onShowModal({
                type: 'info',
                title: 'Posible Conflicto de Asignación',
                message: `¡Atención! ${pubName} podría tener un conflicto:\n\n• ${conflictMessages.join('\n• ')}`
            });
        }
    }, [getPublisherName, onShowModal]);

    const handleEditChange = (dateKey: string, role: AssignmentKey, value: string | string[], index?: number) => {
        if (!editableSchedule) return;

        const newSchedule = JSON.parse(JSON.stringify(editableSchedule));
        const dayAssignments = newSchedule.schedule[dateKey] || {};

        let newPublisherId = '';
        if (Array.isArray(dayAssignments[role]) && typeof index === 'number') {
            (dayAssignments[role] as string[])[index] = value as string;
            newPublisherId = value as string;
        } else {
            (dayAssignments as any)[role] = value;
            newPublisherId = value as string;
        }
        newSchedule.schedule[dateKey] = dayAssignments;
        setEditableSchedule(newSchedule);
        
        // Check for conflicts after state update
        checkForConflicts(newSchedule, dateKey, newPublisherId);
    };
    
    const handleSaveChanges = async () => {
        if (!editableSchedule) return;
        setIsLoading(true);
        try {
            const { id, ...dataToSave } = editableSchedule;
            await onSaveSchedule(dataToSave);
            setIsEditing(false);
            setEditableSchedule(null);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleCopyToClipboard = (dateKey: string) => {
        const schedule = scheduleForSelectedMonth?.schedule[dateKey];
        if (!schedule) return;

        const getNames = (ids: string[] | string | null | undefined) => {
            if (!ids) return 'N/A';
            const idArray = Array.isArray(ids) ? ids : [ids];
            return idArray.map(id => {
                if (!id) return 'N/A';
                const pub = publishers.find(p => p.id === id);
                return pub ? [pub.Nombre, pub.Apellido, pub['2do Apellido'], pub['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ') : 'No encontrado';
            }).join(', ');
        };
        
        const [day, ...dateParts] = dateKey.split('-');
        const date = new Date(dateParts.join('-') + 'T00:00:00');
        const isTuesday = day === 'tuesday';
        const formattedDate = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

        let text = `*Asignaciones para el ${formattedDate}* 🗓️\n\n`;
        if (isTuesday) {
            text += `*Acomodador en la puerta Principal:* ${getNames(schedule.acomodadoresPrincipal)}\n` +
                    `*Acomodador de la puerta del Auditorio:* ${getNames(schedule.acomodadoresAuditorio)}\n` +
                    `*Acomodador de los Asistentes:* ${getNames(schedule.acomodadoresSala)}\n` +
                    `*Micrófonos:* ${getNames(schedule.microfonos)}\n` +
                    `*Vigilancia (${schedule.vigilanciaHorario || '8:20-8:50 p. m.'}):* ${getNames(schedule.vigilantes)}\n\n` +
                    `🧹 *Aseo:* Grupo ${schedule.aseo}`;
        } else {
             text += `*Presidente:* ${getNames(schedule.presidente)}\n` +
                    `*Conductor Atalaya:* ${getNames(schedule.conductorAtalaya)}\n` +
                    `*Lector Atalaya:* ${getNames(schedule.lectorAtalaya)}\n` +
                    `*Acomodador en la puerta Principal:* ${getNames(schedule.acomodadoresPrincipal)}\n` +
                    `*Acomodador de la puerta del Auditorio:* ${getNames(schedule.acomodadoresAuditorio)}\n` +
                    `*Acomodador de los Asistentes:* ${getNames(schedule.acomodadoresSala)}\n` +
                    `*Micrófonos:* ${getNames(schedule.microfonos)}\n` +
                    `*Vigilancia (${schedule.vigilanciaHorario || '4:15-4:50 p. m.'}):* ${getNames(schedule.vigilantes)}\n\n` +
                    `🧹 *Aseo:* Grupo ${schedule.aseo}\n` +
                    `🤝 *Hospitalidad:* Grupo ${schedule.hospitalidad}`;
        }
            
        setShareModalContent({
            title: `Asignaciones para el ${formattedDate}`,
            text
        });
    };
    
    const ScheduleView = () => {
        const currentSchedule = isEditing && editableSchedule ? editableSchedule : scheduleForSelectedMonth;
        
        const weeks = useMemo(() => {
            if (!currentSchedule) return [];
            const weekMap: { [weekStart: string]: { tuesday?: string, saturday?: string } } = {};
            
            Object.keys(currentSchedule.schedule).forEach(dateKey => {
                const date = new Date(dateKey.substring(dateKey.indexOf('-') + 1) + 'T00:00:00');
                const day = date.getDay(); // 0-6
                const weekStartDate = new Date(date);
                weekStartDate.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
                const weekStartKey = weekStartDate.toISOString().slice(0, 10);

                if (!weekMap[weekStartKey]) weekMap[weekStartKey] = {};

                if(date.getDay() === 2) weekMap[weekStartKey].tuesday = dateKey;
                if(date.getDay() === 6) weekMap[weekStartKey].saturday = dateKey;
            });
            return Object.entries(weekMap).sort((a,b) => a[0].localeCompare(b[0]));
        }, [currentSchedule]);

        if (!currentSchedule) {
            return <p className="text-center text-gray-500 py-8">No hay programa generado para este mes. Haga clic en "Generar Programa".</p>;
        }

        const groups = [...new Set(activePublishers.map(p => p.Grupo).filter(Boolean) as string[])].sort();
        
        const renderCellContent = (dateKey: string | undefined, role: AssignmentKey, size: number = 1) => {
            if (!dateKey) return Array(size).fill(<div className="p-2 min-h-[3rem] bg-gray-100/50"></div>);
            
            const daySchedule = currentSchedule.schedule[dateKey] || {};
            const assignment = daySchedule[role];

            if (role === 'aseo' || role === 'hospitalidad') {
                if (isEditing) {
                    return [<select
                                value={assignment as string || ''}
                                onChange={(e) => handleEditChange(dateKey, role, e.target.value)}
                                className="w-full p-1 border rounded text-xs"
                            >
                                <option value="">N/A</option>
                                {groups.map(g => <option key={g} value={g}>Grupo {g}</option>)}
                            </select>];
                }
                return [<div className="font-semibold">{assignment ? `Grupo ${assignment}` : 'N/A'}</div>];
            }

            const ids = Array.isArray(assignment) ? assignment : [assignment];
            while (ids.length < size) ids.push(null);
            
            const eligible = getEligiblePublishers(ROLE_KEY_TO_NAME[role]);

            return ids.map((id, index) => {
                if(isEditing) {
                    return <select 
                                key={index} 
                                value={id || ''} 
                                onChange={(e) => handleEditChange(dateKey, role, e.target.value, index)}
                                className="w-full p-1 border rounded text-xs"
                            >
                                <option value="">N/A</option>
                                {eligible.map(p => <option key={p.id} value={p.id}>{[p.Nombre, p.Apellido, p['2do Apellido'], p['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ')}</option>)}
                            </select>
                }
                return <div key={index}>{getPublisherName(id)}</div>;
            });
        };

        const assignmentsLayout = [
            { label: 'Presidente', key: 'presidente', tueSize: 0, satSize: 1 },
            { label: 'Cond. Atalaya', key: 'conductorAtalaya', tueSize: 0, satSize: 1 },
            { label: 'Lector Atalaya', key: 'lectorAtalaya', tueSize: 0, satSize: 1 },
            { label: 'Acom. Puerta Principal', key: 'acomodadoresPrincipal', tueSize: 1, satSize: 1 },
            { label: 'Acom. Puerta Auditorio', key: 'acomodadoresAuditorio', tueSize: 1, satSize: 1 },
            { label: 'Acom. Asistentes', key: 'acomodadoresSala', tueSize: 2, satSize: 2 },
            { label: 'Micrófonos', key: 'microfonos', tueSize: 2, satSize: 2 },
            { label: 'Vigilancia', key: 'vigilantes', tueSize: 3, satSize: 3 },
            { label: 'Aseo', key: 'aseo', tueSize: 1, satSize: 1 },
            { label: 'Hospitalidad', key: 'hospitalidad', tueSize: 0, satSize: 1 },
        ];

        const renderVigilanciaCell = (dateKey: string | undefined, size: number) => {
            if (!dateKey || size === 0) return null;
            const daySchedule = currentSchedule.schedule[dateKey];
            if (!daySchedule) return null;
        
            return (
                <>
                    {isEditing ? (
                        <input
                            type="text"
                            value={daySchedule.vigilanciaHorario || ''}
                            onChange={(e) => handleEditChange(dateKey, 'vigilanciaHorario', e.target.value)}
                            className="w-full bg-yellow-200 text-black text-center font-bold p-1 rounded-sm text-xs mb-1"
                        />
                    ) : (
                         daySchedule.vigilanciaHorario && (
                            <div className="bg-yellow-300 text-black text-center font-bold p-1 rounded-sm text-xs mb-1">
                                {daySchedule.vigilanciaHorario}
                            </div>
                         )
                    )}
                    {renderCellContent(dateKey, 'vigilantes', size).map((c, i) => <div key={i}>{c}</div>)}
                </>
            );
        };
        
        return (
             <div className="space-y-6">
                 <div className="p-4 bg-white">
                    <h1 className="text-3xl font-bold text-center text-blue-800 mb-2">PROGRAMA DE PRIVILEGIOS</h1>
                    <h2 className="text-xl font-semibold text-center text-blue-700 mb-6">CONG. CERRO DE LA SILLA-GPE - {selectedMonth} {selectedYear}</h2>

                    <div className="space-y-4 text-xs overflow-x-auto">
                        {weeks.map(([weekStart, weekMeetings]) => {
                            const tueDateKey = weekMeetings.tuesday;
                            const satDateKey = weekMeetings.saturday;
                            const tueSchedule = tueDateKey ? currentSchedule.schedule[tueDateKey] : null;
                            const satSchedule = satDateKey ? currentSchedule.schedule[satDateKey] : null;

                            return (
                                <div key={weekStart} className="border rounded-lg overflow-hidden min-w-[800px]">
                                    <div className="grid grid-cols-[120px_1fr_1fr] bg-gray-100 font-bold text-center">
                                        <div className="p-2 border-b border-r">Privilegio</div>
                                        <div className="p-2 border-b border-r">
                                            {isEditing && tueSchedule ? (
                                                <input type="text" value={tueSchedule.fechaReunion || ''} onChange={(e) => handleEditChange(tueDateKey!, 'fechaReunion', e.target.value)} className="w-full bg-inherit text-center font-bold p-0 border-0"/>
                                            ) : ( <span>{tueSchedule?.fechaReunion || ''}</span> )}
                                            {isEditing && tueSchedule ? (
                                                 <input type="text" value={tueSchedule.reunionHorario || ''} onChange={(e) => handleEditChange(tueDateKey!, 'reunionHorario', e.target.value)} className="w-full bg-inherit text-center font-normal p-0 border-0"/>
                                            ) : ( <span className="font-normal block">{tueSchedule?.reunionHorario || '7:30 p. m.'}</span> )}
                                        </div>
                                        <div className="p-2 border-b">
                                             {isEditing && satSchedule ? (
                                                <input type="text" value={satSchedule.fechaReunion || ''} onChange={(e) => handleEditChange(satDateKey!, 'fechaReunion', e.target.value)} className="w-full bg-inherit text-center font-bold p-0 border-0"/>
                                            ) : ( <span>{satSchedule?.fechaReunion || ''}</span> )}
                                            {isEditing && satSchedule ? (
                                                 <input type="text" value={satSchedule.reunionHorario || ''} onChange={(e) => handleEditChange(satDateKey!, 'reunionHorario', e.target.value)} className="w-full bg-inherit text-center font-normal p-0 border-0"/>
                                            ) : ( <span className="font-normal block">{satSchedule?.reunionHorario || '4:30 p. m.'}</span> )}
                                        </div>
                                    </div>
                                    
                                    {assignmentsLayout.map(({ label, key, tueSize, satSize }) => (
                                        <div className="grid grid-cols-[120px_1fr_1fr] border-b last:border-b-0" key={key}>
                                            <div className="p-2 border-r bg-gray-50 font-semibold flex items-center justify-center text-center">{label}</div>
                                            <div className="p-2 border-r flex flex-col justify-center gap-1">
                                                {key === 'vigilantes' 
                                                    ? renderVigilanciaCell(weekMeetings.tuesday, tueSize)
                                                    : tueSize > 0 && renderCellContent(weekMeetings.tuesday, key as AssignmentKey, tueSize).map((c, i) => <div key={i}>{c}</div>)}
                                            </div>
                                            <div className="p-2 flex flex-col justify-center gap-1">
                                                {key === 'vigilantes'
                                                    ? renderVigilanciaCell(weekMeetings.saturday, satSize)
                                                    : satSize > 0 && renderCellContent(weekMeetings.saturday, key as AssignmentKey, satSize).map((c, i) => <div key={i}>{c}</div>)}
                                            </div>
                                        </div>
                                    ))}

                                    <div className="grid grid-cols-[120px_1fr_1fr]">
                                        <div className="p-2 border-r bg-gray-50 font-semibold flex items-center justify-center">Recordatorio WA</div>
                                        <div className="p-2 border-r flex items-center justify-center">{weekMeetings.tuesday && !isEditing && <button onClick={() => handleCopyToClipboard(weekMeetings.tuesday!)} className="text-blue-600 hover:underline">Copiar</button>}</div>
                                        <div className="p-2 flex items-center justify-center">{weekMeetings.saturday && !isEditing && <button onClick={() => handleCopyToClipboard(weekMeetings.saturday!)} className="text-blue-600 hover:underline">Copiar</button>}</div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{[pub.Nombre, pub.Apellido, pub['2do Apellido'], pub['Apellido de casada']].filter(Boolean).join(' ')}</td>
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
                    <h1 className="text-3xl font-bold text-gray-800">Asignaciones de Reunión</h1>
                    <div className="flex flex-wrap justify-center gap-2">
                         {isEditing ? (
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
                                <button onClick={handleGenerateSchedule} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                                    {isLoading ? 'Generando...' : 'Generar Programa'}
                                </button>
                                <button onClick={() => { setIsEditing(true); setEditableSchedule(JSON.parse(JSON.stringify(scheduleForSelectedMonth))); }} disabled={!scheduleForSelectedMonth} className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 disabled:bg-gray-400">
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
