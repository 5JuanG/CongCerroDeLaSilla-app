

import React, { useState, useEffect, useMemo } from 'react';
import { Publisher, ServiceReport, InvitationContent, MONTHS } from '../App';

interface PublishersData {
    [group: string]: Publisher[];
}

interface InformeServicioProps {
    publishers: Publisher[];
    serviceReports: ServiceReport[];
    onSaveReport: (report: Omit<ServiceReport, 'id'>) => Promise<void>;
    onApplyForPioneer: () => void;
    invitationContent: InvitationContent[];
    isPublicForm?: boolean;
}

interface InvitationDetails {
    month: string;
    year: number;
}


const InvitationModal: React.FC<{
    slides: { imageUrl: string; text: string; }[];
    onClose: () => void;
    onApply: () => void;
}> = ({ slides, onClose, onApply }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        if (slides.length <= 1) return;
        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev === slides.length - 1 ? 0 : prev + 1));
        }, 5000);
        return () => clearInterval(timer);
    }, [slides.length]);

    const nextSlide = () => setCurrentSlide(prev => (prev === slides.length - 1 ? 0 : prev + 1));
    const prevSlide = () => setCurrentSlide(prev => (prev === 0 ? slides.length - 1 : prev - 1));

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-5 text-center">
                     <h2 className="text-2xl font-bold text-blue-700">¡Gracias por tu informe!</h2>
                     <p className="text-gray-600 mt-2">Tu servicio fiel es muy valioso. ¿Has considerado ampliar tu ministerio?</p>
                </div>
                <div className="relative w-full h-64 bg-gray-200">
                    {slides.map((slide, index) => (
                        <div key={index} className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}>
                             <img src={slide.imageUrl} alt="Inspirational" className="w-full h-full object-cover"/>
                             <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                                <p className="text-white text-xl text-center font-semibold">{slide.text}</p>
                             </div>
                        </div>
                    ))}
                    {slides.length > 1 && (
                        <>
                            <button onClick={prevSlide} className="absolute top-1/2 left-2 transform -translate-y-1/2 bg-white/50 p-2 rounded-full hover:bg-white/80">&lt;</button>
                            <button onClick={nextSlide} className="absolute top-1/2 right-2 transform -translate-y-1/2 bg-white/50 p-2 rounded-full hover:bg-white/80">&gt;</button>
                        </>
                    )}
                </div>
                 <div className="p-6 text-center">
                    <button onClick={onApply} className="w-full p-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-transform transform hover:scale-105">
                        ¡Quiero ser precursor auxiliar!
                    </button>
                     <button onClick={onClose} className="mt-3 text-gray-500 hover:text-gray-700 text-sm">
                        Quizás en otra ocasión
                    </button>
                </div>
            </div>
        </div>
    );
};


