import React, { useState, useMemo } from 'react';
import { Publisher, ServiceReport } from '../types';
import PublisherRecordModal from './PublisherRecordModal';
import { DEFAULT_AVATAR, MONTHS } from '../constants';
import { getCalculatedStatus } from '../utils';

interface PublisherCardViewProps {
    publishers: Publisher[];
    serviceReports: ServiceReport[];
}

const PublisherCardView: React.FC<PublisherCardViewProps> = ({ publishers, serviceReports }) => {
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
    const [selectedPublisherForModal, setSelectedPublisherForModal] = useState<Publisher | null>(null);

    const toggleCard = (id: string) => {
        setExpandedCardId(expandedCardId === id ? null : id);
    };

    const handleOpenRecordModal = (e: React.MouseEvent, publisher: Publisher) => {
        e.stopPropagation();
        setSelectedPublisherForModal(publisher);
    };

    const publishersWithStatus = useMemo(() => {
        if (!publishers || !Array.isArray(publishers)) return [];
        return publishers.map(p => {
            if (!p) return null;
            return {
                ...p,
                calculatedStatus: getCalculatedStatus(p, serviceReports || [], MONTHS || [])
            };
        }).filter(Boolean) as (Publisher & { calculatedStatus: string })[];
    }, [publishers, serviceReports]);

    const stats = useMemo(() => {
        return {
            total: publishersWithStatus.length,
            activos: publishersWithStatus.filter(p => p.calculatedStatus === 'activo').length,
            irregulares: publishersWithStatus.filter(p => p.calculatedStatus === 'irregular').length,
            inactivos: publishersWithStatus.filter(p => p.calculatedStatus === 'inactivo').length
        };
    }, [publishersWithStatus]);

    return (
        <div className="space-y-8 p-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-xl">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total</p>
                    <p className="text-2xl font-black text-white">{stats.total}</p>
                </div>
                <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-xl border-l-4 border-l-[#39FF14]">
                    <p className="text-[10px] font-black text-[#39FF14] uppercase tracking-widest mb-1">Activos</p>
                    <p className="text-2xl font-black text-white">{stats.activos}</p>
                </div>
                <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-xl border-l-4 border-l-orange-500">
                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Irregulares</p>
                    <p className="text-2xl font-black text-white">{stats.irregulares}</p>
                </div>
                <div className="bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-xl border-l-4 border-l-red-600">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Inactivos</p>
                    <p className="text-2xl font-black text-white">{stats.inactivos}</p>
                </div>
            </div>

            {/* Publishers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                {publishersWithStatus.map((publisher) => {
                    const isExpanded = expandedCardId === publisher.id;
                    const status = publisher.calculatedStatus;
                    const badgeColor = status === 'activo' ? 'bg-[#39FF14]' : 
                                     status === 'inactivo' ? 'bg-red-600' : 
                                     'bg-orange-500';

                    return (
                        <div
                            key={publisher.id}
                            className={`
                                relative bg-[#0f0f0f] rounded-3xl overflow-hidden transition-all duration-500 ease-out border border-gray-800 cursor-pointer
                                ${isExpanded ? 'shadow-2xl shadow-[#39FF14]/10 ring-1 ring-[#39FF14]/50 scale-[1.02] z-10' : 'shadow-lg hover:shadow-2xl hover:bg-black hover:border-gray-700'}
                            `}
                            onClick={() => toggleCard(publisher.id)}
                        >
                            {/* Decorative Background Blob */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#39FF14]/10 to-transparent rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                            {/* Card Content Container */}
                            <div className="relative p-8 flex flex-col md:flex-row items-center md:items-start justify-between gap-6">

                                {/* LEFT SIDE: Data */}
                                <div className="flex-1 text-center md:text-left z-10">
                                    <h3 className="text-3xl font-black text-white tracking-tight mb-1 leading-tight">
                                        {publisher.Nombre} <br /> {publisher.Apellido}
                                    </h3>
                                    <p className="text-sm font-medium text-gray-400 mb-6 uppercase tracking-wider">
                                        {publisher['2do Apellido']} {publisher['Apellido de casada']}
                                    </p>

                                    <div className="flex gap-3 justify-center md:justify-start mb-6">
                                        <a href={`tel:${publisher.Cel}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-full bg-gray-800 text-gray-300 flex items-center justify-center hover:bg-[#39FF14] hover:text-black transition-all border border-gray-700">
                                            📞
                                        </a>
                                        <a href={`https://wa.me/${publisher.Cel?.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-full bg-gray-800 text-gray-300 flex items-center justify-center hover:bg-[#39FF14] hover:text-black transition-all border border-gray-700">
                                            💬
                                        </a>
                                    </div>
                                    <div className="text-[#39FF14] font-bold text-lg">
                                        {publisher.Privilegio || 'Publicador'}
                                    </div>
                                </div>

                                {/* RIGHT SIDE: Photo */}
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-[#39FF14] rounded-full blur-[40px] opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
                                    <div className="relative w-40 h-40 rounded-full p-1 bg-black shadow-2xl shadow-[#39FF14]/10">
                                        <img
                                            src={publisher.Foto || DEFAULT_AVATAR}
                                            alt={`${publisher.Nombre} ${publisher.Apellido}`}
                                            className="w-full h-full rounded-full object-cover border-[4px] border-[#39FF14]"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                if (target.src !== DEFAULT_AVATAR) {
                                                    target.src = DEFAULT_AVATAR;
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className={`
                                        absolute top-2 right-2 px-3 py-1 rounded-full text-[10px] font-black text-black shadow-lg transform translate-x-2 -translate-y-2 uppercase
                                        ${badgeColor}
                                    `}>
                                        {status}
                                    </div>
                                </div>

                            </div>

                            {/* Expandable Details Section */}
                            <div className={`
                                    w-full overflow-hidden transition-all duration-500 ease-in-out px-8
                                    ${isExpanded ? 'max-h-[800px] opacity-100 pb-8' : 'max-h-0 opacity-0'}
                                `}>
                                <div className="pt-6 border-t border-gray-800 text-left space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                                            <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Grupo</p>
                                            <p className="font-semibold text-white">{publisher.Grupo || '--'}</p>
                                        </div>
                                        <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                                            <p className="text-[10px] text-gray-500 font-black uppercase mb-1">Bautismo</p>
                                            <p className="font-semibold text-white">{publisher['Fecha de bautismo'] || '--'}</p>
                                        </div>
                                    </div>

                                    {publisher['Contacto de Emergencia'] && (
                                        <div className="bg-red-900/10 p-4 rounded-2xl border border-red-900/30 mt-4">
                                            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">🚨 Emergencia</p>
                                            <p className="font-bold text-white text-lg">{publisher['Contacto de Emergencia']}</p>
                                            <p className="text-sm text-red-400">{publisher['Cel de Emergencia']}</p>
                                        </div>
                                    )}

                                    <button
                                        onClick={(e) => handleOpenRecordModal(e, publisher)}
                                        className="w-full mt-4 bg-[#39FF14] text-black font-black py-4 rounded-2xl hover:bg-[#32e012] transition-all transform hover:-translate-y-1"
                                    >
                                        VER TARJETA DE REGISTRO
                                    </button>
                                </div>
                            </div>

                            {!isExpanded && (
                                <div className="h-4 flex items-center justify-center text-gray-800 text-xs font-black bg-slate-900/50">
                                    VER DETALLES
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {selectedPublisherForModal && (
                <PublisherRecordModal
                    publisher={selectedPublisherForModal}
                    serviceReports={serviceReports}
                    onClose={() => setSelectedPublisherForModal(null)}
                />
            )}
        </div>
    );
};

export default PublisherCardView;
