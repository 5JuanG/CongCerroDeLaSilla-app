import React, { useState, useMemo } from 'react';
import { Publisher, ServiceReport } from '../types';

interface PublisherRecordModalProps {
    publisher: Publisher;
    serviceReports: ServiceReport[];
    onClose: () => void;
}

const PublisherRecordModal: React.FC<PublisherRecordModalProps> = ({ publisher, serviceReports, onClose }) => {
    // Determine Service Year (Sep - Aug)
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0 = Jan, 8 = Sep
    const defaultYear = currentMonth >= 8 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();

    const [selectedServiceYear, setSelectedServiceYear] = useState(defaultYear);

    const months = [
        "Septiembre", "Octubre", "Noviembre", "Diciembre",
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto"
    ];

    const reportData = useMemo(() => {
        return months.map((month, index) => {
            // Calculate actual calendar year for the month
            const year = index < 4 ? selectedServiceYear - 1 : selectedServiceYear;

            const report = serviceReports.find(r =>
                r.idPublicador === publisher.id &&
                r.mes === month &&
                r.anioCalendario === year
            );

            return {
                month,
                report
            };
        });
    }, [selectedServiceYear, serviceReports, publisher]);

    const totals = useMemo(() => {
        return reportData.reduce((acc, curr) => {
            if (curr.report) {
                acc.hours += curr.report.horas || 0;
            }
            return acc;
        }, { hours: 0 });
    }, [reportData]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fadeIn">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border border-gray-200">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Registro de Publicador de la Congregación</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors text-2xl font-bold leading-none">&times;</button>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                    {/* Header Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className="font-bold text-lg text-slate-900 mb-1">Nombre: <span className="font-normal text-slate-700">{publisher.Nombre} {publisher.Apellido} {publisher['2do Apellido']} {publisher['Apellido de casada']}</span></p>
                            <p className="font-bold text-slate-900">Fecha de nacimiento: <span className="font-normal text-slate-700">{publisher['Fecha de Nacimiento'] || '--'}</span></p>
                            <p className="font-bold text-slate-900">Fecha de bautismo: <span className="font-normal text-slate-700">{publisher['Fecha de bautismo'] || '--'}</span></p>
                        </div>
                        <div className="space-y-1">
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2"><input type="checkbox" checked={publisher.Sexo === 'Hombre'} readOnly className="accent-blue-600" /> Hombre</label>
                                <label className="flex items-center gap-2"><input type="checkbox" checked={publisher.Sexo === 'Mujer'} readOnly className="accent-blue-600" /> Mujer</label>
                            </div>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2"><input type="checkbox" checked={publisher.Esperanza === 'Otras ovejas'} readOnly className="accent-blue-600" /> Otras ovejas</label>
                                <label className="flex items-center gap-2"><input type="checkbox" checked={publisher.Esperanza === 'Ungido'} readOnly className="accent-blue-600" /> Ungido</label>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                                <label className="flex items-center gap-2"><input type="checkbox" checked={publisher.Privilegio === 'Anciano'} readOnly className="accent-blue-600" /> Anciano</label>
                                <label className="flex items-center gap-2"><input type="checkbox" checked={publisher.Privilegio === 'Siervo Ministerial'} readOnly className="accent-blue-600" /> Siervo ministerial</label>
                                <label className="flex items-center gap-2"><input type="checkbox" checked={publisher['Priv Adicional'] === 'Precursor Regular'} readOnly className="accent-blue-600" /> Precursor regular</label>
                            </div>
                        </div>
                    </div>

                    {/* Service Year Selector */}
                    <div className="flex items-center gap-4 bg-blue-50 p-3 rounded-lg">
                        <span className="font-bold text-blue-800">Año de Servicio:</span>
                        <div className="flex gap-2">
                            <button onClick={() => setSelectedServiceYear(prev => prev - 1)} className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-xs">◀</button>
                            <span className="font-bold text-xl">{selectedServiceYear}</span>
                            <button onClick={() => setSelectedServiceYear(prev => prev + 1)} className="px-2 py-1 bg-white border rounded hover:bg-gray-50 text-xs">▶</button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto border border-slate-300 rounded-sm">
                        <table className="w-full text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-800 text-xs md:text-sm font-bold uppercase">
                                    <th className="border border-slate-300 p-2 w-32">
                                        Año de Servicio<br />
                                        <span className="text-blue-600 text-lg">{selectedServiceYear}</span>
                                    </th>
                                    <th className="border border-slate-300 p-2">Participación<br />en el<br />ministerio</th>
                                    <th className="border border-slate-300 p-2">Cursos<br />bíblicos</th>
                                    <th className="border border-slate-300 p-2">Precursor<br />auxiliar</th>
                                    <th className="border border-slate-300 p-2">Horas<br /><span className="text-[10px] normal-case font-normal">(Si es precursor o misionero que sirve en el campo)</span></th>
                                    <th className="border border-slate-300 p-2 w-1/3">Notas</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {reportData.map((data) => (
                                    <tr key={data.month} className="hover:bg-blue-50/30">
                                        <td className="border border-slate-300 p-2 font-bold text-left bg-slate-50/50">{data.month}</td>
                                        <td className="border border-slate-300 p-2">
                                            {data.report?.participacion ? (
                                                <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded text-xs">✓</span>
                                            ) : (
                                                <div className="w-6 h-6 border rounded mx-auto border-gray-300"></div>
                                            )}
                                        </td>
                                        <td className="border border-slate-300 p-2 text-slate-700">{data.report?.cursosBiblicos || 0}</td>
                                        <td className="border border-slate-300 p-2">
                                            {data.report?.precursorAuxiliar ? (
                                                <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded text-xs">✓</span>
                                            ) : (
                                                <div className="w-6 h-6 border rounded mx-auto border-gray-300"></div>
                                            )}
                                        </td>
                                        <td className="border border-slate-300 p-2 font-mono">{data.report?.horas || ''}</td>
                                        <td className="border border-slate-300 p-2 text-left text-xs text-slate-500 italic truncate max-w-[200px]">{data.report?.notas}</td>
                                    </tr>
                                ))}
                                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                                    <td className="border border-slate-300 p-2 text-right uppercase" colSpan={4}>Total</td>
                                    <td className="border border-slate-300 p-2 text-center">{totals.hours}</td>
                                    <td className="border border-slate-300 p-2"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublisherRecordModal;
