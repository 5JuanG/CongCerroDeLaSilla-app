
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Publisher, ServiceReport, ModalInfo } from '../types';
import { compressImage, getCalculatedStatus } from '../utils';
import { DEFAULT_AVATAR, MONTHS } from '../constants';
import PublisherCardView from './PublisherCardView';

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PublicadoresProps {
    publishers: Publisher[];
    serviceReports: ServiceReport[];
    onAdd: (publisher: Omit<Publisher, 'id'>) => Promise<void>;
    onUpdate: (publisher: Publisher) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onShowModal: (info: ModalInfo) => void;
    canManage: boolean;
    onDownload?: (url: string, fileName: string) => Promise<void>;
}


// --- Sub-components (defined outside to avoid re-mounting) ---

// Accordion Card Component
const PublisherCard: React.FC<{ publisher: Publisher; onEdit: (id: string) => void; onDelete: (id: string) => void; canManage: boolean; onDownload?: (url: string, fileName: string) => Promise<void>; }> = ({ publisher, onEdit, onDelete, canManage, onDownload }) => {
    const [openSection, setOpenSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        setOpenSection(openSection === section ? null : section);
    };

    const accordionSections = {
        "Datos Personales": ["Sexo", "Fecha de Nacimiento", "Apellido de casada"],
        "Dirección y Contacto": ["Calle", "Numero", "Colonia", "Municipio", "Estado", "CP", "Cel", "Correo"],
        "Información Espiritual": ["Fecha de bautismo", "Esperanza", "Privilegio", "Priv Adicional", "Responsabilidad en el Grupo"],
        "Predicación y Localización": ["esLugarEncuentro", "territorioCasa"],
        "Emergencia y Estatus": ["Contacto de Emergencia", "Cel de Emergencia", "Carta de presentacion", "Estatus"]
    };

    const foto = publisher.Foto || DEFAULT_AVATAR;
    const nombreCompleto = [publisher.Nombre, publisher.Apellido, publisher['2do Apellido'], publisher['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ');

    const pdfIconSVG = <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M13.5,9V3.5L18.5,9H13.5M12,18.5C10.3,18.5 9,17.2 9,15.5C9,13.8 10.3,12.5 12,12.5A2.3,2.3 0 0,1 14.3,14.8L15.4,13.7C14.4,12.6 13.3,12 12,12C9.8,12 8,13.8 8,16C8,18.2 9.8,20 12,20C13.2,20 14.2,19.5 15,18.8L13.9,17.7C13.3,18.2 12.7,18.5 12,18.5Z" /></svg>;

    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="flex items-center p-5 border-b border-gray-200">
                <div className="relative group">
                <img
                    src={foto}
                    alt="Foto"
                    className="w-16 h-16 rounded-full object-cover mr-4 border-4 border-blue-500"
                    onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== DEFAULT_AVATAR) {
                            console.warn("Retrying photo with fallback avatar:", foto);
                            target.src = DEFAULT_AVATAR;
                        }
                    }}
                />
                    {publisher.Foto && onDownload && (
                        <button
                            onClick={() => onDownload(publisher.Foto, `foto_${publisher.Nombre}_${publisher.Apellido}.webp`)}
                            className="absolute -bottom-1 -right-1 bg-white text-blue-600 p-1 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Descargar Foto"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12 a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
                            </svg>
                        </button>
                    )}
                </div>
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
                            <span className={`transition-transform duration-300 ${openSection === title ? 'rotate-45' : ''} `}>+</span>
                        </header>
                        <div className={`transition-all duration-500 ease-in-out overflow-hidden ${openSection === title ? 'max-h-[500px]' : 'max-h-0'} `}>
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                {fields.map(field => {
                                    let fieldValue = publisher[field as keyof Omit<Publisher, 'id'>] || '';
                                    if (field === 'Carta de presentacion' && fieldValue) {
                                        return (
                                            <div key={field} className="flex flex-col">
                                                <strong className="text-blue-600 mb-1">{field}:</strong>
                                                <div className="flex gap-2 items-center">
                                                    <a href={fieldValue as string} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline flex items-center gap-2 font-semibold">
                                                        {pdfIconSVG} Ver Carta
                                                    </a>
                                                    {onDownload && (
                                                        <button
                                                            onClick={() => onDownload(fieldValue as string, `carta_${publisher.Nombre}_${publisher.Apellido}.pdf`)}
                                                            className="text-gray-500 hover:text-blue-600 p-1"
                                                            title="Descargar Carta"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M7 10l5 5m0 0l5-5m-5 5V3" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }
                                    if (field === 'esLugarEncuentro') {
                                        return <div key={field} className="flex flex-col"><strong className="text-blue-600 mb-1">¿Lugar de Encuentro?:</strong><span>{fieldValue ? 'Sí' : 'No'}</span></div>
                                    }
                                    if (field === 'territorioCasa') {
                                        return <div key={field} className="flex flex-col"><strong className="text-blue-600 mb-1">Territorio de su Casa:</strong><span>{fieldValue || 'Sin asignar'}</span></div>
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

const PublisherForm: React.FC<{ publisher: Publisher | null, onSubmit: (data: any) => void, onCancel: () => void, onShowModal: (info: ModalInfo) => void }> = ({ publisher, onSubmit, onCancel, onShowModal }) => {
    const [formData, setFormData] = useState<any>(publisher || {
        Nombre: '', Apellido: '', Estatus: 'Activo', asignacionesDisponibles: [], Familia: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(publisher?.Foto || null);
    const [letterFileName, setLetterFileName] = useState<string | null>(null);

    useEffect(() => {
        // Cleanup function to revoke the object URL if it's a blob URL
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
                console.log(`[Publicadores] File selected: ${file.name}, Size: ${file.size} `);
                console.time('PublisherForm_HandlePhoto');
                try {
                    const compressedBlob = await compressImage(file, 400);
                    console.timeLog('PublisherForm_HandlePhoto', 'Compression returned');
                    setFormData((prev: any) => ({ ...prev, [id]: compressedBlob }));

                    // Clean up old blob URL if it exists
                    if (photoPreviewUrl && photoPreviewUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(photoPreviewUrl);
                    }
                    const newUrl = URL.createObjectURL(compressedBlob);
                    setPhotoPreviewUrl(newUrl);
                    console.log(`[Publicadores] Preview URL created: ${newUrl} `);
                } catch (error) {
                    console.error("Image compression failed:", error);
                    onShowModal({ type: 'error', title: 'Error de Imagen', message: (error as Error).message });
                    setFormData((prev: any) => ({ ...prev, [id]: null }));
                    setPhotoPreviewUrl(publisher?.Foto || null);
                } finally {
                    console.timeEnd('PublisherForm_HandlePhoto');
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
        try {
            await onSubmit(formData);
        } finally {
            setIsSaving(false);
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

    const assignmentRoles = [
        'Presidente',
        'Acomodador PP',
        'Acomodador Puerta del Auditorio',
        'Acomodador de Auditorio',
        'Micrófonos',
        'Vigilante',
        'Lector de la Atalaya',
        'Capitán para Predicación',
        'Oración',
        'Califica para Discursar'
    ];

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
                    <h3 className="form-section-title">Familia</h3>
                    <div className="mb-4">
                        {renderField('Familia', 'Nombre de Familia (para agrupar)', 'text')}
                        <p className="text-xs text-gray-500 mt-1">Ejemplo: "Familia Pérez", "Familia Rodriguez-López". Esto servirá para filtrar por familia en la lista.</p>
                    </div>
                    <h3 className="form-section-title">Información Espiritual</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        {renderField('Fecha de bautismo', 'Fecha de Bautismo', 'date')}
                        {renderField('Esperanza', 'Esperanza', 'select', ['Otras ovejas', 'Ungido'])}
                        {renderField('Privilegio', 'Privilegio', 'select', ['Anciano', 'Siervo Ministerial'])}
                        {renderField('Priv Adicional', 'Priv. Adicional', 'select', ['Precursor Regular', 'Precursor Especial', 'Misionero'])}
                        {renderField('Grupo', 'Grupo de Servicio')}
                        {formData.Sexo === 'Hombre' && renderField('Responsabilidad en el Grupo', 'Resp. en el Grupo', 'select', ['Superintendente de Grupo', 'Auxiliar de Grupo'])}
                        {renderField('Estatus', 'Estatus', 'select', ['Activo', 'Inactivo', 'Irregular', 'Se cambió de congregación', 'Falleció', 'Sacado de la congregación'])}
                    </div>
                    <h3 className="form-section-title">Predicación y Localización</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center space-x-2 mt-6">
                            <input
                                type="checkbox"
                                id="esLugarEncuentro"
                                checked={formData.esLugarEncuentro || false}
                                onChange={(e) => setFormData({ ...formData, esLugarEncuentro: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label htmlFor="esLugarEncuentro" className="text-sm font-medium text-gray-700">¿Su casa se usa como lugar de encuentro?</label>
                        </div>
                        {renderField('territorioCasa', 'Número de territorio donde vive', 'number')}
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
                            <input type="file" id="Foto" onChange={handleChange} accept="image/jpeg,image/png,image/webp" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                            {photoPreviewUrl && (
                                <div className="mt-2">
                                    <p className="text-xs text-gray-500 mb-1">Vista previa:</p>
                                    <img src={photoPreviewUrl} alt="Vista previa" className="h-20 w-20 object-cover rounded-md border" />
                                </div>
                            )}
                        </div>
                        <div>
                            <label htmlFor="Carta de presentacion" className="block mb-1 text-sm font-medium text-gray-700">Subir Carta (PDF):</label>
                            <input type="file" id="Carta de presentacion" onChange={handleChange} accept="application/pdf" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
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
                            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
};

// Main Component
const Publicadores: React.FC<PublicadoresProps> = ({ publishers, serviceReports, onAdd, onUpdate, onDelete, onShowModal, canManage, onDownload }) => {
    const [groups, setGroups] = useState<string[]>([]);
    const [families, setFamilies] = useState<string[]>([]);
    const [groupFilter, setGroupFilter] = useState('todos');
    const [familyFilter, setFamilyFilter] = useState('todos');
    const [genderFilter, setGenderFilter] = useState('todos');
    const [statusFilter, setStatusFilter] = useState('todos');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPublisher, setEditingPublisher] = useState<Publisher | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'cards' | 'contactos'>('list');

    const itemsPerPage = 9;

    useEffect(() => {
        const uniqueGroups = [...new Set(publishers.map(p => p.Grupo).filter(Boolean) as string[])].sort();
        setGroups(uniqueGroups);
    }, [publishers]);

    useEffect(() => {
        let filteredPublishers = publishers;
        if (groupFilter !== 'todos') {
            const fGroup = String(groupFilter).trim().toLowerCase();
            filteredPublishers = publishers.filter(p => String(p.Grupo || '').trim().toLowerCase() === fGroup);
        }
        const uniqueFamilies = [...new Set(filteredPublishers.map(p => p.Familia).filter(Boolean) as string[])].sort();
        setFamilies(uniqueFamilies);
    }, [publishers, groupFilter]);

    const filteredPublishers = useMemo(() => {
        return publishers.filter(p => {
            const pGroup = String(p.Grupo || '').trim().toLowerCase();
            const fGroup = String(groupFilter).trim().toLowerCase();
            const matchesGroup = fGroup === 'todos' || pGroup === fGroup;

            const pFamily = String(p.Familia || '').trim().toLowerCase();
            const fFamily = String(familyFilter).trim().toLowerCase();
            const matchesFamily = fFamily === 'todos' || pFamily === fFamily;

            const pSexo = String(p.Sexo || '').trim().toLowerCase();
            const fGender = genderFilter.toLowerCase();
            let matchesGender = fGender === 'todos';
            if (!matchesGender) {
                if (fGender === 'hombre' || fGender === 'varón' || fGender === 'varon') {
                    matchesGender = ['hombre', 'h', 'varón', 'varon'].includes(pSexo);
                } else if (fGender === 'mujer') {
                    matchesGender = ['mujer', 'm'].includes(pSexo);
                } else {
                    matchesGender = pSexo === fGender;
                }
            }

            let matchesStatus = true;
            if (statusFilter !== 'todos') {
                const calculatedStatus = getCalculatedStatus(p, serviceReports, MONTHS);
                const fStatus = statusFilter.trim().toLowerCase();

                if (fStatus === 'se mudaron') matchesStatus = calculatedStatus === 'se cambió de congregación';
                else if (fStatus === 'fallecieron') matchesStatus = calculatedStatus === 'falleció';
                else if (fStatus === 'irregulares') matchesStatus = calculatedStatus === 'irregular';
                else if (fStatus === 'activos') matchesStatus = calculatedStatus === 'activo';
                else if (fStatus === 'inactivos') matchesStatus = calculatedStatus === 'inactivo';
                else matchesStatus = calculatedStatus === fStatus;
            }

            return matchesGroup && matchesFamily && matchesGender && matchesStatus;
        });
    }, [groupFilter, familyFilter, genderFilter, statusFilter, publishers, serviceReports]);

    useEffect(() => {
        setCurrentPage(1);
    }, [groupFilter, familyFilter, genderFilter, statusFilter]);

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

    const handleFormSubmit = async (publisherData: Publisher | Omit<Publisher, 'id'>) => {
        try {
            if ('id' in publisherData && publisherData.id) { // Update
                await onUpdate(publisherData as Publisher);
            } else { // Add
                await onAdd(publisherData);
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
        const blob = new Blob([`\uFEFF${csvString} `], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'publicadores.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGenerateFormPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Helper for form fields
        const formField = (label: string, y: number, width: number = 80) => {
            doc.setFontSize(10);
            doc.text(label, 20, y);
            doc.line(20, y + 2, 20 + width, y + 2);
        };

        // Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('REGISTRO DE PUBLICADOR DE LA CONGREGACIÓN', pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('(Llene sus datos con letra clara y legible)', pageWidth / 2, 28, { align: 'center' });

        let yPos = 40;

        // Sección 1: Datos Personales
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(230, 230, 230);
        doc.rect(15, yPos, pageWidth - 30, 8, 'F');
        doc.text('1. DATOS PERSONALES', 18, yPos + 6);
        yPos += 15;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        doc.text('Nombre:', 20, yPos);
        doc.line(35, yPos + 2, 85, yPos + 2); // Line for nombre

        doc.text('Apellido Materno:', 90, yPos);
        doc.line(125, yPos + 2, 185, yPos + 2);
        yPos += 12;

        doc.text('Apellido Paterno:', 20, yPos);
        doc.line(50, yPos + 2, 85, yPos + 2);

        doc.text('Apellido de Casada:', 90, yPos);
        doc.line(125, yPos + 2, 185, yPos + 2);
        yPos += 12;

        doc.text('Fecha de Nacimiento:', 20, yPos);
        doc.text('(DD/MM/AAAA)', 60, yPos);
        doc.line(60, yPos + 2, 100, yPos + 2);

        doc.text('Sexo:', 110, yPos);
        doc.rect(125, yPos - 3, 4, 4); doc.text('H', 132, yPos);
        doc.rect(145, yPos - 3, 4, 4); doc.text('M', 152, yPos);
        yPos += 10;

        // Sección 2: Dirección y Contacto
        yPos += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(230, 230, 230);
        doc.rect(15, yPos, pageWidth - 30, 8, 'F');
        doc.text('2. DIRECCIÓN Y CONTACTO', 18, yPos + 6);
        yPos += 15;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        doc.text('Calle:', 20, yPos);
        doc.line(35, yPos + 2, 130, yPos + 2);
        doc.text('Número:', 135, yPos);
        doc.line(150, yPos + 2, 185, yPos + 2);
        yPos += 12;

        doc.text('Colonia:', 20, yPos);
        doc.line(35, yPos + 2, 100, yPos + 2);
        doc.text('C.P.:', 110, yPos);
        doc.line(120, yPos + 2, 185, yPos + 2);
        yPos += 12;

        doc.text('Municipio:', 20, yPos);
        doc.line(40, yPos + 2, 100, yPos + 2);
        doc.text('Estado:', 110, yPos);
        doc.line(125, yPos + 2, 185, yPos + 2);
        yPos += 12;

        doc.text('Tel. Celular:', 20, yPos);
        doc.line(45, yPos + 2, 100, yPos + 2);
        doc.text('Correo Electrónico:', 20, yPos + 12);
        doc.line(55, yPos + 14, 185, yPos + 14);
        yPos += 24;


        // Sección 3: Información Espiritual
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(230, 230, 230);
        doc.rect(15, yPos, pageWidth - 30, 8, 'F');
        doc.text('3. INFORMACIÓN ESPIRITUAL', 18, yPos + 6);
        yPos += 15;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        doc.text('Fecha de Bautismo:', 20, yPos);
        doc.line(55, yPos + 2, 100, yPos + 2);

        doc.text('Esperanza:', 110, yPos);
        doc.rect(130, yPos - 3, 4, 4); doc.text('Otras Ovejas', 137, yPos);
        doc.rect(165, yPos - 3, 4, 4); doc.text('Ungido', 172, yPos);
        yPos += 12;

        doc.text('Privilegio:', 20, yPos);
        doc.rect(40, yPos - 3, 4, 4); doc.text('Publicador', 47, yPos);
        doc.rect(70, yPos - 3, 4, 4); doc.text('Siervo Min.', 77, yPos);
        doc.rect(100, yPos - 3, 4, 4); doc.text('Anciano', 107, yPos);
        yPos += 12;

        doc.text('Servicio:', 20, yPos);
        doc.rect(40, yPos - 3, 4, 4); doc.text('Prec. Regular', 47, yPos);
        doc.rect(80, yPos - 3, 4, 4); doc.text('Prec. Especial', 87, yPos);
        doc.rect(120, yPos - 3, 4, 4); doc.text('Misionero', 127, yPos);
        yPos += 12;

        // Sección 4: Emergencia
        yPos += 10;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(230, 230, 230);
        doc.rect(15, yPos, pageWidth - 30, 8, 'F');
        doc.text('4. CONTACTO DE EMERGENCIA', 18, yPos + 6);
        yPos += 15;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Nombre Completo:', 20, yPos);
        doc.line(55, yPos + 2, 185, yPos + 2);
        yPos += 12;
        doc.text('Teléfono:', 20, yPos);
        doc.line(40, yPos + 2, 100, yPos + 2);
        doc.text('Parentesco:', 110, yPos);
        doc.line(130, yPos + 2, 185, yPos + 2);

        doc.save('Formulario_Datos_Publicador.pdf');
    };

    const handleGenerateChecklistPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Title
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('LISTA DE PUBLICADORES VARONES - CAPACIDADES', pageWidth / 2, 15, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado el: ${new Date().toLocaleDateString()}`, pageWidth / 2, 22, { align: 'center' });

        // Filter and group publishers
        const maleActivePublishers = publishers.filter(p => p.Sexo === 'Hombre' && p.Estatus === 'Activo');
        const groupedPublishers: { [key: string]: Publisher[] } = {};

        maleActivePublishers.forEach(p => {
            const group = p.Grupo || 'Sin Grupo';
            if (!groupedPublishers[group]) groupedPublishers[group] = [];
            groupedPublishers[group].push(p);
        });

        // Current roles for the table headers (shortened for space)
        const tableHeaders = [
            'Nombre', 'PRES', 'A PP', 'A PA', 'A AUD', 'MIC', 'VIG', 'LEC', 'CAP', 'ORA', 'DIS'
        ];

        let finalY = 30;
        const checkmark = '\u2713'; // Unicode Checkmark ✓

        // Sort group names
        const sortedGroups = Object.keys(groupedPublishers).sort();

        sortedGroups.forEach((groupName) => {
            const groupData = groupedPublishers[groupName].sort((a, b) => a.Nombre.localeCompare(b.Nombre));

            // Calculate estimated height of this group's table
            // Header height + (number of rows * row height) + group title height
            const estimatedTableHeight = 10 + (groupData.length * 7) + 15; // Rough estimate in mm

            // If the table doesn't fit in the current page, add a new page
            if (finalY + estimatedTableHeight > pageHeight - 30) {
                doc.addPage();
                finalY = 20;
            } else {
                finalY += 10;
            }

            // Group Title Box
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(59, 130, 246); // Blue-500
            doc.rect(15, finalY - 5, pageWidth - 30, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(`GRUPO: ${groupName.toUpperCase()}`, 18, finalY + 1);
            doc.setTextColor(0, 0, 0);

            const tableData = groupData.map(p => {
                const assignments = p.asignacionesDisponibles || [];
                return [
                    `${p.Nombre} ${p.Apellido}`,
                    assignments.includes('Presidente') ? checkmark : '',
                    assignments.includes('Acomodador PP') ? checkmark : '',
                    assignments.includes('Acomodador Puerta del Auditorio') ? checkmark : '',
                    assignments.includes('Acomodador de Auditorio') ? checkmark : '',
                    assignments.includes('Micrófonos') ? checkmark : '',
                    assignments.includes('Vigilante') ? checkmark : '',
                    assignments.includes('Lector de la Atalaya') ? checkmark : '',
                    assignments.includes('Capitán para Predicación') ? checkmark : '',
                    assignments.includes('Oración') ? checkmark : '',
                    assignments.includes('Califica para Discursar') ? checkmark : ''
                ];
            });

            autoTable(doc, {
                head: [tableHeaders],
                body: tableData,
                startY: finalY + 5,
                theme: 'grid', // GRID theme requested
                headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 8, halign: 'center' },
                styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak', textColor: [0, 0, 0] },
                columnStyles: {
                    0: { cellWidth: 50 }, // Name column wider
                    1: { halign: 'center', fontSize: 10, font: 'zapfdingbats' },
                    2: { halign: 'center', fontSize: 10, font: 'zapfdingbats' },
                    3: { halign: 'center', fontSize: 10, font: 'zapfdingbats' },
                    4: { halign: 'center', fontSize: 10, font: 'zapfdingbats' },
                    5: { halign: 'center', fontSize: 10, font: 'zapfdingbats' },
                    6: { halign: 'center', fontSize: 10, font: 'zapfdingbats' },
                    7: { halign: 'center', fontSize: 10, font: 'zapfdingbats' },
                    8: { halign: 'center', fontSize: 10, font: 'zapfdingbats' },
                    9: { halign: 'center', fontSize: 10, font: 'zapfdingbats' },
                    10: { halign: 'center', fontSize: 10, font: 'zapfdingbats' }
                },
                margin: { left: 15, right: 15 },
                didDrawPage: (data: any) => {
                    finalY = data.cursor.y;
                }
            });

            finalY = (doc as any).lastAutoTable?.finalY || finalY + 10;
        });

        // Add Legend at the bottom of each page
        const addLegend = (docX: any) => {
            const pageCount = docX.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                docX.setPage(i);
                docX.setFontSize(7);
                docX.setTextColor(100);

                const legendLines = [
                    "PRES: Presidente | A PP: Acomodador Puerta Principal | A PA: Acomodador Puerta Auditorio",
                    "A AUD: Acomodador Auditorio | MIC: Micrófonos | VIG: Vigilante | LEC: Lector Atalaya",
                    "CAP: Capitán Predicación | ORA: Oración | DIS: Discursar"
                ];

                let legendY = docX.internal.pageSize.getHeight() - 18;
                legendLines.forEach(line => {
                    docX.text(line, 15, legendY);
                    legendY += 3.5;
                });

                docX.text(`Página ${i} de ${pageCount}`, docX.internal.pageSize.getWidth() - 30, docX.internal.pageSize.getHeight() - 10);
            }
        };

        addLegend(doc);

        doc.save('Lista_Capacidades_Varones.pdf');
    };

    const handleGenerateEmergencyPDF = () => {
        const doc = new jsPDF({
            orientation: 'p',
            unit: 'mm',
            format: 'letter'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Filtrar publicadores (Activos, Inactivos, Irregulares)
        const relevantPublishers = publishers.filter(p => ['Activo', 'Inactivo', 'Irregular'].includes(p.Estatus));

        // Agrupar por grupo
        const groupedPublishers: { [key: string]: Publisher[] } = {};
        relevantPublishers.forEach(p => {
            const group = p.Grupo || 'Sin Grupo';
            if (!groupedPublishers[group]) groupedPublishers[group] = [];
            groupedPublishers[group].push(p);
        });

        const sortedGroups = Object.keys(groupedPublishers).sort();

        sortedGroups.forEach((groupName, index) => {
            if (index > 0) doc.addPage();

            // Título
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('DATOS DE EMERGENCIA DE PUBLICADORES', pageWidth / 2, 20, { align: 'center' });

            doc.setFontSize(14);
            doc.text(`GRUPO: ${groupName.toUpperCase()}`, pageWidth / 2, 30, { align: 'center' });

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generado el: ${new Date().toLocaleDateString()}`, pageWidth / 2, 37, { align: 'center' });

            const groupData = groupedPublishers[groupName].sort((a, b) => {
                const famA = String(a.Familia || '').trim().toLowerCase();
                const famB = String(b.Familia || '').trim().toLowerCase();
                if (famA !== famB) return famA.localeCompare(famB);
                return a.Nombre.localeCompare(b.Nombre);
            });

            const tableHeaders = [['Nombre del Publicador', 'Cel. Personal', 'Contacto de Emergencia', 'Tel. Emergencia']];
            const tableData = groupData.map(p => [
                `${p.Nombre} ${p.Apellido} ${p['2do Apellido'] || ''}`.trim(),
                p.Cel || 'N/A',
                p['Contacto de Emergencia'] || 'N/A',
                p['Cel de Emergencia'] || 'N/A'
            ]);

            autoTable(doc, {
                head: tableHeaders,
                body: tableData,
                startY: 45,
                theme: 'grid',
                headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 10, halign: 'center' },
                styles: { fontSize: 9, cellPadding: 3, textColor: [0, 0, 0] },
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { cellWidth: 35, halign: 'center' },
                    2: { cellWidth: 'auto' },
                    3: { cellWidth: 35, halign: 'center' }
                },
                margin: { left: 15, right: 15 }
            });

            // Pie de página
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(100);
                doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, pageHeight - 10);
            }
        });

        doc.save('Datos_Emergencia_Publicadores.pdf');
    };


    return (
        <div className="bg-gray-100 p-4 sm:p-6 lg:p-8">
            <style>{`.form-section-title { border-bottom: 2px solid #3b82f6; padding-bottom: 5px; margin-top: 25px; margin-bottom: 15px; color: #3b82f6; font-size: 1.1rem; font-weight: bold; }`}</style>

            {isModalOpen && <PublisherForm publisher={editingPublisher} onSubmit={handleFormSubmit} onCancel={() => setIsModalOpen(false)} onShowModal={onShowModal} />}

            <header className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h1 className="text-3xl font-bold text-center text-blue-600 mb-4">Gestión de Publicadores</h1>
                <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto justify-center sm:justify-start">
                        <button onClick={handleAddPublisher} disabled={!canManage} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full sm:w-auto disabled:bg-gray-400 disabled:cursor-not-allowed">Añadir Publicador</button>
                        <button onClick={handleGenerateFormPDF} className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 w-full sm:w-auto">Generar Formulario</button>
                        <button onClick={handleGenerateChecklistPDF} className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 w-full sm:w-auto">Generar Checklist Varones</button>
                        <button onClick={handleGenerateEmergencyPDF} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 w-full sm:w-auto">Generar PDF Emergencias</button>
                        <button onClick={handleExportCSV} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 w-full sm:w-auto text-sm">Exportar CSV</button>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                            <label htmlFor="group-filter" className="text-sm font-semibold">Grupo:</label>
                            <select id="group-filter" value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="p-2 border rounded-md">
                                <option value="todos">Todos</option>
                                {groups.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                            <label htmlFor="family-filter" className="text-sm font-semibold">Familia:</label>
                            <select id="family-filter" value={familyFilter} onChange={e => setFamilyFilter(e.target.value)} className="p-2 border rounded-md max-w-[150px]">
                                <option value="todos">Todas</option>
                                {families.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                            <label htmlFor="gender-filter" className="text-sm font-semibold">Sexo:</label>
                            <select id="gender-filter" value={genderFilter} onChange={e => setGenderFilter(e.target.value)} className="p-2 border rounded-md">
                                <option value="todos">Todos</option>
                                <option value="Hombre">Hombres</option>
                                <option value="Mujer">Mujeres</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1 w-full sm:w-auto">
                            <label htmlFor="status-filter" className="text-sm font-semibold">Estatus:</label>
                            <select id="status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="p-2 border rounded-md">
                                <option value="todos">Todos</option>
                                <option value="Activos">Activos</option>
                                <option value="Inactivos">Inactivos</option>
                                <option value="Irregulares">Irregulares</option>
                                <option value="Se mudaron">Se mudaron</option>
                                <option value="Fallecieron">Fallecieron</option>
                            </select>
                        </div>
                    </div>
                </div>
            </header>

            {/* View Toggle Tabs */}
            <div className="flex mb-6 border-b border-gray-200">
                <button
                    className={`py-2 px-4 font-semibold ${viewMode === 'list' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
                    onClick={() => setViewMode('list')}
                >
                    Lista de Gestión
                </button>
                <button
                    className={`py-2 px-4 font-semibold ${viewMode === 'cards' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
                    onClick={() => setViewMode('cards')}
                >
                    Tarjetas de Publicador
                </button>
                <button
                    className={`py-2 px-4 font-semibold ${viewMode === 'contactos' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-blue-600'}`}
                    onClick={() => setViewMode('contactos')}
                >
                    Directorio de Contactos
                </button>
            </div>

            {paginatedPublishers.length > 0 ? (
                viewMode === 'list' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                        {paginatedPublishers.map(pub => (
                            <PublisherCard key={pub.id} publisher={pub} onEdit={handleEdit} onDelete={handleDelete} canManage={canManage} onDownload={onDownload} />
                        ))}
                    </div>
                ) : viewMode === 'cards' ? (
                    <PublisherCardView publishers={paginatedPublishers} serviceReports={serviceReports} />
                ) : (
                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Celular</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Emergencia</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {paginatedPublishers.map(p => {
                                        const nombre = `${p.Nombre} ${p.Apellido}`;
                                        const formatPhone = (phone: string) => phone?.replace(/\D/g, '').replace(/^(\+52|52)/, '');
                                        const cel = formatPhone(p.Cel || '');
                                        const celEmergencia = formatPhone(p['Cel de Emergencia'] || '');

                                        return (
                                            <tr key={p.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{nombre}</div>
                                                    <div className="text-xs text-gray-500">{p.Familia || 'Sin Familia'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-500">{p.Cel || 'N/A'}</span>
                                                        {cel && (
                                                            <div className="flex gap-1">
                                                                <a href={`tel:${cel}`} className="text-blue-600 hover:text-blue-800 transition-colors p-1" title="Llamar Personal">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                                                    </svg>
                                                                </a>
                                                                <a href={`https://wa.me/52${cel}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800 transition-colors p-1" title="WhatsApp">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 448 512" fill="currentColor">
                                                                        <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.7 17.7 68.9 27.1 106.1 27.1h.1c122.4 0 222-99.6 222-222.2 0-59.3-23-115.1-65-157.1zM223.9 446.7c-33.1 0-65.6-8.9-93.9-25.7l-6.7-4-69.8 18.3 18.7-68.1-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-104.8 85.2-190 190.1-190 50.8 0 98.5 19.8 134.4 55.7 35.8 35.8 55.7 83.5 55.7 134.3 0 104.8-85.2 190-190.1 190.1zm105.2-143.9c-5.8-2.9-34.1-16.8-39.3-18.8-5.2-2-9-2.9-12.7 2.9-3.8 5.8-14.7 18.8-18 22.5-3.3 3.8-6.7 4.2-12.5 1.3-5.8-2.9-24.5-9-46.8-28.9-17.3-15.5-29-34.6-32.4-40.5-3.4-5.8-.4-9 2.6-11.8 2.6-2.6 5.8-6.7 8.7-10.1 2.9-3.4 3.8-5.8 5.8-9.6 2-3.8 1-7.1-.5-10.1-1.5-2.9-12.7-30.6-17.4-41.8-4.6-11.1-9.3-9.5-12.7-9.7-3.3-.1-7.1-.1-11-.1-3.8 0-10.1 1.4-15.4 7.1-5.3 5.8-20.2 19.7-20.2 47.9 0 28.2 20.5 55.5 23.4 59.3 2.9 3.8 40.3 61.5 97.7 86.2 13.7 5.9 24.3 9.4 32.7 12 13.7 4.4 26.2 3.8 36.1 2.3 11-1.6 34.1-13.9 38.9-27.4 4.8-13.4 4.8-25 3.4-27.4-1.5-2.4-5.3-3.8-11-6.7z" />
                                                                    </svg>
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{p['Contacto de Emergencia'] || 'N/A'}</div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-gray-500">{p['Cel de Emergencia'] || ''}</span>
                                                        {celEmergencia && (
                                                            <div className="flex gap-1">
                                                                <a href={`tel:${celEmergencia}`} className="text-blue-600 hover:text-blue-800 transition-colors p-1" title="Llamar Emergencia">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                                                                    </svg>
                                                                </a>
                                                                <a href={`https://wa.me/52${celEmergencia}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-800 transition-colors p-1" title="WhatsApp Emergencia">
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 448 512" fill="currentColor">
                                                                        <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.7 17.7 68.9 27.1 106.1 27.1h.1c122.4 0 222-99.6 222-222.2 0-59.3-23-115.1-65-157.1zM223.9 446.7c-33.1 0-65.6-8.9-93.9-25.7l-6.7-4-69.8 18.3 18.7-68.1-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-104.8 85.2-190 190.1-190 50.8 0 98.5 19.8 134.4 55.7 35.8 35.8 55.7 83.5 55.7 134.3 0 104.8-85.2 190-190.1 190.1zm105.2-143.9c-5.8-2.9-34.1-16.8-39.3-18.8-5.2-2-9-2.9-12.7 2.9-3.8 5.8-14.7 18.8-18 22.5-3.3 3.8-6.7 4.2-12.5 1.3-5.8-2.9-24.5-9-46.8-28.9-17.3-15.5-29-34.6-32.4-40.5-3.4-5.8-.4-9 2.6-11.8 2.6-2.6 5.8-6.7 8.7-10.1 2.9-3.4 3.8-5.8 5.8-9.6 2-3.8 1-7.1-.5-10.1-1.5-2.9-12.7-30.6-17.4-41.8-4.6-11.1-9.3-9.5-12.7-9.7-3.3-.1-7.1-.1-11-.1-3.8 0-10.1 1.4-15.4 7.1-5.3 5.8-20.2 19.7-20.2 47.9 0 28.2 20.5 55.5 23.4 59.3 2.9 3.8 40.3 61.5 97.7 86.2 13.7 5.9 24.3 9.4 32.7 12 13.7 4.4 26.2 3.8 36.1 2.3 11-1.6 34.1-13.9 38.9-27.4 4.8-13.4 4.8-25 3.4-27.4-1.5-2.4-5.3-3.8-11-6.7z" />
                                                                    </svg>
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
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