import React, { useState, useEffect } from 'react';
import { InvitationContent, HomepageContent, compressImage, ModalInfo } from '../App';

interface GestionContenidoProps {
    invitationContent: InvitationContent[];
    onAddInvitation: (imageDataUrl: string, phrase: string) => Promise<void>;
    onDeleteInvitation: (contentId: string) => Promise<void>;
    
    homepageContent: HomepageContent[];
    onAddHomepageContent: (imageDataUrl: string, title: string, phrase: string) => Promise<void>;
    onDeleteHomepageContent: (contentId: string) => Promise<void>;

    is15HourOptionEnabled: boolean;
    onUpdate15HourOption: (isEnabled: boolean) => Promise<void>;
    onShowModal: (info: ModalInfo) => void;
}

const GestionContenidoInvitacion: React.FC<GestionContenidoProps> = ({ 
    invitationContent, onAddInvitation, onDeleteInvitation, 
    homepageContent, onAddHomepageContent, onDeleteHomepageContent,
    is15HourOptionEnabled, onUpdate15HourOption,
    onShowModal
}) => {
    const [activeTab, setActiveTab] = useState<'homepage' | 'invitation' | 'settings'>('homepage');

    const [invitationPhrase, setInvitationPhrase] = useState('');
    const [invitationImageFiles, setInvitationImageFiles] = useState<File[]>([]);
    const [invitationImagePreviews, setInvitationImagePreviews] = useState<string[]>([]);
    
    const [homepageTitle, setHomepageTitle] = useState('');
    const [homepagePhrase, setHomepagePhrase] = useState('');
    const [homepageImageFiles, setHomepageImageFiles] = useState<File[]>([]);
    const [homepageImagePreviews, setHomepageImagePreviews] = useState<string[]>([]);

    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const urlsToClean = [...invitationImagePreviews, ...homepageImagePreviews].filter(url => url.startsWith('blob:'));
        return () => {
            urlsToClean.forEach(url => URL.revokeObjectURL(url));
        };
    }, [invitationImagePreviews, homepageImagePreviews]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'invitation' | 'homepage') => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const newPreviews = files.map(file => URL.createObjectURL(file as Blob));
            if (type === 'invitation') {
                setInvitationImageFiles(files);
                setInvitationImagePreviews(newPreviews);
            } else {
                setHomepageImageFiles(files);
                setHomepageImagePreviews(newPreviews);
            }
        }
    };
    
    const handleRemoveImage = (indexToRemove: number, type: 'invitation' | 'homepage') => {
        if (type === 'invitation') {
            URL.revokeObjectURL(invitationImagePreviews[indexToRemove]);
            setInvitationImageFiles(prev => prev.filter((_, index) => index !== indexToRemove));
            setInvitationImagePreviews(prev => prev.filter((_, index) => index !== indexToRemove));
        } else {
             URL.revokeObjectURL(homepageImagePreviews[indexToRemove]);
            setHomepageImageFiles(prev => prev.filter((_, index) => index !== indexToRemove));
            setHomepageImagePreviews(prev => prev.filter((_, index) => index !== indexToRemove));
        }
    };

    const createSubmitHandler = (type: 'invitation' | 'homepage') => async (e: React.FormEvent) => {
        e.preventDefault();
        const files = type === 'invitation' ? invitationImageFiles : homepageImageFiles;
        const phrase = type === 'invitation' ? invitationPhrase : homepagePhrase;
        const title = type === 'homepage' ? homepageTitle : '';
    
        if (files.length === 0 || !phrase.trim() || (type === 'homepage' && !title.trim())) {
            onShowModal({ type: 'error', title: 'Campos Incompletos', message: 'Por favor, complete todos los campos y seleccione al menos una imagen.' });
            return;
        }
    
        setIsUploading(true);
        onShowModal({ type: 'info', title: 'Procesando Imágenes', message: `Comprimiendo y subiendo ${files.length} imágen(es)... Espere un momento.` });
    
        try {
            const compressedDataUrls: string[] = await Promise.all(files.map(file => compressImage(file)));
    
            let successCount = 0;
            let failedFiles: string[] = [];
    
            for (let i = 0; i < compressedDataUrls.length; i++) {
                const dataUrl = compressedDataUrls[i];
                const originalFileName = files[i].name;
    
                try {
                    if (type === 'invitation') {
                        await onAddInvitation(dataUrl, phrase.trim());
                    } else {
                        await onAddHomepageContent(dataUrl, title.trim(), phrase.trim());
                    }
                    successCount++;
                } catch (uploadError) {
                    console.error(`Error uploading ${originalFileName}:`, uploadError);
                    failedFiles.push(originalFileName);
                }
            }
    
            if (failedFiles.length > 0) {
                onShowModal({
                    type: 'error',
                    title: 'Carga Incompleta',
                    message: `Se subieron ${successCount} de ${compressedDataUrls.length} imágenes.\n\nFallaron: ${failedFiles.join(', ')}`
                });
            } else {
                onShowModal({
                    type: 'success',
                    title: 'Carga Exitosa',
                    message: `¡Se añadieron ${successCount} imágenes con éxito!`
                });
            }
    
            // Reset form only on full success
            if (failedFiles.length === 0) {
                if (type === 'invitation') {
                    setInvitationPhrase(''); setInvitationImageFiles([]); setInvitationImagePreviews([]);
                } else {
                    setHomepageTitle(''); setHomepagePhrase(''); setHomepageImageFiles([]); setHomepageImagePreviews([]);
                }
            }
        } catch (compressionError) {
            onShowModal({ type: 'error', title: 'Error de Compresión', message: `No se pudieron procesar las imágenes: ${(compressionError as Error).message}` });
        } finally {
            setIsUploading(false);
        }
    };
    
    const TabButton: React.FC<{ tabName: typeof activeTab; label: string }> = ({ tabName, label }) => (
        <button
            onClick={() => setActiveTab(tabName)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tabName
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="container mx-auto max-w-6xl space-y-8">
            <h1 className="text-3xl font-bold text-center text-gray-800">Gestionar Contenido y Campañas</h1>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                        <TabButton tabName="homepage" label="Imágenes de Inicio (Carrusel)" />
                        <TabButton tabName="invitation" label="Invitación Prec. Auxiliar" />
                        <TabButton tabName="settings" label="Configuración Campaña" />
                    </nav>
                </div>
                
                <div className="mt-8">
                    {activeTab === 'homepage' && (
                        <div>
                            <form onSubmit={createSubmitHandler('homepage')} className="space-y-6">
                                <div>
                                    <label htmlFor="homepageImageFiles" className="block text-sm font-medium text-gray-700 mb-1">1. Seleccionar Imágenes</label>
                                    <input type="file" id="homepageImageFiles" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFileChange(e, 'homepage')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                                </div>
                                {homepageImagePreviews.length > 0 && (
                                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 bg-gray-100 rounded-md border">
                                        {homepageImagePreviews.map((preview, index) => (
                                            <div key={preview} className="relative aspect-video group shadow-md"><img src={preview} alt="Preview" className="w-full h-full object-cover rounded-md"/><button type="button" onClick={() => handleRemoveImage(index, 'homepage')} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 leading-none w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100">&times;</button></div>
                                        ))}
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="homepageTitle" className="block text-sm font-medium text-gray-700 mb-1">2. Título (se usará para todas las imágenes)</label>
                                    <input id="homepageTitle" value={homepageTitle} onChange={e => setHomepageTitle(e.target.value)} placeholder="Ej: Campaña Especial de Predicación" className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                                </div>
                                <div>
                                    <label htmlFor="homepagePhrase" className="block text-sm font-medium text-gray-700 mb-1">3. Frase / Descripción</label>
                                    <textarea id="homepagePhrase" value={homepagePhrase} onChange={e => setHomepagePhrase(e.target.value)} rows={2} placeholder="Ej: Unamos nuestras voces para llevar este mensaje de esperanza." className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                                </div>
                                <button type="submit" disabled={isUploading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-wait transition-colors">
                                    {isUploading ? 'Subiendo...' : 'Añadir a Carrusel'}
                                </button>
                            </form>
                             <h3 className="text-lg font-bold text-gray-700 mt-8 mb-4">Contenido del Carrusel Actual</h3>
                             {homepageContent.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {homepageContent.map(item => (
                                        <div key={item.id} className="bg-gray-50 rounded-lg shadow-md overflow-hidden group relative">
                                            <img src={item.imageUrl} alt={item.title} className="w-full h-48 object-cover"/><div className="p-4"><h4 className="font-bold">{item.title}</h4><p className="text-gray-700 text-sm italic">"{item.phrase}"</p></div><button onClick={() => onDeleteHomepageContent(item.id)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-gray-500 bg-gray-50 p-6 rounded-lg">No hay imágenes. Se mostrará la imagen predeterminada en la página de inicio.</p>}
                        </div>
                    )}
                    {activeTab === 'invitation' && (
                        <div>
                            <form onSubmit={createSubmitHandler('invitation')} className="space-y-6">
                                 <div>
                                    <label htmlFor="invitationImageFiles" className="block text-sm font-medium text-gray-700 mb-1">1. Seleccionar Imágenes</label>
                                    <input type="file" id="invitationImageFiles" multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFileChange(e, 'invitation')} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                                </div>
                                 {invitationImagePreviews.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4 bg-gray-100 rounded-md border">
                                        {invitationImagePreviews.map((preview, index) => (
                                            <div key={preview} className="relative aspect-video group shadow-md"><img src={preview} alt="Preview" className="w-full h-full object-cover rounded-md"/><button type="button" onClick={() => handleRemoveImage(index, 'invitation')} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 leading-none w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100">&times;</button></div>
                                        ))}
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="invitationPhrase" className="block text-sm font-medium text-gray-700 mb-1">2. Frase de Ánimo</label>
                                    <textarea id="invitationPhrase" value={invitationPhrase} onChange={e => setInvitationPhrase(e.target.value)} rows={3} placeholder="Ej: ¡Tu celo es contagioso! ¿Has pensado en ser precursor?" className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                                </div>
                                <button type="submit" disabled={isUploading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-wait transition-colors">
                                    {isUploading ? 'Subiendo...' : 'Añadir a Invitaciones'}
                                </button>
                            </form>
                             <h3 className="text-lg font-bold text-gray-700 mt-8 mb-4">Contenido de Invitación Actual</h3>
                            {invitationContent.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {invitationContent.map(item => (
                                        <div key={item.id} className="bg-gray-50 rounded-lg shadow-md overflow-hidden group relative">
                                            <img src={item.imageUrl} alt="Contenido de invitación" className="w-full h-48 object-cover"/><div className="p-4"><p className="text-gray-700 text-sm italic">"{item.phrase}"</p></div><button onClick={() => onDeleteInvitation(item.id)} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-2 opacity-0 group-hover:opacity-100"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg></button>
                                        </div>
                                    ))}
                                </div>
                            ) : <p className="text-center text-gray-500 bg-gray-50 p-6 rounded-lg">No hay contenido de invitación personalizado. Se mostrarán las imágenes y frases predeterminadas.</p>}
                        </div>
                    )}
                    {activeTab === 'settings' && (
                        <div>
                             <h2 className="text-xl font-bold text-gray-700 mb-4">Configuración de Campaña</h2>
                             <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                                <div>
                                    <span className="mr-4 text-gray-800 font-semibold">Activar opción de 15 horas</span>
                                    <p className="text-sm text-gray-500">Permite a los publicadores solicitar el precursorado auxiliar con un requisito de 15 horas.</p>
                                </div>
                                <label htmlFor="toggle-15-hours" className="flex items-center cursor-pointer">
                                    <div className="relative">
                                        <input type="checkbox" id="toggle-15-hours" className="sr-only" checked={is15HourOptionEnabled} onChange={(e) => onUpdate15HourOption(e.target.checked)}/>
                                        <div className="block bg-gray-200 w-14 h-8 rounded-full"></div>
                                        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${is15HourOptionEnabled ? 'transform translate-x-6 !bg-blue-600' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GestionContenidoInvitacion;