const InformeServicio: React.FC<InformeServicioProps> = ({ publishers, serviceReports, onSaveReport, onApplyForPioneer, invitationContent, isPublicForm = false }) => {
    const [anio, setAnio] = useState<number | string>(new Date().getFullYear());
    const [mes, setMes] = useState('');
    const [grupo, setGrupo] = useState('');
    const [idPublicador, setIdPublicador] = useState('');
    const [nombrePublico, setNombrePublico] = useState('');

    const [predico, setPredico] = useState(false);
    const [cursos, setCursos] = useState<number | string>('');
    const [horas, setHoras] = useState<number | string>('');
    const [tipoServicio, setTipoServicio] = useState('');
    const [notas, setNotas] = useState('');
    const [status, setStatus] = useState({ message: '', type: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [showInvitationModal, setShowInvitationModal] = useState(false);
    const [invitationDetails, setInvitationDetails] = useState<InvitationDetails>({ month: '', year: 0 });

    const publishersData = useMemo(() => {
        return publishers.reduce((acc, pub) => {
            const groupKey = pub.Grupo || 'Sin Grupo';
            if (!acc[groupKey]) {
                acc[groupKey] = [];
            }
            acc[groupKey].push(pub);
            return acc;
        }, {} as PublishersData);
    }, [publishers]);

    const grupos = useMemo(() => Object.keys(publishersData).sort(), [publishersData]);
    const publicadoresEnGrupo = useMemo(() => publishersData[grupo] || [], [publishersData, grupo]);
    
    const invitationSlides = (invitationContent && invitationContent.length > 0)
        ? invitationContent.map(item => ({ imageUrl: item.imageUrl, text: item.phrase }))
        : [
            { imageUrl: `https://source.unsplash.com/random/800x600?joy,sharing`, text: 'Siente el gozo de compartir las buenas noticias a tiempo completo.' },
            { imageUrl: `https://source.unsplash.com/random/800x600?nature,hope`, text: 'Dedica un mes especial a Jehová y ve crecer tu espiritualidad.' },
            { imageUrl: `https://source.unsplash.com/random/800x600?group,friends,smile`, text: `¿Has pensado en ser precursor auxiliar? ¡Es una meta excelente!` },
            { imageUrl: `https://source.unsplash.com/random/800x600?community,service`, text: 'Únete a otros en esta gozosa obra. ¡Tu ayuda es muy valiosa!' }
        ];
        
    useEffect(() => {
        // Public form should not pre-fill data. It's for new submissions only.
        if (isPublicForm) {
            setStatus({ message: '', type: '' });
            return;
        }

        if (idPublicador && mes && anio && serviceReports) {
            const existingReport = serviceReports.find(r => 
                r.idPublicador === idPublicador && 
                r.mes === mes && 
                r.anioCalendario === Number(anio)
            );

            if (existingReport) {
                setPredico(existingReport.participacion);
                setCursos(existingReport.cursosBiblicos ?? '');
                setHoras(existingReport.horas ?? '');
                const pub = publishers.find(p => p.id === idPublicador);
                let serviceType = '';
                if (existingReport.precursorAuxiliar === 'PA') {
                    serviceType = 'Precursor Auxiliar';
                } else if (pub && pub['Priv Adicional'] === 'Precursor Regular') {
                    serviceType = 'Precursor Regular';
                } else if (pub && pub['Priv Adicional'] === 'Precursor Especial') {
                    serviceType = 'Precursor Especial';
                } else if (pub && pub['Priv Adicional'] === 'Misionero') {
                    serviceType = 'Misionero';
                }
                setTipoServicio(serviceType);
                setNotas(existingReport.notas ?? '');
                setStatus({ message: 'Se cargó un informe existente. Puede editarlo y guardarlo.', type: 'info' });
            } else {
                setPredico(false);
                setCursos('');
                setHoras('');
                setTipoServicio('');
                setNotas('');
                setStatus({ message: '', type: '' });
            }
        } else {
            setPredico(false);
            setCursos('');
            setHoras('');
            setTipoServicio('');
            setNotas('');
            setStatus({ message: '', type: '' });
        }
    }, [idPublicador, mes, anio, serviceReports, publishers, isPublicForm]);

    const handleGrupoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setGrupo(e.target.value);
        setIdPublicador(''); // Reset publisher selection
    };

    const resetForm = () => {
        setMes('');
        setGrupo('');
        setIdPublicador('');
        setNombrePublico('');
        setPredico(false);
        setCursos('');
        setHoras('');
        setTipoServicio('');
        setNotas('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus({ message: 'Guardando...', type: 'info' });

        try {
            const commonData = {
                anioCalendario: Number(anio),
                mes,
                participacion: predico,
                cursosBiblicos: cursos !== '' ? Number(cursos) : undefined,
                horas: horas !== '' ? Number(horas) : undefined,
                precursorAuxiliar: tipoServicio === 'Precursor Auxiliar' ? 'PA' : '',
                notas: notas || undefined,
            };

            let reportData;
            if (isPublicForm) {
                if (!nombrePublico.trim()) {
                    setStatus({ message: 'Por favor, ingrese su nombre.', type: 'error' });
                    setIsSubmitting(false);
                    return;
                }
                reportData = { ...commonData, idPublicador: 'public_submission', nombrePublicador: nombrePublico.trim() };
            } else {
                reportData = { ...commonData, idPublicador };
            }


            await onSaveReport(reportData as Omit<ServiceReport, 'id'>);

            setStatus({ message: '¡Informe guardado con éxito!', type: 'success' });
            
            if (!isPublicForm) {
                const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
                const currentMonthIndex = months.indexOf(mes);
                const currentYear = Number(anio);
                let nextMonthIndex = currentMonthIndex + 1;
                let nextYear = currentYear;
                if (nextMonthIndex > 11) {
                    nextMonthIndex = 0;
                    nextYear = currentYear + 1;
                }
                
                setInvitationDetails({ month: months[nextMonthIndex], year: nextYear });
                setShowInvitationModal(true);
            }
            
            resetForm();
            setTimeout(() => setStatus({ message: '', type: '' }), 5000);

        } catch (error) {
            setStatus({ message: 'Error al guardar el informe.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <div className="flex justify-center p-0 sm:p-4">
                <div className="w-full max-w-2xl bg-white p-6 sm:p-8 rounded-xl shadow-lg">
                    <h1 className="text-center text-2xl sm:text-3xl font-bold text-gray-800 mb-6">INFORME DE PREDICACIÓN</h1>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div className="form-group">
                                <label htmlFor="anio" className="label">Año:</label>
                                <input type="number" id="anio" value={anio} onChange={e => setAnio(e.target.value)} required className="input" />
                            </div>
                            <div className="form-group">
                                <label htmlFor="mes" className="label">Mes:</label>
                                <select id="mes" value={mes} onChange={e => setMes(e.target.value)} required className="input">
                                    <option value="" disabled>Seleccione</option>
                                    {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        {isPublicForm ? (
                            <div className="form-group mb-6">
                                <label htmlFor="nombre_publico" className="label">Su Nombre Completo:</label>
                                <input id="nombre_publico" type="text" value={nombrePublico} onChange={e => setNombrePublico(e.target.value)} required className="input" placeholder="Ej: Juan Pérez" />
                            </div>
                        ) : (
                            <>
                                <div className="form-group mb-4">
                                    <label htmlFor="grupo" className="label">Grupo:</label>
                                    <select id="grupo" value={grupo} onChange={handleGrupoChange} required className="input">
                                        <option value="" disabled>Seleccione</option>
                                        {grupos.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                                <div className="form-group mb-6">
                                    <label htmlFor="id_publicador" className="label">Nombre:</label>
                                    <select id="id_publicador" value={idPublicador} onChange={e => setIdPublicador(e.target.value)} required disabled={!grupo} className="input">
                                        <option value="" disabled>{grupo ? 'Seleccione un nombre' : 'Primero seleccione un grupo'}</option>
                                        {publicadoresEnGrupo.map(p => <option key={p.id} value={p.id}>{[p.Nombre, p.Apellido, p['2do Apellido'], p['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ')}</option>)}
                                    </select>
                                </div>
                            </>
                        )}


                        <table className="w-full border-collapse mb-6">
                            <tbody>
                                <tr className="border-b"><td className="p-3">Marque la casilla si participó en la predicación</td><td className="p-3 text-center"><input type="checkbox" checked={predico} onChange={e => setPredico(e.target.checked)} className="w-6 h-6" /></td></tr>
                                <tr className="border-b"><td className="p-3">Cursos bíblicos</td><td className="p-3"><input type="number" value={cursos} onChange={e => setCursos(e.target.value)} min="0" className="input text-center" /></td></tr>
                                <tr><td className="p-3">Horas (solo precursores)</td><td className="p-3"><input type="number" value={horas} onChange={e => setHoras(e.target.value)} min="0" step="any" className="input text-center" /></td></tr>
                            </tbody>
                        </table>

                         <div className="form-group mb-6">
                            <label className="label">Tipo de servicio (si reporta horas):</label>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {['Precursor Auxiliar', 'Precursor Regular', 'Precursor Especial', 'Misionero'].map(type => (
                                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                                        <input type="radio" name="tipo_servicio" value={type} checked={tipoServicio === type} onChange={e => setTipoServicio(e.target.value)} />
                                        {type}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="notas" className="label">Comentarios:</label>
                            <textarea id="notas" value={notas} onChange={e => setNotas(e.target.value)} className="input h-24"></textarea>
                        </div>

                        <button type="submit" disabled={isSubmitting} className="w-full mt-4 p-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                            {isSubmitting ? 'Enviando...' : 'Enviar Informe'}
                        </button>
                    </form>

                    {status.message && (
                        <div className={`text-center mt-4 p-3 rounded-md font-bold ${
                            status.type === 'info' ? 'bg-blue-100 text-blue-800' : 
                            status.type === 'success' ? 'bg-green-100 text-green-800' : 
                            'bg-red-100 text-red-800'
                        }`}>
                            {status.message}
                        </div>
                    )}
                </div>
                 <style>{`.label { display: block; font-weight: bold; margin-bottom: 5px; color: #555; } .input { width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 16px; }`}</style>
            </div>
            {showInvitationModal && (
                <InvitationModal 
                    slides={invitationSlides}
                    onClose={() => {
                        setShowInvitationModal(false);
                        // Clean the hash. App.tsx's listener will handle the view change.
                        window.location.hash = '';
                    }}
                    onApply={() => {
                        setShowInvitationModal(false);
                        onApplyForPioneer();
                    }}
                />
            )}
        </>
    );
};

export default InformeServicio;