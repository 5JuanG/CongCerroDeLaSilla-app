import React, { useState, useMemo, useRef, useCallback } from 'react';
import { MeetingAssignmentSchedule, Publisher, ModalInfo, DayAssignment } from '../App';

declare const jspdf: any;
declare const html2canvas: any;

interface ProgramaServiciosAuxiliaresProps {
    schedules: MeetingAssignmentSchedule[];
    publishers: Publisher[];
    onShowModal: (info: ModalInfo) => void;
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const ProgramaServiciosAuxiliares: React.FC<ProgramaServiciosAuxiliaresProps> = ({ schedules, publishers, onShowModal }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
    const pdfContentRef = useRef<HTMLDivElement>(null);

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i), []);

    const getPublisherName = useCallback((id: string | null | undefined): string => {
        if (!id) return '';
        const pub = publishers.find(p => p.id === id);
        return pub ? [pub.Nombre, pub.Apellido].filter(Boolean).join(' ') : 'No encontrado';
    }, [publishers]);

    const displayData = useMemo(() => {
        const scheduleForMonth = schedules.find(s => s.year === selectedYear && s.month === selectedMonth && s.isPublic);

        if (!scheduleForMonth?.schedule) return [];

        const saturdayMeetings = Object.entries(scheduleForMonth.schedule)
            .filter(([key]) => key.startsWith('saturday'))
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

        return saturdayMeetings.map(([dateKey, assignmentUntyped]) => {
            // FIX: Cast assignment to DayAssignment to access its properties.
            const assignment = assignmentUntyped as DayAssignment;
            const satDate = new Date(dateKey.substring(dateKey.indexOf('-') + 1) + 'T00:00:00');
            const tueDate = new Date(satDate);
            tueDate.setDate(satDate.getDate() - 4);
            const sunDate = new Date(satDate);
            sunDate.setDate(satDate.getDate() + 1);

            const getAssignmentsWithRole = (roleKey: keyof DayAssignment, roleAbbr: string) => {
                const ids = (assignment as any)[roleKey] as string[] | undefined;
                return (ids || []).map(id => ({ name: getPublisherName(id), role: roleAbbr }));
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
                presidente: getPublisherName(assignment.presidente),
                lectorAtalaya: getPublisherName(assignment.lectorAtalaya),
                acomodadoresYMicrofonos,
                aseo: assignment.aseo ? `Aseo: Grupo ${assignment.aseo}` : '',
                hospitalidad: assignment.hospitalidad ? `Hospitalidad: Grupo ${assignment.hospitalidad}` : '',
            };
        });

    }, [selectedYear, selectedMonth, schedules, getPublisherName]);
    
    const handleExportPdf = () => {
        const content = pdfContentRef.current;
        if (!content || displayData.length === 0) {
            onShowModal({ type: 'error', title: 'Error', message: 'No hay programa para exportar.' });
            return;
        }

        onShowModal({ type: 'info', title: 'Generando PDF', message: 'Por favor, espere un momento...' });

        // Temporarily apply styles for PDF generation
        content.classList.add('pdf-export');

        html2canvas(content, {
            scale: 2,
            useCORS: true,
            onclone: (document) => {
                const titleElement = document.querySelector('.pdf-title-export') as HTMLElement;
                if(titleElement) titleElement.style.display = 'block';
                const legendElement = document.querySelector('.pdf-legend-export') as HTMLElement;
                if(legendElement) legendElement.style.display = 'flex';
            }
        }).then(canvas => {
            // @ts-ignore
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
            
            pdf.setFontSize(14);
            pdf.text("PROGRAMA DE ACOMODADORES, LECTORES, HOSPITALIDAD Y ASEO CONG CERRO DE LA SILLA-GPE.", pdf.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

            pdf.setFontSize(12);

            const imgData = canvas.toDataURL('image/png');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const ratio = canvas.width / canvas.height;
            let width = pdfWidth - 20; // with margin
            let height = width / ratio;

            if (height > pdfHeight - 40) { // leave space for title and margins
                height = pdfHeight - 40;
                width = height * ratio;
            }

            const x = (pdfWidth - width) / 2;
            const y = 25;

            pdf.addImage(imgData, 'PNG', x, y, width, height);
            pdf.save(`Programa_Acomodadores_${selectedMonth}_${selectedYear}.pdf`);
            onShowModal({ type: 'success', title: 'Éxito', message: 'PDF generado correctamente.' });
        }).catch(err => {
            onShowModal({ type: 'error', title: 'Error al Exportar', message: `No se pudo generar el PDF: ${(err as Error).message}` });
        }).finally(() => {
            content.classList.remove('pdf-export');
        });
    };


    return (
        <div className="bg-gray-100 p-4 sm:p-6 rounded-lg">
             <style>{`
                .pdf-export table {
                    font-size: 12pt;
                }
                .pdf-export {
                    background-color: white !important;
                    padding: 0 !important;
                    color: black !important;
                }
                .pdf-export .pdf-title-export {
                    display: none !important;
                }
                .pdf-export .table-header-export {
                    background-color: #1A237E !important; /* Dark blue */
                    color: white !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                 .pdf-export .date-cell-export {
                    background-color: #3F51B5 !important; /* Lighter Blue */
                    color: white !important;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .pdf-export .buttons-container-export {
                    display: none !important;
                }
                .pdf-export td, .pdf-export th {
                    border-color: #9E9E9E !important; /* Gray border for PDF */
                }
                .pdf-export .pdf-legend-export {
                    display: none; /* Let the main legend be captured */
                }
            `}</style>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <div className="buttons-container-export flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <h1 className="text-xl font-bold text-gray-800 text-center md:text-left">Visualizador del Programa de Servicios Auxiliares</h1>
                    <div className="flex flex-wrap justify-center gap-2">
                        <button onClick={handleExportPdf} disabled={displayData.length === 0} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                            Exportar a PDF
                        </button>
                    </div>
                </div>
                <div className="buttons-container-export grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="p-2 border rounded-md">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-md">
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800 flex flex-wrap justify-center gap-x-4 gap-y-1">
                    <span className="font-semibold">Leyenda:</span>
                    <span><strong>(AP)</strong>: Acomodador Puerta Principal</span>
                    <span><strong>(APA)</strong>: Acomodador Puerta Auditorio</span>
                    <span><strong>(AA)</strong>: Acomodador de Asistentes (Sala)</span>
                    <span><strong>(AM)</strong>: Micrófonos</span>
                    <span><strong>(V)</strong>: Vigilantes</span>
                </div>
                
                {displayData.length > 0 ? (
                    <div ref={pdfContentRef}>
                        {/* --- Mobile Card View --- */}
                        <div className="md:hidden space-y-4">
                            {displayData.map((week, index) => (
                                <div key={index} className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
                                    <div className="bg-blue-800 text-white font-bold p-3 rounded-t-lg -m-4 mb-4">
                                        <p className="whitespace-pre-line text-center">{week.weekDateRange}</p>
                                    </div>
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between"><span className="font-semibold text-gray-600">Presidente:</span> <span className="text-right">{week.presidente}</span></div>
                                        <div className="flex justify-between"><span className="font-semibold text-gray-600">Lector Atalaya:</span> <span className="text-right">{week.lectorAtalaya}</span></div>
                                        <div>
                                            <p className="font-semibold text-gray-600 mb-1">Acomodadores, Micrófonos y Vigilantes:</p>
                                            <div className="pl-4 text-gray-800">
                                                {week.acomodadoresYMicrofonos.map((item, idx) => <p key={idx}>{item.name} ({item.role})</p>)}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-600 mb-1">Aseo y Hospitalidad:</p>
                                            <div className="pl-4 text-gray-800">
                                                <p>{week.aseo}</p>
                                                <p>{week.hospitalidad}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* --- Desktop Table View (for display and PDF export) --- */}
                        <div className="hidden md:block">
                            <div className="pdf-title-export hidden text-center mb-4">
                                PROGRAMA DE ACOMODADORES, LECTORES, HOSPITALIDAD Y ASEO CONG CERRO DE LA SILLA-GPE.
                            </div>
                            <table className="w-full border-collapse min-w-[1000px] text-sm">
                                <thead className="text-white table-header-export" style={{ backgroundColor: '#1A237E' }}>
                                    <tr>
                                        <th className="p-2 border-2 border-white w-1/5"></th>
                                        <th className="p-2 border-2 border-white">Presidente Reunión fin de semana</th>
                                        <th className="p-2 border-2 border-white">Acomodadores, micrófonos y vigilantes (ambos días)</th>
                                        <th className="p-2 border-2 border-white">Lector de La Atalaya</th>
                                        <th className="p-2 border-2 border-white">Aseo Y Hospitalidad</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayData.map((week, index) => (
                                        <tr key={index} className="align-top">
                                            <td className="p-3 border-2 border-gray-300 font-bold text-white whitespace-pre-line text-center date-cell-export" style={{ backgroundColor: '#3F51B5' }}>{week.weekDateRange}</td>
                                            <td className="p-3 border-2 border-gray-300 text-center">{week.presidente}</td>
                                            <td className="p-3 border-2 border-gray-300">
                                                {week.acomodadoresYMicrofonos.map((item, idx) => (
                                                    <p key={idx}>{item.name} ({item.role})</p>
                                                ))}
                                            </td>
                                            <td className="p-3 border-2 border-gray-300 text-center">{week.lectorAtalaya}</td>
                                            <td className="p-3 border-2 border-gray-300 text-center whitespace-pre-line">
                                                {week.aseo ? <div>{week.aseo}</div> : null}
                                                {week.hospitalidad ? <div>{week.hospitalidad}</div> : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="pdf-legend-export hidden">
                                <span className="font-bold">Leyenda:</span>
                                <span><strong>(AP)</strong>: Acomodador Puerta Principal</span>
                                <span><strong>(APA)</strong>: Acomodador Puerta Auditorio</span>
                                <span><strong>(AA)</strong>: Acomodador de Asistentes (Sala)</span>
                                <span><strong>(AM)</strong>: Micrófonos</span>
                                <span><strong>(V)</strong>: Vigilantes</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                        <p>El programa para {selectedMonth} de {selectedYear} no ha sido publicado o no existe.</p>
                        <p className="mt-2 text-xs">Si usted es el administrador, por favor genere el programa y márquelo como "Público".</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgramaServiciosAuxiliares;
