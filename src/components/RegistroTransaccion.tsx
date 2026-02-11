import React, { useState, useEffect, useRef, useCallback } from 'react';

declare const jspdf: any;
declare const html2canvas: any;
declare const SignaturePad: any;

const CheckboxItem: React.FC<{ label: string; value: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; }> = ({ label, value, checked, onChange }) => (
    <label className="flex items-center space-x-2 cursor-pointer text-sm checkbox-item-export">
        <input type="checkbox" value={value} checked={checked} onChange={onChange} className="h-4 w-4 rounded border-gray-400 text-blue-600 focus:ring-blue-500" />
        <span className="whitespace-nowrap">{label}</span>
    </label>
);

const AmountInput: React.FC<{ 
    label?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    name: string;
    description?: string;
    onDescriptionChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    descriptionName?: string;
}> = ({ label, value, onChange, name, description, onDescriptionChange, descriptionName }) => (
    <div className="flex items-end space-x-4">
        <div className="flex-grow">
            {label ? (
                <label htmlFor={name} className="text-gray-800">{label}</label>
            ) : (
                <input
                    id={descriptionName}
                    name={descriptionName}
                    type="text"
                    value={description}
                    onChange={onDescriptionChange}
                    placeholder="Descripción..."
                    className="w-full bg-transparent p-1 border-b border-dotted border-gray-400 focus:outline-none focus:border-blue-500"
                />
            )}
        </div>
        <input
            id={name}
            name={name}
            type="number"
            value={value}
            onChange={onChange}
            placeholder="0.00"
            step="0.01"
            className="w-36 p-1 bg-transparent border-b border-dotted border-gray-400 text-right focus:outline-none focus:border-blue-500 shrink-0"
        />
    </div>
);

