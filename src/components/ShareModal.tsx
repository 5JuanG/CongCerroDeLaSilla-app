import React, { useState, useEffect, useRef } from 'react';

declare const html2canvas: any;

interface ShareModalProps {
    title: string;
    textContent: string;
    onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ title, textContent, onClose }) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const [copyStatus, setCopyStatus] = useState('');

    useEffect(() => {
        if (copyStatus) {
            const timer = setTimeout(() => setCopyStatus(''), 2000);
            return () => clearTimeout(timer);
        }
    }, [copyStatus]);

    const handleCopyImage = async () => {
        if (!contentRef.current) return;
        setCopyStatus('Copiando imagen...');
        try {
            const canvas = await html2canvas(contentRef.current, { scale: 2, backgroundColor: null });
            canvas.toBlob(async (blob) => {
                if (blob) {
                    // @ts-ignore
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                    setCopyStatus('¡Imagen copiada!');
                } else {
                    setCopyStatus('Error al crear la imagen.');
                }
            }, 'image/png');
        } catch (err) {
            console.error(err);
            setCopyStatus('Error al copiar la imagen.');
        }
    };

    const handleCopyText = () => {
        navigator.clipboard.writeText(textContent).then(() => {
            setCopyStatus('¡Texto copiado!');
        }).catch(() => {
            setCopyStatus('Error al copiar el texto.');
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b">
                    <h3 className="text-xl font-bold text-gray-800">{title}</h3>
                </div>
                <div className="p-6 bg-gray-100">
                    <div ref={contentRef} className="bg-[#E0FDCF] p-4 rounded-xl shadow-sm relative">
                        <p className="text-gray-800 whitespace-pre-wrap">{textContent}</p>
                    </div>
                </div>
                <div className="p-4 bg-gray-50 space-y-3">
                    <div className="text-center h-5 text-blue-600 font-semibold">{copyStatus}</div>
                    <div className="flex justify-center gap-4">
                        <button onClick={handleCopyImage} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Copiar Imagen</button>
                        <button onClick={handleCopyText} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Copiar Texto</button>
                        <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
