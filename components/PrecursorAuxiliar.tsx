// FIX: Import `useMemo` from `react` to fix 'Cannot find name' error.
import React, { useState, useEffect, useRef, useCallback, forwardRef, useMemo } from 'react';
import { UserRole, MONTHS } from '../App';
import { GoogleGenAI } from "@google/genai";
import Tooltip from './Tooltip';

// --- Type Declarations ---
declare const SignaturePad: any;
declare const jspdf: any;
declare const html2canvas: any;
declare const db: any;


interface Solicitud {
    id: string;
    nombre: string;
    mes: string;
    deContinuo: boolean;
    fecha: string;
    status: 'Pendiente' | 'Aprobado';
    horas: '15' | '30' | string;
    firma_solicitante: string | null;
    firma1: string | null;
    firma2: string | null;
    firma3: string | null;
}

interface PrecursorAuxiliarProps {
    userRole: UserRole;
    isCommitteeMember: boolean;
    forceFormView?: boolean;
    is15HourOptionEnabled: boolean;
}

// --- UI Sub-Components ---

const Badge: React.FC<{ status: Solicitud['status']; children: React.ReactNode }> = ({ status, children }) => {
    const statusClasses = {
        'Pendiente': 'bg-yellow-100 text-yellow-800',
        'Aprobado': 'bg-green-100 text-green-800',
    };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusClasses[status]}`}>{children}</span>;
};

const Formulario: React.FC<{ is15HourOptionEnabled: boolean }> = ({ is15HourOptionEnabled }) => {
    const [nombre, setNombre] = useState('');
    const [mes, setMes] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [horas, setHoras] = useState<string | null>(null);
    const [deContinuo, setDeContinuo] = useState(false);
    const [status, setStatus] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signaturePadRef = useRef<any>(null);

    useEffect(() => {
        if (!is15HourOptionEnabled && horas === '15') {
            setHoras(null); // Deselect if it becomes disabled
        }
    }, [is15HourOptionEnabled, horas]);

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        signaturePadRef.current = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
        const resizeCanvas = () => {
            if (!canvas || !signaturePadRef.current) return;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext('2d')?.scale(ratio, ratio);
            signaturePadRef.current.clear();
        };
        const timeoutId = setTimeout(resizeCanvas, 50);
        window.addEventListener('resize', resizeCanvas);
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', resizeCanvas);
            signaturePadRef.current?.off();
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!horas) { alert("Por favor, seleccione el número de horas."); return; }
        if (signaturePadRef.current?.isEmpty()) { alert("Por favor, proporcione su firma."); return; }

        setIsLoading(true);
        setStatus('Enviando...');
        
        try {
            const firmaDataURL = signaturePadRef.current.toDataURL("image/png");
            
            const newApplication = {
                horas,
                nombre,
                mes,
                deContinuo,
                fecha,
                firma_solicitante: firmaDataURL,
                status: 'Pendiente' as const,
                firma1: null,
                firma2: null,
                firma3: null,
            };

            await db.collection('pioneer_applications').add(newApplication);

            setStatus('¡Solicitud enviada con éxito!');
            setNombre('');
            setMes('');
            setHoras(null);
            setDeContinuo(false);
            signaturePadRef.current?.clear();
            setTimeout(() => setStatus(''), 5000);
        } catch (error: any) {
            setStatus(`Error al enviar la solicitud: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div className="max-w-4xl mx-auto bg-white p-6 sm:p-8 md:p-12 rounded-2xl shadow-lg">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center text-gray-800 mb-8">Solicitud para el Servicio de Precursor Auxiliar</h2>
            <p className="text-gray-600 text-base md:text-lg mb-6 leading-relaxed">Debido a mi amor por Jehová y mi deseo de ayudar a mi prójimo a aprender acerca de él y sus propósitos amorosos, me gustaría aumentar mi participación en el servicio del campo siendo precursor auxiliar durante el período que se indica a continuación:</p>
            <form onSubmit={handleSubmit} noValidate>
                 <div className="mb-8">
                    <label className="block text-lg font-bold text-gray-700 mb-3">Requisito de Horas</label>
                    <div className="flex flex-col sm:flex-row gap-4 rounded-xl border-2 border-gray-200 p-4 bg-gray-50">
                        <div className="flex-1 relative group">
                            <input
                                type="radio"
                                id="horas15"
                                name="horas"
                                value="15"
                                checked={horas === '15'}
                                onChange={() => setHoras('15')}
                                className="hidden peer"
                                required
                                disabled={!is15HourOptionEnabled}
                            />
                            <label
                                htmlFor="horas15"
                                className={`block text-center text-lg p-4 rounded-lg border-2 border-gray-300 transition-all
                                    ${is15HourOptionEnabled
                                        ? 'cursor-pointer peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600'
                                        : 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed'
                                    }`}
                            >
                                15 Horas
                                {!is15HourOptionEnabled && <span className="block text-xs font-normal mt-1">(No disponible actualmente)</span>}
                            </label>
                             <Tooltip text={!is15HourOptionEnabled ? 'Esta opción solo está disponible durante meses de campaña especial, según lo anuncie la sucursal.' : 'Seleccione si aplicará para el requisito de 15 horas.'} />
                        </div>
                        <div className="flex-1">
                            <input type="radio" id="horas30" name="horas" value="30" checked={horas === '30'} onChange={() => setHoras('30')} className="hidden peer" />
                            <label htmlFor="horas30" className="block text-center text-lg p-4 rounded-lg border-2 border-gray-300 cursor-pointer peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 transition-all">30 Horas</label>
                        </div>
                    </div>
                </div>
                <div className="mb-6">
                    <label htmlFor="mes" className="block text-lg font-bold text-gray-700 mb-2">El(los) mes(es) de:</label>
                    <input type="text" id="mes" value={mes} onChange={(e) => setMes(e.target.value)} required className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition" autoComplete="off" autoCorrect="off" spellCheck="false" translate="no" />
                </div>
                <div className="my-8 flex items-center gap-4 p-4 bg-blue-50 rounded-lg relative group">
                    <input type="checkbox" id="deContinuo" checked={deContinuo} onChange={(e) => setDeContinuo(e.target.checked)} className="h-6 w-6 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0" />
                    <label htmlFor="deContinuo" className="text-base text-gray-700">Marque la casilla si desea ser precursor auxiliar continuo hasta nuevo aviso.</label>
                    <Tooltip text="Si marca esta casilla, su solicitud se renovará automáticamente cada mes hasta que notifique lo contrario al comité de servicio." />
                </div>
                <p className="text-gray-600 text-base md:text-lg my-6 leading-relaxed">Disfruto de una buena reputación moral y tengo buenos hábitos. He hecho planes para cumplir con el requisito de horas.</p>
                 <div className="mb-6">
                    <label htmlFor="nombre" className="block text-lg font-bold text-gray-700 mb-2">Nombre (en imprenta):</label>
                    <input type="text" id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition" />
                </div>
                <div className="mb-6">
                    <label className="block text-lg font-bold text-gray-700 mb-2">Firma del Solicitante:</label>
                    <div className="border-2 border-gray-300 rounded-lg bg-white">
                        <canvas ref={canvasRef} className="w-full h-48 md:h-64 cursor-crosshair rounded-lg" />
                    </div>
                    <div className="text-center mt-4">
                        <button type="button" onClick={() => signaturePadRef.current?.clear()} className="py-2 px-6 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-base">Limpiar Firma</button>
                    </div>
                </div>
                <div className="mb-8">
                    <label htmlFor="fecha" className="block text-lg font-bold text-gray-700 mb-2">Fecha:</label>
                    <input type="date" id="fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="w-full p-4 text-lg border-2 border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition" />
                </div>
                <button type="submit" disabled={isLoading} className="w-full py-4 px-6 bg-blue-600 text-white font-bold text-xl rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105">
                    {isLoading ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
                {status && <div className="mt-6 text-center text-lg font-semibold">{status}</div>}
            </form>
        </div>
    );
};

