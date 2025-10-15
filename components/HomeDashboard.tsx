import React, { useState, useMemo, useRef, useCallback } from 'react';
// FIX: Import `PublicTalkAssignment` to resolve 'Cannot find name' error.
import { Publisher, MeetingAssignmentSchedule, LMMeetingSchedule, PublicTalksSchedule, ModalInfo, View, MONTHS, PublicTalkAssignment } from '../App';
import ShareModal from './ShareModal';
import { DISCURSOS_PUBLICOS } from './discursos';

declare const jspdf: any;
declare const html2canvas: any;

interface HomeDashboardProps {
    lmSchedules: LMMeetingSchedule[];
    schedules: MeetingAssignmentSchedule[];
    publicTalksSchedule: PublicTalksSchedule;
    publishers: Publisher[];
    onShowModal: (info: ModalInfo) => void;
    setActiveView: (view: View) => void;
}

const findLatestSchedule = <T extends { year: number; month: string }>(schedules: T[]): T | undefined => {
    const now = new Date();
    const currentMonth = MONTHS[now.getMonth()];
    const currentYear = now.getFullYear();
    const nextMonthDate = new Date(now.setMonth(now.getMonth() + 1));
    const nextMonth = MONTHS[nextMonthDate.getMonth()];
    const nextMonthYear = nextMonthDate.getFullYear();

    const currentMonthSchedule = schedules.find(s => s.year === currentYear && s.month === currentMonth);
    if (currentMonthSchedule) return currentMonthSchedule;

    const nextMonthSchedule = schedules.find(s => s.year === nextMonthYear && s.month === nextMonth);
    return nextMonthSchedule;
};


const HomeDashboard: React.FC<HomeDashboardProps> = ({ lmSchedules, schedules, publicTalksSchedule, publishers, onShowModal, setActiveView }) => {
    
    const latestLmSchedule = useMemo(() => findLatestSchedule(lmSchedules), [lmSchedules]);
    const latestAuxSchedule = useMemo(() => findLatestSchedule(schedules), [schedules]);
    
    const getPublisherName = useCallback((id: string | null | undefined): string => {
        if (!id) return '';
        const pub = publishers.find(p => p.id === id);
        return pub ? [pub.Nombre, pub.Apellido].filter(Boolean).join(' ') : 'N/A';
    }, [publishers]);

    const handleShowNotAvailableModal = (programName: string) => {
        onShowModal({
            type: 'info',
            title: 'Programa no Disponible',
            message: `El programa para "${programName}" de este mes o el próximo aún no ha sido generado. Por favor, consulte más tarde.`
        });
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Panel de Inicio</h1>
            
            <VymScheduleCard
                schedule={latestLmSchedule}
                getPublisherName={getPublisherName}
                onShowNotAvailable={() => handleShowNotAvailableModal('Vida y Ministerio')}
            />

            <AuxServicesScheduleCard
                schedule={latestAuxSchedule}
                getPublisherName={getPublisherName}
                onShowNotAvailable={() => handleShowNotAvailableModal('Servicios Auxiliares')}
            />

            <PublicTalksScheduleCard 
                schedule={publicTalksSchedule}
                onShowNotAvailable={() => handleShowNotAvailableModal('Reunión Pública')}
                onShowModal={onShowModal}
            />
            
            <div className="p-6 bg-white rounded-2xl shadow-lg border-t-4 border-gray-500">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Otros Accesos</h2>
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    <button onClick={() => setActiveView('informeServicio')} className="p-3 bg-gray-100 rounded-lg text-center font-semibold text-gray-700 hover:bg-gray-200 transition-colors">Informar Servicio</button>
                    <button onClick={() => setActiveView('territorios')} className="p-3 bg-gray-100 rounded-lg text-center font-semibold text-gray-700 hover:bg-gray-200 transition-colors">Territorios</button>
                    <button onClick={() => setActiveView('dashboardCursos')} className="p-3 bg-gray-100 rounded-lg text-center font-semibold text-gray-700 hover:bg-gray-200 transition-colors">Dashboard Cursos</button>
                 </div>
            </div>
        </div>
    );
};

// ... Internal components (VymScheduleCard, AuxServicesScheduleCard, PublicTalksScheduleCard) ...
// NOTE: These components will be defined below inside this same file.

