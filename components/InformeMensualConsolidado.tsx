


import React, { useState, useMemo } from 'react';
import { Publisher, ServiceReport, MONTHS } from '../App';

interface InformeMensualConsolidadoProps {
    publishers: Publisher[];
    serviceReports: ServiceReport[];
}

const InformeMensualConsolidado: React.FC<InformeMensualConsolidadoProps> = ({ publishers, serviceReports }) => {
    const currentYear = new Date().getFullYear();
    const currentMonthName = MONTHS[new Date().getMonth()];

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);

    const toggleAccordion = (groupName: string) => {
        setOpenAccordion(prev => (prev === groupName ? null : groupName));
    };

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - i), [currentYear]);

    const consolidatedData = useMemo(() => {
        const participatingReports = serviceReports.filter(r =>
            r.anioCalendario === selectedYear && r.mes === selectedMonth && r.participacion
        );

        const regularPioneerIds = new Set(publishers.filter(p => p['Priv Adicional'] === 'Precursor Regular').map(p => p.id));

        const auxReports = participatingReports.filter(r => r.precursorAuxiliar === 'PA');
        const auxReportIds = new Set(auxReports.map(r => r.id));
        const auxCount = auxReports.length;
        const auxHours = auxReports.reduce((sum, r) => sum + (r.horas || 0), 0);
        const auxCourses = auxReports.reduce((sum, r) => sum + (r.cursosBiblicos || 0), 0);

        const regReports = participatingReports.filter(r => 
            !auxReportIds.has(r.id) && regularPioneerIds.has(r.idPublicador)
        );
        const regReportIds = new Set(regReports.map(r => r.id));
        const regCount = regReports.length;
        const regHours = regReports.reduce((sum, r) => sum + (r.horas || 0), 0);
        const regCourses = regReports.reduce((sum, r) => sum + (r.cursosBiblicos || 0), 0);
        
        const pubOnlyReports = participatingReports.filter(r => 
            !auxReportIds.has(r.id) && !regReportIds.has(r.id)
        );
        const pubCount = pubOnlyReports.length;
        const pubCourses = pubOnlyReports.reduce((sum, r) => sum + (r.cursosBiblicos || 0), 0);

        const totalCount = pubCount + auxCount + regCount;
        const totalHours = auxHours + regHours;
        const totalCourses = pubCourses + auxCourses + regCourses;

        return {
            publicadores: { cantidad: pubCount, horas: undefined, cursos: pubCourses },
            auxiliares: { cantidad: auxCount, horas: auxHours, cursos: auxCourses },
            regulares: { cantidad: regCount, horas: regHours, cursos: regCourses },
            totales: { cantidad: totalCount, horas: totalHours, cursos: totalCourses },
        };
    }, [publishers, serviceReports, selectedYear, selectedMonth]);

    const publishersWhoDidNotReport = useMemo(() => {
        const activePublishers = publishers.filter(p => p.Estatus === 'Activo');
        
        return activePublishers.filter(pub => {
            const hasReported = serviceReports.some(r =>
                r.idPublicador === pub.id &&
                r.anioCalendario === selectedYear &&
                r.mes === selectedMonth &&
                r.participacion === true
            );
            return !hasReported;
        });
    }, [publishers, serviceReports, selectedYear, selectedMonth]);
    
    const pendingByGroup = useMemo(() => {
        if (publishersWhoDidNotReport.length === 0) return {};
        
        const sortedPublishers = [...publishersWhoDidNotReport].sort((a, b) => a.Nombre.localeCompare(b.Nombre));

        return sortedPublishers.reduce((acc, pub) => {
            const groupName = pub.Grupo || 'Sin Grupo';
            if (!acc[groupName]) {
                acc[groupName] = [];
            }
            acc[groupName].push(pub);
            return acc;
        }, {} as Record<string, Publisher[]>);
    }, [publishersWhoDidNotReport]);

    const publishersWhoBecameInactive = useMemo(() => {
        const monthIndex = MONTHS.indexOf(selectedMonth);
        const monthsToCheck: { month: string; year: number }[] = [];
        for (let i = 0; i < 7; i++) {
            let newMonthIndex = monthIndex - i;
            let newYear = selectedYear;
            while (newMonthIndex < 0) {
                newMonthIndex += 12;
                newYear--;
            }
            monthsToCheck.push({ month: MONTHS[newMonthIndex], year: newYear });
        }

        const activePublishers = publishers.filter(p => p.Estatus === 'Activo');

        return activePublishers.filter(pub => {
            const isInactiveFor6Months = monthsToCheck.slice(0, 6).every(({ month, year }) => {
                const report = serviceReports.find(r =>
                    r.idPublicador === pub.id &&
                    r.anioCalendario === year &&
                    r.mes === month &&
                    r.participacion === true
                );
                return !report;
            });

            if (!isInactiveFor6Months) return false;

            const seventhMonthBack = monthsToCheck[6];
            return serviceReports.some(r =>
                r.idPublicador === pub.id &&
                r.anioCalendario === seventhMonthBack.year &&
                r.mes === seventhMonthBack.month &&
                r.participacion === true
            );
        });
    }, [publishers, serviceReports, selectedYear, selectedMonth]);

    const tableRows = [
        { categoria: 'Publicadores que informaron', data: consolidatedData.publicadores },
        { categoria: 'Precursores Auxiliares', data: consolidatedData.auxiliares },
        { categoria: 'Precursores Regulares', data: consolidatedData.regulares },
    ];

    return (
        <div className="container mx-auto max-w-5xl bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Informe a la Sucursal</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
                <div>
                    <label htmlFor="year-select" className="block text-sm font-medium text-gray-700">Año:</label>
                    <select id="year-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="month-select" className="block text-sm font-medium text-gray-700">Mes:</label>
                    <select id="month-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                        {MONTHS.map(m => <option key={m} value={m} translate="no">{m}</option>)}
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Categoría</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Cantidad</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Horas</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Cursos Bíblicos</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {tableRows.map(row => (
                            <tr key={row.categoria} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{row.categoria}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">{row.data.cantidad}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">{row.data.horas !== undefined ? row.data.horas.toFixed(1) : '–'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-700">{row.data.cursos}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-200 font-bold">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">TOTALES</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">{consolidatedData.totales.cantidad}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">{consolidatedData.totales.horas.toFixed(1)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">{consolidatedData.totales.cursos}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-6 text-xs text-gray-500 text-center">
                <p>* "Publicadores que informaron" muestra solo publicadores que no son precursores regulares ni sirvieron como auxiliares este mes.</p>
                <p>* Las horas totales solo suman las de precursores auxiliares y regulares.</p>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                    <h2 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-3">Publicadores Pendientes de Informar ({publishersWhoDidNotReport.length})</h2>
                    {publishersWhoDidNotReport.length > 0 ? (
                         <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                            {Object.entries(pendingByGroup).map(([groupName, pendingPubs]) => {
                                const typedPendingPubs = pendingPubs as Publisher[];
                                return (
                                <div key={groupName}>
                                    <button onClick={() => toggleAccordion(groupName)} className="w-full flex justify-between items-center p-3 text-left hover:bg-gray-50 focus:outline-none">
                                        <span className="font-semibold text-gray-800">{groupName} ({typedPendingPubs.length})</span>
                                        <svg className={`w-5 h-5 text-gray-500 transition-transform transform ${openAccordion === groupName ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                    {openAccordion === groupName && (
                                        <ul className="pl-6 pr-3 pb-3 text-sm space-y-2 bg-gray-50/50">
                                            {typedPendingPubs.map(pub => (
                                                <li key={pub.id} className="text-gray-700 pt-1">{pub.Nombre} {pub.Apellido}</li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )})}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">Todos los publicadores activos han informado.</p>
                    )}
                </div>
                <div>
                    <h2 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-3">Publicadores que se Hicieron Inactivos este Mes ({publishersWhoBecameInactive.length})</h2>
                    {publishersWhoBecameInactive.length > 0 ? (
                        <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
                            {publishersWhoBecameInactive.map(pub => (
                                <li key={pub.id} className="p-2 bg-red-50 rounded-md">
                                    <span className="font-medium text-gray-800">{pub.Nombre} {pub.Apellido}</span> - <span className="text-gray-600">Grupo: {pub.Grupo || 'N/A'}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500">Ningún publicador se ha vuelto inactivo este mes.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default InformeMensualConsolidado;