const SolicitudPreview = forwardRef<HTMLDivElement, { solicitud: Solicitud }>(({ solicitud }, ref) => {
    return (
        <div ref={ref} className="bg-white font-serif text-black w-[11in] h-[8.5in] p-12 box-border text-[11pt] flex flex-col">
            {/* === Top Section === */}
            <div>
                <h1 className="text-center font-bold tracking-wider text-[12pt] mb-6">SOLICITUD PARA EL SERVICIO DE PRECURSOR AUXILIAR</h1>
                <p className="mb-4">Debido a mi amor a Jehová y mi deseo de ayudar al prójimo a aprender acerca de él y sus amorosos propósitos, quisiera aumentar mi participación en el servicio del campo siendo precursor auxiliar durante el periodo indicado abajo:</p>
                <div className="flex items-baseline my-2">
                    <span className="whitespace-nowrap">El (los) mes(es) de</span>
                    <span className="flex-grow border-b border-dotted border-black mx-2 text-center font-bold">{solicitud.mes}</span>
                </div>
                <div className="flex items-center gap-2 my-4">
                    <div className="w-4 h-4 border border-black flex items-center justify-center">
                        {solicitud.deContinuo && <span className="font-bold text-xs -translate-y-px">X</span>}
                    </div>
                    <span>Marque la casilla si desea ser precursor auxiliar de continuo hasta nuevo aviso.</span>
                </div>
                <div className="my-4 w-[18.5cm]">
                    <p>Gozo de una buena reputación moral y tengo buenos hábitos. He hecho planes para satisfacer el requisito de</p>
                    <p>horas. (Vea <em>Nuestro Ministerio del Reino</em> de junio de 2013, página 2).</p>
                </div>
            </div>

            {/* === Date, Signature, Name Section === */}
            <div className="mt-4">
                <div className="flex flex-row justify-between items-end gap-x-12">
                    <div className="w-1/2 flex items-baseline">
                         <span className="text-[9pt] mr-2">Fecha:</span>
                         <span className="flex-grow border-b border-dotted border-black text-center pb-1 h-12 flex items-end justify-center">{solicitud.fecha}</span>
                    </div>
                    <div className="w-1/2">
                        <div className="border-b border-dotted border-black h-20 flex justify-center items-center">
                            {solicitud.firma_solicitante && <img src={solicitud.firma_solicitante} alt="signature" className="h-16 max-w-full" />}
                        </div>
                        <p className="text-center text-[9pt]">(Firma del solicitante)</p>
                    </div>
                </div>
                <div className="flex flex-row justify-end mt-4">
                    <div className="w-1/2">
                        <div className="border-b border-dotted border-black h-10 text-center font-bold flex justify-center items-end pb-1">{solicitud.nombre}</div>
                        <p className="text-center text-[9pt]">(Nombre en letra de molde)</p>
                    </div>
                </div>
            </div>

            {/* === Bottom Two-Column Section === */}
            <div className="flex flex-row mt-8 gap-x-12">
                {/* Left Column */}
                <div className="w-1/2 text-[9pt] space-y-4">
                    <p><strong>NOTA:</strong> Después de llenar esta solicitud, entréguela al coordinador del cuerpo de ancianos. Si es posible, hágalo por lo menos una semana antes de la fecha en que desea comenzar el servicio de precursor auxiliar. No debe enviarse esta solicitud a la sucursal, sino más bien guardarse en los archivos de la congregación.</p>
                    <div>
                        <p className="font-bold">Para el Comité de Servicio de la Congregación:</p>
                        <ol className="list-decimal list-inside space-y-1 mt-1 pl-2">
                            <li>¿Es el solicitante un buen ejemplo del vivir cristiano?</li>
                            <li>Quienes hayan sido censurados o readmitidos durante el pasado año o todavía estén bajo restricciones no satisfacen los requisitos.</li>
                            <li>¿Han consultado con su superintendente de grupo?</li>
                        </ol>
                    </div>
                </div>
                {/* Right Column */}
                <div className="w-1/2">
                    <p>Aprobado por los miembros del comité de servicio:</p>
                    <p className="text-[9pt]">(Basta con las iniciales)</p>
                    <div className="border-b border-dotted border-black h-12 mt-2 flex justify-center items-center">
                        {solicitud.firma1 && <img src={solicitud.firma1} alt="firma 1" className="h-10 max-w-full" />}
                    </div>
                    <div className="border-b border-dotted border-black h-12 mt-2 flex justify-center items-center">
                        {solicitud.firma2 && <img src={solicitud.firma2} alt="firma 2" className="h-10 max-w-full" />}
                    </div>
                    <div className="border-b border-dotted border-black h-12 mt-2 flex justify-center items-center">
                        {solicitud.firma3 && <img src={solicitud.firma3} alt="firma 3" className="h-10 max-w-full" />}
                    </div>
                </div>
            </div>

            {/* === Footer === */}
            <div className="mt-auto pt-4 text-[9pt]">
                S-205b-S 4/15
            </div>
        </div>
    );
});


