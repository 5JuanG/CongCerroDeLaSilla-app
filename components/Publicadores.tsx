import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Publisher, ModalInfo, compressImage } from '../App';

interface PublicadoresProps {
    publishers: Publisher[];
    onAdd: (publisher: Omit<Publisher, 'id'>, onProgress?: (progress: number) => void) => Promise<void>;
    onUpdate: (publisher: Publisher, onProgress?: (progress: number) => void) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onShowModal: (info: ModalInfo) => void;
    canManage: boolean;
}

// Accordion Card Component
const PublisherCard: React.FC<{ publisher: Publisher; onEdit: (id: string) => void; onDelete: (id: string) => void; canManage: boolean; }> = ({ publisher, onEdit, onDelete, canManage }) => {
    const [openSection, setOpenSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        setOpenSection(openSection === section ? null : section);
    };

    const accordionSections = {
      "Datos Personales": ["Sexo", "Fecha de Nacimiento", "Apellido de casada"],
      "Dirección y Contacto": ["Calle", "Numero", "Colonia", "Municipio", "Estado", "CP", "Cel", "Correo"],
      "Información Espiritual": ["Fecha de bautismo", "Esperanza", "Privilegio", "Priv Adicional"],
      "Emergencia y Estatus": ["Contacto de Emergencia", "Cel de Emergencia", "Carta de presentacion", "Estatus"]
    };

    const foto = publisher.Foto || 'https://i.imgur.com/83itvIu.png';
    const nombreCompleto = [publisher.Nombre, publisher.Apellido, publisher['2do Apellido'], publisher['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ');

    const pdfIconSVG = <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M13.5,9V3.5L18.5,9H13.5M12,18.5C10.3,18.5 9,17.2 9,15.5C9,13.8 10.3,12.5 12,12.5A2.3,2.3 0 0,1 14.3,14.8L15.4,13.7C14.4,12.6 13.3,12 12,12C9.8,12 8,13.8 8,16C8,18.2 9.8,20 12,20C13.2,20 14.2,19.5 15,18.8L13.9,17.7C13.3,18.2 12.7,18.5 12,18.5Z"/></svg>;
    
    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="flex items-center p-5 border-b border-gray-200">
                <img src={foto} alt="Foto" className="w-16 h-16 rounded-full object-cover mr-4 border-4 border-blue-500" />
                <div>
                    <h3 className="text-xl font-bold text-gray-800">{nombreCompleto}</h3>
                    <p className="text-gray-500">Grupo: {publisher.Grupo || 'N/A'} | <span className={publisher.Estatus === 'Activo' ? 'text-green-600' : 'text-red-600'}>{publisher.Estatus}</span></p>
                </div>
            </div>
            <div>
                {Object.entries(accordionSections).map(([title, fields]) => (
                    <div key={title} className="border-t border-gray-200">
                        <header onClick={() => toggleSection(title)} className="bg-gray-50 p-4 cursor-pointer font-semibold flex justify-between items-center hover:bg-gray-100">
                            {title}
                            <span className={`transition-transform duration-300 ${openSection === title ? 'rotate-45' : ''}`}>+</span>
                        </header>
                        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openSection === title ? 'max-h-[500px]' : 'max-h-0'}`}>
                           <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                               {fields.map(field => {
                                   let fieldValue = publisher[field as keyof Omit<Publisher, 'id'>] || '';
                                   if (field === 'Carta de presentacion' && fieldValue) {
                                       return <div key={field} className="flex flex-col"><strong className="text-blue-600 mb-1">{field}:</strong><span><a href={fieldValue as string} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline flex items-center gap-2 font-semibold">{pdfIconSVG} Ver Carta</a></span></div>
                                   }
                                   return <div key={field} className="flex flex-col"><strong className="text-blue-600 mb-1">{field}:</strong><span>{fieldValue as React.ReactNode}</span></div>
                               })}
                           </div>
                        </div>
                    </div>
                ))}
            </div>
            <div className="p-4 text-right bg-gray-50 border-t border-gray-200">
                <button onClick={() => onEdit(publisher.id)} disabled={!canManage} className="text-green-600 border border-green-600 hover:bg-green-50 px-3 py-1 rounded-md text-sm font-semibold mr-2 disabled:opacity-50 disabled:cursor-not-allowed">Editar</button>
                <button onClick={() => onDelete(publisher.id)} disabled={!canManage} className="text-red-600 border border-red-600 hover:bg-red-50 px-3 py-1 rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Borrar</button>
            </div>
        </div>
    );
};

// Main Component
const Publicadores: React.FC<PublicadoresProps> = ({ publishers, onAdd, onUpdate, onDelete, onShowModal, canManage }) => {
    const [groups, setGroups] = useState<string[]>([]);
    const [filteredPublishers, setFilteredPublishers] = useState<Publisher[]>([]);
    const [groupFilter, setGroupFilter] = useState('todos');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPublisher, setEditingPublisher] = useState<Publisher | null>(null);

    const itemsPerPage = 9;

    useEffect(() => {
        const uniqueGroups = [...new Set(publishers.map(p => p.Grupo).filter(Boolean) as string[])].sort();
        setGroups(uniqueGroups);
    }, [publishers]);

    useEffect(() => {
        let data = publishers;
        if (groupFilter !== 'todos') {
            data = publishers.filter(p => p.Grupo === groupFilter);
        }
        setFilteredPublishers(data);
        setCurrentPage(1); 
    }, [groupFilter, publishers]);

    const paginatedPublishers = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return filteredPublishers.slice(start, end);
    }, [filteredPublishers, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredPublishers.length / itemsPerPage);

    const handleAddPublisher = () => {
        setEditingPublisher(null);
        setIsModalOpen(true);
    };

    const handleEdit = (id: string) => {
        const publisher = publishers.find(p => p.id === id);
        if (publisher) {
            setEditingPublisher(publisher);
            setIsModalOpen(true);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar a este publicador?')) {
            onDelete(id);
        }
    };

    const handleFormSubmit = async (publisherData: Publisher | Omit<Publisher, 'id'>, onProgress?: (progress: number) => void) => {
        try {
            if ('id' in publisherData && publisherData.id) { // Update
                await onUpdate(publisherData as Publisher, onProgress);
            } else { // Add
                await onAdd(publisherData, onProgress);
            }
            setIsModalOpen(false);
            setEditingPublisher(null);
        } catch (error) {
            console.error("Submit failed in component:", error);
            // The error modal is shown in App.tsx's handler.
        }
    };
    
    const handleExportCSV = () => {
        if (publishers.length === 0) {
            onShowModal({ type: 'info', title: 'Exportación CSV', message: 'No hay publicadores para exportar.' });
            return;
        }

        const dataToExport = publishers.map(p => ({
            'Nombre': p.Nombre,
            'Apellido Paterno': p.Apellido,
            'Apellido Materno': p['2do Apellido'] || '',
            'Apellido de casada': (p['Apellido de casada'] && p['Apellido de casada'].toLowerCase() !== 'n/a') ? p['Apellido de casada'] : '',
            'Sexo': p.Sexo || '',
            'Fecha de Nacimiento': p['Fecha de Nacimiento'] || '',
            'Calle': p.Calle || '',
            'Numero': p.Numero || '',
            'Colonia': p.Colonia || '',
            'Municipio': p.Municipio || '',
            'Estado': p.Estado || '',
            'CP': p.CP || '',
            'Celular': p.Cel || '',
            'Correo': p.Correo || '',
            'Fecha de Bautismo': p['Fecha de bautismo'] || '',
            'Esperanza': p.Esperanza || '',
            'Privilegio': p.Privilegio || '',
            'Privilegio Adicional': p['Priv Adicional'] || '',
            'Grupo': p.Grupo || '',
            'Estatus': p.Estatus,
            'Contacto de Emergencia': p['Contacto de Emergencia'] || '',
            'Celular de Emergencia': p['Cel de Emergencia'] || '',
        }));

        const headers = Object.keys(dataToExport[0]);
        const csvRows = [
            headers.join(','),
            ...dataToExport.map(row =>
                headers.map(header => {
                    let cell = row[header as keyof typeof row] === null || row[header as keyof typeof row] === undefined ? '' : row[header as keyof typeof row];
                    cell = String(cell).replace(/"/g, '""');
                    if (String(cell).includes(',')) {
                        cell = `"${cell}"`;
                    }
                    return cell;
                }).join(',')
            )
        ];

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'publicadores.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const PublisherForm: React.FC<{ publisher: Publisher | null, onSubmit: (data: any, onProgress?: (p: number) => void) => void, onCancel: () => void, onShowModal: PublicadoresProps['onShowModal'] }> = ({ publisher, onSubmit, onCancel, onShowModal }) => {
        const [formData, setFormData] = useState<any>(publisher || {
            Nombre: '', Apellido: '', Estatus: 'Activo', asignacionesDisponibles: []
        });
        const [isSaving, setIsSaving] = useState(false);
        const [uploadProgress, setUploadProgress] = useState<number | null>(null);
        const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(publisher?.Foto || null);
        const [letterFileName, setLetterFileName] = useState<string | null>(null);

        useEffect(() => {
            return () => {
                if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
                    URL.revokeObjectURL(photoPreviewUrl);
                }
            };
        }, [photoPreviewUrl]);

        const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            const { id, value, type } = e.target;
            if (type === 'file') {
                const file = (e.target as HTMLInputElement).files?.[0];

                if (id === 'Foto' && file) {
                    try {
                        const compressedFile = await compressImage(file, 400); // Smaller width for profile pics
                        setFormData((prev: any) => ({ ...prev, [id]: compressedFile }));
                        if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
                            URL.revokeObjectURL(photoPreviewUrl);
                        }
                        setPhotoPreviewUrl(URL.createObjectURL(compressedFile));
                    } catch (error) {
                        console.error("Image compression failed:", error);
                        onShowModal({ type: 'error', title: 'Error de Imagen', message: (error as Error).message });
                        setFormData((prev: any) => ({ ...prev, [id]: null }));
                        setPhotoPreviewUrl(publisher?.Foto || null);
                    }
                } else {
                    setFormData((prev: any) => ({ ...prev, [id]: file || null }));
                    if (id === 'Carta de presentacion') {
                        setLetterFileName(file?.name || null);
                    } else if (id === 'Foto' && !file) {
                         setPhotoPreviewUrl(publisher?.Foto || null);
                    }
                }
            } else {
                setFormData((prev: any) => ({ ...prev, [id]: value }));
            }
        }
        
        const handleAssignmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { value, checked } = e.target;
            setFormData((prev: any) => {
                const currentAssignments = prev.asignacionesDisponibles || [];
                if (checked) {
                    return { ...prev, asignacionesDisponibles: [...currentAssignments, value] };
                } else {
                    return { ...prev, asignacionesDisponibles: currentAssignments.filter((a: string) => a !== value) };
                }
            });
        };

        const handleSubmit = async (e: React.FormEvent) => {
            e.preventDefault();
            setIsSaving(true);
            setUploadProgress(0);
            
            const onProgress = (progress: number) => {
                setUploadProgress(progress);
            };

            try {
                await onSubmit(formData, onProgress);
            } finally {
                setIsSaving(false);
                setUploadProgress(null);
            }
        }

        const renderField = (id: keyof Omit<Publisher, 'id'>, label: string, type: string = 'text', options: string[] = []) => (
            <div className="form-group">
                <label htmlFor={id as string} className="block mb-1 text-sm font-medium text-gray-700">{label}:</label>
                {type === 'select' ? (
                     <select id={id as string} value={(formData as any)[id] || ''} onChange={handleChange} className="w-full p-2 border rounded-md">
                        <option value=""></option>
                        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                     </select>
                ) : (
                    <input type={type} id={id as string} value={(formData as any)[id] || ''} onChange={handleChange} className="w-full p-2 border rounded-md" />
                )}
            </div>
        );
        
        const assignmentRoles = ['Presidente', 'Acomodador en la puerta Principal', 'Acomodador de la puerta del Auditorio', 'Acomodador de los Asistentes', 'Micrófono', 'Vigilante', 'Conductor de la Atalaya', 'Lector de la Atalaya'];

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                    <div className="p-6 sticky top-0 bg-white border-b z-10 flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-800">{publisher ? 'Editar' : 'Añadir'} Publicador</h2>
                        <button onClick={onCancel} className="text-gray-500 hover:text-gray-800 text-3xl">&times;</button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6">
                        <h3 className="form-section-title">Datos Personales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                            {renderField('Nombre', 'Nombre')}
                            {renderField('Apellido', 'Apellido Paterno')}
                            {renderField('2do Apellido', 'Apellido Materno')}
                            {renderField('Apellido de casada', 'Apellido de casada')}
                            {renderField('Sexo', 'Sexo', 'select', ['Hombre', 'Mujer'])}
                            {renderField('Fecha de Nacimiento', 'Fecha de Nacimiento', 'date')}
                        </div>
                        <h3 className="form-section-title">Contacto y Dirección</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                             {renderField('Cel', 'Celular', 'tel')}
                             {renderField('Correo', 'Correo', 'email')}
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            {renderField('Calle', 'Calle')}
                            {renderField('Numero', 'Número')}
                            {renderField('Colonia', 'Colonia')}
                            {renderField('CP', 'C.P.')}
                            {renderField('Municipio', 'Municipio')}
                            {renderField('Estado', 'Estado')}
                         </div>
                        <h3 className="form-section-title">Información Espiritual</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                             {renderField('Fecha de bautismo', 'Fecha de Bautismo', 'date')}
                             {renderField('Esperanza', 'Esperanza', 'select', ['Otras ovejas', 'Ungido'])}
                             {renderField('Privilegio', 'Privilegio', 'select', ['Anciano', 'Siervo Ministerial'])}
                             {renderField('Priv Adicional', 'Priv. Adicional', 'select', ['Precursor Regular', 'Precursor Especial', 'Misionero'])}
                             {renderField('Grupo', 'Grupo de Servicio')}
                             {renderField('Estatus', 'Estatus', 'select', ['Activo', 'Inactivo', 'Se cambió de congregación', 'Falleció', 'Sacado de la congregación'])}
                         </div>
                         <h3 className="form-section-title">Privilegios de Asignación (Reunión Fin de Semana)</h3>
                         <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            {assignmentRoles.map(role => (
                                <label key={role} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        value={role}
                                        checked={formData.asignacionesDisponibles?.includes(role) || false}
                                        onChange={handleAssignmentChange}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span>{role}</span>
                                </label>
                            ))}
                         </div>
                        <h3 className="form-section-title">Contacto de Emergencia</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                           {renderField('Contacto de Emergencia', 'Nombre del Contacto')}
                           {renderField('Cel de Emergencia', 'Celular de Emergencia', 'tel')}
                        </div>
                         <h3 className="form-section-title">Archivos</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="Foto" className="block mb-1 text-sm font-medium text-gray-700">Subir Foto:</label>
                                <input type="file" id="Foto" onChange={handleChange} accept="image/jpeg,image/png,image/webp" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                                {photoPreviewUrl && (
                                    <div className="mt-2">
                                        <p className="text-xs text-gray-500 mb-1">Vista previa:</p>
                                        <img src={photoPreviewUrl} alt="Vista previa" className="h-20 w-20 object-cover rounded-md border" />
                                    </div>
                                )}
                            </div>
                             <div>
                                <label htmlFor="Carta de presentacion" className="block mb-1 text-sm font-medium text-gray-700">Subir Carta (PDF):</label>
                                <input type="file" id="Carta de presentacion" onChange={handleChange} accept="application/pdf" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                                {letterFileName ? (
                                    <div className="mt-2 text-sm text-gray-600">
                                        <p className="font-medium">Archivo seleccionado:</p>
                                        <p>{letterFileName}</p>
                                    </div>
                                 ) : (
                                    typeof formData['Carta de presentacion'] === 'string' && formData['Carta de presentacion'] && (
                                     <div className="mt-2">
                                         <a href={formData['Carta de presentacion']} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">Ver carta actual</a>
                                     </div>
                                    )
                                 )}
                            </div>
                         </div>
                        <div className="mt-6 flex justify-end gap-4">
                           <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded-md" disabled={isSaving}>Cancelar</button>
                           <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400" disabled={isSaving}>
                            {isSaving ? (uploadProgress !== null ? `Subiendo... ${uploadProgress.toFixed(0)}%` : 'Guardando...') : 'Guardar Cambios'}
                           </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    };
    
    return (
        <div className="bg-gray-100 p-4 sm:p-6 lg:p-8">
            <style>{`.form-section-title { border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-top: 25px; margin-bottom: 15px; color: #3b82f6; font-size: 1.1rem; font-weight: bold; }`}</style>
            
            {isModalOpen && <PublisherForm publisher={editingPublisher} onSubmit={handleFormSubmit} onCancel={() => setIsModalOpen(false)} onShowModal={onShowModal} />}
            
            <header className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h1 className="text-3xl font-bold text-center text-blue-600 mb-4">Gestión de Publicadores</h1>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex gap-2">
                        <button onClick={handleAddPublisher} disabled={!canManage} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full sm:w-auto disabled:bg-gray-400 disabled:cursor-not-allowed">Añadir Publicador</button>
                        <button onClick={handleExportCSV} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 w-full sm:w-auto">Exportar CSV</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <label htmlFor="group-filter" className="font-semibold">Filtrar por Grupo:</label>
                        <select id="group-filter" value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="p-2 border rounded-md">
                            <option value="todos">Todos los grupos</option>
                            {groups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                </div>
            </header>

            {paginatedPublishers.length > 0 ? (
                 <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                    {paginatedPublishers.map(pub => (
                        <PublisherCard key={pub.id} publisher={pub} onEdit={handleEdit} onDelete={handleDelete} canManage={canManage} />
                    ))}
                </div>
            ) : (
                <div className="text-center p-10 bg-white rounded-lg shadow-md">
                    <p className="text-gray-500">No se encontraron publicadores para el filtro seleccionado.</p>
                </div>
            )}
           
            {totalPages > 1 && (
                <div className="mt-8 flex justify-center items-center gap-4">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-4 py-2 bg-white border rounded-md disabled:opacity-50 font-semibold">Anterior</button>
                    <span className="font-semibold text-gray-700">Página {currentPage} de {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-4 py-2 bg-white border rounded-md disabled:opacity-50 font-semibold">Siguiente</button>
                </div>
            )}
        </div>
    );
};

export default Publicadores;