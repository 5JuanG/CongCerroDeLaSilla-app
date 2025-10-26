import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserRole, View, Publisher, UserData, Permission, ALL_PERMISSIONS, MeetingConfig, SpecialEvent } from '../App';

declare const db: any;
declare const firebase: any;

interface ControlAccesoProps {
    users: UserData[];
    publishers: Publisher[];
    committeeMembers: string[];
    onUpdateUserPermissions: (userId: string, permissions: Permission[]) => Promise<void>;
    onUpdateServiceCommittee: (memberUids: string[]) => Promise<void>;
    onLinkUserToPublisher: (userId: string, publisherId: string) => Promise<void>;
    isPublicReportFormEnabled: boolean;
    onUpdatePublicReportFormEnabled: (isEnabled: boolean) => Promise<void>;
    meetingConfig: MeetingConfig | null;
    onSaveMeetingConfig: (config: MeetingConfig) => Promise<void>;
    onResetData: () => Promise<void>;
    currentUserRole: UserRole;
    canManage: boolean;
}

const roleNames: Record<UserRole, string> = {
    admin: 'Administrador',
    secretario: 'Secretario',
    overseer: 'Superintendente',
    publisher: 'Publicador',
    helper: 'Ayudante',
    auxiliary: 'Auxiliar'
};

const manageablePermissions: { label: string; items: { permission: Permission; label: string }[] }[] = [
    {
        label: "Páginas",
        items: [
            { permission: 'asistenciaForm', label: 'Formulario de Asistencia' },
            { permission: 'asistenciaReporte', label: 'Reporte Anual de Asistencia' },
            { permission: 'publicadores', label: 'Publicadores' },
            { permission: 'registrosServicio', label: 'Tarjetas de Publicador' },
            { permission: 'dashboardCursos', label: 'Dashboard de Cursos Biblicos' },
            { permission: 'dashboardPrecursores', label: 'Dashboard Precursores' },
            { permission: 'informeMensualGrupo', label: 'Informe Mensual' },
            { permission: 'informeMensualConsolidado', label: 'Informe a la Sucursal' },
            { permission: 'grupos', label: 'Grupos' },
            { permission: 'territorios', label: 'Territorios' },
            { permission: 'gestionContenidoInvitacion', label: 'Contenido Invitación/Campaña' },
            { permission: 'controlAcceso', label: 'Control de Acceso' },
            { permission: 'registroTransaccion', label: 'Registro de Transacción' },
            { permission: 'precursorAuxiliar', label: 'Prec. Auxiliar' },
            { permission: 'vidaYMinisterio', label: 'Vida y Ministerio' },
            { permission: 'asignacionesReunion', label: 'Generar Prog. Acomodadores' },
            { permission: 'programaServiciosAuxiliares', label: 'Prog Acomodadores' },
            { permission: 'reunionPublica', label: 'Reunión Pública' },
        ]
    },
    {
        label: "Acciones Específicas",
        items: [
            { permission: 'editAsistenciaReporte', label: 'Editar en "Reporte Anual de Asistencia"' },
            { permission: 'managePublicadores', label: 'Añadir/Editar en "Publicadores"' },
            { permission: 'editRegistrosServicio', label: 'Editar registro en "Tarjetas de Publicador"' },
            { permission: 'manageGrupos', label: 'Administrar en "Grupos"' },
            { permission: 'configVidaYMinisterio', label: 'Configuración en "Vida y Ministerio"' },
            { permission: 'manageMeetingAssignments', label: 'Generar/Editar Programa (Acomodadores)' },
            { permission: 'managePublicTalks', label: 'Guardar/Editar en "Reunión Pública"' },
            { permission: 'resetData', label: 'Limpiar datos' },
        ]
    }
];