const SigningModal: React.FC<{
    solicitud: Solicitud;
    onClose: () => void;
    onSave: (signatureDataUrl: string) => Promise<void>;
}> = ({ solicitud, onClose, onSave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signaturePadRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        signaturePadRef.current = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });
        const resizeCanvas = () => {
            if (!canvas || !signaturePadRef.current) return;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext('2d')?.scale(ratio, ratio);
            signaturePadRef.current.clear();
        };
        const timeoutId = setTimeout(resizeCanvas, 50);
        window.addEventListener('resize', resizeCanvas);
        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', resizeCanvas);
            signaturePadRef.current?.off();
        };
    }, []);

    const handleSaveClick = async () => {
        if (signaturePadRef.current?.isEmpty()) {
            alert("Por favor, firme en el recuadro.");
            return;
        }
        setIsLoading(true);
        const signatureDataUrl = signaturePadRef.current.toDataURL("image/png");
        await onSave(signatureDataUrl);
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[60] p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b">
                    <h3 className="text-xl font-bold">Añadir Firma del Comité</h3>
                    <p className="text-sm text-gray-600">Para: {solicitud.nombre}</p>
                </div>
                <div className="p-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Firma del miembro del comité:</label>
                    <div className="border border-gray-300 rounded-md bg-white">
                        <canvas ref={canvasRef} className="w-full h-48 cursor-crosshair rounded-md" />
                    </div>
                    <div className="text-right mt-2">
                        <button type="button" onClick={() => signaturePadRef.current?.clear()} className="text-xs text-blue-600 hover:underline">Limpiar Firma</button>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-4">
                    <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-gray-200 rounded-md">Cancelar</button>
                    <button onClick={handleSaveClick} disabled={isLoading} className="px-4 py-2 bg-green-600 text-white rounded-md disabled:bg-gray-400">
                        {isLoading ? 'Guardando...' : 'Guardar Firma'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PrecursorAuxiliar: React.FC<PrecursorAuxiliarProps> = ({ userRole, isCommitteeMember, forceFormView = false, is15HourOptionEnabled }) => {
    const isPrivilegedUser = useMemo(() => userRole === 'admin' || userRole === 'overseer' || isCommitteeMember, [userRole, isCommitteeMember]);
    const initialView = forceFormView ? 'form' : (isPrivilegedUser ? 'list' : 'form');
    const [view, setView] = useState<'list' | 'form'>(initialView);
    const [librariesReady, setLibrariesReady] = useState(false);
    const [libraryError, setLibraryError] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            if (typeof SignaturePad !== 'function' || typeof html2canvas !== 'function' || (typeof jspdf !== 'object' || typeof jspdf.jsPDF !== 'function')) {
                setLibraryError('Error: Una librería externa no se pudo cargar. Por favor, refresque la página para reintentar.');
            } else {
                setLibrariesReady(true);
            }
        }, 300); // Increased delay slightly for robustness
        return () => clearTimeout(timer);
    }, []);

    const SolicitudesList: React.FC = () => {
        const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
        const [loading, setLoading] = useState(true);
        const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);
        const [showPreview, setShowPreview] = useState(false);
        const [signingSolicitud, setSigningSolicitud] = useState<Solicitud | null>(null);
        const [deletingId, setDeletingId] = useState<string | null>(null);
        
        const previewRef = useRef<HTMLDivElement>(null);

        useEffect(() => {
            const unsubscribe = db.collection('pioneer_applications').orderBy('fecha', 'desc').onSnapshot((snapshot: any) => {
                const data = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
                setSolicitudes(data);
                setLoading(false);
            }, (error: any) => {
                console.error("Error fetching applications:", error);
                setLoading(false);
            });
            return () => unsubscribe();
        }, []);

        const continuos = useMemo(() => solicitudes.filter(s => s.deContinuo), [solicitudes]);
        const mensuales = useMemo(() => solicitudes.filter(s => !s.deContinuo), [solicitudes]);

        const handleSaveSignatureAndApprove = async (signatureDataUrl: string) => {
            if (!signingSolicitud) return;
        
            const updateData: Partial<Solicitud> = {};
        
            if (!signingSolicitud.firma1) {
                updateData.firma1 = signatureDataUrl;
            } else if (!signingSolicitud.firma2) {
                updateData.firma2 = signatureDataUrl;
            } else if (!signingSolicitud.firma3) {
                updateData.firma3 = signatureDataUrl;
                updateData.status = 'Aprobado';
            } else {
                console.warn('Attempted to sign an application that is already fully signed.');
                setSigningSolicitud(null);
                return;
            }
        
            await db.collection('pioneer_applications').doc(signingSolicitud.id).update(updateData);
            setSigningSolicitud(null);
        };

        const handleDelete = async (id: string) => {
            if (!window.confirm('¿Está seguro de que desea eliminar esta solicitud? Esta acción no se puede deshacer.')) {
                return;
            }
            if (!id) {
                alert('Error: ID de solicitud no válido. No se puede eliminar.');
                return;
            }
            setDeletingId(id);
            try {
                await db.collection('pioneer_applications').doc(id).delete();
                alert('Solicitud eliminada con éxito.');
            } catch (error) {
                console.error("Error deleting application:", error);
                alert(`¡ERROR! No se pudo eliminar la solicitud.\n\nMotivo: ${(error as Error).message}\n\nPor favor, verifique los permisos en la base de datos y su conexión a internet.`);
            } finally {
                setDeletingId(null);
            }
        };

        const handlePreview = (solicitud: Solicitud) => {
            setSelectedSolicitud(solicitud);
            setShowPreview(true);
        };
        
        const handleExportPdf = async () => {
            if (!previewRef.current || !selectedSolicitud) return;
            // @ts-ignore
            const { jsPDF } = jspdf;
            const canvas = await html2canvas(previewRef.current, { scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'letter' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgProps= pdf.getImageProperties(imgData);
            const imgRatio = imgProps.width / imgProps.height;
            
            let imgWidth = pdfWidth;
            let imgHeight = imgWidth / imgRatio;

            if (imgHeight > pdfHeight) {
                imgHeight = pdfHeight;
                imgWidth = imgHeight * imgRatio;
            }

            const x = (pdfWidth - imgWidth) / 2;
            const y = (pdfHeight - imgHeight) / 2;

            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            pdf.save(`Solicitud_PA_${selectedSolicitud.nombre}.pdf`);
        };

        const renderSolicitudList = (list: Solicitud[]) => {
            if (list.length === 0) {
                return <p className="text-center text-gray-500 p-4 bg-gray-50 rounded-md">No hay solicitudes en esta categoría.</p>;
            }
            return list.map(s => {
                const isDeleting = deletingId === s.id;
                return (
                    <div key={s.id} className="bg-gray-50 p-4 rounded-lg flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <p className="font-bold">{s.nombre}</p>
                            <p className="text-sm text-gray-600">Mes: {s.mes} | Fecha: {s.fecha} | Horas: {s.horas}</p>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                            <Badge status={s.status}>{s.status}</Badge>
                            {s.status === 'Pendiente' && isCommitteeMember && (
                                <button onClick={() => setSigningSolicitud(s)} className="px-3 py-1 bg-green-500 text-white rounded text-sm">Firmar</button>
                            )}
                            <button onClick={() => handlePreview(s)} className="px-3 py-1 bg-blue-500 text-white rounded text-sm">Vista Previa</button>
                            <button 
                                onClick={() => handleDelete(s.id)} 
                                disabled={isDeleting}
                                className="px-3 py-1 bg-red-500 text-white rounded text-sm disabled:bg-red-300 disabled:cursor-wait"
                            >
                                {isDeleting ? 'Eliminando...' : 'Eliminar'}
                            </button>
                        </div>
                    </div>
                )
            });
        };

        if (loading) return <div className="text-center p-8">Cargando solicitudes...</div>;

        return (
            <div>
                {showPreview && selectedSolicitud && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4" onClick={() => setShowPreview(false)}>
                        <div className="bg-white rounded-lg shadow-2xl flex flex-col max-h-[95vh] w-full max-w-7xl" onClick={e => e.stopPropagation()}>
                            <div className="flex-grow overflow-auto p-4 bg-gray-100">
                                <div className="mx-auto w-fit transform origin-top scale-[0.45] sm:scale-[0.7] lg:scale-[0.9]">
                                    <SolicitudPreview solicitud={selectedSolicitud} ref={previewRef} />
                                </div>
                            </div>
                            <div className="flex-shrink-0 flex justify-center gap-4 bg-white p-4 rounded-b-lg border-t">
                                <button onClick={handleExportPdf} className="px-4 py-2 bg-blue-600 text-white rounded">Descargar PDF</button>
                                <button onClick={() => setShowPreview(false)} className="px-4 py-2 bg-gray-300 rounded">Cerrar</button>
                            </div>
                        </div>
                    </div>
                )}
                {signingSolicitud && (
                    <SigningModal
                        solicitud={signingSolicitud}
                        onClose={() => setSigningSolicitud(null)}
                        onSave={handleSaveSignatureAndApprove}
                    />
                )}
                 <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 text-center">Gestionar Solicitudes de Prec. Auxiliar</h1>
                </div>

                <div className="mb-10">
                    <h2 className="text-xl font-semibold border-b-2 border-blue-200 pb-2 mb-4 text-blue-800">Solicitudes Continuas</h2>
                    <div className="space-y-4">
                        {renderSolicitudList(continuos)}
                    </div>
                </div>
                
                <div>
                    <h2 className="text-xl font-semibold border-b-2 border-gray-200 pb-2 mb-4 text-gray-800">Solicitudes Mensuales</h2>
                    <div className="space-y-4">
                        {renderSolicitudList(mensuales)}
                    </div>
                </div>
            </div>
        )
    };

    if (libraryError) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-md shadow-md" role="alert">
                    <p className="font-bold mb-2">Error Crítico</p>
                    <p>{libraryError}</p>
                </div>
            </div>
        );
    }
    
    if (!librariesReady) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <p className="text-gray-600 font-semibold animate-pulse">Cargando...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
             {isPrivilegedUser && !forceFormView && (
                <div className="mb-4 border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <button
                            onClick={() => setView('list')}
                            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                                view === 'list'
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Gestionar Solicitudes
                        </button>
                        <button
                            onClick={() => setView('form')}
                             className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                                view === 'form'
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                        >
                            Enviar Nueva Solicitud
                        </button>
                    </nav>
                </div>
            )}
            
            <div className="bg-white p-0 sm:p-6 rounded-lg shadow-md">
                {view === 'list' ? <SolicitudesList /> : <Formulario is15HourOptionEnabled={is15HourOptionEnabled} />}
            </div>
        </div>
    );
};

export default PrecursorAuxiliar;