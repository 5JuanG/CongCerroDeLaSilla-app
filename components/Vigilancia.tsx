import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Tooltip from './Tooltip';

interface VigilanciaEvent {
    id: string;
    date: string;
    description: string;
    congregation: string;
}

interface VigilanciaSchedule {
    id: string; // e.g. "tuesday_2024"
    year: number;
    day: 'tuesday' | 'saturday';
    assignments: {
        [month: string]: {
            [timeSlot: string]: string; // congregation name
        };
    };
    specialEvents: VigilanciaEvent[];
}

interface VigilanciaProps {
    schedules: VigilanciaSchedule[];
    onSave: (schedule: VigilanciaSchedule) => Promise<void>;
}

// FIX: Define MONTHS constant to resolve 'Cannot find name' error.
const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const TUESDAY_SLOTS = ["7:20-7:50pm", "7:50-8:20pm", "8:20-8:50pm", "8:50-9:20pm"];
const SATURDAY_SLOTS = ["4:15-4:50pm", "4:50-5:20pm", "5:20-5:50pm", "5:50-6:20pm"];
const CONGREGATIONS = ["Jardines de Andalucia", "Las Jacarandas", "Nacozari", "Cerro de la Silla", "Niños Heroes"];
const MONTHS_GRID = [
    ["Enero", "Febrero", "Marzo"],
    ["Abril", "Mayo", "Junio"],
    ["Julio", "Agosto", "Septiembre"],
    ["Octubre", "Noviembre", "Diciembre"],
];

