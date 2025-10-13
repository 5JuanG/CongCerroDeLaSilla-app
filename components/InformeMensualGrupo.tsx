import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Publisher, ServiceReport, MONTHS } from '../App';

type EditableReport = Omit<ServiceReport, 'id'>;

interface InformeMensualGrupoProps {
    publishers: Publisher[];
    serviceReports: ServiceReport[];
    onBatchUpdateReports: (reports: EditableReport[]) => Promise<void>;
}

const InformeMensualGrupo: React.FC<InformeMensualGrupoProps> = ({ publishers, serviceReports, onBatchUpdateReports }) => {
    const currentMonthName = MONTHS[new Date().getMonth()];
    const currentYear = new Date().getFullYear();

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editableData, setEditableData] = useState<any[]>([]);
    const [status, setStatus] = useState('');

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - i), [currentYear]);
    const groups = useMemo(() => [...new Set(publishers.map(p => p.Grupo).filter(Boolean) as string[])].sort(), [publishers]);

    useEffect(() => {
        if (groups.length > 0 && !selectedGroup) {
            setSelectedGroup(groups[0]);
        }
    }, [groups, selectedGroup]);

    const filteredPublishers = useMemo(() => {
        if (!selectedGroup) return [];
        return publishers.filter(p => p.Grupo === selectedGroup).sort((a, b) => a.Nombre.localeCompare(b.Nombre));
    }, [publishers, selectedGroup]);

    const reportData = useMemo(() => {
        return filteredPublishers.map(pub => {
            const report = serviceReports.find(r =>
                r.idPublicador === pub.id &&
                r.anioCalendario === selectedYear &&
                r.mes === selectedMonth
            );
            return { publisher: pub, report };
        });
    }, [filteredPublishers, serviceReports, selectedYear, selectedMonth]);
    
    const informedCount = useMemo(() => reportData.filter(d => d.report && d.report.participacion).length, [reportData]);
    const pendingCount = reportData.length - informedCount;

    const handleEdit = () => {
        setEditableData(JSON.parse(JSON.stringify(reportData)));
        setIsEditing(true);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditableData([]);
        setStatus('');
    };

    const handleDataChange = useCallback((publisherId: string, field: string, value: any) => {
        setEditableData(currentData => {
            return currentData.map(item => {
                if (item.publisher.id !== publisherId) return item;

                const newReport = item.report ? { ...item.report } : {
                    idPublicador: publisherId, anioCalendario: selectedYear, mes: selectedMonth, participacion: false, precursorAuxiliar: '',
                };

                if (field === 'participacion') newReport.participacion = value;
                else if (field === 'precursorAuxiliar') newReport.precursorAuxiliar = value ? 'PA' : '';
                else if (field === 'cursosBiblicos' || field === 'horas') (newReport as any)[field] = value === '' ? undefined : Number(value);
                else (newReport as any)[field] = value || undefined;
                
                return { ...item, report: newReport };
            });
        });
    }, [selectedYear, selectedMonth]);

    const handleSave = async () => {
        setStatus('Guardando...');
        try {
            const reportsToUpdate = editableData.map(d => d.report).filter(r => r && r.idPublicador);
            if (reportsToUpdate.length > 0) {
                await onBatchUpdateReports(reportsToUpdate);
            }
            setStatus('¡Cambios guardados con éxito!');
            setIsEditing(false);
            setTimeout(() => setStatus(''), 3000);
        } catch (error) {
            setStatus('Error al guardar los cambios.');
            console.error(error);
        }
    };

    const getRowClassName = (publisher: Publisher, report?: ServiceReport) => {
        // 1. Pendiente (No ha informado) -> Rojo
        if (!report || !report.participacion) {
            return 'bg-red-200 hover:bg-red-300';
        }
    
        // Si ya informó, se revisan los siguientes casos:
    
        // 2. Informó como Precursor Auxiliar -> Verde brillante
        if (report.precursorAuxiliar === 'PA') {
            return 'bg-green-200 hover:bg-green-300';
        }
    
        // 3. Es Precursor Regular (y ya informó) -> Amarillo brillante
        if (publisher['Priv Adicional'] === 'Precursor Regular') {
            return 'bg-yellow-200 hover:bg-yellow-300';
        }
        
        // 4. Es publicador regular que ya informó -> Verde suave
        return 'bg-green-50 hover:bg-green-100';
    };
    
    const dataForView = isEditing ? editableData : reportData;

    return (
        <div className="container mx-auto max-w-6xl bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Informe Mensual por Grupo de Servicio</h1>
    
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
                <div>
                    <label htmlFor="year-select" className="block text-sm font-medium text-gray-700">Año:</label>
                    <select id="year-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="month-select" className="block text-sm font-medium text-gray-700">Mes:</label>
                    <select id="month-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="group-select" className="block text-sm font-medium text-gray-700">Grupo:</label>
                    <select id="group-select" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" disabled={groups.length === 0}>
                        <option value="">-- Seleccione Grupo --</option>
                        {groups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4 p-3 bg-gray-50 border rounded-lg text-sm text-gray-700">
                <h3 className="font-bold text-gray-800 mr-4">Leyenda:</h3>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-200 border border-red-300"></div>
                    <span>Pendiente</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-200 border border-yellow-300"></div>
                    <span>Prec. Regular</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-200 border border-green-300"></div>
                    <span>Prec. Auxiliar</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-50 border border-green-200"></div>
                    <span>Publicador</span>
                </div>
            </div>
    
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                <div className="flex gap-4 text-sm font-semibold">
                    <span className="text-green-600">Informaron: {informedCount}</span>
                    <span className="text-yellow-600">Pendientes: {pendingCount}</span>
                    <span className="text-gray-700">Total: {reportData.length}</span>
                </div>
                <div>
                    {isEditing ? (
                        <div className="flex gap-2">
                            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Guardar Cambios</button>
                            <button onClick={handleCancel} className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600">Cancelar</button>
                        </div>
                    ) : (
                        <button onClick={handleEdit} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700" disabled={reportData.length === 0}>Editar Informes</button>
                    )}
                </div>
            </div>
    
            {status && <div className="text-center mb-4 font-semibold text-blue-700">{status}</div>}
    
            {/* --- Desktop Table View --- */}
            <div className="overflow-x-auto hidden md:block">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase">Publicador</th>
                            <th className="px-2 py-3 text-center font-bold text-gray-600 uppercase">Participó</th>
                            <th className="px-2 py-3 text-center font-bold text-gray-600 uppercase">Prec. Aux.</th>
                            <th className="px-2 py-3 text-center font-bold text-gray-600 uppercase">Cursos</th>
                            <th className="px-2 py-3 text-center font-bold text-gray-600 uppercase">Horas</th>
                            <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase">Notas</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {dataForView.map(item => (
                            <tr key={item.publisher.id} className={isEditing ? 'bg-white' : getRowClassName(item.publisher, item.report)}>
                                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900">{[item.publisher.Nombre, item.publisher.Apellido].join(' ')}</td>
                                <td className="px-2 py-3 text-center">
                                    {isEditing ? (
                                        <input type="checkbox" checked={item.report?.participacion || false} onChange={e => handleDataChange(item.publisher.id, 'participacion', e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                    ) : (
                                        item.report?.participacion ? 'Sí' : 'No'
                                    )}
                                </td>
                                <td className="px-2 py-3 text-center">
                                    {isEditing ? (
                                         <input type="checkbox" checked={item.report?.precursorAuxiliar === 'PA'} onChange={e => handleDataChange(item.publisher.id, 'precursorAuxiliar', e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"/>
                                    ) : (
                                        item.report?.precursorAuxiliar === 'PA' ? 'Sí' : 'No'
                                    )}
                                </td>
                                <td className="px-2 py-3 text-center">
                                    {isEditing ? (
                                        <input type="number" value={item.report?.cursosBiblicos ?? ''} onChange={e => handleDataChange(item.publisher.id, 'cursosBiblicos', e.target.value)} className="w-16 p-1 text-center border rounded"/>
                                    ) : (
                                        item.report?.cursosBiblicos ?? ''
                                    )}
                                </td>
                                <td className="px-2 py-3 text-center">
                                    {isEditing ? (
                                         <input type="number" step="0.1" value={item.report?.horas ?? ''} onChange={e => handleDataChange(item.publisher.id, 'horas', e.target.value)} className="w-20 p-1 text-center border rounded"/>
                                    ) : (
                                        item.report?.horas ?? ''
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    {isEditing ? (
                                         <input type="text" value={item.report?.notas ?? ''} onChange={e => handleDataChange(item.publisher.id, 'notas', e.target.value)} className="w-full p-1 border rounded"/>
                                    ) : (
                                        item.report?.notas ?? ''
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* --- Mobile Card View --- */}
            <div className="space-y-4 md:hidden">
                {dataForView.map(item => (
                    <div key={item.publisher.id} className={`p-4 rounded-lg shadow-md ${isEditing ? 'bg-white border' : getRowClassName(item.publisher, item.report)}`}>
                        <h3 className="font-bold text-lg text-gray-800 mb-3">{[item.publisher.Nombre, item.publisher.Apellido].join(' ')}</h3>
                        
                        <div className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                            {/* Participó & Prec Aux */}
                            <div className="flex items-center justify-between col-span-2">
                                <label className="font-semibold text-gray-600">Participó</label>
                                {isEditing ? (
                                    <input type="checkbox" checked={item.report?.participacion || false} onChange={e => handleDataChange(item.publisher.id, 'participacion', e.target.checked)} className="h-6 w-6 rounded border-gray-400 text-blue-600 focus:ring-blue-500"/>
                                ) : (
                                    <span className="font-semibold">{item.report?.participacion ? 'Sí' : 'No'}</span>
                                )}
                            </div>
                            <div className="flex items-center justify-between col-span-2">
                                <label className="font-semibold text-gray-600">Prec. Aux.</label>
                                {isEditing ? (
                                    <input type="checkbox" checked={item.report?.precursorAuxiliar === 'PA'} onChange={e => handleDataChange(item.publisher.id, 'precursorAuxiliar', e.target.checked)} className="h-6 w-6 rounded border-gray-400 text-blue-600 focus:ring-blue-500"/>
                                ) : (
                                    <span className="font-semibold">{item.report?.precursorAuxiliar === 'PA' ? 'Sí' : 'No'}</span>
                                )}
                            </div>

                            {/* Cursos */}
                            <div className="flex flex-col">
                                <label htmlFor={`cursos-${item.publisher.id}`} className="font-semibold text-gray-600">Cursos</label>
                                {isEditing ? (
                                    <input id={`cursos-${item.publisher.id}`} type="number" value={item.report?.cursosBiblicos ?? ''} onChange={e => handleDataChange(item.publisher.id, 'cursosBiblicos', e.target.value)} className="w-full mt-1 p-2 text-center border rounded-md"/>
                                ) : (
                                    <span className="font-bold text-lg mt-1">{item.report?.cursosBiblicos ?? '—'}</span>
                                )}
                            </div>
                           
                            {/* Horas */}
                            <div className="flex flex-col">
                                <label htmlFor={`horas-${item.publisher.id}`} className="font-semibold text-gray-600">Horas</label>
                                {isEditing ? (
                                    <input id={`horas-${item.publisher.id}`} type="number" step="0.1" value={item.report?.horas ?? ''} onChange={e => handleDataChange(item.publisher.id, 'horas', e.target.value)} className="w-full mt-1 p-2 text-center border rounded-md"/>
                                ) : (
                                    <span className="font-bold text-lg mt-1">{item.report?.horas ?? '—'}</span>
                                )}
                            </div>
                        </div>
                        
                        {/* Notas (full width) */}
                        <div className="mt-4">
                             <label htmlFor={`notas-${item.publisher.id}`} className="font-semibold text-gray-600 text-sm">Notas</label>
                             <div className="mt-1">
                                 {isEditing ? (
                                    <input id={`notas-${item.publisher.id}`} type="text" value={item.report?.notas ?? ''} onChange={e => handleDataChange(item.publisher.id, 'notas', e.target.value)} className="w-full p-2 border rounded-md"/>
                                ) : (
                                    <p className="text-sm text-gray-800">{item.report?.notas || '—'}</p>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default InformeMensualGrupo;
