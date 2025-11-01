import React, { useState, useMemo } from 'react';
import { Publisher, ServiceReport, MONTHS, PioneerApplication } from '../App';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactElement;
    color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
    <div className={`bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4 border-l-4 ${color}`}>
        <div className={`p-3 rounded-full ${color.replace('border-', 'bg-').replace('-500', '-100')}`}>
            {icon}
        </div>
        <div className="min-w-0">
            <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
            <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
        </div>
    </div>
);

interface DashboardPrecursoresProps {
    publishers: Publisher[];
    serviceReports: ServiceReport[];
    pioneerApplications: PioneerApplication[];
}

const DashboardPrecursores: React.FC<DashboardPrecursoresProps> = ({ publishers, serviceReports, pioneerApplications }) => {
    const currentServiceYearEnd = new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear();
    const currentMonthName = MONTHS[new Date().getMonth()];

    const [selectedYear, setSelectedYear] = useState(currentServiceYearEnd);
    const [selectedMonth, setSelectedMonth] = useState(currentMonthName);

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentServiceYearEnd - i), [currentServiceYearEnd]);

    const stats = useMemo(() => {
        const regularPioneersCount = publishers.filter(p => p.Estatus === 'Activo' && p['Priv Adicional'] === 'Precursor Regular').length;
        
        const calendarYearForSelectedMonth = MONTHS.indexOf(selectedMonth) >= 8 ? selectedYear - 1 : selectedYear;

        const auxiliaryPioneersForSelectedMonth = serviceReports.filter(r => 
            r.anioCalendario === calendarYearForSelectedMonth && 
            r.mes === selectedMonth && 
            r.precursorAuxiliar === 'PA'
        ).length;

        const pioneerNamesForSelectedMonth = serviceReports.filter(r => 
            r.anioCalendario === calendarYearForSelectedMonth && 
            r.mes === selectedMonth && 
            r.precursorAuxiliar === 'PA'
        ).map(report => {
            const pub = publishers.find(p => p.id === report.idPublicador);
            return pub ? [pub.Nombre, pub.Apellido, pub['2do Apellido'], pub['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ') : report.nombrePublicador || 'Nombre Desconocido';
        }).sort();

        return {
            regularPioneersCount,
            auxiliaryPioneersForSelectedMonth,
            pioneerNamesForSelectedMonth,
        };
    }, [publishers, serviceReports, selectedYear, selectedMonth]);

     const approvedPioneers = useMemo(() => {
        const calendarYearForSelectedMonth = MONTHS.indexOf(selectedMonth) >= 8 ? selectedYear - 1 : selectedYear;
        const referenceDate = new Date(calendarYearForSelectedMonth, MONTHS.indexOf(selectedMonth), 1);
        
        const currentMonthIndex = referenceDate.getMonth();
        const currentYear = referenceDate.getFullYear();
        const currentMonthName = MONTHS[currentMonthIndex].toLowerCase();
        
        const nextMonthDate = new Date(currentYear, currentMonthIndex + 1, 1);
        const nextMonthName = MONTHS[nextMonthDate.getMonth()].toLowerCase();

        const approvedApps = pioneerApplications.filter(app => app.status === 'Aprobado');

        const names = new Set<string>();

        approvedApps.forEach(app => {
            if (app.deContinuo) {
                names.add(app.nombre);
                return;
            }
            const appMonths = app.mes.toLowerCase().split(/, | y | and /).map(m => m.trim());
            if (appMonths.some(appMonth => appMonth.includes(currentMonthName) || appMonth.includes(nextMonthName))) {
                names.add(app.nombre);
            }
        });
        
        return {
            count: names.size,
            names: Array.from(names).sort(),
            currentMonth: MONTHS[currentMonthIndex],
            nextMonth: MONTHS[nextMonthDate.getMonth()]
        };
    }, [pioneerApplications, selectedMonth, selectedYear]);

    const chartData = useMemo(() => {
        const data = [];
        const serviceYearStart = selectedYear -1;

        const serviceYearMonths = [...MONTHS.slice(8), ...MONTHS.slice(0, 8)];

        serviceYearMonths.forEach((monthName, index) => {
            const calendarYear = index < 4 ? serviceYearStart : selectedYear;

            const pioneersInMonthCount = serviceReports.filter(report =>
                report.anioCalendario === calendarYear &&
                report.mes === monthName &&
                report.precursorAuxiliar === 'PA'
            ).length;

            data.push({
                label: `${monthName.substring(0, 3)}-${calendarYear.toString().slice(-2)}`,
                value: pioneersInMonthCount,
                isHighlighted: monthName === selectedMonth,
            });
        });
        
        return data;
    }, [selectedYear, selectedMonth, serviceReports]);

    const maxChartValue = Math.max(5, ...chartData.map(d => d.value));
    const hasData = useMemo(() => chartData.some(d => d.value > 0), [chartData]);
    
    return (
        <div className="container mx-auto max-w-7xl p-4 space-y-8">
            <h1 className="text-3xl font-bold text-center text-gray-800">Dashboard de Precursores</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-white rounded-lg shadow-md border">
                <div>
                    <label htmlFor="year-select" className="block text-sm font-medium text-gray-700">Año de Servicio:</label>
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
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard 
                    title="Precursores Regulares Activos" 
                    value={stats.regularPioneersCount} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                    color="border-purple-500"
                />
                 <StatCard 
                    title={`Precursores Auxiliares (${selectedMonth})`} 
                    value={stats.auxiliaryPioneersForSelectedMonth} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                    color="border-yellow-500"
                />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Tendencia de Prec. Auxiliares (Año de Servicio {selectedYear})</h2>
                    {hasData ? (
                        <div className="overflow-x-auto pb-4">
                            <div className="flex items-end h-64 space-x-2 min-w-[600px]">
                                {chartData.map((data, index) => (
                                    <div key={index} className="flex-1 h-full flex flex-col justify-end items-center">
                                        <div 
                                            className={`w-full ${data.isHighlighted ? 'bg-orange-500 hover:bg-orange-600' : 'bg-yellow-400 hover:bg-yellow-500'} rounded-t-md transition-all flex justify-center items-start pt-1`}
                                            style={{ height: `${(data.value / maxChartValue) * 100}%` }}
                                            title={`${data.label}: ${data.value} precursores`}
                                        >
                                            {data.value > 0 && <span className="text-xs font-bold text-gray-800">{data.value}</span>}
                                        </div>
                                        <span className={`text-xs text-gray-500 mt-1 ${data.isHighlighted ? 'font-bold text-gray-800' : 'text-gray-500'}`}>{data.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-8">No hay datos de precursores auxiliares para mostrar en este período.</p>
                    )}
                </div>
                 <div className="space-y-6">
                     <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            Próximos Aprobados ({approvedPioneers.count})
                            <span className="block text-sm font-normal text-gray-500">{approvedPioneers.currentMonth} y {approvedPioneers.nextMonth}</span>
                        </h2>
                         {approvedPioneers.names.length > 0 ? (
                            <ul className="space-y-2 max-h-40 overflow-y-auto">
                                {approvedPioneers.names.map(name => (
                                    <li key={name} className="flex items-center space-x-3 p-2 bg-blue-50 rounded-md">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        <span className="font-medium text-gray-700">{name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-gray-500 pt-8">No hay precursores aprobados para los meses seleccionados.</p>
                        )}
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Informaron en {selectedMonth} ({stats.pioneerNamesForSelectedMonth.length})</h2>
                        {stats.pioneerNamesForSelectedMonth.length > 0 ? (
                            <ul className="space-y-2 max-h-40 overflow-y-auto">
                                {stats.pioneerNamesForSelectedMonth.map(name => (
                                    <li key={name} className="flex items-center space-x-3 p-2 bg-green-50 rounded-md">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                        <span className="font-medium text-gray-700">{name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-gray-500 pt-8">Nadie informó como precursor auxiliar en {selectedMonth}.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardPrecursores;