const RegistroTransaccion: React.FC = () => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [transactionTypes, setTransactionTypes] = useState<string[]>([]);
    const [amounts, setAmounts] = useState({
        obraMundial: '',
        gastosCongregacion: '',
        otro1: '',
        otro2: '',
        otro3: '',
    });
    const [descriptions, setDescriptions] = useState({
        otro1: '',
        otro2: '',
        otro3: '',
    });
    const [total, setTotal] = useState('0.00');
    const [status, setStatus] = useState({ message: '', type: '' });
    const [filledByName, setFilledByName] = useState('');
    const [verifiedByName, setVerifiedByName] = useState('');
    const [pdfForSharing, setPdfForSharing] = useState<Blob | null>(null);
    
    // State for robust library loading
    const [librariesReady, setLibrariesReady] = useState(false);
    const [libraryError, setLibraryError] = useState('');

    const formRef = useRef<HTMLDivElement>(null);
    const filledByCanvasRef = useRef<HTMLCanvasElement>(null);
    const verifiedByCanvasRef = useRef<HTMLCanvasElement>(null);
    const filledByPadRef = useRef<any>(null);
    const verifiedByPadRef = useRef<any>(null);

    // Effect to check for external libraries on mount
    useEffect(() => {
        // A short delay to allow CDN scripts to load, then check.
        const timer = setTimeout(() => {
            if (typeof SignaturePad !== 'function') {
                setLibraryError('Error: La librería de firmas (SignaturePad) no se pudo cargar. Por favor, refresque la página.');
            } else if (typeof html2canvas !== 'function') {
                setLibraryError('Error: La librería de exportación (html2canvas) no se pudo cargar. Por favor, refresque la página.');
            } else if (typeof jspdf?.jsPDF !== 'function') {
                setLibraryError('Error: La librería de PDF (jspdf) no se pudo cargar. Por favor, refresque la página.');
            } else {
                setLibrariesReady(true);
            }
        }, 200); // 200ms delay

        return () => clearTimeout(timer);
    }, []);

    const initPad = useCallback((canvasRef: React.RefObject<HTMLCanvasElement>, padRef: React.MutableRefObject<any>) => {
        if (!canvasRef.current || !SignaturePad) return;

        padRef.current = new SignaturePad(canvasRef.current, {
            backgroundColor: 'rgba(255, 255, 255, 0)',
            penColor: 'rgb(0, 0, 0)'
        });
        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            canvas.width = canvas.offsetWidth * ratio;
            canvas.height = canvas.offsetHeight * ratio;
            canvas.getContext('2d')?.scale(ratio, ratio);
            padRef.current.clear();
        };
        window.addEventListener('resize', resizeCanvas);
        const timeoutId = setTimeout(resizeCanvas, 50);
        return () => {
            window.removeEventListener('resize', resizeCanvas);
            clearTimeout(timeoutId);
        };
    }, []);

    useEffect(() => {
        if (!librariesReady) return; // Guard clause: Only run when libraries are confirmed to be ready.
        const cleanupFilled = initPad(filledByCanvasRef, filledByPadRef);
        const cleanupVerified = initPad(verifiedByCanvasRef, verifiedByPadRef);
        return () => {
            if (cleanupFilled) cleanupFilled();
            if (cleanupVerified) cleanupVerified();
        };
    }, [librariesReady, initPad]);

    useEffect(() => {
        const sum = Object.values(amounts).reduce<number>((acc, val) => acc + (parseFloat(val as string) || 0), 0);
        setTotal(sum.toFixed(2));
    }, [amounts]);

    const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        setTransactionTypes(prev =>
            checked ? [...prev, value] : prev.filter(t => t !== value)
        );
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setAmounts(prev => ({ ...prev, [name]: value }));
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setDescriptions(prev => ({ ...prev, [name]: value }));
    };

    const handleClear = () => {
        setDate(new Date().toISOString().split('T')[0]);
        setTransactionTypes([]);
        setAmounts({ obraMundial: '', gastosCongregacion: '', otro1: '', otro2: '', otro3: '' });
        setDescriptions({ otro1: '', otro2: '', otro3: '' });
        filledByPadRef.current?.clear();
        verifiedByPadRef.current?.clear();
        setFilledByName('');
        setVerifiedByName('');
        setPdfForSharing(null);
        setStatus({ message: '', type: '' });
    };

    const handleGeneratePdf = async () => {
        const content = formRef.current;
        if (!content) return;

        setStatus({ message: 'Generando PDF...', type: 'info' });
        setPdfForSharing(null);

        content.classList.add('pdf-export');

        try {
            const canvas = await html2canvas(content, { scale: 3 });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const ratio = canvas.width / canvas.height;

            let finalWidth = pdfWidth;
            let finalHeight = finalWidth / ratio;

            if (finalHeight > pdfHeight) {
                finalHeight = pdfHeight;
                finalWidth = finalHeight * ratio;
            }
            
            const x = (pdfWidth - finalWidth) / 2;
            const y = (pdfHeight - finalHeight) / 2;

            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
            
            const blob = pdf.output('blob');
            setPdfForSharing(blob);

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Registro_Transaccion_${date}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            setStatus({ message: '¡PDF generado! Ya puedes compartirlo.', type: 'success' });
        } catch (error) {
            setStatus({ message: 'Error al generar el PDF.', type: 'error' });
            console.error(error);
        } finally {
            content.classList.remove('pdf-export');
        }
    };
    
    const handleShare = async () => {
        if (!pdfForSharing) {
            setStatus({ message: 'Por favor, genera el PDF primero antes de compartir.', type: 'info' });
            return;
        }

        const pdfFile = new File([pdfForSharing], `Registro_Transaccion_${date}.pdf`, { type: 'application/pdf' });
        const shareData = {
            files: [pdfFile],
            title: 'Registro de Transacción',
            text: 'Adjunto el registro de transacción para su revisión.',
        };
        
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
                setStatus({ message: 'Compartido con éxito.', type: 'success' });
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    setStatus({ message: 'No se pudo compartir el archivo.', type: 'error' });
                }
            }
        } else {
            setStatus({ message: 'Tu navegador no soporta compartir archivos directamente. Por favor, compártelo desde tus descargas.', type: 'info' });
        }
    };

    if (libraryError) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-md shadow-md" role="alert">
                    <p className="font-bold mb-2">Error Crítico de Carga</p>
                    <p>{libraryError}</p>
                </div>
            </div>
        );
    }

    if (!librariesReady) {
        return (
            <div className="flex items-center justify-center h-full p-4">
                <p className="text-gray-600 font-semibold animate-pulse">Cargando componentes de registro...</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 min-h-screen p-4 flex items-center justify-center">
            <style>{`
                .pdf-export {
                    font-family: 'Times New Roman', Times, serif !important;
                    padding: 15px 2px !important;
                    margin: 0 !important;
                    background: white !important;
                    color: black !important;
                    box-sizing: border-box;
                    line-height: 1.5 !important;
                }
                .pdf-export h1 {
                    padding-top: 5px !important;
                    font-size: 22pt !important;
                    margin-bottom: 12px !important;
                }
                .pdf-export .transaction-types-section {
                    margin-bottom: 12px !important;
                }
                .pdf-export .checkbox-item-export {
                    display: flex !important;
                    align-items: center !important;
                    padding-bottom: 6px !important;
                }
                .pdf-export input[type="checkbox"] {
                    -webkit-appearance: checkbox !important;
                    appearance: checkbox !important;
                    width: 12px !important;
                    height: 12px !important;
                    border: 1px solid #333 !important;
                    background-color: white !important;
                    margin-right: 8px !important;
                    flex-shrink: 0 !important;
                    print-color-adjust: exact;
                    -webkit-print-color-adjust: exact;
                    position: relative;
                    top: 4px;
                }
                .pdf-export .amounts-container {
                    display: flex;
                    flex-direction: column;
                    gap: 18px !important;
                    margin-bottom: 5px !important;
                }
                .pdf-export input[type="text"],
                .pdf-export input[type="date"],
                .pdf-export input[type="number"],
                .pdf-export .total-display {
                    padding: 2px 0 18px 0 !important;
                    height: auto !important;
                    line-height: 1.5 !important;
                    border: none !important;
                    border-bottom: 1px solid #333 !important;
                    border-radius: 0 !important;
                    background-color: transparent !important;
                    font-size: 11pt !important;
                    -webkit-appearance: none;
                    appearance: none;
                }
                .pdf-export input[type="number"],
                .pdf-export .total-display {
                    font-family: 'Times New Roman', Times, serif !important;
                    -moz-appearance: textfield;
                }
                .pdf-export .total-section {
                    margin-top: 10px !important;
                }
                .pdf-export .signature-grid {
                    margin-top: 30px !important;
                }
                .pdf-export .signature-canvas-container {
                    height: 60px !important;
                    margin-bottom: 0 !important;
                }
                .pdf-export .signature-label {
                    margin-bottom: 2px !important;
                }
                .pdf-export .signature-name-input {
                    height: auto !important;
                    padding-bottom: 10px !important;
                }
                .pdf-export .footer-text {
                    margin-top: 25px !important;
                }
                .pdf-export .clear-signature-btn,
                .pdf-export .form-buttons-container {
                    display: none !important;
                }
            `}</style>
            <div className="w-full overflow-x-auto pb-2">
                <div ref={formRef} className="max-w-2xl min-w-[700px] mx-auto bg-white p-6 sm:p-8 shadow-lg font-serif">
                    <h1 className="text-2xl font-bold text-center mb-6 tracking-widest">REGISTRO DE TRANSACCIÓN</h1>
                    
                    <div className="flex justify-between items-start mb-6 transaction-types-section">
                        <div>
                            <h2 className="font-semibold mb-2">Seleccione el tipo de transacción:</h2>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                <CheckboxItem label="Donación" value="donacion" checked={transactionTypes.includes('donacion')} onChange={handleTypeChange} />
                                <CheckboxItem label="Pago" value="pago" checked={transactionTypes.includes('pago')} onChange={handleTypeChange} />
                                <CheckboxItem label="Depósito en la caja de efectivo" value="deposito" checked={transactionTypes.includes('deposito')} onChange={handleTypeChange} />
                                <CheckboxItem label="Adelanto de efectivo" value="adelanto" checked={transactionTypes.includes('adelanto')} onChange={handleTypeChange} />
                            </div>
                        </div>
                        <div className="flex items-baseline space-x-2 shrink-0">
                            <label htmlFor="date" className="font-semibold">Fecha:</label>
                            <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className="w-32 bg-transparent border-b border-dotted border-gray-400 focus:outline-none" />
                        </div>
                    </div>

                    <div className="space-y-4 mb-4 amounts-container">
                        <AmountInput label="Donaciones (Obra mundial)" name="obraMundial" value={amounts.obraMundial} onChange={handleAmountChange} />
                        <AmountInput label="Donaciones (Gastos de la congregación)" name="gastosCongregacion" value={amounts.gastosCongregacion} onChange={handleAmountChange} />
                        <AmountInput name="otro1" value={amounts.otro1} onChange={handleAmountChange} description={descriptions.otro1} onDescriptionChange={handleDescriptionChange} descriptionName="otro1" />
                        <AmountInput name="otro2" value={amounts.otro2} onChange={handleAmountChange} description={descriptions.otro2} onDescriptionChange={handleDescriptionChange} descriptionName="otro2" />
                        <AmountInput name="otro3" value={amounts.otro3} onChange={handleAmountChange} description={descriptions.otro3} onDescriptionChange={handleDescriptionChange} descriptionName="otro3" />
                    </div>

                    <div className="flex justify-end items-center space-x-4 py-2 mt-4 total-section">
                        <span className="font-bold text-lg">TOTAL:</span>
                        <input type="text" value={total} readOnly className="total-display w-36 p-1 font-bold text-lg bg-transparent border-b border-dotted border-gray-400 text-right" />
                    </div>

                    <div className="grid grid-cols-2 gap-8 mt-6 signature-grid">
                        <div>
                             <div className="relative h-16 mb-1 signature-canvas-container">
                                <canvas ref={filledByCanvasRef} className="absolute top-0 left-0 w-full h-full" />
                                <div className="signature-line absolute bottom-0 left-0 w-full h-px border-b border-dotted border-gray-400"></div>
                            </div>
                            <p className="text-xs text-center text-gray-600 mb-2 signature-label">(Rellenado por)</p>
                             <input 
                                type="text" 
                                id="filledByName" 
                                value={filledByName} 
                                onChange={(e) => setFilledByName(e.target.value)}
                                placeholder="nombre o iniciales"
                                className="w-full bg-transparent p-1 border-b border-dotted border-gray-400 text-center focus:outline-none focus:border-blue-500 signature-name-input"
                            />
                            <button type="button" onClick={() => filledByPadRef.current?.clear()} className="text-xs text-blue-600 hover:underline float-right mt-1 clear-signature-btn">Limpiar firma</button>
                        </div>
                         <div>
                            <div className="relative h-16 mb-1 signature-canvas-container">
                                <canvas ref={verifiedByCanvasRef} className="absolute top-0 left-0 w-full h-full" />
                                <div className="signature-line absolute bottom-0 left-0 w-full h-px border-b border-dotted border-gray-400"></div>
                            </div>
                            <p className="text-xs text-center text-gray-600 mb-2 signature-label">(Verificado por)</p>
                            <input 
                                type="text" 
                                id="verifiedByName" 
                                value={verifiedByName} 
                                onChange={(e) => setVerifiedByName(e.target.value)}
                                placeholder="nombre o iniciales"
                                className="w-full bg-transparent p-1 border-b border-dotted border-gray-400 text-center focus:outline-none focus:border-blue-500 signature-name-input"
                            />
                             <button type="button" onClick={() => verifiedByPadRef.current?.clear()} className="text-xs text-blue-600 hover:underline float-right mt-1 clear-signature-btn">Limpiar firma</button>
                        </div>
                    </div>

                    <p className="text-xs text-gray-500 mt-12 footer-text">S-24-S 5/21</p>
                </div>

                <div className="max-w-2xl min-w-[700px] mx-auto form-buttons-container">
                    <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                        <button onClick={handleGeneratePdf} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Generar PDF</button>
                        <button onClick={handleClear} className="px-6 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300">Limpiar</button>
                        {pdfForSharing && (
                            <button onClick={handleShare} className="px-6 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" /></svg>
                                Compartir
                            </button>
                        )}
                    </div>
                    {status.message && (
                        <div className={`mt-4 text-center p-2 rounded-md font-semibold text-sm ${
                            status.type === 'success' ? 'bg-green-100 text-green-800' :
                            status.type === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                        }`}>
                            {status.message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegistroTransaccion;