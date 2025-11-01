import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Publisher, ServiceReport, SERVICE_YEAR_MONTHS } from '../App';

type Report = Omit<ServiceReport, 'id'>;
type GlobalReportType = 'global_regulares' | 'global_auxiliares' | 'global_publicadores';
type ItemToPrint = { type: 'publisher' | 'global'; id: string };


// Custom styled checkbox for display purposes, as per user request
const CheckboxDisplay: React.FC<{label: string; checked: boolean;}> = ({ label, checked }) => (
    <div className="flex items-center whitespace-nowrap">
        <div className={`h-4 w-4 rounded border flex-shrink-0 flex items-center justify-center mr-1.5 ${checked ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-400'}`}>
            {checked && (
                <svg className="w-3 h-3 text-white fill-current" viewBox="0 0 20 20">
                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                </svg>
            )}
        </div>
        <label>{label}</label>
    </div>
);

// Custom styled interactive checkbox
const StyledCheckbox: React.FC<{
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    editable: boolean;
    dataField: string;
}> = ({ checked, onChange, editable, dataField }) => {
    const uniqueId = React.useId();
    return (
        <div className="relative flex items-center justify-center h-5 w-5">
            <input
                id={uniqueId}
                type="checkbox"
                className="absolute opacity-0 w-full h-full cursor-pointer disabled:cursor-default"
                data-field={dataField}
                checked={checked}
                onChange={onChange}
                disabled={!editable}
            />
            <label
                htmlFor={uniqueId}
                className={`h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${
                    checked
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-white border-gray-400'
                } ${editable ? 'cursor-pointer' : 'cursor-default'}`}
            >
                {checked && (
                    <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 20 20">
                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                )}
            </label>
        </div>
    );
};


interface RecordCardProps {
    serviceYearEnd: number;
    editable: boolean;
    // For individual
    publisher?: Publisher | null;
    reportsData?: Report[];
    onDataChange?: (change: Report) => void;
    // For global
    globalReport?: {
        title: string;
        data: { [month: string]: { count: number; hours?: number; cursos?: number } };
        totalHorasAnual?: number;
    };
}

