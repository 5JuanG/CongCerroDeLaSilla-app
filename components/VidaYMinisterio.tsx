import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Publisher, LMMeetingSchedule, LMWeekAssignment, ModalInfo } from '../App';
import { GoogleGenAI, Type } from "@google/genai";

declare const jspdf: any;
declare const html2canvas: any;

// Lazy-loaded singleton instance of the AI client
let ai: GoogleGenAI | null = null;

/**
 * Gets the singleton instance of the GoogleGenAI client.
 * Initializes it on first call if the API key is available.
 * @returns The GoogleGenAI client instance or null if the API key is missing.
 */
const getAiClient = (): GoogleGenAI | null => {
    if (ai) return ai; // Return cached instance

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.error("API_KEY is not configured. AI features will be disabled.");
        return null;
    }

    try {
        ai = new GoogleGenAI({ apiKey });
        return ai;
    } catch (error) {
        console.error("Failed to initialize GoogleGenAI client:", error);
        return null;
    }
};


interface VidaYMinisterioProps {
    publishers: Publisher[];
    lmSchedules: LMMeetingSchedule[];
    onSaveSchedule: (schedule: Omit<LMMeetingSchedule, 'id'>) => Promise<void>;
    onUpdatePublisherVyMAssignments: (publisherId: string, assignments: { [key: string]: boolean }) => Promise<void>;
    onShowModal: (info: ModalInfo) => void;
    canConfig: boolean;
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const ALL_VYM_ROLES: { key: keyof Publisher, label: string }[] = [
    { key: 'vym_presidente', label: 'Presidente' },
    { key: 'vym_oracion', label: 'Oración' },
    { key: 'vym_tesoros', label: 'Discurso (Tesoros)' },
    { key: 'vym_perlas', label: 'Perlas Escondidas' },
    { key: 'vym_conductor_ebc', label: 'Conductor EBC' },
    { key: 'puedeLeerBibliaVyM', label: 'Lector Biblia (Tesoros)' },
    { key: 'puedeLeerEBC', label: 'Lector EBC' },
    { key: 'esEstudianteVyM', label: 'Estudiante (Ministerio)' },
];


// --- Helper Functions ---
const parseDuration = (title: string | undefined): number => {
    if (!title) return 0;
    const match = title.match(/\((\d+)\s*min/);
    return match ? parseInt(match[1], 10) : 0;
};

const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: false });
};

const calculateStartTimesForWeek = (week: LMWeekAssignment): LMWeekAssignment => {
    const newWeek = { ...week };
    let currentTime = new Date('2000-01-01T19:30:00'); // 7:30 PM

    const processPart = (timeKey: keyof LMWeekAssignment, duration: number, title?: string) => {
        (newWeek as any)[timeKey] = formatTime(currentTime);
        const parsedDur = duration > 0 ? duration : parseDuration(title);
        currentTime.setMinutes(currentTime.getMinutes() + parsedDur);
    };
    
    // Order of meeting parts
    processPart('hora_cancion_inicial', 3);
    processPart('hora_introduccion', 1);
    processPart('hora_tesoros_discurso', 10, newWeek.tesoros_discurso_titulo);
    processPart('hora_tesoros_perlas', 10, newWeek.tesoros_perlas_titulo);
    processPart('hora_tesoros_lectura', 4, newWeek.tesoros_lectura_titulo);
    processPart('hora_cancion_media1', 3);
    processPart('hora_ministerio_parte1', 0, newWeek.ministerio_parte1_titulo);
    processPart('hora_ministerio_parte2', 0, newWeek.ministerio_parte2_titulo);
    processPart('hora_ministerio_parte3', 0, newWeek.ministerio_parte3_titulo);
    processPart('hora_cancion_media2', 3);
    processPart('hora_vida_parte1', 0, newWeek.vida_titulo_parte1);
    processPart('hora_estudio_biblico', 30, newWeek.vida_titulo_parte2);
    processPart('hora_conclusion', 3);
    processPart('hora_cancion_final', 5);

    return newWeek;
};

