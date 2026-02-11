import React, { useState } from 'react';
import { Publisher, ServiceReport } from '../types';
import PublisherRecordModal from './PublisherRecordModal';

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

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 p-4">
            {publishers.map((publisher) => {
                const isExpanded = expandedCardId === publisher.id;

                return (
                    <div
                        key={publisher.id}
                        className={`
                            relative bg-[#0f0f0f] rounded-3xl overflow-hidden transition-all duration-500 ease-out border border-gray-800
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
                                {/* Name and Basic Info */}
                                <h3 className="text-3xl font-black text-white tracking-tight mb-1 leading-tight">
                                    {publisher.Nombre} <br /> {publisher.Apellido}
                                </h3>
                                <p className="text-sm font-medium text-gray-400 mb-6 uppercase tracking-wider">
                                    {publisher['2do Apellido']} {publisher['Apellido de casada']}
                                </p>

                                {/* Quick Actions / Icons */}
                                <div className="flex gap-3 justify-center md:justify-start mb-6">
                                    <a href={`tel:${publisher.Cel}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-full bg-gray-800 text-gray-300 flex items-center justify-center hover:bg-[#39FF14] hover:text-black transition-all border border-gray-700">
                                        📞
                                    </a>
                                    <a href={`mailto:${publisher.Correo}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-full bg-gray-800 text-gray-300 flex items-center justify-center hover:bg-[#39FF14] hover:text-black transition-all border border-gray-700">
                                        ✉️
                                    </a>
                                    {publisher['Carta de presentacion'] && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); window.open(typeof publisher['Carta de presentacion'] === 'string' ? publisher['Carta de presentacion'] : '#', '_blank'); }}
                                            className="w-10 h-10 rounded-full bg-gray-800 text-gray-300 flex items-center justify-center hover:bg-[#39FF14] hover:text-black transition-all border border-gray-700"
                                            title="Ver PDF Original"
                                        >
                                            📄
                                        </button>
                                    )}
                                </div>
                                <div className="text-[#39FF14] font-bold text-lg">
                                    {publisher.Privilegio || 'Publicador'}
                                </div>
                            </div>

                            {/* RIGHT SIDE: Photo */}
                            <div className="relative group">
                                <div className="absolute inset-0 bg-[#39FF14] rounded-full blur-[40px] opacity-20 group-hover:opacity-30 transition-opacity duration-300"></div>
                                <div className="relative w-48 h-48 rounded-full p-1 bg-black shadow-2xl shadow-[#39FF14]/10">
                                    <img
                                        src={publisher.Foto || 'https://via.placeholder.com/150'}
                                        alt={`${publisher.Nombre} ${publisher.Apellido}`}
                                        className="w-full h-full rounded-full object-cover border-[4px] border-[#39FF14]"
                                    />
                                </div>
                                {/* Status Badge */}
                                <div className={`
                                    absolute top-2 right-2 px-3 py-1 rounded-full text-xs font-bold text-black shadow-lg transform translate-x-2 -translate-y-2
                                    ${publisher.Estatus === 'Activo' ? 'bg-[#39FF14]' :
                                        publisher.Estatus === 'Inactivo' ? 'bg-red-500 text-white' :
                                            'bg-orange-500 text-white'}
                                `}>
                                    {publisher.Estatus}
                                </div>
                            </div>

                        </div>

                        {/* Expandable Details Section */}
                        <div className={`
                                w-full overflow-hidden transition-all duration-500 ease-in-out px-8
                                ${isExpanded ? 'max-h-[800px] opacity-100 pb-8' : 'max-h-0 opacity-0'}
                            `}>
                            <div className="pt-6 border-t border-gray-800 text-left space-y-4">

                                {/* Spiritual Info Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">Grupo</p>
                                        <p className="font-semibold text-white">{publisher.Grupo || '--'}</p>
                                    </div>
                                    <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">Bautismo</p>
                                        <p className="font-semibold text-white">{publisher['Fecha de bautismo'] || '--'}</p>
                                    </div>
                                    <div className="bg-gray-900 p-4 rounded-2xl border border-gray-800">
                                        <p className="text-xs text-gray-500 font-bold uppercase mb-1">Esperanza</p>
                                        <p className="font-semibold text-white">{publisher.Esperanza || 'Otras ovejas'}</p>
                                    </div>
                                </div>

                                {/* Emergency Contact */}
                                {publisher['Contacto de Emergencia'] && (
                                    <div className="bg-red-900/10 p-4 rounded-2xl border border-red-900/30 mt-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-red-500 text-lg">🚨</span>
                                            <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Emergencia</p>
                                        </div>
                                        <p className="font-bold text-white text-lg">{publisher['Contacto de Emergencia']}</p>
                                        {publisher['Cel de Emergencia'] && (
                                            <a href={`tel:${publisher['Cel de Emergencia']}`} onClick={(e) => e.stopPropagation()} className="inline-block mt-2 text-sm font-semibold text-red-400 bg-black/30 px-3 py-1.5 rounded-full hover:bg-black/50 transition-all">
                                                Llamar: {publisher['Cel de Emergencia']}
                                            </a>
                                        )}
                                    </div>
                                )}

                                {/* View Record Button */}
                                <button
                                    onClick={(e) => handleOpenRecordModal(e, publisher)}
                                    className="w-full mt-4 bg-[#39FF14] text-black font-bold py-3 rounded-xl hover:bg-[#32e012] hover:shadow-[0_0_20px_rgba(57,255,20,0.3)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    Ver Registro de Actividad
                                </button>
                            </div>
                        </div>

                        {/* Expansion Hint Arrow */}
                        {!isExpanded && (
                            <div className="h-6 flex items-center justify-center text-gray-700 animate-pulse bg-[#0f0f0f]">
                                ⌄
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Modal for Record Card */}
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