const PermissionsModal: React.FC<{
    user: UserData;
    onClose: () => void;
    onSave: (userId: string, permissions: Permission[]) => void;
}> = ({ user, onClose, onSave }) => {
    const [permissions, setPermissions] = useState<Permission[]>(user.permissions || []);

    const handlePermissionChange = (permission: Permission, isChecked: boolean) => {
        setPermissions(prev => {
            if (isChecked) {
                return [...new Set([...prev, permission])];
            } else {
                return prev.filter(p => p !== permission);
            }
        });
    };

    const handleSave = () => {
        onSave(user.id, permissions);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
                <div className="p-4 border-b">
                    <h3 className="text-xl font-bold text-gray-800">Gestionar Permisos para {user.email}</h3>
                </div>
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {manageablePermissions.map(group => (
                        <div key={group.label} className="mb-6">
                            <h4 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-3">{group.label}</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {group.items.map(({ permission, label }) => (
                                    <label key={permission} className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            checked={permissions.includes(permission)}
                                            onChange={e => handlePermissionChange(permission, e.target.checked)}
                                        />
                                        <span className="text-gray-700">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Cancelar</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md">Guardar Permisos</button>
                </div>
            </div>
        </div>
    );
};

const LinkPublisherModal: React.FC<{
    user: UserData;
    unlinkedPublishers: Publisher[];
    onClose: () => void;
    onLink: (userId: string, publisherId: string) => void;
}> = ({ user, unlinkedPublishers, onClose, onLink }) => {
    const [selectedPublisherId, setSelectedPublisherId] = useState('');

    const handleLink = () => {
        if (selectedPublisherId) {
            onLink(user.id, selectedPublisherId);
            onClose();
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                <div className="p-4 border-b">
                    <h3 className="text-xl font-bold">Enlazar Usuario <span className="text-blue-600">{user.email}</span></h3>
                </div>
                <div className="p-6">
                    <p className="mb-4 text-gray-600">Seleccione el perfil de publicador que corresponde a esta cuenta de usuario.</p>
                    <select
                        value={selectedPublisherId}
                        onChange={e => setSelectedPublisherId(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md"
                    >
                        <option value="">-- Seleccione un publicador --</option>
                        {unlinkedPublishers.map(p => (
                            <option key={p.id} value={p.id}>
                                {[p.Nombre, p.Apellido, p['2do Apellido'], p['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ')}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Cancelar</button>
                    <button onClick={handleLink} disabled={!selectedPublisherId} className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:bg-gray-400">Enlazar</button>
                </div>
            </div>
        </div>
    );
};


const ControlAcceso: React.FC<ControlAccesoProps> = ({ 
    users,
    publishers,
    committeeMembers: initialCommitteeMembers,
    onUpdateUserPermissions, 
    onUpdateServiceCommittee, 
    onLinkUserToPublisher,
    isPublicReportFormEnabled,
    onUpdatePublicReportFormEnabled,
    meetingConfig,
    onSaveMeetingConfig,
    onResetData,
    currentUserRole,
    canManage
}) => {
    const [status, setStatus] = useState('');
    const [committeeMembers, setCommitteeMembers] = useState<string[]>(initialCommitteeMembers);
    const [committeeCandidates, setCommitteeCandidates] = useState<UserData[]>([]);
    
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [linkingUser, setLinkingUser] = useState<UserData | null>(null);
    const [enableReset, setEnableReset] = useState(false);

    // State for meeting config form
    const [localMeetingConfig, setLocalMeetingConfig] = useState<MeetingConfig | null>(null);
    const [newEvent, setNewEvent] = useState({ date: '', description: '' });

    const { uidToPublisherMap, unlinkedPublishers } = useMemo(() => {
        const map = new Map<string, Publisher>();
        publishers.forEach(p => {
            if (p.authUid) {
                map.set(p.authUid, p);
            }
        });
        const unlinked = publishers.filter(p => !p.authUid);
        return { uidToPublisherMap: map, unlinkedPublishers: unlinked };
    }, [publishers]);

    useEffect(() => {
        setCommitteeMembers(initialCommitteeMembers);
        const candidates = users.filter((u: UserData) => ['admin', 'overseer', 'secretario'].includes(u.role));
        setCommitteeCandidates(candidates);
    }, [users, initialCommitteeMembers]);

    useEffect(() => {
        if (meetingConfig) {
            setLocalMeetingConfig(JSON.parse(JSON.stringify(meetingConfig)));
        }
    }, [meetingConfig]);
    
    const handleMeetingConfigChange = (field: keyof MeetingConfig, value: any) => {
        if (!localMeetingConfig) return;
        setLocalMeetingConfig(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleAddEvent = () => {
        if (!localMeetingConfig || !newEvent.date || !newEvent.description) return;
        const newSpecialEvent: SpecialEvent = { ...newEvent, id: crypto.randomUUID() };
        handleMeetingConfigChange('specialEvents', [...localMeetingConfig.specialEvents, newSpecialEvent]);
        setNewEvent({ date: '', description: '' });
    };

    const handleRemoveEvent = (id: string) => {
        if (!localMeetingConfig) return;
        handleMeetingConfigChange('specialEvents', localMeetingConfig.specialEvents.filter(e => e.id !== id));
    };

    const handleSaveMeetingConfig = async () => {
        if (!localMeetingConfig) return;
        setStatus('Guardando configuración de reuniones...');
        try {
            await onSaveMeetingConfig(localMeetingConfig);
            setStatus('¡Configuración de reuniones guardada!');
        } catch(e) {
            setStatus('Error al guardar la configuración.');
        } finally {
            setTimeout(() => setStatus(''), 3000);
        }
    };

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        setStatus('Actualizando rol...');
        try {
            const userToUpdate = users.find(u => u.id === userId);
            const oldRole = userToUpdate?.role;
    
            const userRef = db.collection('users').doc(userId);
            
            const isNowPrivileged = newRole === 'admin' || newRole === 'secretario';
            const wasPrivileged = oldRole?.toLowerCase() === 'admin' || oldRole?.toLowerCase() === 'secretario';
    
            // Always update the role
            const updatePayload: { role: UserRole; permissions?: Permission[] } = { role: newRole };
    
            if (isNowPrivileged) {
                // If promoting to admin/secretario, always grant all permissions
                updatePayload.permissions = ALL_PERMISSIONS;
            } else if (wasPrivileged && !isNowPrivileged) {
                // If demoting FROM admin/secretario, reset permissions
                updatePayload.permissions = [];
            }
            // In other cases (e.g., publisher to helper), permissions are not touched here.
            
            await userRef.update(updatePayload);
    
            setStatus('¡Rol y permisos actualizados con éxito!');
        } catch (err) {
            console.error("Error updating role:", err);
            setStatus('Error al actualizar el rol.');
        } finally {
            setTimeout(() => setStatus(''), 3000);
        }
    };
    
    const handleCommitteeMemberChange = (index: number, value: string) => {
        const newMembers = [...committeeMembers];
        newMembers[index] = value;
        setCommitteeMembers(newMembers);
    };

    const handleSaveCommittee = async () => {
        setStatus('Guardando Comité de Servicio...');
        try {
            const finalMembers = [...new Set(committeeMembers.filter(id => id))];
            await onUpdateServiceCommittee(finalMembers);
            setStatus('¡Comité de Servicio actualizado con éxito!');
        } catch(e) {
            setStatus('Error al guardar el comité.');
        } finally {
            setTimeout(() => setStatus(''), 3000);
        }
    };
    
    const handleSavePermissions = async (userId: string, permissions: Permission[]) => {
        setStatus(`Guardando permisos...`);
        try {
            await onUpdateUserPermissions(userId, permissions);
            // The listener in App.tsx will update state.
            setStatus('¡Permisos guardados con éxito!');
        } catch (err) {
            setStatus('Error al guardar los permisos.');
        } finally {
            setTimeout(() => setStatus(''), 3000);
        }
    };
    
    const handleLink = async (userId: string, publisherId: string) => {
        setStatus('Enlazando usuario con publicador...');
        try {
            await onLinkUserToPublisher(userId, publisherId);
            setStatus('¡Usuario enlazado correctamente!');
        } catch(err) {
            setStatus('Error al enlazar el usuario.');
        } finally {
            setTimeout(() => setStatus(''), 3000);
        }
    };

    const dayOptions = [
        { label: 'Domingo', value: 0 }, { label: 'Lunes', value: 1 }, { label: 'Martes', value: 2 },
        { label: 'Miércoles', value: 3 }, { label: 'Jueves', value: 4 }, { label: 'Viernes', value: 5 },
        { label: 'Sábado', value: 6 }
    ];

    return (
        <div className="container mx-auto max-w-6xl space-y-12">
            {editingUser && <PermissionsModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSavePermissions} />}
            {linkingUser && <LinkPublisherModal user={linkingUser} unlinkedPublishers={unlinkedPublishers} onClose={() => setLinkingUser(null)} onLink={handleLink} />}

            <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">Control de Acceso y Configuración</h1>
            {status && <p className="text-center text-blue-600 font-semibold mb-4">{status}</p>}

            <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-xl font-bold text-blue-700 mb-2">Configuración de Reuniones y Eventos</h2>
                <p className="text-sm text-gray-500 mb-4">Establezca los horarios de reunión y las fechas en que se cancelan por eventos especiales. Estos ajustes se aplicarán a los programas que se generen.</p>
                {localMeetingConfig && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 border-b pb-6 mb-6">
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Reunión de entre semana</h3>
                                <div className="flex gap-4">
                                    <select value={localMeetingConfig.midweekDay} onChange={e => handleMeetingConfigChange('midweekDay', Number(e.target.value))} className="p-2 border rounded-md w-full">
                                        {dayOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                    </select>
                                    <input type="time" value={localMeetingConfig.midweekTime} onChange={e => handleMeetingConfigChange('midweekTime', e.target.value)} className="p-2 border rounded-md"/>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-2">Reunión de fin de semana</h3>
                                <div className="flex gap-4">
                                     <select value={localMeetingConfig.weekendDay} onChange={e => handleMeetingConfigChange('weekendDay', Number(e.target.value))} className="p-2 border rounded-md w-full">
                                        {dayOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                    </select>
                                    <input type="time" value={localMeetingConfig.weekendTime} onChange={e => handleMeetingConfigChange('weekendTime', e.target.value)} className="p-2 border rounded-md"/>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-semibold text-gray-800 mb-2">Eventos Especiales (sin reunión)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mb-4">
                                <input type="date" value={newEvent.date} onChange={e => setNewEvent(p => ({...p, date: e.target.value}))} className="p-2 border rounded-md"/>
                                <input type="text" value={newEvent.description} onChange={e => setNewEvent(p => ({...p, description: e.target.value}))} placeholder="Descripción (Ej: Asamblea)" className="p-2 border rounded-md"/>
                                <button onClick={handleAddEvent} className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">Añadir Evento</button>
                            </div>
                            <ul className="space-y-2 max-h-40 overflow-y-auto">
                                {localMeetingConfig.specialEvents.map(event => (
                                    <li key={event.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <div>
                                            <span className="font-medium">{event.date}</span> - <span className="text-gray-600">{event.description}</span>
                                        </div>
                                        <button onClick={() => handleRemoveEvent(event.id)} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {canManage && <div className="text-right mt-6"><button onClick={handleSaveMeetingConfig} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Guardar Configuración de Reuniones</button></div>}
                    </>
                )}
            </div>

            <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-xl font-bold text-blue-700 mb-2">Comité de Servicio</h2>
                <p className="text-sm text-gray-500 mb-4">Designe hasta tres miembros del comité. Solo administradores, secretarios y superintendentes pueden ser seleccionados.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[0, 1, 2].map(index => (
                        <div key={index}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Miembro {index + 1}</label>
                            <select
                                value={committeeMembers[index] || ''}
                                onChange={e => handleCommitteeMemberChange(index, e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md"
                                disabled={!canManage}
                            >
                                <option value="">-- Vacante --</option>
                                {committeeCandidates.map(user => {
                                    const publisher = uidToPublisherMap.get(user.id);
                                    const displayName = publisher ? [publisher.Nombre, publisher.Apellido].filter(Boolean).join(' ') : user.email;
                                    return (
                                        <option key={user.id} value={user.id} disabled={committeeMembers.includes(user.id) && committeeMembers[index] !== user.id}>
                                            {displayName}
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                    ))}
                </div>
                {canManage && <div className="text-right mt-4"><button onClick={handleSaveCommittee} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Guardar Comité</button></div>}
            </div>

            <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-xl font-bold text-blue-700 mb-2">Configuraciones Públicas</h2>
                <div className={`flex items-center justify-between p-4 bg-gray-50 rounded-lg border ${!canManage ? 'opacity-60' : ''}`}>
                    <div>
                        <span className="text-gray-800 font-semibold">Habilitar formularios públicos</span>
                        <p className="text-sm text-gray-500">Permite a publicadores no registrados enviar informes de servicio y solicitudes de precursorado desde la página de inicio.</p>
                    </div>
                    <label htmlFor="toggle-public-forms" className={`flex items-center ${canManage ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="toggle-public-forms"
                                className="sr-only"
                                checked={isPublicReportFormEnabled}
                                onChange={(e) => onUpdatePublicReportFormEnabled(e.target.checked)}
                                disabled={!canManage}
                            />
                            <div className={`block w-14 h-8 rounded-full transition-colors ${isPublicReportFormEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition ${isPublicReportFormEnabled ? 'transform translate-x-6' : ''}`}></div>
                        </div>
                    </label>
                </div>
            </div>
            
            <div>
                <h2 className="text-xl font-bold text-blue-700 mb-2">Roles y Permisos de Usuarios</h2>
                <p className="text-sm text-gray-500 mb-4">Asigne roles y permisos. Solo Administradores y Secretarios pueden hacer cambios.</p>
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3">Usuario (Nombre y Email)</th>
                                    <th className="px-6 py-3">Rol Asignado</th>
                                    <th className="px-6 py-3 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(user => {
                                    const linkedPublisher = uidToPublisherMap.get(user.id);
                                    const isPrivileged = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'secretario';
                                    return (
                                        <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                                {linkedPublisher ? <>{[linkedPublisher.Nombre, linkedPublisher.Apellido].filter(Boolean).join(' ')}<span className="block text-xs text-gray-500">{user.email}</span></> : user.email}
                                            </td>
                                            <td className="px-6 py-4">
                                                <select value={user.role} onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)} disabled={!canManage} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 disabled:bg-gray-200">
                                                    {Object.entries(roleNames).map(([roleKey, roleName]) => <option key={roleKey} value={roleKey}>{roleName}</option>)}
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-center space-x-4">
                                                {!linkedPublisher && <button onClick={() => setLinkingUser(user)} disabled={!canManage} className="font-medium text-green-600 hover:underline disabled:text-gray-400">Enlazar con Publicador</button>}
                                                
                                                {isPrivileged ? (
                                                    <span className="text-xs italic text-gray-500">Todos los permisos (automático)</span>
                                                ) : (
                                                    <button onClick={() => setEditingUser(user)} disabled={!canManage} className="font-medium text-blue-600 hover:underline disabled:text-gray-400">
                                                        Gestionar Permisos
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {currentUserRole === 'admin' && (
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg shadow-md">
                     <h2 className="text-xl font-bold text-red-800 mb-2">Zona de Peligro</h2>
                     <p className="text-sm text-red-700 mb-4">Esta acción es irreversible y borrará permanentemente todos los datos de la congregación.</p>
                     <div className="flex items-center space-x-4">
                         <label className="flex items-center space-x-2 cursor-pointer">
                             <input type="checkbox" checked={enableReset} onChange={e => setEnableReset(e.target.checked)} className="h-5 w-5 rounded" />
                             <span className="font-medium text-red-800">Habilitar borrado de datos</span>
                         </label>
                         <button onClick={onResetData} disabled={!enableReset} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed">
                            Limpiar Todos los Datos
                         </button>
                     </div>
                </div>
            )}
        </div>
    );
};

export default ControlAcceso;
