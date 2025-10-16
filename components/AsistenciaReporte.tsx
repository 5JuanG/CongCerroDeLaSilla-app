import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AttendanceRecord, AsistenciaData, SERVICE_YEAR_MONTHS, MONTHS as CALENDAR_YEAR_MONTHS } from '../App';

// Define month orders as constants to prevent typos and ensure consistency.


interface MonthData {
    numReuniones: number;
    asistenciaTotal: number;
    promedioSemanal: string;
}
interface YearData {
    entreSemana: { [key: string]: MonthData };
    finDeSemana: { [key: string]: MonthData };
}
interface ReportData {
    year1End: number;
    year2End: number;
    year1Data: YearData;
    year2Data: YearData;
}

interface AsistenciaReporteProps {
    attendanceRecords: AttendanceRecord[];
    onBatchUpdateAttendance: (records: AttendanceRecord[]) => Promise<void>;
    canEdit: boolean;
}

const AsistenciaReporte: React.FC<AsistenciaReporteProps> = ({ attendanceRecords, onBatchUpdateAttendance, canEdit }) => {
    const [years, setYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number>(0);
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [status, setStatus] = useState('');
    const pdfContentRef = useRef<HTMLDivElement>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editableData, setEditableData] = useState<ReportData | null>(null);
    const [isSaving, setIsSaving] = useState(false);


    useEffect(() => {
        const currentServiceYear = new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear();
        const serviceYears = Array.from({ length: 5 }, (_, i) => currentServiceYear - i);
        setYears(serviceYears);
        if (!selectedYear) {
            setSelectedYear(serviceYears[0]);
        }
    }, []);

    useEffect(() => {
        if (selectedYear > 0 && attendanceRecords) {
            setStatus('Procesando datos...');
            
            const processDataForServiceYear = (endYear: number): YearData => {
                const startYear = endYear - 1;
                
                const data: YearData = { entreSemana: {}, finDeSemana: {} };

                SERVICE_YEAR_MONTHS.forEach((month, index) => {
                    const calendarYear = index < 4 ? startYear : endYear;
                    const record = attendanceRecords.find(r => r.ano === calendarYear && r.mes === month);
                    
                    const calculateMonthData = (prefix: 'es' | 'fs'): MonthData => {
                        if (!record) return { numReuniones: 0, asistenciaTotal: 0, promedioSemanal: '' };
                        
                        let total = 0;
                        let count = 0;
                        for (let i = 1; i <= 5; i++) {
                            const valueStr = record[`${prefix}_sem${i}` as keyof AsistenciaData];
                            if (valueStr && valueStr.trim() !== '') {
                                const value = parseInt(valueStr, 10);
                                if (!isNaN(value) && value > 0) {
                                    total += value;
                                    count++;
                                }
                            }
                        }
                        return {
                            numReuniones: count,
                            asistenciaTotal: total,
                            promedioSemanal: count > 0 ? (total / count).toFixed(2) : '',
                        };
                    };

                    data.entreSemana[month] = calculateMonthData('es');
                    data.finDeSemana[month] = calculateMonthData('fs');
                });
                return data;
            };

            const newReportData: ReportData = {
                year1End: selectedYear,
                year2End: selectedYear + 1,
                year1Data: processDataForServiceYear(selectedYear),
                year2Data: processDataForServiceYear(selectedYear + 1)
            };
            
            setReportData(newReportData);
            setStatus('');
        }
    }, [selectedYear, attendanceRecords]);
    
    const handleEdit = () => {
        setEditableData(JSON.parse(JSON.stringify(reportData)));
        setIsEditing(true);
    };

    const handleCancel = () => {
        setEditableData(null);
        setIsEditing(false);
    };

    const handleDataChange = (yearKey: 'year1Data' | 'year2Data', type: 'entreSemana' | 'finDeSemana', month: string, field: 'numReuniones' | 'asistenciaTotal', value: string) => {
        setEditableData(prev => {
            if (!prev) return null;
            const newData = JSON.parse(JSON.stringify(prev));
            const numValue = parseInt(value, 10);
            newData[yearKey][type][month][field] = isNaN(numValue) || numValue < 0 ? 0 : numValue;
            
            const { numReuniones, asistenciaTotal } = newData[yearKey][type][month];
            newData[yearKey][type][month].promedioSemanal = numReuniones > 0 ? (asistenciaTotal / numReuniones).toFixed(2) : '';

            return newData;
        });
    };

    const handleSave = async () => {
        if (!editableData) return;
        setIsSaving(true);
        setStatus('');

        try {
            const recordsToUpdate: AttendanceRecord[] = [];

            // --- Process Year 1 ---
            const endYear1 = editableData.year1End;
            const startYear1 = endYear1 - 1;
            SERVICE_YEAR_MONTHS.forEach((month, index) => {
                const calendarYear = index < 4 ? startYear1 : endYear1;
                const docId = `${calendarYear}_${month}`;
                const originalRecord = attendanceRecords.find(r => r.id === docId);

                const newRecordData: AttendanceRecord = {
                    id: docId, ano: calendarYear, mes: month,
                    es_sem1: originalRecord?.es_sem1 || '', es_sem2: originalRecord?.es_sem2 || '', es_sem3: originalRecord?.es_sem3 || '', es_sem4: originalRecord?.es_sem4 || '', es_sem5: originalRecord?.es_sem5 || '',
                    fs_sem1: originalRecord?.fs_sem1 || '', fs_sem2: originalRecord?.fs_sem2 || '', fs_sem3: originalRecord?.fs_sem3 || '', fs_sem4: originalRecord?.fs_sem4 || '', fs_sem5: originalRecord?.fs_sem5 || '',
                };
                let hasChanged = false;

                (['entreSemana', 'finDeSemana'] as const).forEach(type => {
                    const monthData = editableData.year1Data[type][month];
                    const prefix = type === 'entreSemana' ? 'es' : 'fs';

                    const originalTotal = [1,2,3,4,5].reduce((sum, i) => sum + (parseInt(newRecordData[`${prefix}_sem${i}` as keyof AsistenciaData]) || 0), 0);
                    if (originalTotal !== monthData.asistenciaTotal) hasChanged = true;

                    const numMeetings = monthData.numReuniones;
                    const total = monthData.asistenciaTotal;
                    const baseAttendance = numMeetings > 0 ? Math.floor(total / numMeetings) : 0;
                    let remainder = numMeetings > 0 ? total % numMeetings : 0;
                    
                    for (let i = 1; i <= 5; i++) {
                        const key = `${prefix}_sem${i}` as keyof AsistenciaData;
                        if (i <= numMeetings) {
                            (newRecordData as any)[key] = (baseAttendance + (remainder-- > 0 ? 1 : 0)).toString();
                        } else {
                            (newRecordData as any)[key] = '';
                        }
                    }
                });
                if (hasChanged) recordsToUpdate.push(newRecordData);
            });

            // --- Process Year 2 ---
            const endYear2 = editableData.year2End;
            const startYear2 = endYear2 - 1;
            SERVICE_YEAR_MONTHS.forEach((month, index) => {
                const calendarYear = index < 4 ? startYear2 : endYear2;
                const docId = `${calendarYear}_${month}`;
                const originalRecord = attendanceRecords.find(r => r.id === docId);

                const newRecordData: AttendanceRecord = {
                    id: docId, ano: calendarYear, mes: month,
                    es_sem1: originalRecord?.es_sem1 || '', es_sem2: originalRecord?.es_sem2 || '', es_sem3: originalRecord?.es_sem3 || '', es_sem4: originalRecord?.es_sem4 || '', es_sem5: originalRecord?.es_sem5 || '',
                    fs_sem1: originalRecord?.fs_sem1 || '', fs_sem2: originalRecord?.fs_sem2 || '', fs_sem3: originalRecord?.fs_sem3 || '', fs_sem4: originalRecord?.fs_sem4 || '', fs_sem5: originalRecord?.fs_sem5 || '',
                };
                let hasChanged = false;

                (['entreSemana', 'finDeSemana'] as const).forEach(type => {
                    const monthData = editableData.year2Data[type][month];
                    const prefix = type === 'entreSemana' ? 'es' : 'fs';
                    
                    const originalTotal = [1,2,3,4,5].reduce((sum, i) => sum + (parseInt(newRecordData[`${prefix}_sem${i}` as keyof AsistenciaData]) || 0), 0);
                    if (originalTotal !== monthData.asistenciaTotal) hasChanged = true;
                    
                    const numMeetings = monthData.numReuniones;
                    const total = monthData.asistenciaTotal;
                    const baseAttendance = numMeetings > 0 ? Math.floor(total / numMeetings) : 0;
                    let remainder = numMeetings > 0 ? total % numMeetings : 0;
                    
                    for (let i = 1; i <= 5; i++) {
                        const key = `${prefix}_sem${i}` as keyof AsistenciaData;
                        if (i <= numMeetings) {
                            (newRecordData as any)[key] = (baseAttendance + (remainder-- > 0 ? 1 : 0)).toString();
                        } else {
                            (newRecordData as any)[key] = '';
                        }
                    }
                });
                if (hasChanged) recordsToUpdate.push(newRecordData);
            });
            
            if (recordsToUpdate.length > 0) {
               await onBatchUpdateAttendance(recordsToUpdate);
            }
            // Success modal handled by parent
            setIsEditing(false);
            setEditableData(null);
        } catch (error) {
            // Error modal handled by parent
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportCSV = () => {
        if (attendanceRecords.length === 0) {
            alert("No hay registros de asistencia para exportar.");
            return;
        }
        
        const sortedRecords = [...attendanceRecords].sort((a, b) => {
            if (a.ano !== b.ano) return a.ano - b.ano;
            return CALENDAR_YEAR_MONTHS.indexOf(a.mes) - CALENDAR_YEAR_MONTHS.indexOf(b.mes);
        });

        const dataToExport = sortedRecords.map(r => ({
            'Año': r.ano,
            'Mes': r.mes,
            'ES_Sem1': r.es_sem1,
            'ES_Sem2': r.es_sem2,
            'ES_Sem3': r.es_sem3,
            'ES_Sem4': r.es_sem4,
            'ES_Sem5': r.es_sem5,
            'FS_Sem1': r.fs_sem1,
            'FS_Sem2': r.fs_sem2,
            'FS_Sem3': r.fs_sem3,
            'FS_Sem4': r.fs_sem4,
            'FS_Sem5': r.fs_sem5,
        }));

        const headers = Object.keys(dataToExport[0]);
        const csvRows = [
            headers.join(','),
            ...dataToExport.map(row =>
                headers.map(header => {
                    let cell = row[header as keyof typeof row] || '';
                    cell = String(cell).replace(/"/g, '""');
                    if (String(cell).includes(',')) {
                        cell = `"${cell}"`;
                    }
                    return cell;
                }).join(',')
            )
        ];

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'registros_de_asistencia.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        if (isEditing) {
            alert("Guarde o cancele los cambios antes de exportar a PDF.");
            return;
        }
        const content = pdfContentRef.current;
        if (content) {
            setStatus("Generando PDF...");
            content.classList.add('pdf-export');
            
            // @ts-ignore
            html2canvas(content, { scale: 2 }).then(canvas => {
                // @ts-ignore
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const imgData = canvas.toDataURL('image/png');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const ratio = canvasWidth / canvasHeight;
                let width = pdfWidth - 20;
                let height = width / ratio;

                if (height > pdfHeight - 20) {
                    height = pdfHeight - 20;
                    width = height * ratio;
                }
                
                let positionX = (pdfWidth - width) / 2;
                let positionY = (pdfHeight - height) / 2;

                pdf.addImage(imgData, 'PNG', positionX, positionY, width, height);
                pdf.save(`Reporte_Asistencia_${selectedYear}.pdf`);
                setStatus("PDF generado. Revisa tus descargas.");
                 content.classList.remove('pdf-export');
            }).catch(err => {
                 setStatus("Error al generar PDF: " + err.message);
                 content.classList.remove('pdf-export');
            });
        }
    };
    
    const renderTable = (type: 'entreSemana' | 'finDeSemana', data: ReportData) => {
        let totalReunionesY1 = 0, totalAsistenciaY1 = 0;
        let totalReunionesY2 = 0, totalAsistenciaY2 = 0;
        
        const defaultMonthData: MonthData = { numReuniones: 0, asistenciaTotal: 0, promedioSemanal: '' };
        
        const dataToRender = isEditing && editableData ? editableData : data;

        const rows = SERVICE_YEAR_MONTHS.map(month => {
            const d1 = dataToRender.year1Data[type][month] || defaultMonthData;
            const d2 = dataToRender.year2Data[type][month] || defaultMonthData;
            totalReunionesY1 += d1.numReuniones;
            totalAsistenciaY1 += d1.asistenciaTotal;
            totalReunionesY2 += d2.numReuniones;
            totalAsistenciaY2 += d2.asistenciaTotal;
            return (
                <tr key={month}>
                    <td className="p-2 border border-gray-300 font-bold text-left" translate="no">{month}</td>
                    <td className="p-2 border border-gray-300">{isEditing ? <input type="number" value={d1.numReuniones} onChange={e => handleDataChange('year1Data', type, month, 'numReuniones', e.target.value)} className="w-16 p-1 text-center border rounded"/> : (d1.numReuniones || '')}</td>
                    <td className="p-2 border border-gray-300">{isEditing ? <input type="number" value={d1.asistenciaTotal} onChange={e => handleDataChange('year1Data', type, month, 'asistenciaTotal', e.target.value)} className="w-20 p-1 text-center border rounded"/> : (d1.asistenciaTotal || '')}</td>
                    <td className="p-2 border border-gray-300 font-semibold border-r-2 border-r-gray-500">{d1.promedioSemanal || ''}</td>
                    <td className="p-2 border border-gray-300 font-bold text-left" translate="no">{month}</td>
                    <td className="p-2 border border-gray-300">{isEditing ? <input type="number" value={d2.numReuniones} onChange={e => handleDataChange('year2Data', type, month, 'numReuniones', e.target.value)} className="w-16 p-1 text-center border rounded"/> : (d2.numReuniones || '')}</td>
                    <td className="p-2 border border-gray-300">{isEditing ? <input type="number" value={d2.asistenciaTotal} onChange={e => handleDataChange('year2Data', type, month, 'asistenciaTotal', e.target.value)} className="w-20 p-1 text-center border rounded"/> : (d2.asistenciaTotal || '')}</td>
                    <td className="p-2 border border-gray-300 font-semibold">{d2.promedioSemanal || ''}</td>
                </tr>
            );
        });

        const avgY1 = totalReunionesY1 > 0 ? (totalAsistenciaY1 / totalReunionesY1).toFixed(2) : '0.00';
        const avgY2 = totalReunionesY2 > 0 ? (totalAsistenciaY2 / totalReunionesY2).toFixed(2) : '0.00';
        
        const footer = (
            <tr className="bg-gray-50 font-bold">
                <td colSpan={2} className="p-2 border border-gray-300 text-left">Totales Anuales</td>
                <td className="p-2 border border-gray-300 text-center font-extrabold text-blue-700">{totalAsistenciaY1 || ''}</td>
                <td className="p-2 border border-gray-300 text-center font-extrabold text-blue-700 border-r-2 border-r-gray-500">{avgY1}</td>
                <td colSpan={2} className="p-2 border border-gray-300 text-left">Totales Anuales</td>
                <td className="p-2 border border-gray-300 text-center font-extrabold text-blue-700">{totalAsistenciaY2 || ''}</td>
                <td className="p-2 border border-gray-300 text-center font-extrabold text-blue-700">{avgY2}</td>
            </tr>
        );

        const year1End = data.year1End;
        const year2End = data.year2End;

        return (
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-center text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2 border border-gray-300 text-center align-middle">
                                Año de servicio
                                <span className="block text-lg font-bold text-blue-700 leading-tight">{year1End}</span>
                            </th>
                            <th className="p-2 border border-gray-300 align-middle">Número de reuniones</th>
                            <th className="p-2 border border-gray-300 align-middle">Asistencia total</th>
                            <th className="p-2 border border-gray-300 border-r-2 border-r-gray-500 align-middle">Promedio de asistencia semanal</th>
                            
                            <th className="p-2 border border-gray-300 text-center align-middle">
                                Año de servicio
                                <span className="block text-lg font-bold text-blue-700 leading-tight">{year2End}</span>
                            </th>
                            <th className="p-2 border border-gray-300 align-middle">Número de reuniones</th>
                            <th className="p-2 border border-gray-300 align-middle">Asistencia total</th>
                            <th className="p-2 border border-gray-300 align-middle">Promedio de asistencia semanal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows}
                        {footer}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 bg-white rounded-lg shadow-md">
            <div className="text-center mb-6">
                <label htmlFor="year-select" className="mr-2 font-bold">Año de Servicio:</label>
                <select id="year-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="p-2 border rounded-md">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            
            <div id="pdf-content" ref={pdfContentRef}>
                <h1 className="text-2xl font-bold text-center mb-6">REGISTRO DE ASISTENCIA A LAS REUNIONES DE CONGREGACIÓN</h1>
                {reportData ? (
                    <>
                        <h2 className="text-xl font-semibold border-b-2 pb-2 mb-4">Reunión de entre semana</h2>
                        {renderTable('entreSemana', reportData)}
                        
                        <h2 className="text-xl font-semibold border-b-2 pb-2 mt-8 mb-4">Reunión del fin de semana</h2>
                        {renderTable('finDeSemana', reportData)}
                    </>
                ) : <p className="text-center">Cargando datos o no hay datos disponibles...</p>}
            </div>

            <div className="text-center mt-8 space-x-4">
                {isEditing ? (
                    <>
                        <button onClick={handleSave} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-300 disabled:bg-gray-400">
                           {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                        <button onClick={handleCancel} disabled={isSaving} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-300">Cancelar</button>
                    </>
                ) : (
                    <>
                        {canEdit && <button onClick={handleEdit} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-300" disabled={!reportData}>Editar Informe</button>}
                        <button onClick={handleExportCSV} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-300" disabled={attendanceRecords.length === 0}>Exportar a CSV</button>
                        <button onClick={exportToPDF} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-300" disabled={!reportData}>Exportar a PDF</button>
                    </>
                )}
            </div>
            <div id="status" className="text-center mt-4 font-bold text-blue-700 min-h-[1.5rem]">{status}</div>
        </div>
    );
};

export default AsistenciaReporte;