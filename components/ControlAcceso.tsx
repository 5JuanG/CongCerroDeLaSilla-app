import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserRole, View, Publisher, UserData, Permission } from '../App';

declare const db: any;
declare const firebase: any;

interface ControlAccesoProps {
    users: UserData[];
    publishers: Publisher[];
    onUpdateUserPermissions: (userId: string, permissions: Permission[]) => Promise<void>;
    onUpdateServiceCommittee: (memberUids: string[]) => Promise<void>;
    onLinkUserToPublisher: (userId: string, publisherId: string) => Promise<void>;
}

const roleNames: Record<UserRole, string> = {
    admin: 'Administrador',
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
            { permission: 'asignacionesReunion', label: 'Asignaciones Reunión' },
            { permission: 'programaServiciosAuxiliares', label: 'Programa Serv. Auxiliares' },
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
            { permission: 'configAsignacionesReunion', label: 'Configuración de Participantes en "Asignación Reunión"' },
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


const ControlAcceso: React.FC<ControlAccesoProps> = ({ users: allUsers, publishers, onUpdateUserPermissions, onUpdateServiceCommittee, onLinkUserToPublisher }) => {
    const [users, setUsers] = useState<UserData[]>(allUsers);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');

    const [committeeMembers, setCommitteeMembers] = useState<string[]>(['', '', '']);
    const [adminsAndOverseers, setAdminsAndOverseers] = useState<UserData[]>([]);
    
    const [editingUser, setEditingUser] = useState<UserData | null>(null);
    const [linkingUser, setLinkingUser] = useState<UserData | null>(null);

    const { uidToPublisherMap, unlinkedPublishers } = useMemo(() => {
        const map = new Map<string, Publisher>();
        const linkedPublisherIds = new Set<string>();
        
        publishers.forEach(p => {
            if (p.authUid) {
                map.set(p.authUid, p);
                linkedPublisherIds.add(p.id);
            }
        });
        
        const unlinked = publishers.filter(p => !p.authUid);

        return { uidToPublisherMap: map, unlinkedPublishers: unlinked };
    }, [publishers]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            // Users are passed via props, so no need to fetch them here.
            setUsers(allUsers);

            // Filter for committee candidates
            const candidates = allUsers.filter((u: UserData) => u.role === 'admin' || u.role === 'overseer');
            setAdminsAndOverseers(candidates);

            // Fetch service committee
            const committeeDoc = await db.collection('settings').doc('serviceCommittee').get();
            if (committeeDoc.exists) {
                const members = committeeDoc.data().members || [];
                setCommitteeMembers([members[0] || '', members[1] || '', members[2] || '']);
            }

        } catch (err) {
            console.error("Error fetching committee data: ", err);
            setError('No se pudo cargar la configuración del comité.');
        } finally {
            setLoading(false);
        }
    }, [allUsers]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        setStatus('Actualizando rol...');
        try {
            await db.collection('users').doc(userId).update({ role: newRole });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u)); // Update local state
            setStatus('¡Rol actualizado con éxito!');
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
            const finalMembers = [...new Set(committeeMembers.filter(id => id))]; // Remove duplicates and empty strings
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
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions } : u));
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
            // No need to refetch, parent component's listener will update props.
        } catch(err) {
            setStatus('Error al enlazar el usuario.');
        } finally {
            setTimeout(() => setStatus(''), 3000);
        }
    };

    if (loading) {
        return <div className="text-center p-8">Cargando...</div>;
    }

    if (error) {
        return <div className="text-center p-8 text-red-600 bg-red-100 rounded-md">{error}</div>;
    }

    return (
        <div className="container mx-auto max-w-6xl space-y-12">
            {editingUser && <PermissionsModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSavePermissions} />}
            {linkingUser && <LinkPublisherModal user={linkingUser} unlinkedPublishers={unlinkedPublishers} onClose={() => setLinkingUser(null)} onLink={handleLink} />}

            <h1 className="text-3xl font-bold text-center text-gray-800 mb-4">Control de Acceso</h1>
            {status && <p className="text-center text-blue-600 font-semibold mb-4">{status}</p>}

            {/* Service Committee Management */}
            <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-xl font-bold text-blue-700 mb-2">Comité de Servicio</h2>
                <p className="text-sm text-gray-500 mb-4">Designe hasta tres miembros del comité. Solo administradores y superintendentes pueden ser seleccionados.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[0, 1, 2].map(index => (
                        <div key={index}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Miembro {index + 1}</label>
                            <select
                                value={committeeMembers[index]}
                                onChange={e => handleCommitteeMemberChange(index, e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md"
                            >
                                <option value="">-- Vacante --</option>
                                {adminsAndOverseers.map(user => {
                                    const publisher = uidToPublisherMap.get(user.id);
                                    const displayName = publisher ? [publisher.Nombre, publisher.Apellido, publisher['2do Apellido'], publisher['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ') : user.email;
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
                <div className="text-right mt-4">
                    <button onClick={handleSaveCommittee} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Guardar Comité</button>
                </div>
            </div>

            {/* User Roles & Permissions Management */}
            <div>
                 <h2 className="text-xl font-bold text-blue-700 mb-2">Roles y Permisos de Usuarios</h2>
                <p className="text-sm text-gray-500 mb-4">Asigne roles a los usuarios y gestione permisos individuales para superintendentes, ayudantes y auxiliares.</p>
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
                                    return (
                                        <tr key={user.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                                {linkedPublisher ? (
                                                    <>
                                                        {[linkedPublisher.Nombre, linkedPublisher.Apellido, linkedPublisher['2do Apellido'], linkedPublisher['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ')}
                                                        <span className="block text-xs text-gray-500">{user.email}</span>
                                                    </>
                                                ) : (
                                                    user.email
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={user.role}
                                                    onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                                >
                                                    <option value="publisher">{roleNames.publisher}</option>
                                                    <option value="overseer">{roleNames.overseer}</option>
                                                    <option value="helper">{roleNames.helper}</option>
                                                    <option value="auxiliary">{roleNames.auxiliary}</option>
                                                    <option value="admin">{roleNames.admin}</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-center space-x-4">
                                                {!linkedPublisher && (
                                                    <button onClick={() => setLinkingUser(user)} className="font-medium text-green-600 hover:underline">
                                                        Enlazar con Publicador
                                                    </button>
                                                )}
                                                {['overseer', 'helper', 'auxiliary'].includes(user.role) && (
                                                    <button
                                                        onClick={() => setEditingUser(user)}
                                                        className="font-medium text-blue-600 hover:underline"
                                                    >
                                                        Gestionar Permisos
                                                    </button>
                                                )}
                                                {!['overseer', 'helper', 'auxiliary'].includes(user.role) && linkedPublisher && (
                                                    <span className="text-gray-400">—</span>
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
        </div>
    );
};

export default ControlAcceso;