import React, { useState, useMemo } from 'react';
import { Publisher, ServiceReport, MONTHS } from '../App';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactElement;
    color: string;
    isAlertCard?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, isAlertCard = false }) => {
    const isZeroAndAlert = isAlertCard && value === 0;

    const displayColor = isZeroAndAlert ? 'border-green-500' : color;
    const iconBgColor = isZeroAndAlert
        ? 'bg-green-100'
        : color.replace('border-', 'bg-').replace('-500', '-100');

    return (
        <div className={`bg-white p-6 rounded-xl shadow-lg flex items-start space-x-4 border-l-4 ${displayColor}`}>
            <div className={`p-3 rounded-full ${iconBgColor} flex-shrink-0 mt-1`}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-500">{title}</p>
                {isZeroAndAlert ? (
                    <div className="mt-1 flex items-center text-green-500">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                ) : (
                    <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
                )}
            </div>
        </div>
    );
};


const DashboardCursos: React.FC<{ publishers: Publisher[], serviceReports: ServiceReport[] }> = ({ publishers, serviceReports }) => {
    const currentServiceYearEnd = new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear();
    const currentMonthName = MONTHS[new Date().getMonth()];

    const [selectedYear, setSelectedYear] = useState(currentServiceYearEnd);
    const [selectedMonth, setSelectedMonth] = useState(currentMonthName);

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentServiceYearEnd - i), [currentServiceYearEnd]);

    // Memoized calculation for all dashboard stats
    const allStats = useMemo(() => {
        const calendarYearForSelectedMonth = MONTHS.indexOf(selectedMonth) >= 8 ? selectedYear - 1 : selectedYear;
        
        // --- Stats for selected month ---
        const monthlyReports = serviceReports.filter(r =>
            r.anioCalendario === calendarYearForSelectedMonth && r.mes === selectedMonth && r.participacion
        );
        const reportsWithCourses = monthlyReports.filter(r => (Number(r.cursosBiblicos) || 0) > 0);
        
        const activePublishers = publishers.filter(p => p.Estatus === 'Activo');
        const activeRegularPioneers = activePublishers.filter(p => p['Priv Adicional'] === 'Precursor Regular');
        const activeRegularPioneerIds = new Set(activeRegularPioneers.map(p => p.id));
        
        const totalCourses = reportsWithCourses.reduce((sum, r) => sum + (Number(r.cursosBiblicos) || 0), 0);
        
        const uniquePublishersWithCourses = new Set(reportsWithCourses.map(r => r.idPublicador));

        const auxPioneerReports = reportsWithCourses.filter(r => r.precursorAuxiliar === 'PA');
        const regPioneerReports = reportsWithCourses.filter(r =>
            r.precursorAuxiliar !== 'PA' && activeRegularPioneerIds.has(r.idPublicador)
        );
        const publisherOnlyReports = reportsWithCourses.filter(r =>
            r.precursorAuxiliar !== 'PA' && !activeRegularPioneerIds.has(r.idPublicador)
        );

        const auxPioneerCourses = auxPioneerReports.reduce((sum, r) => sum + (Number(r.cursosBiblicos) || 0), 0);
        const regPioneerCourses = regPioneerReports.reduce((sum, r) => sum + (Number(r.cursosBiblicos) || 0), 0);
        const publisherCourses = publisherOnlyReports.reduce((sum, r) => sum + (Number(r.cursosBiblicos) || 0), 0);

        // --- Stats for last 6 months ---
        const sixMonthsRange: { month: string, year: number }[] = [];
        let monthIndex = MONTHS.indexOf(selectedMonth);
        let year = calendarYearForSelectedMonth;
        for (let i = 0; i < 6; i++) {
            sixMonthsRange.push({ month: MONTHS[monthIndex], year });
            monthIndex--;
            if (monthIndex < 0) {
                monthIndex = 11;
                year--;
            }
        }
        const reportsLast6Months = serviceReports.filter(report =>
            sixMonthsRange.some(range => range.month === report.mes && range.year === report.anioCalendario)
        );
        const uniqueAuxPioneersLast6Months = new Set(
            reportsLast6Months.filter(r => r.precursorAuxiliar === 'PA').map(r => r.idPublicador)
        );

        // --- New Stats ---
        const regularPioneersWithCoursesIds = new Set(regPioneerReports.map(r => r.idPublicador));
        const regularPioneersWithoutCourses = activeRegularPioneers.length - regularPioneersWithCoursesIds.size;
        const publishersWithoutCourses = activePublishers.length - uniquePublishersWithCourses.size;


        return {
            totalCourses,
            auxPioneerCourses,
            regPioneerCourses,
            publisherCourses,
            uniquePublishersWithCourses: uniquePublishersWithCourses.size,
            totalActivePublishers: activePublishers.length > 0 ? activePublishers.length : 'N/A',
            uniqueAuxPioneersLast6Months: uniqueAuxPioneersLast6Months.size,
            regularPioneersWithoutCourses,
            publishersWithoutCourses,
        };
    }, [selectedYear, selectedMonth, serviceReports, publishers]);

    // Memoized calculation for the selected service year chart data
    const chartData = useMemo(() => {
        const data = [];
        const serviceYearStart = selectedYear - 1;

        const serviceYearMonths = [...MONTHS.slice(8), ...MONTHS.slice(0, 8)];

        serviceYearMonths.forEach((monthName, index) => {
            const calendarYear = index < 4 ? serviceYearStart : selectedYear;

            const coursesInMonth = serviceReports
                .filter(r => r.anioCalendario === calendarYear && r.mes === monthName && r.participacion)
                .reduce((sum, r) => sum + (Number(r.cursosBiblicos) || 0), 0);

            data.push({
                label: `${monthName.substring(0, 3)}-${calendarYear.toString().slice(-2)}`,
                value: coursesInMonth,
                isHighlighted: monthName === selectedMonth,
            });
        });
        
        return data;
    }, [selectedYear, selectedMonth, serviceReports]);
    
    const maxChartValue = Math.max(5, ...chartData.map(d => d.value));
    const hasData = useMemo(() => chartData.some(d => d.value > 0), [chartData]);

    return (
        <div className="container mx-auto max-w-7xl p-4 space-y-8">
            <h1 className="text-3xl font-bold text-center text-gray-800">Dashboard de Cursos Bíblicos</h1>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-white rounded-lg shadow-md border">
                <div>
                    <label htmlFor="year-select" className="block text-sm font-medium text-gray-700">Año de Servicio:</label>
                    <select id="year-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="month-select" className="block text-sm font-medium text-gray-700">Mes (para tarjetas):</label>
                    <select id="month-select" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                        {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            </div>

            {/* Stat Cards */}
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title={`Total de Cursos Bíblicos (${selectedMonth})`} 
                    value={allStats.totalCourses} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 6.25278C12 6.25278 5.72266 10 3 10C3 18 12 22 12 22C12 22 21 18 21 10C18.2773 10 12 6.25278 12 6.25278Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 12L3 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    color="border-blue-500"
                />
                <StatCard 
                    title={`Total de Personas con Cursos (${selectedMonth})`} 
                    value={`${allStats.uniquePublishersWithCourses} / ${allStats.totalActivePublishers}`} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    color="border-teal-500"
                />
                 <StatCard 
                    title="Prec. Aux. Distintos (Últ. 6m)" 
                    value={allStats.uniqueAuxPioneersLast6Months} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                    color="border-indigo-500"
                />
                <StatCard 
                    title={`Cursos por Publicadores (no prec.) (${selectedMonth})`} 
                    value={allStats.publisherCourses} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    color="border-green-500"
                />
                <StatCard 
                    title={`Cursos por Prec. Aux. (${selectedMonth})`} 
                    value={allStats.auxPioneerCourses} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                    color="border-yellow-500"
                />
                <StatCard 
                    title={`Cursos por Prec. Reg. (${selectedMonth})`} 
                    value={allStats.regPioneerCourses} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                    color="border-purple-500"
                />
                 <StatCard 
                    title={`Prec. Regulares sin Cursos (${selectedMonth})`} 
                    value={allStats.regularPioneersWithoutCourses} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                    color="border-orange-500"
                    isAlertCard={true}
                />
                <StatCard 
                    title={`Publicadores sin Cursos (${selectedMonth})`} 
                    value={allStats.publishersWithoutCourses} 
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    color="border-red-500"
                    isAlertCard={true}
                />
            </div>
            
            {/* Trend Chart */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Tendencia de Cursos (Año de Servicio {selectedYear})</h2>
                {hasData ? (
                    <div className="overflow-x-auto pb-4">
                        <div className="flex items-end h-64 space-x-2 min-w-[600px]">
                            {chartData.map((data, index) => (
                                <div key={index} className="flex-1 h-full flex flex-col justify-end items-center">
                                    <div
                                        className={`w-full ${data.isHighlighted ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-400 hover:bg-blue-500'} rounded-t-md transition-all flex justify-center items-start pt-1`}
                                        style={{ height: `${(data.value / maxChartValue) * 100}%` }}
                                        title={`${data.label}: ${data.value} cursos`}
                                    >
                                        {data.value > 0 && <span className="text-xs font-bold text-white">{data.value}</span>}
                                    </div>
                                    <span className={`text-xs text-gray-500 mt-1 ${data.isHighlighted ? 'font-bold text-gray-800' : 'text-gray-500'}`}>{data.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-gray-500 py-8">No hay datos de cursos en este año de servicio para mostrar.</p>
                )}
            </div>
        </div>
    );
};

export default DashboardCursos;
