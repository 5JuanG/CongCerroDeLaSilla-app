import React, { useState, useMemo, useRef, useCallback } from 'react';
import { MeetingAssignmentSchedule, Publisher, ModalInfo, DayAssignment, MeetingConfig } from '../types';
import { MONTHS } from '../constants';

declare const jspdf: any;
declare const html2canvas: any;

interface ProgramaServiciosAuxiliaresProps {
    schedules: MeetingAssignmentSchedule[];
    publishers: Publisher[];
    onShowModal: (info: ModalInfo) => void;
    meetingConfig: MeetingConfig;
}


const ProgramaServiciosAuxiliares: React.FC<ProgramaServiciosAuxiliaresProps> = ({ schedules, publishers, onShowModal, meetingConfig }) => {
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

        if (!scheduleForMonth?.schedule || !meetingConfig) return [];

        // Get all assignments (both midweek and weekend)
        const allAssignments = Object.entries(scheduleForMonth.schedule)
            .sort(([keyA], [keyB]) => {
                // Extract dates from keys (e.g., 'weekend-2025-07-12', 'midweek-2025-07-08')
                const dateA = new Date(keyA.substring(keyA.indexOf('-') + 1));
                const dateB = new Date(keyB.substring(keyB.indexOf('-') + 1));
                return dateA.getTime() - dateB.getTime();
            });

        return allAssignments.map(([key, assignmentUntyped]) => {
            const assignment = assignmentUntyped as DayAssignment;
            const dateStr = key.substring(key.indexOf('-') + 1); // YYYY-MM-DD
            // Create date object treating it as local date (append T00:00:00 to avoid UTC shifts)
            const meetDate = new Date(dateStr + 'T00:00:00');

            const isWeekend = key.startsWith('weekend');
            const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
            const dayName = dayNames[meetDate.getDay()];
            const formattedDate = `${dayName.toUpperCase()}\n${meetDate.getDate()} DE ${MONTHS[meetDate.getMonth()].toUpperCase()} ${meetDate.getFullYear()}`;

            const getAssignmentsWithRole = (roleKey: keyof DayAssignment, roleAbbr: string) => {
                const ids = (assignment as any)[roleKey] as (string | null)[] | undefined;
                return (ids || []).map(id => ({ name: getPublisherName(id), role: roleAbbr }));
            };

            const acomodadores = [
                ...getAssignmentsWithRole('acomodadoresPrincipal', 'AP'),
                ...getAssignmentsWithRole('acomodadoresAuditorio', 'AA'),
                ...getAssignmentsWithRole('acomodadoresSala', 'AA'), // Using AA for both for simplicity as per image reference usually merges them
            ];

            const microfonos = getAssignmentsWithRole('microfonos', '');

            const vigilancia = getAssignmentsWithRole('vigilantes', '');

            return {
                date: formattedDate,
                isWeekend,
                presidente: isWeekend ? getPublisherName(assignment.presidente) : '', // 'PRESIDIR LOS SÁBADOS'
                microfonos,
                acomodadores,
                lector: isWeekend ? getPublisherName(assignment.lectorAtalaya) : '', // 'LECTOR DE LA ATALAYA'
                vigilancia,
                aseo: assignment.aseo ? `GRUPO ${assignment.aseo}` : '',
                hospitalidad: assignment.hospitalidad ? `GRUPO ${assignment.hospitalidad}` : '',
            };
        });

    }, [selectedYear, selectedMonth, schedules, getPublisherName, meetingConfig]);

    const handleExportPdf = () => {
        const content = pdfContentRef.current;
        if (!content || displayData.length === 0) {
            onShowModal({ type: 'error', title: 'Error', message: 'No hay programa para exportar.' });
            return;
        }

        onShowModal({ type: 'info', title: 'Generando PDF', message: 'Por favor, espere un momento...' });

        content.classList.add('pdf-export');

        html2canvas(content, {
            scale: 2,
            useCORS: true,
            windowWidth: 1600, // Ensure wide enough capture
        }).then(canvas => {
            // @ts-ignore
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' }); // Landscape matches the wide table better

            const imgData = canvas.toDataURL('image/png');
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pageWidth = pdf.internal.pageSize.getWidth();

            const margin = 10;
            const topMargin = 10;

            const imgWidth = pageWidth - margin * 2;
            const imgHeight = canvas.height * imgWidth / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', margin, topMargin, imgWidth, imgHeight);

            // Handle multi-page if needed (though usually fits in one if landscape)
            if (imgHeight > pageHeight - margin * 2) {
                heightLeft -= (pageHeight - topMargin - margin);
                while (heightLeft > 0) {
                    position -= (pageHeight - margin * 2);
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
                    heightLeft -= (pageHeight - margin * 2);
                }
            }

            pdf.save(`Programa_Acomodadores_${selectedMonth}_${selectedYear}.pdf`);
            onShowModal({ type: 'success', title: 'Éxito', message: 'PDF generado correctamente.' });
        }).catch(err => {
            console.error(err);
            onShowModal({ type: 'error', title: 'Error al Exportar', message: `No se pudo generar el PDF: ${(err as Error).message}` });
        }).finally(() => {
            content.classList.remove('pdf-export');
        });
    };


    return (
        <div className="bg-gray-100 p-4 sm:p-6 rounded-lg">
            <style>{`
                .pdf-export table {
                    font-size: 9pt; /* Smaller font for PDF fit */
                    width: 100% !important;
                    border-collapse: collapse;
                }
                .pdf-export {
                    background-color: white !important;
                    padding: 20px !important;
                    color: black !important;
                    width: 1500px; /* Fixed width for better canvas capture */
                }
                .pdf-export .pdf-title-export {
                    display: block !important;
                    background-color: #0d4a75; /* Dark blue header */
                    color: white;
                    padding: 10px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 16pt;
                    margin-bottom: 20px;
                    border-radius: 4px;
                }
                .pdf-export .table-header-export {
                    background-color: #0d4a75 !important;
                    color: white !important;
                    font-weight: bold;
                    text-transform: uppercase;
                    font-size: 8pt;
                    height: 50px;
                    vertical-align: middle;
                }
                .pdf-export .table-header-export th {
                     border: 1px solid #0d4a75;
                }
                .pdf-export .date-cell-export {
                    background-color: #0d4a75 !important;
                    color: white !important;
                    font-weight: bold;
                    width: 150px;
                }
                .pdf-export .buttons-container-export {
                    display: none !important;
                }
                .pdf-export td {
                    border: 1px solid #b0c4de !important; /* Light blue border */
                    padding: 8px;
                    vertical-align: middle;
                    background-color: #eaf2f8; /* Very light blue background for rows */
                }
                .pdf-export tr:nth-child(even) td:not(.date-cell-export) {
                    background-color: #ffffff; /* Alternating white */
                }
                 .pdf-export tr td {
                    color: #000;
                    font-weight: 600;
                 }
                 .pdf-export .role-subtext {
                    font-size: 7pt;
                    color: #555;
                    font-weight: normal;
                 }
                 /* Hide mobile view when exporting */
                 .pdf-export .mobile-view {
                    display: none !important;
                 }
                 .pdf-export .desktop-view {
                    display: block !important;
                 }
            `}</style>
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                <div className="buttons-container-export flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                    <h1 className="text-xl font-bold text-gray-800 text-center md:text-left">Visualizador del Programa de Acomodadores</h1>
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

                {displayData.length > 0 ? (
                    <div ref={pdfContentRef}>
                        <div className="pdf-title-export hidden">
                            PROGRAMA DE ACOMODADORES, MICROFONOS, VIGILANCIA, HOSPITALIDAD Y ASEO
                        </div>

                        {/* --- Mobile Card View --- */}
                        <div className="md:hidden space-y-4 mobile-view">
                            {displayData.map((day, index) => (
                                <div key={index} className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
                                    <div className="bg-blue-800 text-white font-bold p-3 rounded-t-lg -m-4 mb-4">
                                        <p className="whitespace-pre-line text-center">{day.date}</p>
                                    </div>
                                    <div className="space-y-3 text-sm">
                                        {day.isWeekend && <div className="flex justify-between border-b pb-2"><span className="font-semibold text-gray-600">Preside:</span> <span className="text-right font-bold">{day.presidente}</span></div>}
                                        <div className="flex justify-between border-b pb-2"><span className="font-semibold text-gray-600">Micrófonos:</span>
                                            <div className="text-right">
                                                {day.microfonos.map((m, i) => <div key={i}>{m.name}</div>)}
                                            </div>
                                        </div>
                                        <div className="border-b pb-2">
                                            <p className="font-semibold text-gray-600 mb-1">Acomodadores:</p>
                                            <div className="pl-4 text-gray-800">
                                                {day.acomodadores.map((item, idx) => <p key={idx}>{item.name} <span className="text-xs text-gray-500">({item.role})</span></p>)}
                                            </div>
                                        </div>
                                        {day.isWeekend && <div className="flex justify-between border-b pb-2"><span className="font-semibold text-gray-600">Lector Atalaya:</span> <span className="text-right font-bold">{day.lector}</span></div>}
                                        <div className="border-b pb-2">
                                            <p className="font-semibold text-gray-600 mb-1">Vigilancia:</p>
                                            <div className="pl-4 text-gray-800">
                                                {day.vigilancia.map((m, i) => <div key={i}>{m.name}</div>)}
                                            </div>
                                        </div>
                                        <div className="flex justify-between pt-2">
                                            <span className="font-semibold text-gray-600">Aseo:</span>
                                            <span className="text-right">{day.aseo}</span>
                                        </div>
                                        {day.hospitalidad && <div className="flex justify-between pt-2">
                                            <span className="font-semibold text-gray-600">Hospitalidad:</span>
                                            <span className="text-right">{day.hospitalidad}</span>
                                        </div>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* --- Desktop/PDF Table View --- */}
                        <div className="hidden md:block overflow-x-auto desktop-view">
                            <table className="w-full border-collapse text-sm text-center">
                                <thead className="text-white table-header-export" style={{ backgroundColor: '#0d4a75' }}>
                                    <tr>
                                        <th className="p-2 border min-w-[120px]"></th>
                                        <th className="p-2 border w-[15%]">PRESIDIR LOS SÁBADOS</th>
                                        <th className="p-2 border w-[15%]">MICROFONOS</th>
                                        <th className="p-2 border w-[20%]">ACOMODADORES</th>
                                        <th className="p-2 border w-[15%]">LECTOR DE LA ATALAYA</th>
                                        <th className="p-2 border w-[15%]">VIGILANCIA</th>
                                        <th className="p-2 border w-[10%]">ASEO</th>
                                        <th className="p-2 border w-[10%]">HOSPITALIDAD</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayData.map((day, index) => (
                                        <tr key={index} className="align-middle">
                                            <td className="p-2 border font-bold text-white whitespace-pre-line text-center date-cell-export rounded-l-md" style={{ backgroundColor: '#0d4a75' }}>
                                                {day.date}
                                            </td>
                                            <td className="p-2 border font-bold text-gray-800 uppercase">
                                                {day.presidente}
                                            </td>
                                            <td className="p-2 border text-gray-800">
                                                {day.microfonos.map((item, idx) => (
                                                    <div key={idx} className="uppercase font-bold">{item.name}</div>
                                                ))}
                                            </td>
                                            <td className="p-2 border text-left pl-4">
                                                {day.acomodadores.map((item, idx) => (
                                                    <div key={idx} className="uppercase font-bold mb-1">
                                                        {item.role === 'AP' ? 'AP ' : item.role === 'AA' ? 'AA ' : item.role === 'APA' ? 'AA ' : ''}
                                                        {item.name}
                                                    </div>
                                                ))}
                                            </td>
                                            <td className="p-2 border font-bold text-gray-800 uppercase">
                                                {day.lector}
                                            </td>
                                            <td className="p-2 border text-gray-800">
                                                {day.vigilancia.map((item, idx) => (
                                                    <div key={idx} className="uppercase font-bold">{item.name}</div>
                                                ))}
                                            </td>
                                            <td className="p-2 border font-bold text-gray-800 uppercase">
                                                {day.aseo}
                                            </td>
                                            <td className="p-2 border font-bold text-gray-800 uppercase">
                                                {day.hospitalidad}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                        <p>El programa para {selectedMonth} de {selectedYear} no ha sido publicado.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgramaServiciosAuxiliares;
