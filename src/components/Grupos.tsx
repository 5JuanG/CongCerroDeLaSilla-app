import React, { useState, useMemo } from 'react';
import { Publisher } from '../App';

interface GruposProps {
    publishers: Publisher[];
    onUpdateGroup: (publisherId: string, newGroup: string) => Promise<void>;
    canManage: boolean;
}

const Grupos: React.FC<GruposProps> = ({ publishers, onUpdateGroup, canManage }) => {
    const [view, setView] = useState<'summary' | 'admin'>('summary');
    const [editingPublisher, setEditingPublisher] = useState<Publisher | null>(null);
    const [groupFilter, setGroupFilter] = useState('todos');

    const groupNames = useMemo(() => {
        const activePublishers = publishers.filter(p => p.Estatus === 'Activo');
        const allGroups = activePublishers.map(p => p.Grupo).filter(Boolean) as string[];
        return [...new Set(allGroups)].sort();
    }, [publishers]);
    
    const handleSaveChanges = async () => {
        if (editingPublisher && editingPublisher.id) {
            await onUpdateGroup(editingPublisher.id, editingPublisher.Grupo || '');
            setEditingPublisher(null);
        }
    };
    
    const getPublisherFullName = (p: Publisher) => [p.Nombre, p.Apellido, p['2do Apellido'], p['Apellido de casada']].filter(namePart => namePart && namePart.toLowerCase() !== 'n/a').join(' ');

    const AdminView: React.FC = () => {
        const [currentPage, setCurrentPage] = useState(1);
        const ROWS_PER_PAGE = 15;
        const statusFilters: Publisher['Estatus'][] = ['Inactivo', 'Se cambió de congregación', 'Falleció', 'Sacado de la congregación'];

        const filteredData = useMemo(() => {
             let data = [...publishers];
             if (statusFilters.includes(groupFilter as Publisher['Estatus'])) {
                 data = data.filter(p => p.Estatus === groupFilter);
             } else if (groupFilter === 'sin-grupo') {
                 data = data.filter(p => p.Estatus === 'Activo' && !p.Grupo);
             } else if (groupFilter !== 'todos') {
                 data = data.filter(p => p.Grupo === groupFilter);
             }
             return data.sort((a,b) => `${a.Nombre} ${a.Apellido}`.localeCompare(`${b.Nombre} ${b.Apellido}`));
        }, [groupFilter, publishers]);

        const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
        const paginatedData = filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

        return (
            <div>
                 <div className="bg-white p-4 rounded-lg shadow-md mb-4 flex items-center gap-4">
                    <label htmlFor="group-filter" className="font-bold">Ver:</label>
                    <select id="group-filter" value={groupFilter} onChange={e => { setGroupFilter(e.target.value); setCurrentPage(1); }} className="p-2 border rounded-md">
                        <option value="todos">Todos los Registros</option>
                        <optgroup label="Grupos de Servicio (Activos)">
                            {groupNames.map(name => <option key={name} value={name}>{name}</option>)}
                            <option value="sin-grupo">Activos Sin Grupo</option>
                        </optgroup>
                        <optgroup label="Estatus">
                           {statusFilters.map(status => <option key={status} value={status}>{status}</option>)}
                        </optgroup>
                    </select>
                 </div>
                 <div className="overflow-x-auto bg-white rounded-lg shadow-md">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-800 text-white">
                            <tr>
                                <th className="p-3">Nombre</th>
                                <th className="p-3">Grupo</th>
                                <th className="p-3">Estatus</th>
                                <th className="p-3 w-24">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map(p => (
                                <tr key={p.id} className="border-b hover:bg-gray-50">
                                    <td className="p-3">
                                        {getPublisherFullName(p)}
                                        <span className="text-xs font-semibold text-gray-500 ml-1">
                                            {p.Privilegio ? `(${p.Privilegio})` : (p['Priv Adicional'] ? `(${p['Priv Adicional']})` : '')}
                                        </span>
                                    </td>
                                    <td className="p-3">{p.Grupo || <em>Sin asignar</em>}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                            p.Estatus === 'Activo' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                                        }`}>{p.Estatus}</span>
                                    </td>
                                    <td className="p-3"><button onClick={() => setEditingPublisher(p)} className="text-blue-600 hover:underline">Editar Grupo</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
                 {totalPages > 1 && (
                     <div className="flex justify-center items-center gap-2 mt-4">
                        {Array.from({length: totalPages}, (_, i) => i + 1).map(page => (
                            <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1 border rounded ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-white'}`}>{page}</button>
                        ))}
                    </div>
                 )}
            </div>
        )
    };
    
    const SummaryView: React.FC = () => {
        const activeGroupsData = useMemo(() => {
            const activePublishers = publishers.filter(p => p.Estatus === 'Activo');
            const data: {[key: string]: { members: Publisher[], prCount: number }} = {};
            [...groupNames, 'Sin Grupo'].forEach(name => { data[name] = { members: [], prCount: 0 }; });

            activePublishers.forEach(p => {
                const groupKey = p.Grupo || 'Sin Grupo';
                if (data[groupKey]) {
                    data[groupKey].members.push(p);
                    if (p['Priv Adicional'] === 'Precursor Regular') data[groupKey].prCount++;
                }
            });

            Object.values(data).forEach(group => {
                group.members.sort((a,b) => a.Nombre.localeCompare(b.Nombre));
            });

            return data;
        }, [publishers, groupNames]);

        const inactiveByGroup = useMemo(() => {
            const inactivePublishers = publishers.filter(p => p.Estatus === 'Inactivo' && p.Grupo);
            if (inactivePublishers.length === 0) return null;

            return inactivePublishers.reduce((acc, pub) => {
                const groupName = pub.Grupo!;
                if (!acc[groupName]) acc[groupName] = [];
                acc[groupName].push(pub);
                acc[groupName].sort((a,b) => a.Nombre.localeCompare(b.Nombre));
                return acc;
            }, {} as Record<string, Publisher[]>);
        }, [publishers]);

        const otherStatusData = useMemo(() => {
            const statusesToTrack: Publisher['Estatus'][] = ['Se cambió de congregación', 'Falleció', 'Sacado de la congregación'];
            const data: Partial<Record<Publisher['Estatus'], Publisher[]>> = {};

            statusesToTrack.forEach(status => {
                const pubsWithStatus = publishers.filter(p => p.Estatus === status).sort((a,b) => a.Nombre.localeCompare(b.Nombre));
                if (pubsWithStatus.length > 0) data[status] = pubsWithStatus;
            });
            return data;
        }, [publishers]);


        return (
            <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Object.entries(activeGroupsData).map(([name, data]) => {
                        const groupData = data as { members: Publisher[]; prCount: number };
                        if (groupData.members.length === 0) return null;
                        return (
                        <div key={name} className="bg-white rounded-lg shadow-md flex flex-col">
                            <div className="bg-blue-600 text-white p-3 font-bold rounded-t-lg">{name}</div>
                            <ul className="flex-grow p-2 overflow-y-auto max-h-96">
                                {groupData.members.length > 0 ? groupData.members.map(p => (
                                    <li key={p.id} className="p-2 border-b text-sm">
                                        {getPublisherFullName(p)}
                                        <span className="text-xs font-semibold text-gray-500 ml-1">
                                            {p.Privilegio ? `(${p.Privilegio})` : (p['Priv Adicional'] ? `(${p['Priv Adicional']})` : '')}
                                        </span>
                                    </li>
                                )) : <li className="p-2 text-gray-500 italic">Grupo vacío</li>}
                            </ul>
                            <div className="bg-gray-100 p-3 rounded-b-lg font-bold flex justify-between text-sm">
                                <span>Total: {groupData.members.length}</span>
                                <span>Precursores Reg.: {groupData.prCount}</span>
                            </div>
                        </div>
                    )})}
                </div>

                {inactiveByGroup && (
                    <div className="mt-12">
                        <h2 className="text-xl font-bold text-gray-700 mb-6 border-b-2 border-gray-300 pb-2">
                            Publicadores Inactivos Asignados a Grupos
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(inactiveByGroup).sort(([groupA], [groupB]) => groupA.localeCompare(groupB)).map(([groupName, members]) => (
                                <div key={groupName} className="bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm flex flex-col">
                                    <div className="bg-yellow-400 text-yellow-900 p-3 font-bold rounded-t-lg">Grupo: {groupName}</div>
                                    <ul className="flex-grow p-2">
                                        {(members as Publisher[]).map(p => (
                                            <li key={p.id} className="p-2 border-b border-yellow-200/50 text-sm">{getPublisherFullName(p)}</li>
                                        ))}
                                    </ul>
                                    <div className="bg-yellow-100 p-3 rounded-b-lg font-bold text-sm">
                                        Total Inactivos: {(members as Publisher[]).length}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                 {Object.keys(otherStatusData).length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-xl font-bold text-gray-700 mb-6 border-b-2 border-gray-300 pb-2">
                            Registros de Otros Estatus
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(otherStatusData).map(([status, members]) => (
                                 <div key={status} className="bg-gray-100 border border-gray-200 rounded-lg shadow-sm flex flex-col">
                                    <div className="bg-gray-300 text-gray-800 p-3 font-bold rounded-t-lg">{status}</div>
                                     <ul className="flex-grow p-2 max-h-60 overflow-y-auto">
                                        {(members as Publisher[]).map(p => (
                                            <li key={p.id} className="p-2 border-b border-gray-200/50 text-sm">{getPublisherFullName(p)}</li>
                                        ))}
                                    </ul>
                                    <div className="bg-gray-200 p-3 rounded-b-lg font-bold text-sm">
                                        Total: {(members as Publisher[]).length}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        )
    };
    
    return (
        <div className="p-4 sm:p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-blue-800">
                    {view === 'summary' ? 'Resumen de Grupos CONG. CERRO DE LA SILLA-GPE' : 'Administrar Grupos de Publicadores'}
                </h1>
                {canManage && (
                    <button onClick={() => setView(v => v === 'summary' ? 'admin' : 'summary')} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                        {view === 'summary' ? 'Ir a Administrar' : 'Volver a Resumen'}
                    </button>
                )}
            </div>

            {view === 'summary' ? <SummaryView /> : <AdminView />}

            {editingPublisher && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                        <h2 className="text-xl font-bold mb-4">Editar Grupo de {getPublisherFullName(editingPublisher)}</h2>
                        <div className="mb-4">
                            <label htmlFor="edit-group" className="block mb-2">Grupo de Servicio:</label>
                            <input
                                id="edit-group"
                                type="text"
                                value={editingPublisher.Grupo || ''}
                                onChange={e => setEditingPublisher({ ...editingPublisher, Grupo: e.target.value })}
                                className="w-full p-2 border rounded"
                                list="group-suggestions"
                            />
                            <datalist id="group-suggestions">
                                {groupNames.map(name => <option key={name} value={name} />)}
                            </datalist>
                        </div>
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setEditingPublisher(null)} className="px-4 py-2 bg-gray-200 rounded-md">Cancelar</button>
                            <button onClick={handleSaveChanges} className="px-4 py-2 bg-blue-600 text-white rounded-md">Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Grupos;
