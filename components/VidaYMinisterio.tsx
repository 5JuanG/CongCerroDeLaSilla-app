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
};

const STUDENT_ASSIGNMENTS = {
    'Lectura de la Biblia': 'vym_lectura',
    'SMM Asig. 4, 5, 6 y 7': 'vym_revisita', // Represents all non-discourse student assignments.
    'SMM Discurso': 'vym_discurso_estudiante',
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
    
    const getPublisherName = useCallback((id: string | null | undefined): string => {
        if (!id) return '';
        const pub = publishers.find(p => p.id === id);
        return pub ? [pub.Nombre, pub.Apellido].filter(Boolean).join(' ') : 'N/A';
    }, [publishers]);

    const getEligiblePublishers = useCallback((roleKey: string, gender?: 'Hombre' | 'Mujer') => {
        let eligible = activePublishers.filter(p => (p as any)[roleKey]);
    
        if (roleKey === 'vym_presidente' || roleKey === 'vym_conductor_ebc') {
            eligible = eligible.filter(p => p.Privilegio === 'Anciano' || p.Privilegio === 'Siervo Ministerial');
        } else if (['vym_tesoros', 'vym_perlas', 'vym_vida_cristiana', 'vym_oracion'].includes(roleKey)) {
             eligible = eligible.filter(p => p.Privilegio === 'Anciano' || p.Privilegio === 'Siervo Ministerial');
        } else if (['vym_lectura', 'vym_discurso_estudiante'].includes(roleKey)) {
            eligible = eligible.filter(p => p.Sexo === 'Hombre');
        }
    
        if (gender) {
            eligible = eligible.filter(p => p.Sexo === gender);
        }
        return eligible.sort((a,b) => `${a.Nombre} ${a.Apellido}`.localeCompare(`${b.Nombre} ${b.Apellido}`));
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
                current[keys[i]] = current[keys[i]] || {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            return newSchedule;
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
            const lines = programText.split('\n').map(l => l.trim()).filter(Boolean);
            const weekBoundaries = lines.reduce<number[]>((acc, line, index) => {
                if (/^(\d{1,2}(?:-\d{1,2})? DE [A-ZÁÉÍÓÚÑ]+)/i.test(line)) {
                    acc.push(index);
                }
                return acc;
            }, []);
    
            if (weekBoundaries.length === 0) {
                throw new Error("No se encontraron fechas de semana en el texto (Ej: '22-28 DE DICIEMBRE').");
            }
    
            const parsedWeeks: LMWeekAssignment[] = [];
    
            for (let i = 0; i < weekBoundaries.length; i++) {
                const weekStartIndex = weekBoundaries[i];
                const weekEndIndex = i + 1 < weekBoundaries.length ? weekBoundaries[i + 1] : lines.length;
                const weekLines = lines.slice(weekStartIndex, weekEndIndex);
    
                let currentWeek: any = {
                    weekRange: lines[weekStartIndex],
                    bibleReadingSource: '',
                    song1: '', song2: '', song3: '',
                    treasuresTalkTitle: '', hasSpiritualGems: false, hasBibleReading: false, hasCbs: false,
                    studentAssignments: [], christianLivingParts: [],
                };
                
                let currentSection: 'INIT' | 'TESOROS' | 'MAESTROS' | 'VIDA_CRISTIANA' = 'INIT';
    
                for (let j = 0; j < weekLines.length; j++) {
                    const line = weekLines[j];
                    const nextLine = weekLines[j + 1] || '';

                    // Detectar lectura bíblica justo después de la fecha
                    if (j === 0 && !/DE [A-ZÁÉÍÓÚÑ]+/.test(nextLine) && /^[A-ZÁÉÍÓÚÑ\s]+\s+\d{1,3}(?:[:\s,-]\d{1,3})*/.test(nextLine)) {
                        currentWeek.bibleReadingSource = nextLine;
                        j++; // Saltar la línea de lectura
                        continue;
                    }

                    if (/TESOROS DE LA BIBLIA/.test(line)) { currentSection = 'TESOROS'; continue; }
                    if (/SEAMOS MEJORES MAESTROS/.test(line)) { currentSection = 'MAESTROS'; continue; }
                    if (/NUESTRA VIDA CRISTIANA/.test(line)) { currentSection = 'VIDA_CRISTIANA'; continue; }
                    
                    if (/Lectura semanal: (.*)/i.test(line)) {
                        currentWeek.bibleReadingSource = line.match(/Lectura semanal: (.*)/i)![1].trim();
                        continue;
                    }

                    if (/^C(a|á)n(c|t)i(c|o)o?\s+(\d+)/i.test(line)) {
                        const songNumber = RegExp.$4;
                        if (!currentWeek.song1) currentWeek.song1 = songNumber;
                        else if (currentSection === 'VIDA_CRISTIANA' && !currentWeek.song2) currentWeek.song2 = songNumber;
                        else if (currentSection === 'VIDA_CRISTIANA') currentWeek.song3 = songNumber;
                        continue;
                    }
    
                    const durationMatch = line.match(/(\(\s*\d{1,2}\s*min\s*\.?\s*\))/i);
                    if (durationMatch) {
                        const durationText = durationMatch[1];
                        const duration = durationText.replace(/[()]/g, '').trim();
                        let title = line.replace(durationText, '').trim();

                        // Si el título está vacío, es probable que esté en la siguiente línea.
                        if (title === '' && nextLine && !/\(\s*\d{1,2}\s*min\s*\.?\s*\)/i.test(nextLine) && !/^(TESOROS|SEAMOS|NUESTRA)/.test(nextLine)) {
                            title = nextLine;
                            j++;
                        }
                        title = title.replace(/^\d+\.\s*/, '').trim();

                        const isVideo = /presentación de video/i.test(nextLine) || /presentación de video/i.test(title);
                        if (isVideo) {
                            title = title.replace(/\(presentación de video\)/i, '').trim();
                            if (/presentación de video/i.test(nextLine)) j++;
                        }
    
                        switch (currentSection) {
                            case 'TESOROS':
                                if (/Busquemos perlas escondidas/i.test(title)) currentWeek.hasSpiritualGems = true;
                                else if (/Lectura de la Biblia/i.test(title)) currentWeek.hasBibleReading = true;
                                else currentWeek.treasuresTalkTitle = title || 'Discurso';
                                break;
                            case 'MAESTROS':
                                if (title) {
                                    const isDiscourse = /discurso/i.test(title);
                                    currentWeek.studentAssignments.push({
                                        title, duration,
                                        type: isDiscourse ? 'discurso_estudiante' : 'demonstration',
                                        studentId: null,
                                        helperId: isDiscourse ? null : undefined,
                                    });
                                }
                                break;
                            case 'VIDA_CRISTIANA':
                                if (title) {
                                    if (/Estudio bíblico de la congregación/i.test(title)) currentWeek.hasCbs = true;
                                    else if (!/Palabras de conclusión/i.test(title)) {
                                        currentWeek.christianLivingParts.push({ 
                                            title, duration, 
                                            assigneeId: isVideo ? null : undefined,
                                            note: isVideo ? '(Presentación de video)' : undefined
                                        });
                                    }
                                }
                                break;
                        }
                    }
                }
                parsedWeeks.push(currentWeek);
            }
            
            // --- Assignment Logic ---
            const queues: Record<string, any[]> = {};
            for (const key of Object.values(ALL_ASSIGNMENT_KEYS)) {
                queues[key] = [...getEligiblePublishers(key)];
            }
            const studentFemaleQueue = [...getEligiblePublishers('vym_revisita', 'Mujer')];
            const studentMaleQueue = [...getEligiblePublishers('vym_revisita', 'Hombre')];
            
            let assignedLastWeek = new Set<string>();
    
            for (const week of parsedWeeks) {
                const assignedThisNight = new Set<string>();
    
                const assignNext = (queueKey: string, allowDupeOnNight: boolean = false, excludeId: string | null = null): string | null => {
                    const queue = queues[queueKey];
                    if (!queue || queue.length === 0) return null;
                    
                    let eligibleForNight = queue.filter(p => !excludeId || p.id !== excludeId);
                    if (!allowDupeOnNight) {
                        eligibleForNight = eligibleForNight.filter(p => !assignedThisNight.has(p.id));
                    }
                    
                    const notInLastWeek = eligibleForNight.filter(p => !assignedLastWeek.has(p.id));
                    const candidatePool = notInLastWeek.length > 0 ? notInLastWeek : eligibleForNight;
                    
                    if (candidatePool.length === 0) { // Fallback if no ideal candidates
                        // Try again but allow anyone from the queue not already assigned tonight
                        const fallbackPool = queue.filter(p => !assignedThisNight.has(p.id));
                        if(fallbackPool.length > 0) {
                            const person = fallbackPool[0];
                            const mainQueueIndex = queue.findIndex(p => p.id === person.id);
                            if (mainQueueIndex > -1) {
                                const [p] = queue.splice(mainQueueIndex, 1);
                                queue.push(p);
                            }
                            assignedThisNight.add(person.id);
                            return person.id;
                        } else {
                            // Absolute fallback: just pick the first person
                            const person = queue[0];
                             const [p] = queue.splice(0, 1);
                            queue.push(p);
                            assignedThisNight.add(person.id);
                            return person.id;
                        }
                    }
                    
                    const person = candidatePool[0];
                    const mainQueueIndex = queue.findIndex(p => p.id === person.id);
                    if (mainQueueIndex > -1) {
                        const [p] = queue.splice(mainQueueIndex, 1);
                        queue.push(p);
                    }
    
                    assignedThisNight.add(person.id);
                    return person.id;
                };

                const assignStudentAndHelper = (assignment: any) => {
                    let studentId: string | null = null;
                    let helperId: string | null = null;
                
                    // Try to pick someone not already assigned tonight
                    let eligibleStudentsMale = studentMaleQueue.filter(p => !assignedThisNight.has(p.id));
                    let eligibleStudentsFemale = studentFemaleQueue.filter(p => !assignedThisNight.has(p.id));
                
                    // Fallback if everyone is assigned
                    if (eligibleStudentsMale.length === 0 && eligibleStudentsFemale.length === 0) {
                        eligibleStudentsMale = studentMaleQueue;
                        eligibleStudentsFemale = studentFemaleQueue;
                    }
                
                    const studentIsMale = eligibleStudentsMale.length > 0 && (eligibleStudentsMale.length >= eligibleStudentsFemale.length);
                
                    if (studentIsMale && eligibleStudentsMale.length > 0) {
                        const student = eligibleStudentsMale.shift()!;
                        studentId = student.id;
                        studentMaleQueue.push(student); // Move to end of main queue
                
                        // Find helper from remaining eligible men
                        if (eligibleStudentsMale.length > 0) {
                            const helper = eligibleStudentsMale.shift()!;
                            helperId = helper.id;
                            studentMaleQueue.push(helper);
                        }
                    } else if (eligibleStudentsFemale.length > 0) {
                        const student = eligibleStudentsFemale.shift()!;
                        studentId = student.id;
                        studentFemaleQueue.push(student);
                
                        if (eligibleStudentsFemale.length > 0) {
                            const helper = eligibleStudentsFemale.shift()!;
                            helperId = helper.id;
                            studentFemaleQueue.push(helper);
                        }
                    }
                
                    if(studentId) assignedThisNight.add(studentId);
                    if(helperId) assignedThisNight.add(helperId);
                
                    assignment.studentId = studentId;
                    assignment.helperId = helperId;
                };

                week.presidentId = assignNext('vym_presidente');
                week.treasuresTalkId = assignNext('vym_tesoros');
                if (week.hasSpiritualGems) week.spiritualGemsId = assignNext('vym_perlas');
                if (week.hasBibleReading) week.bibleReadingStudentId = assignNext('vym_lectura');
                
                for (const asig of week.studentAssignments) {
                    if (asig.type === 'discurso_estudiante') {
                        asig.studentId = assignNext('vym_discurso_estudiante');
                    } else if (asig.helperId !== null) { // Es una demostración
                       assignStudentAndHelper(asig);
                    }
                }
    
                for (const part of week.christianLivingParts) {
                    if (part.assigneeId === undefined) { 
                        part.assigneeId = assignNext('vym_vida_cristiana');
                    }
                }
    
                if (week.hasCbs) {
                    week.cbsConductorId = assignNext('vym_conductor_ebc');
                    week.cbsReaderId = assignNext('vym_lectura', true, week.cbsConductorId);
                }
                
                week.finalPrayerId = assignNext('vym_oracion', true);
    
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
            const value = assignmentKey.split('.').reduce((o, i) => o?.[i], (editableSchedule || draftSchedule)?.weeks[weekIndex]) || '';
    
            return (
                <select 
                    value={value} 
                    onChange={e => handleEditChange(weekIndex, assignmentKey, e.target.value)}
                    className="w-full p-1 border rounded text-sm bg-yellow-50"
                >
                    <option value="">-- Vacante --</option>
                    {eligible.map(p => (
                        <option key={p.id} value={p.id}>{getPublisherName(p.id)}</option>
                    ))}
                </select>
            );
        };
        
        const renderInput = (weekIndex: number, assignmentKey: string, placeholder: string) => (
            <input
                type="text"
                value={assignmentKey.split('.').reduce((o, i) => o?.[i], (editableSchedule || draftSchedule)?.weeks[weekIndex]) || ''}
                onChange={e => handleEditChange(weekIndex, assignmentKey, e.target.value)}
                className="w-full p-1 border rounded text-sm bg-yellow-50"
                placeholder={placeholder}
            />
        );
        
        if (!currentSchedule?.weeks?.length) {
            return <p className="text-center text-gray-500 py-8">No hay programa disponible o generado para este mes.</p>;
        }
    
        const AssignmentRow: React.FC<{label: React.ReactNode, time?: string, children: React.ReactNode}> = ({ label, time, children }) => (
            <div className="grid grid-cols-12 gap-2 py-2 border-b">
                <div className="col-span-1 text-right text-gray-500">{time}</div>
                <div className="col-span-5 flex items-center">{label}</div>
                <div className="col-span-6">{children}</div>
            </div>
        );

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
                            <AssignmentRow label={<>Cántico {isEditing ? <input type="text" value={week.song1 || ''} onChange={e => handleEditChange(weekIndex, 'song1', e.target.value)} className="w-12 inline-block p-1 border rounded text-sm bg-yellow-50"/> : week.song1} y oración</>}>
                                {isEditing ? renderSelect(weekIndex, 'presidentId', 'vym_presidente') : <strong>{getPublisherName(week.presidentId)} (Presidente)</strong>}
                            </AssignmentRow>

                            <div className="bg-yellow-100 text-yellow-800 font-bold p-2 my-2 rounded-md">TESOROS DE LA BIBLIA</div>
                            <AssignmentRow label={isEditing ? renderInput(weekIndex, 'treasuresTalkTitle', 'Título del discurso') : week.treasuresTalkTitle} time="10 min.">
                                {isEditing ? renderSelect(weekIndex, 'treasuresTalkId', 'vym_tesoros') : getPublisherName(week.treasuresTalkId)}
                            </AssignmentRow>
                            {week.hasSpiritualGems && <AssignmentRow label="Busquemos perlas escondidas" time="10 min.">
                                {isEditing ? renderSelect(weekIndex, 'spiritualGemsId', 'vym_perlas') : getPublisherName(week.spiritualGemsId)}
                            </AssignmentRow>}
                            {week.hasBibleReading && <AssignmentRow label="Lectura de la Biblia" time="4 min.">
                                {isEditing ? renderSelect(weekIndex, 'bibleReadingStudentId', 'vym_lectura', 'Hombre') : getPublisherName(week.bibleReadingStudentId)}
                            </AssignmentRow>}

                            <div className="bg-green-100 text-green-800 font-bold p-2 my-2 rounded-md">SEAMOS MEJORES MAESTROS</div>
                            {(week.studentAssignments || []).map((asig: any, asigIndex: number) => {
                                const studentId = currentSchedule?.weeks[weekIndex]?.studentAssignments?.[asigIndex]?.studentId;
                                const isDiscourse = asig.type === 'discurso_estudiante';
                                const studentRoleKey = isDiscourse ? 'vym_discurso_estudiante' : 'vym_revisita';
                                const studentGender = isDiscourse ? 'Hombre' : undefined;

                                return (
                                    <AssignmentRow key={asigIndex} label={isEditing ? renderInput(weekIndex, `studentAssignments.${asigIndex}.title`, 'Título') : asig.title} time={`${asig.duration || ''}`}>
                                        <div className="flex space-x-2">
                                            <div className="flex-1">
                                                {isEditing ? renderSelect(weekIndex, `studentAssignments.${asigIndex}.studentId`, studentRoleKey, studentGender) : getPublisherName(asig.studentId)}
                                            </div>
                                            {asig.helperId !== null && <div className="font-bold">/</div>}
                                            {asig.helperId !== null && (
                                                <div className="flex-1">
                                                    {isEditing ? renderSelect(weekIndex, `studentAssignments.${asigIndex}.helperId`, 'vym_revisita', undefined, studentId) : getPublisherName(asig.helperId)}
                                                </div>
                                            )}
                                        </div>
                                    </AssignmentRow>
                                );
                            })}
                            
                            <div className="bg-red-100 text-red-800 font-bold p-2 my-2 rounded-md">NUESTRA VIDA CRISTIANA</div>
                            <AssignmentRow label={<>Cántico {isEditing ? <input type="text" value={week.song2 || ''} onChange={e => handleEditChange(weekIndex, 'song2', e.target.value)} className="w-12 inline-block p-1 border rounded text-sm bg-yellow-50"/> : week.song2}</>}><span></span></AssignmentRow>
                            {(week.christianLivingParts || []).map((part: any, partIndex: number) => (
                                <AssignmentRow key={partIndex} label={isEditing ? renderInput(weekIndex, `christianLivingParts.${partIndex}.title`, 'Título') : part.title} time={`${part.duration || ''}`}>
                                    {part.note ? <em className="text-gray-500">{part.note}</em> : (isEditing ? renderSelect(weekIndex, `christianLivingParts.${partIndex}.assigneeId`, 'vym_vida_cristiana') : getPublisherName(part.assigneeId))}
                                </AssignmentRow>
                            ))}
                            {week.hasCbs && <AssignmentRow label="Estudio bíblico de la congregación" time="30 min.">
                                <div className="flex space-x-2">
                                    <div className="flex-1">
                                        {isEditing ? renderSelect(weekIndex, 'cbsConductorId', 'vym_conductor_ebc') : getPublisherName(week.cbsConductorId)}
                                    </div>
                                    {week.hasOwnProperty('cbsReaderId') && <div className="font-bold">/</div>}
                                    {week.hasOwnProperty('cbsReaderId') && (
                                        <div className="flex-1">
                                            {isEditing ? renderSelect(weekIndex, 'cbsReaderId', 'vym_lectura', 'Hombre') : getPublisherName(week.cbsReaderId)}
                                        </div>
                                    )}
                                </div>
                            </AssignmentRow>}
                            <AssignmentRow label="Palabras de conclusión" time="3 min."><strong>{getPublisherName(week.presidentId)}</strong></AssignmentRow>
                            <AssignmentRow label={<>Cántico {isEditing ? <input type="text" value={week.song3 || ''} onChange={e => handleEditChange(weekIndex, 'song3', e.target.value)} className="w-12 inline-block p-1 border rounded text-sm bg-yellow-50"/> : week.song3} y oración</>}>
                                {isEditing ? renderSelect(weekIndex, 'finalPrayerId', 'vym_oracion') : getPublisherName(week.finalPrayerId)}
                            </AssignmentRow>
                        </div>
                    </div>
                ))}
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
                    <h2 className="text-xl font-bold">Configuración de Participantes</h2>
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
                {canConfig && (
                    <div className="mb-4 border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            <button onClick={() => setActiveTab('schedule')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'schedule' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Programa</button>
                            <button onClick={() => setActiveTab('config')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'config' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>Configuración</button>
                        </nav>
                    </div>
                )}
                
                {activeTab === 'config' && canConfig ? <ConfigView /> : 
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
                                            scheduleForSelectedMonth && <button onClick={handleEditClick} className="px-4 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600">Editar Programa</button>
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
                        
                        {canConfig && !draftSchedule && !isEditing && (
                             <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-6 p-3 bg-gray-100 rounded-lg">
                                <span className="font-semibold">Estado:</span>
                                <span className={`px-3 py-1 text-sm font-bold rounded-full ${isPublic ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {isPublic ? 'Público' : 'Oculto'}
                                </span>
                                <button onClick={handleToggleVisibility} disabled={isLoading || !scheduleForSelectedMonth} className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                                    {isPublic ? 'Ocultar' : 'Hacer Público'}
                                </button>
                            </div>
                        )}
                        
                        {canConfig && !draftSchedule && !isEditing && (
                            <div className="p-4 border rounded-lg bg-gray-50 mb-6">
                                <label htmlFor="program-text" className="block text-sm font-medium text-gray-700 mb-2">Pegue aquí el programa de la Guía de Actividades:</label>
                                <textarea id="program-text" value={programText} onChange={e => setProgramText(e.target.value)} rows={5} className="w-full p-2 border rounded-md shadow-sm" placeholder="Ej: 22-28 DE DICIEMBRE | Lectura semanal: ... | Cántico ... | TESOROS DE LA BIBLIA | Discurso (10 min.) ..."></textarea>
                                <div className="text-right mt-2">
                                     <button onClick={handleGenerateSchedule} disabled={isLoading} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                                        {isLoading ? 'Generando...' : 'Generar Programa'}
                                    </button>
                                </div>
                            </div>
                        )}

                        <ScheduleView />
                    </>
                )}
            </div>
        </div>
    );
};

export default VidaYMinisterio;