const Vigilancia: React.FC<VigilanciaProps> = ({ schedules, onSave }) => {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [isEditing, setIsEditing] = useState(false);
    const [editableTuesday, setEditableTuesday] = useState<VigilanciaSchedule | null>(null);
    const [editableSaturday, setEditableSaturday] = useState<VigilanciaSchedule | null>(null);
    
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventDesc, setNewEventDesc] = useState('');
    const [newEventCongregation, setNewEventCongregation] = useState('');
    const [newEventDay, setNewEventDay] = useState<'tuesday' | 'saturday'>('tuesday');

    const years = useMemo(() => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i), []);

    const createEmptySchedule = (day: 'tuesday' | 'saturday', year: number): VigilanciaSchedule => ({
        id: `${day}_${year}`,
        year,
        day,
        assignments: {},
        specialEvents: []
    });

    const tuesdaySchedule = useMemo(() => schedules.find(s => s.id === `tuesday_${selectedYear}`), [schedules, selectedYear]);
    const saturdaySchedule = useMemo(() => schedules.find(s => s.id === `saturday_${selectedYear}`), [schedules, selectedYear]);

    useEffect(() => {
        if (isEditing) {
            setEditableTuesday(JSON.parse(JSON.stringify(tuesdaySchedule || createEmptySchedule('tuesday', selectedYear))));
            setEditableSaturday(JSON.parse(JSON.stringify(saturdaySchedule || createEmptySchedule('saturday', selectedYear))));
        } else {
            setEditableTuesday(null);
            setEditableSaturday(null);
            setNewEventDate('');
            setNewEventDesc('');
            setNewEventCongregation('');
        }
    }, [isEditing, tuesdaySchedule, saturdaySchedule, selectedYear]);

    const handleDataChange = (day: 'tuesday' | 'saturday', month: string, slot: string, congregation: string) => {
        const setter = day === 'tuesday' ? setEditableTuesday : setEditableSaturday;
        setter(prev => {
            if (!prev) return null;
            const newSchedule = { ...prev };
            if (!newSchedule.assignments[month]) {
                newSchedule.assignments[month] = {};
            }
            newSchedule.assignments[month][slot] = congregation;
            return newSchedule;
        });
    };

    const handleAddEvent = () => {
        if (!newEventDate || !newEventDesc || !newEventCongregation) {
            alert("Por favor, complete la fecha, descripción y congregación del evento.");
            return;
        }
        const setter = newEventDay === 'tuesday' ? setEditableTuesday : setEditableSaturday;
        setter(prev => {
            if (!prev) return null;
            const newEvent: VigilanciaEvent = {
                id: crypto.randomUUID(),
                date: newEventDate,
                description: newEventDesc,
                congregation: newEventCongregation,
            };
            return { ...prev, specialEvents: [...prev.specialEvents, newEvent] };
        });
        setNewEventDate('');
        setNewEventDesc('');
        setNewEventCongregation('');
    };
    
    const handleRemoveEvent = (day: 'tuesday' | 'saturday', eventId: string) => {
        const setter = day === 'tuesday' ? setEditableTuesday : setEditableSaturday;
        setter(prev => {
            if (!prev) return null;
            return { ...prev, specialEvents: prev.specialEvents.filter(e => e.id !== eventId) };
        });
    };

    const handleSave = async () => {
        if (editableTuesday && editableSaturday) {
            await Promise.all([onSave(editableTuesday), onSave(editableSaturday)]);
            setIsEditing(false);
        }
    };
    
    const renderScheduleTable = (
        title: string,
        slots: string[],
        scheduleData: VigilanciaSchedule | null | undefined,
        handler: (month: string, slot: string, cong: string) => void
    ) => {
        return (
            <div className="bg-white p-4 rounded-lg shadow-md">
                <h2 className="text-xl font-bold text-center mb-4">{title}</h2>
                {MONTHS_GRID.map((trimester, index) => (
                    <div key={index} className="overflow-x-auto mb-6">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="p-2 border font-semibold w-32">Horario</th>
                                    {trimester.map(month => {
                                        const events = scheduleData?.specialEvents?.filter(e => new Date(e.date).getMonth() === MONTHS.indexOf(month)) || [];
                                        const tooltipText = events.map(e => `${e.date} (${e.congregation}): ${e.description}`).join('\n');
                                        return (
                                            <th key={month} className="p-2 border font-semibold relative">
                                                {month}
                                                {events.length > 0 && (
                                                    <span className="ml-2 absolute right-2 top-1/2 -translate-y-1/2 group">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.01-1.742 3.01H4.42c-1.53 0-2.493-1.676-1.743-3.01l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                        </svg>
                                                        <Tooltip text={tooltipText} />
                                                    </span>
                                                )}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {slots.map(slot => (
                                    <tr key={slot}>
                                        <td className="p-2 border font-medium text-center">{slot}</td>
                                        {trimester.map(month => (
                                            <td key={month} className="p-1 border text-center">
                                                {isEditing ? (
                                                    <select
                                                        value={scheduleData?.assignments[month]?.[slot] || ''}
                                                        onChange={(e) => handler(month, slot, e.target.value)}
                                                        className="w-full p-1 border rounded"
                                                    >
                                                        <option value="">--</option>
                                                        {CONGREGATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                ) : (
                                                    scheduleData?.assignments[month]?.[slot] || ''
                                                )}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        );
    };

    const dataForTuesday = isEditing ? editableTuesday : tuesdaySchedule;
    const dataForSaturday = isEditing ? editableSaturday : saturdaySchedule;

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold">Programa de Vigilancia</h1>
                <div className="flex items-center gap-4">
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="p-2 border rounded-md">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    {isEditing ? (
                        <>
                            <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Guardar</button>
                            <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600">Cancelar</button>
                        </>
                    ) : (
                        <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Editar Programa</button>
                    )}
                </div>
            </div>

            {renderScheduleTable(
                "Programa de Vigilancia de Los martes",
                TUESDAY_SLOTS,
                dataForTuesday,
                (month, slot, cong) => handleDataChange('tuesday', month, slot, cong)
            )}

            {renderScheduleTable(
                "Programa de Vigilancia de Los Sábados",
                SATURDAY_SLOTS,
                dataForSaturday,
                (month, slot, cong) => handleDataChange('saturday', month, slot, cong)
            )}
            
            {isEditing && (
                 <div className="bg-white p-6 rounded-lg shadow-md mt-8">
                    <h3 className="text-xl font-bold mb-4">Gestionar Eventos Especiales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end mb-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium">Descripción</label>
                            <input type="text" value={newEventDesc} onChange={e => setNewEventDesc(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Ej: Visita del Superintendente"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Fecha</label>
                            <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Congregación</label>
                            <select value={newEventCongregation} onChange={e => setNewEventCongregation(e.target.value)} className="w-full p-2 border rounded-md">
                                <option value="">-- Seleccione --</option>
                                {CONGREGATIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Programa</label>
                            <select value={newEventDay} onChange={e => setNewEventDay(e.target.value as any)} className="w-full p-2 border rounded-md">
                                <option value="tuesday">Martes</option>
                                <option value="saturday">Sábado</option>
                            </select>
                        </div>
                    </div>
                    <div className="text-right mb-6">
                        <button onClick={handleAddEvent} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Añadir Evento</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h4 className="font-semibold mb-2">Eventos (Martes)</h4>
                            <ul className="space-y-2">
                                {editableTuesday?.specialEvents.map(event => (
                                    <li key={event.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <div>
                                            <p className="font-medium">{event.date} - <span className="font-normal text-gray-700">{event.congregation}</span></p>
                                            <p className="text-sm text-gray-600">{event.description}</p>
                                        </div>
                                        <button onClick={() => handleRemoveEvent('tuesday', event.id)} className="text-red-500 hover:text-red-700">&times;</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">Eventos (Sábado)</h4>
                            <ul className="space-y-2">
                                 {editableSaturday?.specialEvents.map(event => (
                                    <li key={event.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                        <div>
                                            <p className="font-medium">{event.date} - <span className="font-normal text-gray-700">{event.congregation}</span></p>
                                            <p className="text-sm text-gray-600">{event.description}</p>
                                        </div>
                                        <button onClick={() => handleRemoveEvent('saturday', event.id)} className="text-red-500 hover:text-red-700">&times;</button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                 </div>
            )}
        </div>
    );
};

export default Vigilancia;