const VidaYMinisterio: React.FC<VidaYMinisterioProps> = ({
    publishers,
    lmSchedules,
    onSaveSchedule,
    onUpdatePublisherVyMAssignments,
    onShowModal,
    canConfig
}) => {
    const [activeTab, setActiveTab] = useState<'schedule' | 'config'>('schedule');
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editableSchedule, setEditableSchedule] = useState<LMMeetingSchedule | null>(null);
    const [pastedContent, setPastedContent] = useState('');
    const [isAiAvailable, setIsAiAvailable] = useState(false);
    const pdfContentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Check for AI availability once on component mount.
        if (getAiClient()) {
            setIsAiAvailable(true);
        }
    }, []);

    const scheduleForSelectedMonth = useMemo(() => {
        return lmSchedules.find(s => s.year === selectedYear && s.month === selectedMonth);
    }, [lmSchedules, selectedYear, selectedMonth]);
    
    useEffect(() => {
        setIsEditing(false);
        setEditableSchedule(null);
    }, [selectedMonth, selectedYear, activeTab]);

    const getPublisherName = useCallback((id: string | null | undefined) => {
        if (!id) return '';
        const pub = publishers.find(p => p.id === id);
        return pub ? `${pub.Nombre} ${pub.Apellido}` : 'N/A';
    }, [publishers]);

    const eligiblePublishersByRole = useMemo(() => {
        const roles: { [key: string]: Publisher[] } = {};
        const isMale = (p: Publisher) => p.Sexo === 'Hombre';
        const isPrivileged = (p: Publisher) => p.Privilegio === 'Anciano' || p.Privilegio === 'Siervo Ministerial';

        roles.vym_presidente = publishers.filter(p => p.vym_presidente && isPrivileged(p));
        roles.vym_oracion = publishers.filter(p => p.vym_oracion && isMale(p));
        roles.vym_tesoros = publishers.filter(p => p.vym_tesoros && isPrivileged(p));
        roles.vym_perlas = publishers.filter(p => p.vym_perlas && isPrivileged(p));
        roles.vym_conductor_ebc = publishers.filter(p => p.vym_conductor_ebc && isPrivileged(p));
        roles.puedeLeerBibliaVyM = publishers.filter(p => p.puedeLeerBibliaVyM);
        roles.puedeLeerEBC = publishers.filter(p => p.puedeLeerEBC);
        roles.esEstudianteVyM = publishers.filter(p => p.esEstudianteVyM);
        return roles;
    }, [publishers]);

    const handleGenerateSchedule = async () => {
        const aiClient = getAiClient();
        if (!aiClient) {
            onShowModal({
                type: 'error',
                title: 'Error de Configuración',
                message: 'La función de IA no está disponible porque la clave de API no está configurada. Por favor, pida al administrador que configure el secreto "API_KEY".'
            });
            return;
        }

        setIsLoading(true);
        onShowModal({type: 'info', title: 'Generando Programa', message: 'Contactando a la IA para obtener el programa. Esto puede tardar unos momentos...'});
        
        try {
            const eligiblePublishersForPrompt = publishers.filter(p => p.Estatus === 'Activo').map(p => ({
                id: p.id,
                nombre: `${p.Nombre} ${p.Apellido}`,
                privilegio: p.Privilegio,
                sexo: p.Sexo,
                roles: ALL_VYM_ROLES.reduce((acc, role) => ({ ...acc, [role.key]: !!p[role.key] }), {})
            }));

            if (!pastedContent) {
                onShowModal({type: 'error', title: 'Contenido Faltante', message: 'Por favor, pega el contenido de la Guía de Actividades en el área de texto antes de generar el programa.'});
                setIsLoading(false);
                return;
            }

            const prompt = `
                Genera un programa para la reunión "Vida y Ministerio Cristianos" para ${selectedMonth} ${selectedYear}.
                Usa el siguiente texto de la Guía de Actividades para extraer los temas y las asignaciones:
                ---
                ${pastedContent}
                ---
                Aquí está la lista de publicadores y sus capacidades:
                ${JSON.stringify(eligiblePublishersForPrompt, null, 2)}
                
                Reglas de asignación:
                - Extrae los números de las canciones y ponlos en los campos 'cancion_*_numero'.
                - La palabra correcta es 'Canción', no 'Canto'.
                - Asigna solo publicadores elegibles a cada parte, usando sus IDs.
                - 'presidente', 'oracionInicial', 'oracionFinal', 'tesoros_discurso', 'tesoros_perlas' deben ser varones (Ancianos o Siervos Ministeriales).
                - 'vida_participante2_conductor' (Conductor EBC) debe ser un varón elegible.
                - Rota a los participantes para que no se repitan mucho. Un participante no debe tener más de una asignación por reunión, excepto el presidente.
                - Para asignaciones con 2 participantes, asigna 2 IDs distintos si es posible. Si no, usa null para el segundo.
                - Devuelve el resultado en formato JSON.
            `;
            
            const responseSchema = {
                type: Type.OBJECT,
                properties: {
                    weeks: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                fecha: { type: Type.STRING },
                                cancion_inicial_numero: { type: Type.STRING },
                                cancion_media1_numero: { type: Type.STRING },
                                cancion_media2_numero: { type: Type.STRING },
                                cancion_final_numero: { type: Type.STRING },
                                presidente: { type: Type.STRING },
                                oracionInicial: { type: Type.STRING },
                                oracionFinal: { type: Type.STRING },
                                tesoros_discurso: { type: Type.STRING },
                                tesoros_perlas: { type: Type.STRING },
                                tesoros_lectura: { type: Type.STRING },
                                ministerio_parte1_participante1: { type: Type.STRING },
                                ministerio_parte1_participante2: { type: Type.STRING },
                                ministerio_parte2_participante1: { type: Type.STRING },
                                ministerio_parte2_participante2: { type: Type.STRING },
                                ministerio_parte3_participante1: { type: Type.STRING },
                                ministerio_parte3_participante2: { type: Type.STRING },
                                vida_participante1: { type: Type.STRING },
                                vida_participante2_conductor: { type: Type.STRING },
                                vida_participante2_lector: { type: Type.STRING },
                                tesoros_discurso_titulo: { type: Type.STRING },
                                tesoros_perlas_titulo: { type: Type.STRING },
                                tesoros_lectura_titulo: { type: Type.STRING },
                                ministerio_parte1_titulo: { type: Type.STRING },
                                ministerio_parte2_titulo: { type: Type.STRING },
                                ministerio_parte3_titulo: { type: Type.STRING },
                                vida_titulo_parte1: { type: Type.STRING },
                                vida_titulo_parte2: { type: Type.STRING },
                            }
                        }
                    }
                }
            };
            
            const response = await aiClient.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: responseSchema,
                },
            });
            
            const scheduleJson = JSON.parse(response.text);
            const weeksWithTimes = scheduleJson.weeks.map((week: LMWeekAssignment) => calculateStartTimesForWeek(week));
            
            const newSchedule = {
                // FIX: Add missing 'id' property to align with the LMMeetingSchedule type.
                id: `${selectedYear}-${selectedMonth}`,
                year: selectedYear,
                month: selectedMonth,
                weeks: weeksWithTimes
            };

            setEditableSchedule(newSchedule);
            setIsEditing(true);
            onShowModal({type: 'success', title: 'Éxito', message: 'Programa generado. Ahora puede revisarlo y guardarlo.'});
            setPastedContent('');
        } catch (error) {
            console.error(error);
            onShowModal({type: 'error', title: 'Error de IA', message: `No se pudo generar el programa. Error: ${(error as Error).message}`});
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSaveChanges = async () => {
        if (!editableSchedule) return;
        setIsLoading(true);
        try {
            // Recalculate times before saving
            const scheduleToSave = {
                ...editableSchedule,
                weeks: editableSchedule.weeks.map(calculateStartTimesForWeek)
            };
            await onSaveSchedule(scheduleToSave);
            setIsEditing(false);
            setEditableSchedule(null);
            onShowModal({type: 'success', title: 'Guardado', message: 'El programa se guardó correctamente.'});
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditChange = (weekIndex: number, field: keyof LMWeekAssignment, value: string) => {
        if (!editableSchedule) return;
        const newWeeks = [...editableSchedule.weeks];
        const weekToUpdate = { ...newWeeks[weekIndex] };
        (weekToUpdate as any)[field] = value;
        newWeeks[weekIndex] = weekToUpdate;
        setEditableSchedule({ ...editableSchedule, weeks: newWeeks });
    };

    const handleExportPdf = async () => {
        const scheduleToExport = (isEditing && editableSchedule) ? editableSchedule : scheduleForSelectedMonth;

        if (!scheduleToExport) {
            onShowModal({ type: 'error', title: 'Error', message: 'No hay programa para exportar.' });
            return;
        }
        onShowModal({ type: 'info', title: 'Generando PDF', message: 'Preparando documento, por favor espere...' });

        try {
            // @ts-ignore
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

            const PAGE_WIDTH = pdf.internal.pageSize.getWidth();
            const PAGE_HEIGHT = pdf.internal.pageSize.getHeight();
            const MARGIN = 10;
            const contentWidth = PAGE_WIDTH - MARGIN * 2;
            const LINE_HEIGHT = 4.0;
            const TITLE_MAX_WIDTH = contentWidth * 0.60;
            const PARTICIPANT_MAX_WIDTH = contentWidth * 0.30;
            const PARTICIPANT_START_X = PAGE_WIDTH - MARGIN;

            const getParticipantText = (p1?: string, p2?: string, prefix1?: string, prefix2?: string): string => {
                const currentData = (isEditing && editableSchedule) ? editableSchedule : scheduleForSelectedMonth;
                const name1 = p1 ? getPublisherName(p1) : '';
                const name2 = p2 ? getPublisherName(p2) : '';
                
                if (prefix1 && prefix2) {
                    return `${prefix1}: ${name1}\n${prefix2}: ${name2}`;
                }
                return [name1, name2].filter(Boolean).join(' / ');
            };

            const calculateWeekHeight = (week: LMWeekAssignment) => {
                let height = 0;
                const getRowHeight = (title: string, participantText: string) => {
                    pdf.setFontSize(9);
                    const titleLines = pdf.splitTextToSize(title || '', TITLE_MAX_WIDTH).length;
                    const participantLines = pdf.splitTextToSize(participantText, PARTICIPANT_MAX_WIDTH).length;
                    return Math.max(titleLines, participantLines) * LINE_HEIGHT + 1.2;
                };

                height += 8 + 1; // Week header + padding
                height += getRowHeight(`Canción ${week.cancion_inicial_numero} y Palabras de introducción`, getParticipantText(week.oracionInicial));
                height += 6; // Section header
                height += getRowHeight(week.tesoros_discurso_titulo || '', getParticipantText(week.tesoros_discurso));
                height += getRowHeight(week.tesoros_perlas_titulo || '', getParticipantText(week.tesoros_perlas));
                height += getRowHeight(week.tesoros_lectura_titulo || '', getParticipantText(week.tesoros_lectura));
                height += 4; // Song
                height += 6; // Section header
                height += getRowHeight(week.ministerio_parte1_titulo || '', getParticipantText(week.ministerio_parte1_participante1, week.ministerio_parte1_participante2));
                height += getRowHeight(week.ministerio_parte2_titulo || '', getParticipantText(week.ministerio_parte2_participante1, week.ministerio_parte2_participante2));
                height += getRowHeight(week.ministerio_parte3_titulo || '', getParticipantText(week.ministerio_parte3_participante1, week.ministerio_parte3_participante2));
                height += 4; // Song
                height += 6; // Section header
                height += getRowHeight(week.vida_titulo_parte1 || '', getParticipantText(week.vida_participante1));
                height += getRowHeight(week.vida_titulo_parte2 || '', getParticipantText(week.vida_participante2_conductor, week.vida_participante2_lector, "Cond", "Lector"));
                height += getRowHeight(`Palabras de conclusión y Canción ${week.cancion_final_numero}`, getParticipantText(week.oracionFinal));
                height += 3; // Extra padding
                return height;
            };

            let yPos = MARGIN;

            const addHeader = () => {
                pdf.setFontSize(14).setFont(undefined, 'bold');
                pdf.text('PROGRAMA DE LA REUNIÓN VIDA Y MINISTERIO', PAGE_WIDTH / 2, MARGIN, { align: 'center' });
                pdf.setFontSize(12).setFont(undefined, 'normal');
                pdf.text(`MES DE ${selectedMonth.toUpperCase()} ${selectedYear} - CONG. CERRO DE LA SILLA`, PAGE_WIDTH / 2, MARGIN + 6, { align: 'center' });
                yPos = MARGIN + 15;
            };

            const drawRow = (time: string, title: string, participantText: string) => {
                pdf.setFontSize(9).setFont(undefined, 'normal');
                const titleLines = pdf.splitTextToSize(title || '', TITLE_MAX_WIDTH);
                const participantLines = pdf.splitTextToSize(participantText, PARTICIPANT_MAX_WIDTH);
                const rowHeight = Math.max(titleLines.length, participantLines.length) * LINE_HEIGHT + 1.2;
                const startY = yPos + LINE_HEIGHT - 1;

                pdf.text(time || '', MARGIN + 2, startY);
                pdf.text(title || '', MARGIN + 12, startY, { maxWidth: TITLE_MAX_WIDTH, align: 'left' });
                pdf.text(participantText, PARTICIPANT_START_X, startY, { maxWidth: PARTICIPANT_MAX_WIDTH, align: 'right' });
                yPos += rowHeight;
            };

            const addWeekToPdf = (week: LMWeekAssignment) => {
                pdf.setFontSize(11).setFont(undefined, 'bold');
                pdf.setFillColor(59, 130, 246);
                pdf.setTextColor(255, 255, 255);
                pdf.rect(MARGIN, yPos, contentWidth, 8, 'F');
                pdf.text(week.fecha, MARGIN + 2, yPos + 5.5);
                pdf.text(`Presidente: ${getPublisherName(week.presidente)}`, PAGE_WIDTH - MARGIN - 2, yPos + 5.5, { align: 'right' });
                yPos += 9;
                pdf.setTextColor(0, 0, 0);

                const drawSectionHeader = (title: string, color: number[]) => {
                    pdf.setFontSize(9).setFont(undefined, 'bold');
                    pdf.setFillColor(color[0], color[1], color[2]);
                    pdf.rect(MARGIN, yPos, contentWidth, 5, 'F');
                    pdf.setTextColor(color[3], color[4], color[5]);
                    pdf.text(title, PAGE_WIDTH / 2, yPos + 3.5, { align: 'center' });
                    yPos += 6;
                    pdf.setTextColor(0, 0, 0);
                };

                drawRow(week.hora_cancion_inicial || '', `Canción ${week.cancion_inicial_numero} y Palabras de introducción`, getParticipantText(week.oracionInicial));
                drawSectionHeader('TESOROS DE LA BIBLIA', [254, 249, 195, 133, 77, 14]);
                drawRow(week.hora_tesoros_discurso || '', week.tesoros_discurso_titulo || '', getParticipantText(week.tesoros_discurso));
                drawRow(week.hora_tesoros_perlas || '', week.tesoros_perlas_titulo || '', getParticipantText(week.tesoros_perlas));
                drawRow(week.hora_tesoros_lectura || '', week.tesoros_lectura_titulo || '', getParticipantText(week.tesoros_lectura));
                yPos += 1.5; pdf.text(`Canción ${week.cancion_media1_numero}`, MARGIN + 12, yPos); yPos += 2.5;
                drawSectionHeader('SEAMOS MEJORES MAESTROS', [254, 226, 226, 153, 27, 27]);
                drawRow(week.hora_ministerio_parte1 || '', week.ministerio_parte1_titulo || '', getParticipantText(week.ministerio_parte1_participante1, week.ministerio_parte1_participante2));
                drawRow(week.hora_ministerio_parte2 || '', week.ministerio_parte2_titulo || '', getParticipantText(week.ministerio_parte2_participante1, week.ministerio_parte2_participante2));
                drawRow(week.hora_ministerio_parte3 || '', week.ministerio_parte3_titulo || '', getParticipantText(week.ministerio_parte3_participante1, week.ministerio_parte3_participante2));
                yPos += 1.5; pdf.text(`Canción ${week.cancion_media2_numero}`, MARGIN + 12, yPos); yPos += 2.5;
                drawSectionHeader('NUESTRA VIDA CRISTIANA', [243, 232, 255, 107, 33, 168]);
                drawRow(week.hora_vida_parte1 || '', week.vida_titulo_parte1 || '', getParticipantText(week.vida_participante1));
                drawRow(week.hora_estudio_biblico || '', week.vida_titulo_parte2 || '', getParticipantText(week.vida_participante2_conductor, week.vida_participante2_lector, 'Cond', 'Lector'));
                drawRow(week.hora_conclusion || '', `Palabras de conclusión y Canción ${week.cancion_final_numero}`, getParticipantText(week.oracionFinal));
                yPos += 3;
            };

            addHeader();
            let weeksOnPage = 0;

            for (const week of scheduleToExport.weeks) {
                const weekHeight = calculateWeekHeight(week);
                if (yPos + weekHeight > PAGE_HEIGHT - MARGIN && weeksOnPage > 0) {
                    pdf.addPage();
                    addHeader();
                    weeksOnPage = 0;
                }
                addWeekToPdf(week);
                weeksOnPage++;
            }

            pdf.save(`Programa_Vida_y_Ministerio_${selectedMonth}_${selectedYear}.pdf`);
            onShowModal({type: 'success', title: 'Éxito', message: 'PDF generado correctamente.'});
        } catch (err) {
            console.error("PDF Export Error:", err);
            onShowModal({ type: 'error', title: 'Error al Exportar', message: `No se pudo generar el PDF: ${(err as Error).message}` });
        }
    };

    const ParticipantSelect: React.FC<{
        weekIndex: number;
        field: keyof LMWeekAssignment;
        value: string | undefined;
        roleKey: keyof typeof eligiblePublishersByRole;
    }> = ({ weekIndex, field, value, roleKey }) => (
        <select
            value={value || ''}
            onChange={(e) => handleEditChange(weekIndex, field, e.target.value)}
            className="w-full p-1 border rounded text-xs bg-yellow-50 text-black"
        >
            <option value="">-- Asignar --</option>
            {(eligiblePublishersByRole[roleKey] || []).map(p => (
                <option key={p.id} value={p.id}>{p.Nombre} {p.Apellido}</option>
            ))}
        </select>
    );

    const ScheduleView = () => {
        const currentSchedule = isEditing ? editableSchedule : scheduleForSelectedMonth;

        return (
            <div className="mt-6">
                {canConfig && (
                    <div className="bg-gray-50 p-4 rounded-lg border mb-6">
                        <label htmlFor="pastedContent" className="block text-sm font-medium text-gray-700 mb-2">Pegue aquí el texto de la Guía de Actividades:</label>
                        <textarea id="pastedContent" value={pastedContent} onChange={(e) => setPastedContent(e.target.value)} rows={6} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" placeholder="Copie y pegue el contenido completo de la Guía de Actividades del mes aquí..."/>
                    </div>
                )}
                <div className="text-center mb-6 flex flex-wrap justify-center gap-4">
                    {canConfig && (
                        <button
                            onClick={handleGenerateSchedule}
                            disabled={isLoading || !pastedContent || !isAiAvailable}
                            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            title={!isAiAvailable ? "Función no disponible. Pida al administrador que configure la clave de API." : ""}
                        >
                            {isLoading ? 'Generando...' : 'Generar Programa con IA'}
                        </button>
                    )}
                    {isEditing ? (
                        <>
                            <button onClick={handleSaveChanges} disabled={isLoading} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400">Guardar Cambios</button>
                            <button onClick={() => { setIsEditing(false); setEditableSchedule(null); }} className="px-6 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600">Cancelar</button>
                        </>
                    ) : (
                        <>
                            {canConfig && (
                                <button onClick={() => { setIsEditing(true); setEditableSchedule(JSON.parse(JSON.stringify(scheduleForSelectedMonth))); }} disabled={!scheduleForSelectedMonth} className="px-6 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600 disabled:bg-gray-400">
                                    Editar Programa
                                </button>
                            )}
                            <button onClick={handleExportPdf} disabled={!scheduleForSelectedMonth || isEditing} className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:bg-gray-400">Exportar a PDF</button>
                        </>
                    )}
                </div>

                {currentSchedule ? (
                    <div ref={pdfContentRef}>
                        <div className="vym-pdf-title text-center">
                            <h2 className="text-2xl font-bold">PROGRAMA DE LA REUNIÓN VIDA Y MINISTERIO</h2>
                            <h3 className="text-xl font-semibold text-gray-700">MES DE {selectedMonth.toUpperCase()} {selectedYear} - CONG. CERRO DE LA SILLA</h3>
                        </div>
                        <div className="space-y-6 mt-4">
                            {currentSchedule.weeks.map((week, weekIndex) => (
                                <div key={weekIndex} className="vym-pdf-week border-2 border-blue-200 rounded-lg overflow-hidden">
                                    <div className="bg-blue-600 text-white p-3">
                                        <h3 className="font-bold text-xl">{week.fecha}</h3>
                                        <p className="text-sm">Presidente: {isEditing ? <ParticipantSelect weekIndex={weekIndex} field="presidente" value={week.presidente} roleKey="vym_presidente" /> : <strong className="text-yellow-300">{getPublisherName(week.presidente)}</strong>}</p>
                                    </div>
                                    <div className="divide-y divide-gray-200 text-sm">
                                        {/* Table-like structure */}
                                        <div className="grid grid-cols-[50px_1fr_2fr] items-center p-2 bg-blue-50 font-semibold"><span className="text-center">{week.hora_cancion_inicial}</span><span>Canción {week.cancion_inicial_numero} y Palabras de introducción</span><span className="text-right">Oración: {isEditing ? <ParticipantSelect weekIndex={weekIndex} field="oracionInicial" value={week.oracionInicial} roleKey="vym_oracion" /> : getPublisherName(week.oracionInicial)}</span></div>
                                        <div className="p-2 bg-yellow-100 font-bold text-yellow-800 text-center">TESOROS DE LA BIBLIA</div>
                                        <div className="grid grid-cols-[50px_1fr_2fr] items-center p-2"><span className="text-center">{week.hora_tesoros_discurso}</span><span>{isEditing ? <input value={week.tesoros_discurso_titulo} onChange={e => handleEditChange(weekIndex, 'tesoros_discurso_titulo', e.target.value)} className="w-full bg-yellow-50 p-1 rounded" /> : week.tesoros_discurso_titulo}</span><span>{isEditing ? <ParticipantSelect weekIndex={weekIndex} field="tesoros_discurso" value={week.tesoros_discurso} roleKey="vym_tesoros" /> : getPublisherName(week.tesoros_discurso)}</span></div>
                                        <div className="grid grid-cols-[50px_1fr_2fr] items-center p-2"><span className="text-center">{week.hora_tesoros_perlas}</span><span>{isEditing ? <input value={week.tesoros_perlas_titulo} onChange={e => handleEditChange(weekIndex, 'tesoros_perlas_titulo', e.target.value)} className="w-full bg-yellow-50 p-1 rounded" /> : week.tesoros_perlas_titulo}</span><span>{isEditing ? <ParticipantSelect weekIndex={weekIndex} field="tesoros_perlas" value={week.tesoros_perlas} roleKey="vym_perlas" /> : getPublisherName(week.tesoros_perlas)}</span></div>
                                        <div className="grid grid-cols-[50px_1fr_2fr] items-center p-2"><span className="text-center">{week.hora_tesoros_lectura}</span><span>{isEditing ? <input value={week.tesoros_lectura_titulo} onChange={e => handleEditChange(weekIndex, 'tesoros_lectura_titulo', e.target.value)} className="w-full bg-yellow-50 p-1 rounded" /> : week.tesoros_lectura_titulo}</span><span>{isEditing ? <ParticipantSelect weekIndex={weekIndex} field="tesoros_lectura" value={week.tesoros_lectura} roleKey="puedeLeerBibliaVyM" /> : getPublisherName(week.tesoros_lectura)}</span></div>
                                        <div className="grid grid-cols-[50px_1fr] items-center p-2 bg-gray-100"><span className="text-center">{week.hora_cancion_media1}</span><span className="font-semibold">Canción {week.cancion_media1_numero}</span></div>
                                        <div className="p-2 bg-red-100 font-bold text-red-800 text-center">SEAMOS MEJORES MAESTROS</div>
                                        <div className="grid grid-cols-[50px_1fr_2fr] items-center p-2"><span className="text-center">{week.hora_ministerio_parte1}</span><span>{isEditing ? <input value={week.ministerio_parte1_titulo} onChange={e => handleEditChange(weekIndex, 'ministerio_parte1_titulo', e.target.value)} className="w-full bg-yellow-50 p-1 rounded" /> : week.ministerio_parte1_titulo}</span><div className="flex gap-1">{isEditing ? <><ParticipantSelect weekIndex={weekIndex} field="ministerio_parte1_participante1" value={week.ministerio_parte1_participante1} roleKey="esEstudianteVyM" /><ParticipantSelect weekIndex={weekIndex} field="ministerio_parte1_participante2" value={week.ministerio_parte1_participante2} roleKey="esEstudianteVyM" /></> : <>{getPublisherName(week.ministerio_parte1_participante1)} / {getPublisherName(week.ministerio_parte1_participante2)}</>}</div></div>
                                        <div className="grid grid-cols-[50px_1fr_2fr] items-center p-2"><span className="text-center">{week.hora_ministerio_parte2}</span><span>{isEditing ? <input value={week.ministerio_parte2_titulo} onChange={e => handleEditChange(weekIndex, 'ministerio_parte2_titulo', e.target.value)} className="w-full bg-yellow-50 p-1 rounded" /> : week.ministerio_parte2_titulo}</span><div className="flex gap-1">{isEditing ? <><ParticipantSelect weekIndex={weekIndex} field="ministerio_parte2_participante1" value={week.ministerio_parte2_participante1} roleKey="esEstudianteVyM" /><ParticipantSelect weekIndex={weekIndex} field="ministerio_parte2_participante2" value={week.ministerio_parte2_participante2} roleKey="esEstudianteVyM" /></> : <>{getPublisherName(week.ministerio_parte2_participante1)} / {getPublisherName(week.ministerio_parte2_participante2)}</>}</div></div>
                                        <div className="grid grid-cols-[50px_1fr_2fr] items-center p-2"><span className="text-center">{week.hora_ministerio_parte3}</span><span>{isEditing ? <input value={week.ministerio_parte3_titulo} onChange={e => handleEditChange(weekIndex, 'ministerio_parte3_titulo', e.target.value)} className="w-full bg-yellow-50 p-1 rounded" /> : week.ministerio_parte3_titulo}</span><div className="flex gap-1">{isEditing ? <><ParticipantSelect weekIndex={weekIndex} field="ministerio_parte3_participante1" value={week.ministerio_parte3_participante1} roleKey="esEstudianteVyM" /><ParticipantSelect weekIndex={weekIndex} field="ministerio_parte3_participante2" value={week.ministerio_parte3_participante2} roleKey="esEstudianteVyM" /></> : <>{getPublisherName(week.ministerio_parte3_participante1)} / {getPublisherName(week.ministerio_parte3_participante2)}</>}</div></div>
                                        <div className="grid grid-cols-[50px_1fr] items-center p-2 bg-gray-100"><span className="text-center">{week.hora_cancion_media2}</span><span className="font-semibold">Canción {week.cancion_media2_numero}</span></div>
                                        <div className="p-2 bg-purple-100 font-bold text-purple-800 text-center">NUESTRA VIDA CRISTIANA</div>
                                        <div className="grid grid-cols-[50px_1fr_2fr] items-center p-2"><span className="text-center">{week.hora_vida_parte1}</span><span>{isEditing ? <input value={week.vida_titulo_parte1} onChange={e => handleEditChange(weekIndex, 'vida_titulo_parte1', e.target.value)} className="w-full bg-yellow-50 p-1 rounded" /> : week.vida_titulo_parte1}</span><span>{isEditing ? <ParticipantSelect weekIndex={weekIndex} field="vida_participante1" value={week.vida_participante1} roleKey="esEstudianteVyM" /> : getPublisherName(week.vida_participante1)}</span></div>
                                        <div className="grid grid-cols-[50px_1fr_2fr] items-center p-2"><span className="text-center">{week.hora_estudio_biblico}</span><span>{isEditing ? <input value={week.vida_titulo_parte2} onChange={e => handleEditChange(weekIndex, 'vida_titulo_parte2', e.target.value)} className="w-full bg-yellow-50 p-1 rounded" /> : week.vida_titulo_parte2}</span><div>Cond: {isEditing ? <ParticipantSelect weekIndex={weekIndex} field="vida_participante2_conductor" value={week.vida_participante2_conductor} roleKey="vym_conductor_ebc" /> : getPublisherName(week.vida_participante2_conductor)}<br/>Lector: {isEditing ? <ParticipantSelect weekIndex={weekIndex} field="vida_participante2_lector" value={week.vida_participante2_lector} roleKey="puedeLeerEBC" /> : getPublisherName(week.vida_participante2_lector)}</div></div>
                                        <div className="grid grid-cols-[50px_1fr_2fr] items-center p-2 bg-blue-50 font-semibold"><span className="text-center">{week.hora_conclusion}</span><span>Palabras de conclusión y Canción {week.cancion_final_numero}</span><span className="text-right">Oración: {isEditing ? <ParticipantSelect weekIndex={weekIndex} field="oracionFinal" value={week.oracionFinal} roleKey="vym_oracion" /> : getPublisherName(week.oracionFinal)}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-gray-500 mt-6">No hay programa para este mes. {canConfig && 'Puede generarlo usando IA.'}</p>
                )}
            </div>
        )
    };

    const ConfigView = () => {
        const [assignments, setAssignments] = useState(() =>
            Object.fromEntries(publishers.map(p => [p.id, ALL_VYM_ROLES.reduce((acc, role) => ({ ...acc, [role.key]: p[role.key] || false }), {})]))
        );
        const [isSaving, setIsSaving] = useState(false);
    
        const handleToggle = (pubId: string, roleKey: keyof Publisher) => {
            setAssignments(prev => ({
                ...prev,
                [pubId]: {
                    ...prev[pubId],
                    [roleKey]: !prev[pubId][roleKey]
                }
            }));
        };
    
        const handleSave = async () => {
            setIsSaving(true);
            try {
                const promises = Object.entries(assignments).map(([pubId, roles]) =>
                    onUpdatePublisherVyMAssignments(pubId, roles as { [key: string]: boolean })
                );
                await Promise.all(promises);
                onShowModal({ type: 'success', title: 'Guardado', message: 'Configuración de participantes guardada.' });
            } catch (error) {
                onShowModal({ type: 'error', title: 'Error', message: 'No se pudo guardar la configuración.' });
            } finally {
                setIsSaving(false);
            }
        };
    
        return (
            <div className="mt-6">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10">Publicador</th>
                                {ALL_VYM_ROLES.map(role => (
                                    <th key={role.key as string} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{role.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {publishers.map(pub => (
                                <tr key={pub.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 sticky left-0 bg-white z-10">{pub.Nombre} {pub.Apellido}</td>
                                    {ALL_VYM_ROLES.map(role => (
                                        <td key={role.key as string} className="px-6 py-4 text-center">
                                            <input
                                                type="checkbox"
                                                className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                checked={assignments[pub.id]?.[role.key] || false}
                                                onChange={() => handleToggle(pub.id, role.key)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="text-right mt-6">
                    <button onClick={handleSave} disabled={isSaving} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
                        {isSaving ? 'Guardando...' : 'Guardar Configuración'}
                    </button>
                </div>
            </div>
        );
    };
    
    return (
        <div className="container mx-auto max-w-7xl">
            <style>{`
                .pdf-export-mode {
                    width: 7.5in;
                    color: #000;
                    background-color: #fff;
                }
                .pdf-export-mode h2 {
                    font-size: 13pt !important;
                    font-weight: bold !important;
                }
                .pdf-export-mode h3 {
                    font-size: 12pt !important;
                    font-weight: bold !important;
                }
                .pdf-export-mode, .pdf-export-mode div, .pdf-export-mode span, .pdf-export-mode p, .pdf-export-mode strong {
                    font-size: 11pt !important;
                }
                .pdf-export-mode button, .pdf-export-mode input, .pdf-export-mode select, .pdf-export-mode textarea {
                    display: none !important;
                }
                .pdf-export-mode .vym-pdf-week {
                    display: block !important;
                    page-break-inside: avoid;
                    margin-bottom: 10px;
                }
                .pdf-export-mode .bg-blue-600 { background-color: #2563eb !important; color: white !important; }
                .pdf-export-mode .bg-yellow-100 { background-color: #fef9c3 !important; }
                .pdf-export-mode .text-yellow-800 { color: #854d0e !important; }
                .pdf-export-mode .bg-red-100 { background-color: #fee2e2 !important; }
                .pdf-export-mode .text-red-800 { color: #991b1b !important; }
                .pdf-export-mode .bg-purple-100 { background-color: #f3e8ff !important; }
                .pdf-export-mode .text-purple-800 { color: #6b21a8 !important; }
                .pdf-export-mode .bg-blue-50 { background-color: #eff6ff !important; }
                .pdf-export-mode .bg-gray-100 { background-color: #f3f4f6 !important; }
                .pdf-export-mode * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            `}</style>
            <div className="bg-white p-6 rounded-lg shadow-md">
                 <h1 className="text-3xl font-bold text-gray-800 text-center mb-6">Vida y Ministerio Cristianos</h1>
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
                        <button onClick={() => setActiveTab('schedule')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'schedule' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300'}`}>Programa</button>
                        {canConfig && <button onClick={() => setActiveTab('config')} className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'config' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300'}`}>Configuración</button>}
                    </nav>
                </div>
                
                {activeTab === 'schedule' ? <ScheduleView /> : <ConfigView />}

            </div>
        </div>
    );
};

export default VidaYMinisterio;
