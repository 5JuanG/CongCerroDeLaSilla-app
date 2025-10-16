import React, { useState, useMemo, useRef, useCallback } from 'react';
import { MeetingAssignmentSchedule, Publisher, ModalInfo, DayAssignment } from '../App';

declare const jspdf: any;

interface ProgramaServiciosAuxiliaresProps {
    schedules: MeetingAssignmentSchedule[];
    publishers: Publisher[];
    onShowModal: (info: ModalInfo) => void;
}

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const ProgramaServiciosAuxiliares: React.FC<ProgramaServiciosAuxiliaresProps> = ({ schedules, publishers, onShowModal }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i), []);

    const getPublisherName = useCallback((id: string | null | undefined): string => {
        if (!id) return 'N/A';
        const pub = publishers.find(p => p.id === id);
        return pub ? [pub.Nombre, pub.Apellido, pub['2do Apellido'], pub['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ') : 'No encontrado';
    }, [publishers]);

    const displayData = useMemo(() => {
        const scheduleForMonth = schedules.find(s => s.year === selectedYear && s.month === selectedMonth);
        if (!scheduleForMonth?.schedule) return [];

        const meetingDays = Object.entries(scheduleForMonth.schedule).map(([dateKey, dayAssignment]) => {
            const typedDayAssignment = dayAssignment as DayAssignment;
            const isSaturday = dateKey.startsWith('saturday');
            
            const fechaParts = (typedDayAssignment.fechaReunion || ' ').split(' ');
            const dayOfWeek = fechaParts[0];
            const dayNum = fechaParts.slice(1).join(' ');

            const acomodadores = [
                `AP: ${getPublisherName(typedDayAssignment.acomodadoresPrincipal?.[0])}`,
                `Aud: ${getPublisherName(typedDayAssignment.acomodadoresAuditorio?.[0])}`,
                `Sala: ${typedDayAssignment.acomodadoresSala?.map(id => getPublisherName(id)).join(' / ') || 'N/A'}`
            ].join('\n');

            const microfonos = typedDayAssignment.microfonos?.map(id => getPublisherName(id)).join('\n') || '';

            return {
                dayKey: dateKey,
                date: `${dayOfWeek}\n${dayNum} de ${selectedMonth.toLowerCase()}`,
                isSaturday,
                presidirSabado: isSaturday ? getPublisherName(typedDayAssignment.presidente) : '',
                lector: isSaturday ? getPublisherName(typedDayAssignment.lectorAtalaya) : '',
                acomodadores,
                microfonos,
                vigilanciaHorario: typedDayAssignment.vigilanciaHorario || (isSaturday ? '4:15-4:50 p. m.' : '8:20-8:50 p. m.'),
                vigilanciaNombres: typedDayAssignment.vigilantes?.map(id => getPublisherName(id)).join('\n') || '',
                aseo: typedDayAssignment.aseo ? `Grupo ${typedDayAssignment.aseo}` : '',
                hospitalidad: isSaturday && typedDayAssignment.hospitalidad ? `Grupo ${typedDayAssignment.hospitalidad}` : ''
            };
        });

        return meetingDays.sort((a, b) => {
            const dateStrA = a.dayKey.substring(a.dayKey.indexOf('-') + 1);
            const dateStrB = b.dayKey.substring(b.dayKey.indexOf('-') + 1);
            return new Date(dateStrA).getTime() - new Date(dateStrB).getTime();
        });

    }, [selectedYear, selectedMonth, schedules, getPublisherName]);

    const handleExportPdf = () => {
        if (displayData.length === 0) {
            onShowModal({ type: 'error', title: 'Error', message: 'No hay programa para exportar.' });
            return;
        }

        onShowModal({ type: 'info', title: 'Generando PDF', message: 'Por favor, espere un momento...' });
        
        try {
            // @ts-ignore
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

            const PAGE_WIDTH = pdf.internal.pageSize.getWidth();
            const PAGE_HEIGHT = pdf.internal.pageSize.getHeight();
            const MARGIN = 12;
            let yPos = MARGIN;

            // Colors
            const HEADER_BG = '#283593'; // Indigo
            const HEADER_TEXT = '#FFFFFF';
            const DATE_BG = '#E8EAF6';   // Light Indigo
            const DATE_TEXT = '#1A237E';  // Deep Indigo
            const VIGILANCIA_BG = '#FFF9C4'; // Light Yellow
            const VIGILANCIA_TEXT = '#3E2723'; // Brown
            const ROW_TEXT = '#212121';

            // Draw Main Header
            pdf.setFontSize(13).setFont(undefined, 'bold');
            pdf.setTextColor('#1A237E');
            pdf.text('Programa De Acomodadores, Lectores, vigilancia, Aseo y Hospitalidad de las Reuniones. Cong Cerro de la Silla', PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 6;
            pdf.setFontSize(12).setFont(undefined, 'normal');
            pdf.setTextColor('#333333');
            pdf.text(`${selectedMonth.toUpperCase()} ${selectedYear}`, PAGE_WIDTH / 2, yPos, { align: 'center' });
            yPos += 10;

            const colWidths = [
                (PAGE_WIDTH - MARGIN * 2) * 0.12, // Fecha
                (PAGE_WIDTH - MARGIN * 2) * 0.12, // Presidir
                (PAGE_WIDTH - MARGIN * 2) * 0.12, // Lector
                (PAGE_WIDTH - MARGIN * 2) * 0.16, // Acomodadores
                (PAGE_WIDTH - MARGIN * 2) * 0.12, // Microfonos
                (PAGE_WIDTH - MARGIN * 2) * 0.16, // Vigilancia
                (PAGE_WIDTH - MARGIN * 2) * 0.10, // Aseo
                (PAGE_WIDTH - MARGIN * 2) * 0.10, // Hospitalidad
            ];
            
            const drawTableHeader = () => {
                pdf.setFillColor(HEADER_BG);
                pdf.setTextColor(HEADER_TEXT);
                pdf.setFontSize(9).setFont(undefined, 'bold');
                pdf.rect(MARGIN, yPos, PAGE_WIDTH - MARGIN * 2, 10, 'F');
                let xPos = MARGIN;
                const headers = ['Fecha', 'Presidir Sábados', 'Lector Atalaya', 'Acomodadores', 'Micrófonos', 'Vigilancia', 'Aseo', 'Hospitalidad'];
                headers.forEach((header, i) => {
                    pdf.text(header, xPos + colWidths[i] / 2, yPos + 6, { align: 'center', maxWidth: colWidths[i] - 2 });
                    xPos += colWidths[i];
                });
                yPos += 10;
            };

            drawTableHeader();

            pdf.setFontSize(11).setFont(undefined, 'normal');
            const LINE_HEIGHT = 4.5;

            displayData.forEach(day => {
                const cellContents = [
                    day.date,
                    day.presidirSabado,
                    day.lector,
                    day.acomodadores,
                    day.microfonos,
                    `${day.vigilanciaHorario}\n${day.vigilanciaNombres}`,
                    day.aseo,
                    day.hospitalidad
                ];

                const lineCounts = cellContents.map((text, i) => pdf.splitTextToSize(text, colWidths[i] - 4).length);
                const rowHeight = Math.max(...lineCounts) * LINE_HEIGHT + 4;
                
                if (yPos + rowHeight > PAGE_HEIGHT - MARGIN) {
                    pdf.addPage();
                    yPos = MARGIN;
                    drawTableHeader();
                }

                pdf.setTextColor(ROW_TEXT);
                let xPos = MARGIN;
                cellContents.forEach((text, i) => {
                    // Date cell styling
                    if (i === 0) {
                        pdf.setFillColor(DATE_BG);
                        pdf.rect(xPos, yPos, colWidths[i], rowHeight, 'F');
                        pdf.setTextColor(DATE_TEXT);
                        pdf.setFont(undefined, 'bold');
                    } else {
                        pdf.setTextColor(ROW_TEXT);
                        pdf.setFont(undefined, 'normal');
                    }
                    
                    // Vigilancia cell styling
                    if(i === 5) { // Index 5 is Vigilancia now
                        const horarioLines = pdf.splitTextToSize(day.vigilanciaHorario, colWidths[i] - 4);
                        const horarioHeight = horarioLines.length * LINE_HEIGHT + 2;
                        pdf.setFillColor(VIGILANCIA_BG);
                        pdf.rect(xPos + 1, yPos + 1, colWidths[i] - 2, horarioHeight, 'F');
                        
                        pdf.setTextColor(VIGILANCIA_TEXT);
                        pdf.setFont(undefined, 'bold');
                        pdf.text(day.vigilanciaHorario, xPos + colWidths[i] / 2, yPos + LINE_HEIGHT + 1, { align: 'center', maxWidth: colWidths[i] - 4 });
                        
                        pdf.setTextColor(ROW_TEXT);
                        pdf.setFont(undefined, 'normal');
                        pdf.text(day.vigilanciaNombres, xPos + colWidths[i] / 2, yPos + horarioHeight + LINE_HEIGHT + 1, { align: 'center', maxWidth: colWidths[i] - 4 });

                    } else {
                         pdf.text(text, xPos + colWidths[i] / 2, yPos + rowHeight / 2, { align: 'center', baseline: 'middle', maxWidth: colWidths[i] - 4 });
                    }

                    xPos += colWidths[i];
                });
                
                pdf.setDrawColor('#DDDDDD');
                pdf.line(MARGIN, yPos + rowHeight, PAGE_WIDTH - MARGIN, yPos + rowHeight);
                yPos += rowHeight;
            });
            
            pdf.save(`Programa_Auxiliar_${selectedMonth}_${selectedYear}.pdf`);
            onShowModal({ type: 'success', title: 'Éxito', message: 'PDF generado correctamente.' });
        } catch(err) {
            onShowModal({ type: 'error', title: 'Error al Exportar', message: `No se pudo generar el PDF: ${(err as Error).message}` });
        }
    };
    
    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
            <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <h1 className="text-xl font-bold text-gray-800 text-center md:text-left">Programa De Acomodadores, Lectores, vigilancia, Aseo y Hospitalidad de las Reuniones. Cong Cerro de la Silla</h1>
                <div className="flex flex-wrap justify-center gap-2">
                    <button onClick={handleExportPdf} disabled={displayData.length === 0} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                        Exportar a PDF
                    </button>
                </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="p-2 border rounded-md">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 border rounded-md">
                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
            
            {displayData.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[1200px]">
                        <thead className="text-white text-sm" style={{ backgroundColor: '#283593' }}>
                            <tr>
                                <th className="p-2 border border-white">Fecha</th>
                                <th className="p-2 border border-white">Presidir Sábados</th>
                                <th className="p-2 border border-white">Lector Atalaya</th>
                                <th className="p-2 border border-white">Acomodadores</th>
                                <th className="p-2 border border-white">Micrófonos</th>
                                <th className="p-2 border border-white">Vigilancia</th>
                                <th className="p-2 border border-white">Aseo</th>
                                <th className="p-2 border border-white">Hospitalidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.map(day => (
                                <tr key={day.dayKey} className="text-sm text-center align-top even:bg-gray-50">
                                    <td className="p-2 border font-semibold bg-indigo-50 text-indigo-800 whitespace-pre-line">{day.date}</td>
                                    <td className="p-2 border whitespace-pre-line">{day.presidirSabado || ''}</td>
                                    <td className="p-2 border whitespace-pre-line">{day.lector || ''}</td>
                                    <td className="p-2 border whitespace-pre-line text-left">{day.acomodadores}</td>
                                    <td className="p-2 border whitespace-pre-line">{day.microfonos}</td>
                                    <td className="p-2 border whitespace-pre-line">
                                        <span className="bg-yellow-200 text-yellow-800 font-bold px-1 rounded text-xs">{day.vigilanciaHorario}</span>
                                        <div className="mt-1">{day.vigilanciaNombres}</div>
                                    </td>
                                    <td className="p-2 border whitespace-pre-line">{day.aseo}</td>
                                    <td className="p-2 border whitespace-pre-line">{day.hospitalidad || ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                    <p>No hay un programa de asignaciones generado para {selectedMonth} de {selectedYear}.</p>
                    <p className="mt-2">Por favor, vaya a "Asignaciones Reunión" para generar el programa primero.</p>
                </div>
            )}
        </div>
    );
};

export default ProgramaServiciosAuxiliares;