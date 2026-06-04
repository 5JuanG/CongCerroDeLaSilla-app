
import React, { useMemo, useState } from 'react';
import { Publisher, ServiceReport, ModalInfo } from '../types';
import { MONTHS } from '../constants';
import { getPreviousMonthAndYear } from '../utils';

interface SeguimientoInformesProps {
    publishers: Publisher[];
    serviceReports: ServiceReport[];
    onShowModal: (info: ModalInfo) => void;
}

const SeguimientoInformes: React.FC<SeguimientoInformesProps> = ({ publishers, serviceReports, onShowModal }) => {
    const { monthIndex, year: prevYear } = getPreviousMonthAndYear();
    const currentMonth = MONTHS[monthIndex];
    const currentYear = new Date().getFullYear();

    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(prevYear);

    // Filter active publishers
    const activePublishers = useMemo(() => 
        publishers.filter(p => p.Estatus === 'Activo'), 
    [publishers]);

    // Group publishers by their group
    const groups = useMemo(() => {
        const g = new Set<string>();
        activePublishers.forEach(p => g.add(p.Grupo || 'Sin Grupo'));
        return Array.from(g).sort();
    }, [activePublishers]);

    // Calculate reporting status
    const statusData = useMemo(() => {
        const reportsThisMonth = serviceReports.filter(r => 
            r.mes === selectedMonth && r.anioCalendario === selectedYear && r.participacion === true
        );

        const reportedIds = new Set(reportsThisMonth.map(r => r.idPublicador));

        const data: Record<string, { reported: Publisher[], pending: Publisher[] }> = {};

        groups.forEach(groupName => {
            data[groupName] = { reported: [], pending: [] };
        });

        activePublishers.forEach(pub => {
            const groupName = pub.Grupo || 'Sin Grupo';
            if (reportedIds.has(pub.id)) {
                data[groupName].reported.push(pub);
            } else {
                data[groupName].pending.push(pub);
            }
        });

        return data;
    }, [activePublishers, serviceReports, selectedMonth, selectedYear, groups]);

    const [editingMessage, setEditingMessage] = useState<{ text: string, phone: string } | null>(null);

    const totalStats = useMemo(() => {
        let totalReported = 0;
        let totalPending = 0;
        Object.values(statusData).forEach(group => {
            totalReported += group.reported.length;
            totalPending += group.pending.length;
        });
        return { totalReported, totalPending, total: totalReported + totalPending };
    }, [statusData]);

    const handleSendInvitationToAll = () => {
        const message = `*Recordatorio de Informe de Servicio*\n\nHola hermanos, les recordamos que ya pueden entregar su informe de servicio del mes de *${selectedMonth}*. Pueden hacerlo directamente desde la app: \n\nhttps://congcerrodelasilla-app.web.app\n\n¡Muchas gracias por su colaboración!`;
        setEditingMessage({ text: message, phone: '' });
    };

    const handleSendGroupReport = (groupName: string) => {
        const data = statusData[groupName];
        const reportedCount = data.reported.length;
        const pendingCount = data.pending.length;
        const total = reportedCount + pendingCount;
        const percent = Math.round((reportedCount / total) * 100);

        const responsible = publishers.find(p => 
            p.Grupo === groupName && 
            (p['Responsabilidad en el Grupo'] === 'Superintendente de Grupo' || p['Responsabilidad en el Grupo'] === 'Auxiliar de Grupo')
        );

        let message = `*Estado de Informes - Grupo ${groupName}*\n\n📊 *Progreso:* ${reportedCount}/${total} (${percent}%)\n\n`;
        
        if (pendingCount > 0) {
            message += `⚠️ *Pendientes (${pendingCount}):*\n`;
            data.pending.forEach(p => {
                message += `- ${p.Nombre} ${p.Apellido}\n`;
            });
            message += `\nFavor de recordarles que pueden informar en la app.`;
        } else {
            message += `✅ *¡Excelente! Todo el grupo ya informó.* 🎉`;
        }

        const phone = responsible?.Cel ? responsible.Cel.replace(/\D/g, '') : '';
        setEditingMessage({ text: message, phone });
    };

    const handleSendIndividualReminder = (pub: Publisher) => {
        const phone = pub.Cel ? pub.Cel.replace(/\D/g, '') : '';
        const message = `Hola ${pub.Nombre}, te recordamos entregar tu informe de servicio de *${selectedMonth}*. Puedes hacerlo aquí: https://congcerrodelasilla-app.web.app\n\n¡Gracias!`;
        setEditingMessage({ text: message, phone });
    };

    const confirmAndSend = () => {
        if (!editingMessage) return;
        const encoded = encodeURIComponent(editingMessage.text);
        let url = `https://wa.me/?text=${encoded}`;
        
        if (editingMessage.phone) {
            const cleanPhone = editingMessage.phone.length === 10 ? '52' + editingMessage.phone : editingMessage.phone;
            url = `https://wa.me/${cleanPhone}?text=${encoded}`;
        }
        
        window.open(url, '_blank');
        setEditingMessage(null);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-blue-50">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight">Agente de Seguimiento</h1>
                        <p className="text-slate-500">Monitoreo y automatización de informes de servicio</p>
                    </div>
                    <div className="flex gap-2">
                        <select 
                            value={selectedMonth} 
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="p-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-blue-500 transition-colors"
                        >
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select 
                            value={selectedYear} 
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="p-3 border-2 border-slate-100 rounded-2xl font-bold text-slate-700 focus:border-blue-500 transition-colors"
                        >
                            {[currentYear, currentYear - 1].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-lg shadow-blue-200">
                        <p className="text-blue-100 text-sm font-bold uppercase tracking-wider mb-1">Informados</p>
                        <h3 className="text-4xl font-black">{totalStats.totalReported}</h3>
                        <p className="text-blue-100/70 text-xs mt-2">Publicadores activos</p>
                    </div>
                    <div className="bg-amber-500 p-6 rounded-3xl text-white shadow-lg shadow-amber-200">
                        <p className="text-amber-100 text-sm font-bold uppercase tracking-wider mb-1">Pendientes</p>
                        <h3 className="text-4xl font-black">{totalStats.totalPending}</h3>
                        <p className="text-amber-100/70 text-xs mt-2">Necesitan recordatorio</p>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-3xl text-white shadow-lg shadow-slate-300">
                        <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Progreso Total</p>
                        <h3 className="text-4xl font-black">{Math.round((totalStats.totalReported / totalStats.total) * 100)}%</h3>
                        <div className="w-full bg-white/10 h-2 rounded-full mt-3 overflow-hidden">
                            <div className="bg-blue-400 h-full transition-all duration-1000" style={{ width: `${(totalStats.totalReported / totalStats.total) * 100}%` }}></div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center mb-12">
                    <button 
                        onClick={handleSendInvitationToAll}
                        className="px-8 py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-all shadow-xl shadow-green-200 flex items-center gap-3 uppercase tracking-widest text-sm"
                    >
                        <span>📢</span> Invitar a Toda la Congregación
                    </button>
                </div>

                <div className="space-y-6">
                    <h2 className="text-xl font-black text-slate-800 mb-4 px-2">Estado por Grupo</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {groups.map(groupName => {
                            const data = statusData[groupName];
                            const total = data.reported.length + data.pending.length;
                            const isDone = data.pending.length === 0;

                            return (
                                <div key={groupName} className="border-2 border-slate-50 p-6 rounded-[2rem] hover:border-blue-100 transition-all group">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800">Grupo {groupName}</h3>
                                            <p className="text-sm text-slate-500">{data.reported.length} de {total} informados</p>
                                        </div>
                                        {isDone ? (
                                            <span className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-xs font-black uppercase">¡Completado!</span>
                                        ) : (
                                            <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-xs font-black uppercase">En progreso</span>
                                        )}
                                    </div>

                                    <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
                                        <div className={`h-full transition-all duration-1000 ${isDone ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${(data.reported.length / total) * 100}%` }}></div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 mb-6 max-h-32 overflow-y-auto p-1">
                                        {data.pending.map(p => (
                                            <button 
                                                key={p.id}
                                                onClick={() => handleSendIndividualReminder(p)}
                                                className="px-3 py-1.5 bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-700 rounded-xl text-xs font-medium border border-transparent hover:border-amber-200 transition-all flex items-center gap-2"
                                                title={`Enviar recordatorio individual a ${p.Nombre}`}
                                            >
                                                <span>👤</span> {p.Nombre}
                                            </button>
                                        ))}
                                    </div>

                                    <button 
                                        onClick={() => handleSendGroupReport(groupName)}
                                        className={`w-full py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${isDone ? 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white' : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white'}`}
                                    >
                                        {isDone ? '🎉 Enviar Felicitación' : '📲 Enviar Reporte de Grupo'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {editingMessage && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4 animate-fade-in">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-white/20 animate-scale-up">
                        <div className="p-8 pb-4">
                            <h3 className="text-2xl font-black text-slate-800 mb-2">Revisar Mensaje</h3>
                            <p className="text-slate-500 text-sm mb-6">Puedes editar el texto antes de enviarlo a WhatsApp.</p>
                            
                            <textarea 
                                value={editingMessage.text}
                                onChange={e => setEditingMessage({ ...editingMessage, text: e.target.value })}
                                className="w-full h-64 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl text-slate-700 font-medium focus:border-blue-500 focus:bg-white transition-all outline-none resize-none"
                            />
                        </div>
                        
                        <div className="p-8 pt-4 flex gap-4">
                            <button 
                                onClick={() => setEditingMessage(null)}
                                className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmAndSend}
                                className="flex-1 py-4 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-all shadow-xl shadow-green-200 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                            >
                                <span>🚀</span> Enviar a WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SeguimientoInformes;