const RecordCard: React.FC<RecordCardProps> = ({ 
    publisher,
    serviceYearEnd, 
    reportsData = [], 
    editable, 
    onDataChange,
    globalReport 
}) => {
    const isGlobal = !!globalReport;

    const totalHoras = useMemo(() => {
        if (isGlobal) {
            return globalReport.totalHorasAnual ?? 0;
        }
        if (!publisher) return 0;

        const serviceYearStart = serviceYearEnd - 1;
        return SERVICE_YEAR_MONTHS.reduce((acc, month, index) => {
            const yearToSearch = index < 4 ? serviceYearStart : serviceYearEnd;
            const report = reportsData.find(r => r.idPublicador === publisher.id && r.mes === month && r.anioCalendario === yearToSearch);
            return acc + (Number(report?.horas) || 0);
        }, 0);
    }, [reportsData, publisher, serviceYearEnd, isGlobal, globalReport]);
    
    if (!isGlobal && !publisher) return <p>Publicador no encontrado.</p>;

    const serviceYearStart = serviceYearEnd - 1;
    const fullName = !isGlobal && publisher ? [publisher.Nombre, publisher.Apellido, publisher['2do Apellido'], publisher['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ') : (globalReport?.title || '');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>, month: string, year: number) => {
        if (isGlobal || !publisher || !onDataChange) return;
    
        const { dataset, value, type, checked } = e.target;
        const field = dataset.field as keyof Report;
        if (!field) return;
    
        const existingReport = reportsData.find(r => r.idPublicador === publisher!.id && r.mes === month && r.anioCalendario === year) || {
            idPublicador: publisher!.id, mes: month, anioCalendario: year, participacion: false, precursorAuxiliar: ''
        };
        
        let updatedReport: Report = { ...existingReport };
    
        switch (field) {
            case 'participacion':
                updatedReport.participacion = checked;
                break;
            case 'precursorAuxiliar':
                updatedReport.precursorAuxiliar = checked ? 'PA' : '';
                break;
            case 'cursosBiblicos':
                updatedReport.cursosBiblicos = value === '' ? 0 : Number(value);
                break;
            case 'horas':
                updatedReport.horas = value === '' ? 0 : Number(value);
                break;
            case 'notas':
                updatedReport.notas = value; // value will be '' if empty
                break;
        }
    
        onDataChange(updatedReport);
    };

    return (
        <div className="record-card bg-white p-4 w-full max-w-4xl border border-gray-300 shadow-lg my-4 mx-auto text-sm">
            <h3 className="text-center font-bold text-lg mb-4">REGISTRO DE PUBLICADOR DE LA CONGREGACIÓN</h3>
            
            <div className="border-b-2 border-black py-2 mb-2 text-base">
                <div className="flex items-center mb-2">
                    <p><span className="font-bold">Nombre:</span> {fullName}</p>
                </div>
                <>
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <p className="mb-1"><span className="font-bold">Fecha de nacimiento:</span> {!isGlobal && publisher ? publisher['Fecha de Nacimiento'] : ''}</p>
                            <p><span className="font-bold">Fecha de bautismo:</span> {!isGlobal && publisher ? publisher['Fecha de bautismo'] : ''}</p>
                        </div>
                        <div className="flex text-sm">
                            <div className="flex flex-col gap-y-1 pr-4">
                                <CheckboxDisplay label="Hombre" checked={!isGlobal && publisher?.Sexo === 'Hombre'} />
                                <CheckboxDisplay label="Otras ovejas" checked={!isGlobal && publisher?.Esperanza === 'Otras ovejas'} />
                            </div>
                            <div className="flex flex-col gap-y-1">
                                <CheckboxDisplay label="Mujer" checked={!isGlobal && publisher?.Sexo === 'Mujer'} />
                                <CheckboxDisplay label="Ungido" checked={!isGlobal && publisher?.Esperanza === 'Ungido'} />
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mt-2">
                        <CheckboxDisplay label="Anciano" checked={!isGlobal && publisher?.Privilegio === 'Anciano'} />
                        <CheckboxDisplay label="Siervo ministerial" checked={!isGlobal && publisher?.Privilegio === 'Siervo Ministerial'} />
                        <CheckboxDisplay label="Precursor regular" checked={!isGlobal && publisher?.['Priv Adicional'] === 'Precursor Regular'} />
                        <CheckboxDisplay label="Precursor especial" checked={!isGlobal && publisher?.['Priv Adicional'] === 'Precursor Especial'} />
                        <CheckboxDisplay label="Misionero que sirve en el campo" checked={!isGlobal && publisher?.['Priv Adicional'] === 'Misionero'} />
                    </div>
                </>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="p-2 border border-black text-center w-32 align-top text-xs font-semibold">
                                AÑO DE SERVICIO
                                <span className="block font-bold text-lg text-blue-700 mt-1">{serviceYearEnd}</span>
                            </th>
                            <th className="p-2 border border-black text-center w-28 align-top">Participación<br/>en el ministerio</th>
                            <th className="p-2 border border-black text-center w-24 align-top">Cursos<br/>bíblicos</th>
                            <th className="p-2 border border-black text-center w-24 align-top">Precursor<br/>auxiliar</th>
                            <th className="px-1 py-2 border border-black text-center align-top">
                                Horas
                                <br/>
                                <span className="font-normal text-xs">
                                    (Si es precursor o
                                    <br/>
                                    misionero que
                                    <br/>
                                    sirve en el campo)
                                </span>
                            </th>
                            <th className="p-2 border border-black min-w-40 align-middle">Notas</th>
                        </tr>
                    </thead>
                    <tbody>
                        {SERVICE_YEAR_MONTHS.map((month, index) => {
                            const yearToSearch = index < 4 ? serviceYearEnd - 1 : serviceYearEnd;

                            if (isGlobal && globalReport) {
                                const monthData = globalReport.data[month] || { count: 0 };
                                let notesContent: React.ReactNode = monthData.count || '0';
                                if (monthData.count > 0) {
                                    const count = monthData.count;
                                    switch (globalReport.title) {
                                        case 'Precursores Regulares':
                                            notesContent = `${count} precursor${count > 1 ? 'es' : ''} regular${count > 1 ? 'es' : ''}`;
                                            break;
                                        case 'Precursores Auxiliares':
                                            notesContent = `${count} precursor${count > 1 ? 'es' : ''} auxiliar${count > 1 ? 'es' : ''}`;
                                            break;
                                        case 'Publicadores de la Congregación':
                                            notesContent = `${count} publicador${count > 1 ? 'es' : ''}`;
                                            break;
                                    }
                                }

                                return (
                                    <tr key={month}>
                                        <td className="p-2 border border-black font-bold text-left" translate="no">{month}</td>
                                        <td className="p-2 border border-black flex justify-center items-center">-</td>
                                        <td className="p-2 border border-black text-center">{monthData.cursos !== undefined ? monthData.cursos : '-'}</td>
                                        <td className="p-2 border border-black flex justify-center items-center">-</td>
                                        <td className="p-2 border border-black text-center">{monthData.hours !== undefined ? monthData.hours.toFixed(1) : '-'}</td>
                                        <td className="p-2 border border-black text-center font-bold">{notesContent}</td>
                                    </tr>
                                );
                            }
                            
                            if (!isGlobal && publisher && reportsData) {
                                const report = reportsData.find(r => r.idPublicador === publisher.id && r.mes === month && r.anioCalendario === yearToSearch);
                                return (
                                    <tr key={month}>
                                        <td className="p-2 border border-black font-bold text-left" translate="no">{month}</td>
                                        <td className="p-2 border border-black flex justify-center items-center">
                                            <StyledCheckbox
                                                editable={editable}
                                                dataField="participacion"
                                                checked={report?.participacion || false}
                                                onChange={(e) => handleInputChange(e, month, yearToSearch)}
                                            />
                                        </td>
                                        <td className="p-2 border border-black text-center">
                                            {editable ? <input type="number" className="w-16 p-1 text-center border rounded" data-field="cursosBiblicos" value={report?.cursosBiblicos ?? ''} onChange={(e) => handleInputChange(e, month, yearToSearch)} /> : (report?.cursosBiblicos ?? '')}
                                        </td>
                                        <td className="p-2 border border-black flex justify-center items-center">
                                            <StyledCheckbox
                                                editable={editable}
                                                dataField="precursorAuxiliar"
                                                checked={!!report?.precursorAuxiliar}
                                                onChange={(e) => handleInputChange(e, month, yearToSearch)}
                                            />
                                        </td>
                                        <td className="p-2 border border-black text-center">
                                            {editable ? <input type="number" step="0.1" className="w-20 p-1 text-center border rounded" data-field="horas" value={report?.horas ?? ''} onChange={(e) => handleInputChange(e, month, yearToSearch)} /> : (report?.horas ?? '')}
                                        </td>
                                        <td className="p-2 border border-black" translate="no">
                                            {editable ? <input type="text" className="w-full p-1 border rounded" data-field="notas" value={report?.notas ?? ''} onChange={(e) => handleInputChange(e, month, yearToSearch)} translate="no" /> : report?.notas}
                                        </td>
                                    </tr>
                                );
                            }
                            return null;
                        })}
                         <tr className="font-bold bg-gray-100">
                            <td className="p-2 border border-black text-right" colSpan={4}>Total</td>
                            <td className="p-2 border border-black text-center">{totalHoras > 0 ? totalHoras.toFixed(1) : ''}</td>
                            <td className="p-2 border border-black"></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};


interface RegistrosServicioProps {
    publishers: Publisher[];
    serviceReports: ServiceReport[];
    onBatchUpdateReports: (reports: Omit<ServiceReport, 'id'>[]) => Promise<void>;
    onDeleteServiceReport: (reportId: string) => Promise<void>;
    canEdit: boolean;
}

// Main Component
const RegistrosServicio: React.FC<RegistrosServicioProps> = ({ publishers, serviceReports, onBatchUpdateReports, onDeleteServiceReport, canEdit }) => {
    const [years, setYears] = useState<number[]>([]);
    
    // State for filters
    const [selectedFilter, setSelectedFilter] = useState(''); // Can be group name or global report key
    const [selectedPublisherId, setSelectedPublisherId] = useState('');
    const [selectedYear, setSelectedYear] = useState(new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear());
    
    // State for editing and special views
    const [isEditing, setIsEditing] = useState(false);
    const [editableReports, setEditableReports] = useState<Report[] | null>(null);
    const [showPublicSubmissions, setShowPublicSubmissions] = useState(false);

    const [status, setStatus] = useState('');
    const [itemsToPrint, setItemsToPrint] = useState<ItemToPrint[]>([]);
    const printContainerRef = useRef<HTMLDivElement>(null);

    const isGlobalView = useMemo(() => selectedFilter.startsWith('global_'), [selectedFilter]);

    const groups = useMemo(() => {
        return [...new Set(publishers.map(p => p.Grupo).filter(Boolean) as string[])].sort();
    }, [publishers]);
    
    const filteredPublishers = useMemo(() => {
        if (isGlobalView || !selectedFilter) return [];
        return publishers
            .filter(p => p.Grupo === selectedFilter)
            .sort((a, b) => `${a.Nombre} ${a.Apellido}`.localeCompare(`${b.Nombre} ${b.Apellido}`));
    }, [selectedFilter, publishers, isGlobalView]);

    const selectedPublisher = useMemo(() => {
        if (isGlobalView || !selectedPublisherId) return null;
        return publishers.find(p => p.id === selectedPublisherId);
    }, [isGlobalView, selectedPublisherId, publishers]);

    const publicSubmissions = useMemo(() => {
        return serviceReports.filter(r => r.idPublicador === 'public_submission').sort((a, b) => {
            if (a.anioCalendario !== b.anioCalendario) return b.anioCalendario - a.anioCalendario;
            return a.mes.localeCompare(b.mes);
        });
    }, [serviceReports]);

    // Effect to initialize filters on first load
    useEffect(() => {
        const currentServiceYearEnd = new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear();
        setYears(Array.from({length: 10}, (_, i) => currentServiceYearEnd - i));
        
        if (groups.length > 0 && !selectedFilter) {
            // Set initial filter and first publisher atomically
            const initialGroup = groups[0];
            const initialPublishers = publishers
                .filter(p => p.Grupo === initialGroup)
                .sort((a, b) => `${a.Nombre} ${a.Apellido}`.localeCompare(`${b.Nombre} ${b.Apellido}`));
            
            setSelectedFilter(initialGroup);
            if(initialPublishers.length > 0) {
                setSelectedPublisherId(initialPublishers[0].id);
            }
        }
    }, [groups, publishers, selectedFilter]);

    const handleFilterChange = (newFilter: string) => {
        setIsEditing(false);
        setSelectedFilter(newFilter);

        const isNewFilterGlobal = newFilter.startsWith('global_');
        if (isNewFilterGlobal) {
            setSelectedPublisherId('');
        } else {
            const newPublishersInGroup = publishers
                .filter(p => p.Grupo === newFilter)
                .sort((a, b) => `${a.Nombre} ${a.Apellido}`.localeCompare(`${b.Nombre} ${b.Apellido}`));
            
            if (newPublishersInGroup.length > 0) {
                setSelectedPublisherId(newPublishersInGroup[0].id);
            } else {
                setSelectedPublisherId('');
            }
        }
    };

    const globalReportData = useMemo(() => {
        const serviceYearStart = selectedYear - 1;
        const regularPioneerIds = new Set(publishers.filter(p => p['Priv Adicional'] === 'Precursor Regular').map(p => p.id));
        
        const data: { [key in GlobalReportType]: { [month: string]: { count: number; hours?: number; cursos?: number } } } = {
            global_regulares: {}, global_auxiliares: {}, global_publicadores: {}
        };
        let totalHorasRegulares = 0;

        SERVICE_YEAR_MONTHS.forEach((month, index) => {
            const yearToSearch = index < 4 ? serviceYearStart : selectedYear;
            const monthReports = serviceReports.filter(r => r.anioCalendario === yearToSearch && r.mes === month);
            
            // Publicadores
            const informedReports = monthReports.filter(r => r.participacion);
            data.global_publicadores[month] = {
                count: informedReports.length,
                cursos: informedReports.reduce((sum, r) => sum + (r.cursosBiblicos || 0), 0)
            };

            // Auxiliares
            const auxReports = monthReports.filter(r => r.precursorAuxiliar === 'PA');
            data.global_auxiliares[month] = {
                count: auxReports.length,
                cursos: auxReports.reduce((sum, r) => sum + (r.cursosBiblicos || 0), 0),
            };
            
            // Regulares
            const regularReports = monthReports.filter(r => r.participacion && regularPioneerIds.has(r.idPublicador));
            const monthHours = regularReports.reduce((sum, r) => sum + (r.horas || 0), 0);
            const monthCursos = regularReports.reduce((sum, r) => sum + (r.cursosBiblicos || 0), 0);
            data.global_regulares[month] = {
                count: regularReports.length,
                hours: monthHours,
                cursos: monthCursos,
            };
            totalHorasRegulares += monthHours;
        });

        return { ...data, totalHorasAnualRegulares: totalHorasRegulares };

    }, [publishers, serviceReports, selectedYear]);

    const handleDataChange = useCallback((change: Report) => {
        setEditableReports(prevReports => {
            if (!prevReports) return [];
            const newReports = [...prevReports];
            const index = newReports.findIndex(r => r.idPublicador === change.idPublicador && r.mes === change.mes && r.anioCalendario === change.anioCalendario);

            if (index > -1) {
                newReports[index] = change;
            } else {
                newReports.push(change);
            }
            return newReports;
        });
    }, []);
    
    const handleEditClick = () => {
        setEditableReports(JSON.parse(JSON.stringify(serviceReports)));
        setIsEditing(true);
        setStatus('');
    };

    const handleCancelClick = () => {
        setIsEditing(false);
        setEditableReports(null);
        setStatus('');
    };

    const handleSaveClick = async () => {
        if (editableReports && selectedPublisherId) {
            setStatus('Guardando cambios...');
            try {
                const reportsForPublisher = editableReports.filter(r => r.idPublicador === selectedPublisherId);
                await onBatchUpdateReports(reportsForPublisher);
                setIsEditing(false);
                setEditableReports(null);
                setStatus('¡Cambios guardados con éxito!');
                setTimeout(() => setStatus(''), 3000);
            } catch (error) {
                setStatus('Error al guardar los cambios.');
                console.error(error);
            }
        }
    };

    const handleDeleteReport = async (report: ServiceReport) => {
        const confirmation = window.confirm(`¿Estás seguro de que deseas eliminar el informe de "${report.nombrePublicador}" para ${report.mes} ${report.anioCalendario}? Esta acción no se puede deshacer.`);
        if (confirmation) {
            setStatus(`Eliminando informe de ${report.nombrePublicador}...`);
            try {
                await onDeleteServiceReport(report.id);
                setStatus('¡Informe eliminado con éxito!');
            } catch (error) {
                setStatus('Error al eliminar el informe.');
                console.error(error);
            } finally {
                setTimeout(() => setStatus(''), 3000);
            }
        }
    };


    const handlePrintGroup = () => {
        if (isGlobalView || filteredPublishers.length === 0) {
            setStatus("Seleccione un grupo con publicadores para imprimir.");
            setTimeout(() => setStatus(""), 3000);
            return;
        }
        setStatus(`Preparando ${filteredPublishers.length} tarjetas para PDF...`);
        const items = filteredPublishers.map(p => ({ type: 'publisher' as 'publisher', id: p.id }));
        setItemsToPrint(items);
    };

    const handlePrintGlobals = () => {
        setStatus("Preparando informes globales para PDF...");
        const items: ItemToPrint[] = [
            { type: 'global', id: 'global_regulares' },
            { type: 'global', id: 'global_auxiliares' },
            { type: 'global', id: 'global_publicadores' },
        ];
        setItemsToPrint(items);
    };

    const exportSinglePDF = () => {
        if (!selectedFilter) return;

        const idToPrint = isGlobalView ? selectedFilter : selectedPublisherId;
        if (!idToPrint) {
            setStatus("Seleccione un publicador o informe para imprimir.");
            setTimeout(() => setStatus(""), 3000);
            return;
        }
        
        setStatus("Preparando tarjeta para PDF...");
        const type = isGlobalView ? 'global' : 'publisher';
        setItemsToPrint([{ type, id: idToPrint }]);
    };
    
    const handleExportAllReportsCSV = () => {
        if (serviceReports.length === 0) {
            alert("No hay informes de servicio para exportar.");
            return;
        }

        const dataToExport = serviceReports.map(report => {
            const publisher = publishers.find(p => p.id === report.idPublicador);
            const publisherName = publisher ? [publisher.Nombre, publisher.Apellido, publisher['2do Apellido'], publisher['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ') : (report.nombrePublicador || 'Desconocido (Envío Público)');
            return {
                'Año': report.anioCalendario,
                'Mes': report.mes,
                'Publicador': publisherName,
                'Participó': report.participacion ? 'Sí' : 'No',
                'Precursor Auxiliar': report.precursorAuxiliar === 'PA' ? 'Sí' : 'No',
                'Horas': report.horas ?? '',
                'Cursos Bíblicos': report.cursosBiblicos ?? '',
                'Notas': report.notas ?? '',
            };
        });

        const headers = Object.keys(dataToExport[0]);
        const csvRows = [
            headers.join(','),
            ...dataToExport.map(row =>
                headers.map(header => {
                    let cell = String(row[header as keyof typeof row] ?? '').replace(/"/g, '""');
                    if (cell.includes(',')) {
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
        link.setAttribute('download', 'todos_los_informes_de_servicio.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    useEffect(() => {
        if (itemsToPrint.length === 0 || !printContainerRef.current) return;

        const generatePdf = async () => {
            // @ts-ignore
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const container = printContainerRef.current;
            
            // Short delay to ensure React has rendered the items
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const cardElements = container.querySelectorAll<HTMLElement>('.record-card');
            
            for (let i = 0; i < cardElements.length; i++) {
                const card = cardElements[i];
                setStatus(`Generando PDF: Página ${i + 1} de ${cardElements.length}...`);
                // @ts-ignore
                const canvas = await html2canvas(card, { scale: 2, useCORS: true });
                const imgData = canvas.toDataURL('image/png');
                
                if (i > 0) {
                    pdf.addPage();
                }

                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgProps = pdf.getImageProperties(imgData);
                const ratio = imgProps.width / imgProps.height;
                let imgWidth = pdfWidth - 20;
                let imgHeight = imgWidth / ratio;
                if(imgHeight > pdfHeight - 20){
                    imgHeight = pdfHeight - 20;
                    imgWidth = imgHeight * ratio;
                }

                pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
            }

            const fileName = `Registros_${selectedFilter}_${selectedYear}.pdf`;
            pdf.save(fileName);
            setItemsToPrint([]); // Reset
            setStatus("PDF Generado.");
            setTimeout(() => setStatus(""), 3000);
        };

        generatePdf().catch(err => {
            console.error("PDF generation failed:", err);
            setStatus("Error al generar el PDF.");
            setItemsToPrint([]);
        });

    }, [itemsToPrint, selectedFilter, selectedYear]);


    const reportsToDisplay = isEditing ? editableReports : serviceReports;
    const globalType = isGlobalView ? selectedFilter as GlobalReportType : undefined;

    return (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-center mb-6">Registro de Publicador</h1>
            
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 items-end">
                <div>
                    <label>Grupo / Informe:</label>
                    <select value={selectedFilter} onChange={e => handleFilterChange(e.target.value)} className="p-2 w-full border rounded-md" disabled={showPublicSubmissions}>
                        <option value="">Seleccione</option>
                        <optgroup label="Grupos de Servicio">
                            {groups.map(g => <option key={g} value={g}>{g}</option>)}
                        </optgroup>
                         <optgroup label="Informes Globales">
                            <option value="global_regulares">Precursores Regulares</option>
                            <option value="global_auxiliares">Precursores Auxiliares</option>
                            <option value="global_publicadores">Publicadores de la Congregación</option>
                        </optgroup>
                    </select>
                </div>
                <div>
                    <label>Publicador:</label>
                    <select
                        value={selectedPublisherId}
                        onChange={e => {
                            setIsEditing(false);
                            setSelectedPublisherId(e.target.value);
                        }}
                        className="p-2 w-full border rounded-md"
                        disabled={isGlobalView || !selectedFilter || showPublicSubmissions}
                    >
                        <option value="">{isGlobalView ? 'N/A' : 'Seleccione'}</option>
                        {filteredPublishers.map(p => <option key={p.id} value={p.id}>{[p.Nombre, p.Apellido, p['2do Apellido'], p['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ')}</option>)}
                    </select>
                </div>
                <div><label>Año de Servicio:</label><select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="p-2 w-full border rounded-md" disabled={showPublicSubmissions}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
            </div>

            <div className="flex flex-wrap justify-center items-center gap-4 mb-4">
                 {isEditing ? (
                    <>
                        <button onClick={handleSaveClick} className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 font-semibold">Guardar Cambios</button>
                        <button onClick={handleCancelClick} className="bg-gray-500 text-white px-6 py-2 rounded-md hover:bg-gray-600 font-semibold">Cancelar</button>
                    </>
                ) : (
                    <button onClick={handleEditClick} disabled={!canEdit || !selectedPublisherId || isGlobalView || showPublicSubmissions} className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed">Editar Registro</button>
                )}
                {canEdit && (
                    <button onClick={() => setShowPublicSubmissions(s => !s)} className="bg-yellow-500 text-white px-6 py-2 rounded-md hover:bg-yellow-600 font-semibold">
                        {showPublicSubmissions ? 'Volver a Registros' : 'Limpieza de Informes'}
                    </button>
                )}
            </div>

            <div className="min-h-[20px] text-center font-bold text-blue-600 mb-4">{status}</div>
            
            {/* Main display area */}
            <div>
                 {showPublicSubmissions ? (
                    <div className="border p-4 rounded-lg">
                        <h2 className="text-xl font-bold text-yellow-700 mb-2">Informes Públicos No Vinculados</h2>
                        <p className="text-sm text-gray-600 mb-4">Esta es una lista de informes enviados a través del formulario público que no corresponden a ningún publicador registrado. Puede eliminarlos para mantener la base de datos limpia.</p>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-2 text-left">Nombre Escrito</th>
                                        <th className="p-2 text-left">Mes/Año</th>
                                        <th className="p-2 text-center">Participó</th>
                                        <th className="p-2 text-center">Cursos</th>
                                        <th className="p-2 text-center">Horas</th>
                                        <th className="p-2 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {publicSubmissions.map(report => (
                                        <tr key={report.id} className="border-b">
                                            <td className="p-2 font-medium">{report.nombrePublicador}</td>
                                            <td className="p-2">{report.mes} {report.anioCalendario}</td>
                                            <td className="p-2 text-center">{report.participacion ? 'Sí' : 'No'}</td>
                                            <td className="p-2 text-center">{report.cursosBiblicos ?? '–'}</td>
                                            <td className="p-2 text-center">{report.horas ?? '–'}</td>
                                            <td className="p-2 text-center">
                                                <button onClick={() => handleDeleteReport(report)} className="text-red-600 hover:text-red-800 font-semibold">Eliminar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {publicSubmissions.length === 0 && <p className="text-center text-gray-500 p-4">No se encontraron informes públicos no vinculados.</p>}
                        </div>
                    </div>
                 ) : (
                    <>
                         {!selectedFilter && (
                             <p className="text-center text-gray-500 p-6">Seleccione un grupo o informe global para ver su registro.</p>
                         )}
                         {globalType && (
                            <RecordCard
                                serviceYearEnd={selectedYear}
                                editable={false}
                                globalReport={{
                                    title:
                                        globalType === 'global_regulares' ? 'Precursores Regulares' :
                                        globalType === 'global_auxiliares' ? 'Precursores Auxiliares' :
                                        'Publicadores de la Congregación',
                                    data: globalReportData[globalType],
                                    totalHorasAnual: globalType === 'global_regulares' ? globalReportData.totalHorasAnualRegulares : undefined
                                }}
                            />
                         )}
                         {!isGlobalView && selectedPublisher && reportsToDisplay && (
                            <RecordCard 
                                key={selectedPublisher.id}
                                publisher={selectedPublisher}
                                serviceYearEnd={selectedYear}
                                reportsData={reportsToDisplay}
                                editable={isEditing}
                                onDataChange={handleDataChange}
                            />
                        )}
                    </>
                 )}
            </div>

            {/* Export Buttons Section */}
            {!isEditing && !showPublicSubmissions && selectedFilter && (
                <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap justify-center items-center gap-4">
                    <button onClick={exportSinglePDF} disabled={itemsToPrint.length > 0} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed">PDF Publicador</button>
                    <button onClick={handlePrintGroup} disabled={isGlobalView || itemsToPrint.length > 0} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed">PDF por Grupo</button>
                    <button onClick={handlePrintGlobals} disabled={itemsToPrint.length > 0} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed">PDF Globales</button>
                    <button onClick={handleExportAllReportsCSV} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed" disabled={itemsToPrint.length > 0 || serviceReports.length === 0}>Exportar Informes (CSV)</button>
                </div>
            )}


            {/* Hidden container for printing */}
            <div ref={printContainerRef} className="absolute -left-[9999px] top-0">
                {itemsToPrint.map(item => {
                    const isGlobalItem = item.type === 'global';
                    const globalTypeItem = isGlobalItem ? item.id as GlobalReportType : undefined;

                    if (globalTypeItem) {
                        return <RecordCard
                                    key={item.id}
                                    serviceYearEnd={selectedYear}
                                    editable={false}
                                    globalReport={{
                                        title:
                                            globalTypeItem === 'global_regulares' ? 'Precursores Regulares' :
                                            globalTypeItem === 'global_auxiliares' ? 'Precursores Auxiliares' :
                                            'Publicadores de la Congregación',
                                        data: globalReportData[globalTypeItem],
                                        totalHorasAnual: globalTypeItem === 'global_regulares' ? globalReportData.totalHorasAnualRegulares : undefined
                                    }}
                                />;
                    }
                    
                    if (!isGlobalItem) {
                        const publisher = publishers.find(p => p.id === item.id);
                        if (publisher) {
                             return <RecordCard 
                                        key={item.id}
                                        publisher={publisher}
                                        serviceYearEnd={selectedYear}
                                        reportsData={serviceReports}
                                        editable={false}
                                    />;
                        }
                    }
                    return null;
                })}
            </div>
        </div>
    );
};

export default RegistrosServicio;