const VymScheduleCard: React.FC<{
    schedule: LMMeetingSchedule | undefined;
    getPublisherName: (id: string | null | undefined) => string;
    onShowNotAvailable: () => void;
}> = ({ schedule, getPublisherName, onShowNotAvailable }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [shareModalContent, setShareModalContent] = useState<{ title: string; text: string; } | null>(null);

    const handleShare = () => {
        if (!schedule) { onShowNotAvailable(); return; }
        // Generate text content for WhatsApp
        let text = `*Programa Vida y Ministerio - ${schedule.month} ${schedule.year}*\n\n`;
        schedule.weeks.forEach(week => {
            text += `*${week.fecha}*\n`;
            text += `Presidente: ${getPublisherName(week.presidente)}\n\n`;
        });
        setShareModalContent({ title: 'Compartir Programa V&M', text });
    };

    return (
         <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-blue-500">
            {shareModalContent && <ShareModal title={shareModalContent.title} textContent={shareModalContent.text} onClose={() => setShareModalContent(null)} />}
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800">Vida y Ministerio</h2>
                <div className="flex gap-2">
                    <button onClick={handleShare} className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">Compartir</button>
                </div>
            </div>
            {schedule ? (
                <div ref={contentRef} className="overflow-x-auto">
                    <h3 className="text-center font-bold mb-2 text-lg">{schedule.month} {schedule.year}</h3>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-2">Semana</th>
                                <th className="p-2">Presidente</th>
                                <th className="p-2">Oración</th>
                                <th className="p-2">Tesoros</th>
                                <th className="p-2">Perlas</th>
                                <th className="p-2">Lectura</th>
                                <th className="p-2">Estudio Bíblico</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schedule.weeks.map((week, index) => (
                                <tr key={index} className="border-b">
                                    <td className="p-2 font-semibold">{week.fecha}</td>
                                    <td className="p-2">{getPublisherName(week.presidente)}</td>
                                    <td className="p-2">{getPublisherName(week.oracionInicial)}</td>
                                    <td className="p-2">{getPublisherName(week.tesoros_discurso)}</td>
                                    <td className="p-2">{getPublisherName(week.tesoros_perlas)}</td>
                                    <td className="p-2">{getPublisherName(week.tesoros_lectura)}</td>
                                    <td className="p-2">Cond: {getPublisherName(week.vida_participante2_conductor)}<br/>Lector: {getPublisherName(week.vida_participante2_lector)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-center text-gray-500 py-4">Programa no disponible. Clic en "Compartir" para ver el mensaje.</p>
            )}
        </div>
    );
};

const AuxServicesScheduleCard: React.FC<{
    schedule: MeetingAssignmentSchedule | undefined;
    getPublisherName: (id: string | null | undefined) => string;
    onShowNotAvailable: () => void;
}> = ({ schedule, getPublisherName, onShowNotAvailable }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [shareModalContent, setShareModalContent] = useState<{ title: string; text: string; } | null>(null);
    
    const handleShare = () => {
        if (!schedule) { onShowNotAvailable(); return; }
        let text = `*Programa de Servicios Auxiliares - ${schedule.month} ${schedule.year}*\n\n`;
        Object.values(schedule.schedule).forEach(day => {
            text += `*${day.fechaReunion}*\n`;
            text += `Aseo: Grupo ${day.aseo}\n`;
            if (day.hospitalidad) text += `Hospitalidad: Grupo ${day.hospitalidad}\n`;
            text += '\n';
        });
         setShareModalContent({ title: 'Compartir Servicios Auxiliares', text });
    };

    return (
         <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-green-500">
            {shareModalContent && <ShareModal title={shareModalContent.title} textContent={shareModalContent.text} onClose={() => setShareModalContent(null)} />}
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800">Servicios de Reunión</h2>
                 <div className="flex gap-2">
                    <button onClick={handleShare} className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200">Compartir</button>
                </div>
            </div>
            {schedule ? (
                <div ref={contentRef} className="overflow-x-auto">
                     <h3 className="text-center font-bold mb-2 text-lg">{schedule.month} {schedule.year}</h3>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-2">Fecha</th>
                                <th className="p-2">Acomodadores</th>
                                <th className="p-2">Micrófonos</th>
                                <th className="p-2">Vigilancia</th>
                                <th className="p-2">Aseo</th>
                                <th className="p-2">Hospitalidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.values(schedule.schedule).sort((a,b) => (a.fechaReunion || "").localeCompare(b.fechaReunion || "")).map((day, index) => (
                                <tr key={index} className="border-b">
                                    <td className="p-2 font-semibold">{day.fechaReunion}</td>
                                    <td className="p-2 whitespace-pre-wrap">{[...(day.acomodadoresPrincipal || []), ...(day.acomodadoresAuditorio || []), ...(day.acomodadoresSala || [])].map(getPublisherName).join(', ')}</td>
                                    <td className="p-2">{day.microfonos?.map(getPublisherName).join(', ')}</td>
                                    <td className="p-2">{day.vigilantes?.map(getPublisherName).join(', ')}</td>
                                    <td className="p-2">Grupo {day.aseo}</td>
                                    <td className="p-2">{day.hospitalidad ? `Grupo ${day.hospitalidad}` : 'N/A'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                 <p className="text-center text-gray-500 py-4">Programa no disponible.</p>
            )}
        </div>
    );
};

const PublicTalksScheduleCard: React.FC<{
    schedule: PublicTalksSchedule;
    onShowNotAvailable: () => void;
    onShowModal: (info: ModalInfo) => void;
}> = ({ schedule, onShowNotAvailable, onShowModal }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [shareModalContent, setShareModalContent] = useState<{ title: string; text: string; } | null>(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
    
    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i), []);

    const talksByDate = useMemo(() => {
        const map = new Map<string, { talkNumber: number } & PublicTalkAssignment>();
        Object.entries(schedule).forEach(([talkNumStr, assignments]) => {
            if (Array.isArray(assignments)) {
                const talkNumber = parseInt(talkNumStr, 10);
                if (isNaN(talkNumber)) return;

                assignments.forEach(assignment => {
                    if (assignment && assignment.date) {
                        map.set(assignment.date, { talkNumber, ...assignment });
                    }
                });
            }
        });
        return map;
    }, [schedule]);

    const monthlyScheduleData = useMemo(() => {
        const year = selectedYear;
        const monthIndex = MONTHS.indexOf(selectedMonth);
        const dates: ({ date: string, talk: ({ talkNumber: number } & PublicTalkAssignment) | null })[] = [];
        
        const d = new Date(year, monthIndex, 1);
        while (d.getMonth() === monthIndex) {
            if (d.getDay() === 6) { // 6 is Saturday
                const dateStr = d.toISOString().split('T')[0];
                const talk = talksByDate.get(dateStr) || null;
                dates.push({ date: dateStr, talk });
            }
            d.setDate(d.getDate() + 1);
        }
        return dates;
    }, [selectedYear, selectedMonth, talksByDate]);

    const handleShare = () => {
        if (monthlyScheduleData.length === 0 || monthlyScheduleData.every(d => !d.talk)) { 
            onShowNotAvailable(); 
            return; 
        }
        let text = `*Programa de Discursos Públicos - ${selectedMonth} ${selectedYear}*\n\n`;
        monthlyScheduleData.forEach(({ date, talk }) => {
            if (talk) {
                const talkInfo = DISCURSOS_PUBLICOS.find(t => t.number === talk.talkNumber);
                text += `*${date}*\n`;
                text += `Discurso: ${talk.talkNumber}. ${talkInfo?.title}\n`;
                text += `Orador: ${talk.speakerName}\n`;
                text += `Canción: ${talk.song}\n\n`;
            }
        });
        setShareModalContent({ title: 'Compartir Discursos Públicos', text });
    };

    const handleExportPdf = () => {
        if (!contentRef.current || monthlyScheduleData.length === 0 || monthlyScheduleData.every(d => !d.talk)) {
            onShowNotAvailable();
            return;
        }

        const content = contentRef.current;
        onShowModal({ type: 'info', title: 'Generando PDF', message: 'Por favor, espere...' });
        
        html2canvas(content, { scale: 2 }).then(canvas => {
            // @ts-ignore
            const { jsPDF } = jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const ratio = canvas.width / canvas.height;
            let width = pdfWidth - 20;
            let height = width / ratio;

            if (height > pdfHeight - 20) {
                height = pdfHeight - 20;
                width = height * ratio;
            }
            
            const x = (pdfWidth - width) / 2;
            const y = 10;

            pdf.addImage(imgData, 'PNG', x, y, width, height);
            pdf.save(`Discursos_Publicos_${selectedMonth}_${selectedYear}.pdf`);
            onShowModal({ type: 'success', title: 'Éxito', message: 'PDF generado.' });
        }).catch(err => {
            onShowModal({ type: 'error', title: 'Error', message: `No se pudo generar el PDF: ${err.message}` });
        });
    };
    
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-purple-500">
            {shareModalContent && <ShareModal title={shareModalContent.title} textContent={shareModalContent.text} onClose={() => setShareModalContent(null)} />}
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800">Reunión Pública</h2>
                 <div className="flex gap-2">
                    <button onClick={handleExportPdf} className="text-sm px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200">PDF</button>
                    <button onClick={handleShare} className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200">Compartir</button>
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-md">
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="p-2 border rounded-md">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            {monthlyScheduleData.length > 0 && monthlyScheduleData.some(d => d.talk) ? (
                 <div ref={contentRef} className="overflow-x-auto p-4 bg-gray-50 rounded-lg">
                    <h3 className="text-center font-bold text-lg mb-2 text-gray-800">Programa de Discursos Públicos</h3>
                    <h4 className="text-center font-semibold mb-4 text-gray-600">{selectedMonth} {selectedYear}</h4>
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-200">
                            <tr>
                                <th className="p-2">Fecha</th>
                                <th className="p-2">Núm.</th>
                                <th className="p-2">Título del Discurso</th>
                                <th className="p-2">Orador</th>
                                <th className="p-2">Canción</th>
                            </tr>
                        </thead>
                         <tbody>
                            {monthlyScheduleData.map(({ date, talk }, index) => {
                                if (!talk) return null;
                                const talkInfo = DISCURSOS_PUBLICOS.find(t => t.number === talk.talkNumber);
                                return (
                                <tr key={index} className="border-b">
                                    <td className="p-2 font-semibold whitespace-nowrap">{date}</td>
                                    <td className="p-2 text-center">{talk.talkNumber}</td>
                                    <td className="p-2">{talkInfo?.title}</td>
                                    <td className="p-2 whitespace-nowrap">{talk.speakerName}</td>
                                    <td className="p-2 text-center">{talk.song}</td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-center text-gray-500 py-4">No hay discursos públicos programados para el mes seleccionado.</p>
            )}
        </div>
    );
};

export default HomeDashboard;