import React, { useState, useEffect, useMemo } from 'react';
import { DISCURSOS_PUBLICOS } from './discursos';
import { PublicTalksSchedule, PublicTalkAssignment, Publisher, ModalInfo, OutgoingTalkAssignment } from '../types';
import { MONTHS } from '../constants';

interface ReunionPublicaProps {
    schedule: PublicTalksSchedule;
    onSave: (schedule: PublicTalksSchedule) => Promise<void>;
    canManage: boolean;
    publishers: Publisher[];
    onShowModal: (info: ModalInfo) => void;
    onUpdatePublisher?: (publisher: Publisher) => Promise<void>;
}

const TALK_CATEGORIES: Record<string, number[]> = {
    'BIBLIA/DIOS': [4, 26, 37, 54, 70, 76, 80, 88, 99, 101, 114, 124, 133, 137, 139, 145, 164, 169, 175, 187],
    'EVANGELIZACIÓN/MINISTERIO': [17, 63, 66, 81],
    'FAMILIA/JÓVENES': [5, 13, 27, 28, 29, 30, 104, 110, 113, 118, 146, 190],
    'FE/ESPIRITUALIDAD': [1, 9, 16, 18, 22, 31, 44, 46, 60, 67, 71, 74, 87, 142, 147, 149, 151, 158, 159, 166, 168, 172, 188, 189, 192],
    'MUNDO, NO SER PARTE DEL': [11, 25, 33, 39, 51, 53, 59, 64, 79, 97, 107, 115, 116, 119, 123, 131, 138, 160, 167, 178, 179, 183, 191],
    'NORMAS Y CUALIDADES CRISTIANAS': [7, 10, 12, 14, 15, 42, 48, 68, 69, 72, 75, 77, 78, 100, 103, 112, 144, 148, 157, 165, 171, 185],
    'PRUEBAS/PROBLEMAS': [32, 50, 57, 65, 73, 93, 105, 108, 117, 141, 143, 177, 184, 186, 194],
    'REINO/PARAÍSO': [19, 21, 23, 24, 35, 47, 49, 61, 62, 85, 90, 91, 109, 111, 120, 122, 130, 132, 154, 162, 170, 174, 180, 182],
    'RELIGIÓN/ADORACIÓN': [3, 8, 36, 43, 45, 52, 55, 56, 58, 82, 83, 86, 89, 92, 94, 95, 96, 125, 126, 127, 128, 129, 134, 135, 136, 140, 155, 161, 163, 173],
    'ÚLTIMOS DÍAS/JUICIO DE DIOS': [2, 6, 20, 34, 38, 40, 41, 84, 98, 102, 106, 121, 150, 152, 153, 156, 176, 181, 193],
};
const CATEGORY_NAMES = Object.keys(TALK_CATEGORIES);

const ReunionPublica: React.FC<ReunionPublicaProps> = ({ schedule, onSave, canManage, publishers, onShowModal, onUpdatePublisher }) => {
    const [localSchedule, setLocalSchedule] = useState<PublicTalksSchedule>({});
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSlot, setEditingSlot] = useState<{ talkNumber: number; slotIndex: number; data: Partial<PublicTalkAssignment> } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState('');

    const [yearPage, setYearPage] = useState(0);
    const START_YEAR = 2024;
    const YEARS_PER_PAGE = 6;

    const [whatsAppModalData, setWhatsAppModalData] = useState<{ talkNumber: number; data: PublicTalkAssignment } | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('');

    const [activeTab, setActiveTab] = useState<'planner' | 'monthly' | 'outgoing'>('planner');
    const [localOutgoingSchedule, setLocalOutgoingSchedule] = useState<OutgoingTalkAssignment[]>([]);
    const [isOutgoingModalOpen, setIsOutgoingModalOpen] = useState(false);
    const [editingOutgoingTalk, setEditingOutgoingTalk] = useState<Partial<OutgoingTalkAssignment> | null>(null);

    // --- State for Public View & Monthly Admin View ---
    const [viewYear, setViewYear] = useState(new Date().getFullYear());
    const [viewMonth, setViewMonth] = useState(MONTHS[new Date().getMonth()]);


    useEffect(() => {
        const fullSchedule: PublicTalksSchedule = {
            publicVisibility: schedule.publicVisibility || {}
        };

        // FIX: Replaced reduce with a for loop for better type safety and readability when calculating max length.
        let maxLength = 0;
        for (const value of Object.values(schedule)) {
            if (Array.isArray(value)) {
                maxLength = Math.max(maxLength, value.length);
            }
        }
        const requiredLength = Math.max(maxLength, (yearPage + 1) * YEARS_PER_PAGE);

        DISCURSOS_PUBLICOS.forEach(talk => {
            const talkKey = talk.number.toString();
            const existingAssignments = schedule[talkKey] || [];

            const newAssignments = Array(requiredLength).fill(null);
            for (let i = 0; i < existingAssignments.length; i++) {
                if (i < newAssignments.length) {
                    newAssignments[i] = existingAssignments[i];
                }
            }
            fullSchedule[talkKey] = newAssignments;
        });
        setLocalSchedule(fullSchedule);
        setLocalOutgoingSchedule(schedule.outgoingTalks || []);
    }, [schedule, yearPage]);

    const filteredDiscursos = useMemo(() => {
        let talks = [...DISCURSOS_PUBLICOS];

        if (dateFilter) {
            const talkNumbersOnDate = new Set<number>();
            Object.entries(localSchedule).forEach(([talkNum, assignments]) => {
                if (talkNum === 'publicVisibility' || talkNum === 'outgoingTalks') return;
                if (Array.isArray(assignments) && assignments?.some(a => a?.date === dateFilter)) {
                    talkNumbersOnDate.add(Number(talkNum));
                }
            });
            talks = talks.filter(talk => talkNumbersOnDate.has(talk.number));
        }

        if (categoryFilter !== 'all') {
            const categoryTalks = TALK_CATEGORIES[categoryFilter];
            if (categoryTalks) {
                talks = talks.filter(talk => categoryTalks.includes(talk.number));
            }
        }

        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            talks = talks.filter(talk =>
                talk.title.toLowerCase().includes(lowercasedQuery) ||
                talk.number.toString().startsWith(searchQuery)
            );
        }

        return talks;
    }, [searchQuery, categoryFilter, dateFilter, localSchedule]);

    const handleSlotClick = (talkNumber: number, slotIndex: number) => {
        const currentData = localSchedule[talkNumber.toString()]?.[slotIndex] || {};
        setEditingSlot({ talkNumber, slotIndex, data: currentData });
        setIsModalOpen(true);
    };

    const handleModalSave = (newData: PublicTalkAssignment) => {
        if (!editingSlot) return;
        const { talkNumber, slotIndex } = editingSlot;

        setLocalSchedule(prev => {
            const newSchedule = { ...prev };
            const talkKey = talkNumber.toString();
            const talkAssignments = [...(newSchedule[talkKey] || Array(YEARS_PER_PAGE * (yearPage + 1)).fill(null))];
            talkAssignments[slotIndex] = newData;
            newSchedule[talkKey] = talkAssignments;
            return newSchedule;
        });

        setIsModalOpen(false);
        setEditingSlot(null);
    };

    const handleModalDelete = () => {
        if (!editingSlot) return;
        const { talkNumber, slotIndex } = editingSlot;

        setLocalSchedule(prev => {
            const newSchedule = { ...prev };
            const talkKey = talkNumber.toString();
            const talkAssignments = [...(newSchedule[talkKey] || Array(YEARS_PER_PAGE * (yearPage + 1)).fill(null))];
            talkAssignments[slotIndex] = null;
            newSchedule[talkKey] = talkAssignments;
            return newSchedule;
        });

        setIsModalOpen(false);
        setEditingSlot(null);
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        setStatus('Guardando...');
        try {
            const scheduleToSave: PublicTalksSchedule = {
                ...localSchedule,
                outgoingTalks: localOutgoingSchedule,
                publicVisibility: localSchedule.publicVisibility
            };
            await onSave(scheduleToSave);
            setStatus('¡Cambios guardados con éxito!');
        } catch (error) {
            setStatus('Error al guardar los cambios.');
        } finally {
            setIsSaving(false);
            setTimeout(() => setStatus(''), 3000);
        }
    };

    if (!canManage) {
        // This is the new public-facing view.
        const monthlyTalks = useMemo(() => {
            const talks: ({ talkInfo: typeof DISCURSOS_PUBLICOS[0] } & PublicTalkAssignment)[] = [];
            const monthIndex = MONTHS.indexOf(viewMonth);
            const visibilityMap = schedule.publicVisibility || {};
            const yearMonthKey = `${viewYear}-${viewMonth}`;

            if (!visibilityMap[yearMonthKey]) return [];

            for (const talkNumStr in schedule) {
                // FIX: Guard against iterating over non-discourse properties of the schedule object.
                if (talkNumStr === 'publicVisibility' || talkNumStr === 'outgoingTalks') continue;
                const assignments = schedule[talkNumStr];
                if (Array.isArray(assignments)) {
                    for (const assignment of assignments) {
                        if (assignment && assignment.date) {
                            const assignmentDate = new Date(assignment.date + 'T00:00:00');
                            if (assignmentDate.getFullYear() === viewYear && assignmentDate.getMonth() === monthIndex) {
                                const talkInfo = DISCURSOS_PUBLICOS.find(t => t.number === parseInt(talkNumStr, 10));
                                if (talkInfo) {
                                    talks.push({ ...assignment, talkInfo });
                                }
                            }
                        }
                    }
                }
            }
            return talks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }, [schedule, viewYear, viewMonth]);

        return (
            <div className="container mx-auto p-4 bg-white rounded-lg shadow-md">
                <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Programa Mensual de Discursos Públicos</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
                    <div>
                        <label htmlFor="year-select" className="block text-sm font-medium text-gray-700">Año:</label>
                        <select id="year-select" value={viewYear} onChange={e => setViewYear(Number(e.target.value))} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="month-select" className="block text-sm font-medium text-gray-700">Mes:</label>
                        <select id="month-select" value={viewMonth} onChange={e => setViewMonth(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                {monthlyTalks.length > 0 ? (
                    <div>
                        {/* Mobile Card View */}
                        <div className="md:hidden space-y-4">
                            {monthlyTalks.map((talk, index) => (
                                <div key={index} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200">
                                    <h3 className="font-bold text-blue-700 text-lg">
                                        {new Date(talk.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                    </h3>
                                    <div className="mt-2">
                                        <p className="font-semibold text-gray-800">
                                            {talk.talkInfo.number}. {talk.talkInfo.title}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Canción: {talk.song}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Orador: {talk.speakerName}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Fecha</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Tema del Discurso</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Canción</th>
                                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Orador</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {monthlyTalks.map((talk, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {new Date(talk.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-700">
                                                {talk.talkInfo.number}. {talk.talkInfo.title}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {talk.song}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                                {talk.speakerName}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg">
                        <p>El programa de discursos para {viewMonth} de {viewYear} no ha sido publicado.</p>
                    </div>
                )}
            </div>
        );
    }

    const WhatsAppShareModal: React.FC<{ talkNumber: number; data: PublicTalkAssignment; onClose: () => void; }> = ({ talkNumber, data, onClose }) => {
        const [hospitality, setHospitality] = useState('no_ha_confirmado');
        const talkInfo = DISCURSOS_PUBLICOS.find(t => t.number === talkNumber);

        const generateMessage = () => {
            let hospitalityText = '';
            switch (hospitality) {
                case 'si':
                    hospitalityText = 'Sí, se quedará a la hospitalidad.';
                    break;
                case 'no':
                    hospitalityText = 'No, no se quedará a la hospitalidad.';
                    break;
                case 'no_ha_confirmado':
                    hospitalityText = 'No ha confirmado.';
                    break;
            }

            const message = `*Discurso Público para el ${data.date}* 🗓️\n\n` +
                `*Título:* ${talkInfo?.number}. ${talkInfo?.title}\n` +
                `*Orador:* ${data.speakerName || ''}\n` +
                `*Congregación:* ${data.congregation || ''}\n` +
                `*Canción:* ${data.song || ''}\n\n` +
                `*¿Se quedará a la hospitalidad?*\n${hospitalityText}`;

            return message;
        };

        const message = generateMessage();

        const handleSend = () => {
            const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
            window.open(url, '_blank');
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[60] p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b">
                        <h3 className="text-xl font-bold">Compartir por WhatsApp</h3>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">¿Se quedará a la hospitalidad?</label>
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                                <label className="flex items-center"><input type="radio" name="hospitality" value="si" checked={hospitality === 'si'} onChange={(e) => setHospitality(e.target.value)} className="mr-2" /> Sí</label>
                                <label className="flex items-center"><input type="radio" name="hospitality" value="no" checked={hospitality === 'no'} onChange={(e) => setHospitality(e.target.value)} className="mr-2" /> No</label>
                                <label className="flex items-center"><input type="radio" name="hospitality" value="no_ha_confirmado" checked={hospitality === 'no_ha_confirmado'} onChange={(e) => setHospitality(e.target.value)} className="mr-2" /> No ha confirmado</label>
                            </div>
                        </div>
                        <div className="bg-gray-100 p-4 rounded-md max-h-60 overflow-y-auto">
                            <p className="font-semibold text-gray-800 mb-2">Vista previa del mensaje:</p>
                            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{message}</pre>
                        </div>
                    </div>
                    <div className="p-4 bg-gray-50 flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-md">Cancelar</button>
                        <button type="button" onClick={handleSend} className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Enviar a WhatsApp</button>
                    </div>
                </div>
            </div>
        );
    };

    const AssignmentModal = () => {
        if (!isModalOpen || !editingSlot) return null;

        const [formData, setFormData] = useState<Partial<PublicTalkAssignment>>(editingSlot.data);
        const talkInfo = DISCURSOS_PUBLICOS.find(t => t.number === editingSlot.talkNumber);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        };

        const handleSave = (e: React.FormEvent) => {
            e.preventDefault();
            handleModalSave(formData as PublicTalkAssignment);
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b">
                        <h3 className="text-xl font-bold text-gray-800">Asignar Discurso</h3>
                        <p className="text-sm text-gray-600">{talkInfo?.number}. {talkInfo?.title}</p>
                    </div>
                    <form onSubmit={handleSave}>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Fecha</label>
                                <input type="date" name="date" value={formData.date || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Orador</label>
                                <input type="text" name="speakerName" value={formData.speakerName || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Nombre del orador" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Canción</label>
                                <input type="text" name="song" value={formData.song || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Número y título de la canción" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Congregación</label>
                                <input type="text" name="congregation" value={formData.congregation || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Congregación del orador" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Celular</label>
                                <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded-md" placeholder="Número de celular" />
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 flex flex-wrap justify-between items-center gap-2">
                            <button type="button" onClick={handleModalDelete} className="px-3 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 text-sm">Eliminar</button>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setWhatsAppModalData({ talkNumber: editingSlot.talkNumber, data: formData as PublicTalkAssignment })}
                                    className="px-3 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 text-sm"
                                >
                                    WhatsApp
                                </button>
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-3 py-2 bg-gray-200 rounded-md text-sm">Cancelar</button>
                                <button type="submit" className="px-3 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm">Guardar</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    const displayedYears = Array.from({ length: YEARS_PER_PAGE }, (_, i) => START_YEAR + yearPage * YEARS_PER_PAGE + i);

    const LocalSpeakersView = () => {
        const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(null);
        const [filterText, setFilterText] = useState('');
        const [talkSearch, setTalkSearch] = useState('');

        // --- State for Global View (when no speaker selected) ---
        const [monthFilter, setMonthFilter] = useState('');
        const [yearFilter, setYearFilter] = useState<number | ''>('');
        const [speakerFilter, setSpeakerFilter] = useState('');

        const speakers = useMemo(() =>
            publishers.filter(p => p.Sexo === 'Hombre' && (p.Privilegio === 'Anciano' || p.Privilegio === 'Siervo Ministerial'))
                .sort((a, b) => a.Nombre.localeCompare(b.Nombre)),
            [publishers]);

        const filteredSpeakers = useMemo(() =>
            speakers.filter(s => `${s.Nombre} ${s.Apellido}`.toLowerCase().includes(filterText.toLowerCase())),
            [speakers, filterText]
        );

        const selectedSpeaker = useMemo(() =>
            publishers.find(p => p.id === selectedSpeakerId),
            [publishers, selectedSpeakerId]
        );

        // --- Logic for Global View ---
        const getSpeakerName = (id: string) => {
            const speaker = speakers.find(s => s.id === id);
            return speaker ? `${speaker.Nombre} ${speaker.Apellido}` : 'Desconocido';
        };

        const globalFilteredAssignments = useMemo(() => {
            return localOutgoingSchedule.filter(assignment => {
                const date = new Date(assignment.date + 'T00:00:00');
                const monthMatch = monthFilter ? MONTHS[date.getMonth()] === monthFilter : true;
                const yearMatch = yearFilter ? date.getFullYear() === yearFilter : true;
                const speakerMatch = speakerFilter ? assignment.speakerId === speakerFilter : true;
                return monthMatch && speakerMatch && yearMatch;
            }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }, [localOutgoingSchedule, monthFilter, speakerFilter, yearFilter]);


        // --- Logic for Selected Speaker ---
        const handleAddPreparedTalk = async (talkNumber: number) => {
            if (!selectedSpeaker || !onUpdatePublisher) return;
            const currentTalks = selectedSpeaker.preparedTalks || [];
            if (currentTalks.includes(talkNumber)) return;

            const updatedTalks = [...currentTalks, talkNumber].sort((a, b) => a - b);
            try {
                await onUpdatePublisher({ ...selectedSpeaker, preparedTalks: updatedTalks });
            } catch (error) {
                console.error("Error updating prepared talks", error);
                onShowModal({ type: 'error', title: 'Error', message: 'No se pudo guardar el tema preparado.' });
            }
        };

        const handleRemovePreparedTalk = async (talkNumber: number) => {
            if (!selectedSpeaker || !onUpdatePublisher) return;
            const currentTalks = selectedSpeaker.preparedTalks || [];
            const updatedTalks = currentTalks.filter(t => t !== talkNumber);
            try {
                await onUpdatePublisher({ ...selectedSpeaker, preparedTalks: updatedTalks });
            } catch (error) {
                console.error("Error updating prepared talks", error);
                onShowModal({ type: 'error', title: 'Error', message: 'No se pudo eliminar el tema preparado.' });
            }
        };

        const handleAddAssignmentForSpeaker = () => {
            if (!selectedSpeaker) return;
            // Pre-fill modal with speaker
            setEditingOutgoingTalk({ id: crypto.randomUUID(), speakerId: selectedSpeaker.id });
            setIsOutgoingModalOpen(true);
        };

        // Filter assignments for selected speaker
        const speakerAssignments = useMemo(() => {
            if (!selectedSpeaker) return [];
            return localOutgoingSchedule
                .filter(a => a.speakerId === selectedSpeaker.id)
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }, [localOutgoingSchedule, selectedSpeaker]);


        const availableTalksToAdd = useMemo(() => {
            if (!talkSearch) return [];
            const searchLower = talkSearch.toLowerCase();
            return DISCURSOS_PUBLICOS.filter(d =>
                (d.number.toString().startsWith(searchLower) || d.title.toLowerCase().includes(searchLower)) &&
                !selectedSpeaker?.preparedTalks?.includes(d.number)
            ).slice(0, 5);
        }, [talkSearch, selectedSpeaker]);


        return (
            <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px]">
                {/* LEFT PANEL: Speaker List */}
                <div className="w-full md:w-1/3 flex flex-col bg-white rounded-lg shadow border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50">
                        <label className="block text-sm font-bold text-gray-700 mb-2">Oradores Locales</label>
                        <input
                            type="text"
                            placeholder="Buscar orador..."
                            value={filterText}
                            onChange={e => setFilterText(e.target.value)}
                            className="w-full p-2 border rounded-md text-sm"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {filteredSpeakers.map(speaker => (
                            <button
                                key={speaker.id}
                                onClick={() => setSelectedSpeakerId(speaker.id)}
                                className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors flex items-center justify-between ${selectedSpeakerId === speaker.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}
                            >
                                <div>
                                    <p className={`font-semibold ${selectedSpeakerId === speaker.id ? 'text-blue-800' : 'text-gray-800'}`}>{speaker.Nombre} {speaker.Apellido}</p>
                                    <p className="text-xs text-gray-500">{speaker.Privilegio}</p>
                                </div>
                                <span className="text-gray-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                </span>
                            </button>
                        ))}
                        {filteredSpeakers.length === 0 && (
                            <p className="text-center text-gray-500 p-4 text-sm">No se encontraron oradores.</p>
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Details or Global View */}
                <div className="w-full md:w-2/3 bg-white rounded-lg shadow border flex flex-col overflow-hidden">
                    {selectedSpeaker ? (
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800">{selectedSpeaker.Nombre} {selectedSpeaker.Apellido}</h2>
                                    <p className="text-sm text-gray-600">{selectedSpeaker.Privilegio} • {selectedSpeaker.preparedTalks?.length || 0} temas preparados</p>
                                </div>
                                <button onClick={() => setSelectedSpeakerId(null)} className="text-sm text-blue-600 hover:underline md:hidden">
                                    ← Volver a la lista
                                </button>
                            </div>

                            {/* SECTION 1: Temas Preparados */}
                            <div className="mb-8">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Temas Preparados</h3>

                                {canManage && (
                                    <div className="mb-4 relative">
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Buscar por número o título para añadir..."
                                                value={talkSearch}
                                                onChange={e => setTalkSearch(e.target.value)}
                                                className="flex-1 p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        {/* Autocomplete Dropdown */}
                                        {talkSearch && availableTalksToAdd.length > 0 && (
                                            <div className="absolute top-full left-0 w-full bg-white border rounded-md shadow-lg z-20 mt-1 max-h-60 overflow-y-auto">
                                                {availableTalksToAdd.map(talk => (
                                                    <button
                                                        key={talk.number}
                                                        onClick={() => {
                                                            handleAddPreparedTalk(talk.number);
                                                            setTalkSearch('');
                                                        }}
                                                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                                                    >
                                                        <span className="font-bold text-blue-600 w-8 inline-block">{talk.number}</span>
                                                        <span>{talk.title}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {selectedSpeaker.preparedTalks && selectedSpeaker.preparedTalks.length > 0 ? (
                                        selectedSpeaker.preparedTalks.map(talkNum => {
                                            const talkInfo = DISCURSOS_PUBLICOS.find(t => t.number === talkNum);
                                            return (
                                                <div key={talkNum} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-200 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded text-sm w-10 text-center">{talkNum}</span>
                                                        <span className="text-gray-800 text-sm font-medium">{talkInfo?.title || 'Tema desconocido'}</span>
                                                    </div>
                                                    {canManage && (
                                                        <button
                                                            onClick={() => handleRemovePreparedTalk(talkNum)}
                                                            className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                                                            title="Eliminar de temas preparados"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 000-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">No hay temas preparados registrados.</p>
                                    )}
                                </div>
                            </div>

                            {/* SECTION 2: Asignaciones Salientes */}
                            <div>
                                <div className="flex justify-between items-center mb-4 border-b pb-2">
                                    <h3 className="text-lg font-bold text-gray-800">Historial de Salidas</h3>
                                    {canManage && (
                                        <button
                                            onClick={handleAddAssignmentForSpeaker}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 flex items-center gap-1"
                                        >
                                            <span>+</span> Nueva Salida
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    {speakerAssignments.length > 0 ? (
                                        speakerAssignments.map(assignment => {
                                            const talkInfo = DISCURSOS_PUBLICOS.find(t => t.number === assignment.talkNumber);
                                            const isPast = new Date(assignment.date) < new Date();
                                            return (
                                                <div key={assignment.id} className="p-3 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-bold text-gray-800">{assignment.congregation}</p>
                                                            <p className="text-sm text-gray-600">
                                                                {new Date(assignment.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                                            </p>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isPast ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>
                                                            {isPast ? 'Completado' : 'Programado'}
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 text-sm text-gray-700">
                                                        <span className="font-semibold text-blue-700">{assignment.talkNumber}.</span> {talkInfo?.title}
                                                    </div>
                                                    {canManage && (
                                                        <div className="mt-3 flex gap-2 justify-end">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingOutgoingTalk(assignment);
                                                                    setIsOutgoingModalOpen(true);
                                                                }}
                                                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm("¿Está seguro de eliminar esta asignación?")) {
                                                                        setLocalOutgoingSchedule(prev => prev.filter(t => t.id !== assignment.id));
                                                                    }
                                                                }}
                                                                className="text-xs text-red-600 hover:text-red-800 font-medium"
                                                            >
                                                                Eliminar
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">No hay salidas registradas.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // NO SPEAKER SELECTED - GLOBAL SUMMARY VIEW (Old OutgoingSpeakersView logic)
                        <div className="flex flex-col h-full bg-gray-50">
                            <div className="p-6 border-b bg-white">
                                <h2 className="text-xl font-bold text-gray-800 mb-4">Resumen de Oradores Locales</h2>
                                <p className="text-sm text-gray-600 mb-6">Seleccione un orador de la lista para gestionar sus temas y asignaciones individuales, o utilice los filtros abajo para ver el historial global.</p>

                                <div className="flex flex-wrap gap-4">
                                    <div className="w-full sm:w-32">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Año</label>
                                        <select
                                            value={yearFilter}
                                            onChange={(e) => setYearFilter(e.target.value ? Number(e.target.value) : '')}
                                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm"
                                        >
                                            <option value="">Todos</option>
                                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-full sm:w-40">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mes</label>
                                        <select
                                            value={monthFilter}
                                            onChange={(e) => setMonthFilter(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm"
                                        >
                                            <option value="">Todos</option>
                                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-full sm:w-64">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Orador</label>
                                        <select
                                            value={speakerFilter}
                                            onChange={(e) => setSpeakerFilter(e.target.value)}
                                            className="w-full p-2 border border-gray-300 rounded-md shadow-sm text-sm"
                                        >
                                            <option value="">Todos</option>
                                            {speakers.map(s => (
                                                <option key={s.id} value={s.id}>{s.Nombre} {s.Apellido}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {globalFilteredAssignments.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-4">
                                        {globalFilteredAssignments.map(talk => {
                                            const talkInfo = DISCURSOS_PUBLICOS.find(t => t.number === talk.talkNumber);
                                            return (
                                                <div key={talk.id} className="bg-white p-4 rounded-lg border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                    <div>
                                                        <p className="font-bold text-gray-800">{getSpeakerName(talk.speakerId)}</p>
                                                        <div className="text-sm text-gray-600 mt-1">
                                                            <span className="font-medium text-blue-700">{new Date(talk.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                                            <span className="mx-2">•</span>
                                                            <span>{talk.congregation}</span>
                                                        </div>
                                                        <p className="text-sm text-gray-800 mt-2">
                                                            <span className="font-semibold text-gray-600">Tema: </span>
                                                            <span className="italic">{talkInfo ? `${talkInfo.number}. ${talkInfo.title}` : 'Tema no encontrado'}</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p>No se encontraron asignaciones con los filtros seleccionados.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const OutgoingAssignmentModal = () => {
        if (!isOutgoingModalOpen || !editingOutgoingTalk) return null;

        const [formData, setFormData] = useState<Partial<OutgoingTalkAssignment>>(editingOutgoingTalk);

        const speakers = useMemo(() =>
            publishers.filter(p => p.Sexo === 'Hombre' && (p.Privilegio === 'Anciano' || p.Privilegio === 'Siervo Ministerial'))
                .sort((a, b) => `${a.Nombre} ${a.Apellido}`.localeCompare(`${b.Nombre} ${b.Apellido}`)),
            [publishers]);

        const getSpeakerName = (id: string) => {
            const speaker = speakers.find(s => s.id === id);
            return speaker ? `${speaker.Nombre} ${speaker.Apellido}` : 'Desconocido';
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
            setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        };

        const handleSave = (e: React.FormEvent) => {
            e.preventDefault();

            const { speakerId, date, talkNumber, congregation, id } = formData;

            if (!speakerId || !date || !talkNumber || !congregation || !id) {
                onShowModal({ type: 'error', title: 'Campos Incompletos', message: 'Por favor, complete todos los campos.' });
                return;
            }

            const newDate = new Date(date + "T00:00:00");
            const newMonth = newDate.getMonth();
            const newYear = newDate.getFullYear();

            const conflict = localOutgoingSchedule.find(assignment => {
                if (assignment.id === id) return false;
                if (assignment.speakerId !== speakerId) return false;

                const existingDate = new Date(assignment.date + "T00:00:00");
                return existingDate.getMonth() === newMonth && existingDate.getFullYear() === newYear;
            });

            const proceed = () => {
                const finalData: OutgoingTalkAssignment = {
                    id,
                    speakerId,
                    talkNumber: Number(talkNumber),
                    date,
                    congregation
                };
                setLocalOutgoingSchedule(prev => {
                    const existingIndex = prev.findIndex(t => t.id === finalData.id);
                    if (existingIndex > -1) {
                        const updated = [...prev];
                        updated[existingIndex] = finalData;
                        return updated;
                    }
                    return [...prev, finalData];
                });
                setIsOutgoingModalOpen(false);
                setEditingOutgoingTalk(null);
            };

            if (conflict) {
                const speakerName = getSpeakerName(speakerId);
                if (window.confirm(`¡Alerta! ${speakerName} ya tiene una asignación para este mes (${conflict.date} en ${conflict.congregation}). ¿Desea programar esta asignación de todos modos?`)) {
                    proceed();
                }
            } else {
                proceed();
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b">
                        <h3 className="text-xl font-bold">{editingOutgoingTalk.date ? 'Editar' : 'Añadir'} Asignación Saliente</h3>
                    </div>
                    <form onSubmit={handleSave}>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Orador</label>
                                <select name="speakerId" value={formData.speakerId || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                                    <option value="" disabled>-- Seleccione un orador --</option>
                                    {speakers.map(s => <option key={s.id} value={s.id}>{s.Nombre} {s.Apellido}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Discurso</label>
                                <select name="talkNumber" value={formData.talkNumber || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md">
                                    <option value="" disabled>-- Seleccione un discurso --</option>
                                    {DISCURSOS_PUBLICOS.map(t => <option key={t.number} value={t.number}>{t.number}. {t.title}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Fecha</label>
                                <input type="date" name="date" value={formData.date || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Congregación a visitar</label>
                                <input type="text" name="congregation" value={formData.congregation || ''} onChange={handleChange} required className="mt-1 w-full p-2 border rounded-md" placeholder="Nombre de la congregación" />
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 flex justify-end gap-4">
                            <button type="button" onClick={() => setIsOutgoingModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md">Cancelar</button>
                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Guardar</button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    const MonthlyView = () => {
        const monthlyTalks = useMemo(() => {
            const talks: ({ talkInfo: typeof DISCURSOS_PUBLICOS[0] } & PublicTalkAssignment)[] = [];
            const monthIndex = MONTHS.indexOf(viewMonth);

            for (const talkNumStr in localSchedule) {
                if (talkNumStr === 'publicVisibility' || talkNumStr === 'outgoingTalks') continue;

                const assignments = localSchedule[talkNumStr];
                if (Array.isArray(assignments)) {
                    for (const assignment of assignments) {
                        if (assignment && assignment.date) {
                            const assignmentDate = new Date(assignment.date + 'T00:00:00');
                            if (assignmentDate.getFullYear() === viewYear && assignmentDate.getMonth() === monthIndex) {
                                const talkInfo = DISCURSOS_PUBLICOS.find(t => t.number === parseInt(talkNumStr, 10));
                                if (talkInfo) {
                                    talks.push({ ...assignment, talkInfo });
                                }
                            }
                        }
                    }
                }
            }
            return talks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }, [localSchedule, viewYear, viewMonth]);

        const yearMonthKey = `${viewYear}-${viewMonth}`;
        const isPublic = localSchedule.publicVisibility?.[yearMonthKey] || false;

        const handleToggleVisibility = () => {
            setLocalSchedule(prev => {
                const newVisibility = { ...(prev.publicVisibility || {}) };
                newVisibility[yearMonthKey] = !isPublic;
                return { ...prev, publicVisibility: newVisibility };
            });
        };

        return (
            <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
                    <div>
                        <label htmlFor="year-select-monthly" className="block text-sm font-medium text-gray-700">Año:</label>
                        <select id="year-select-monthly" value={viewYear} onChange={e => setViewYear(Number(e.target.value))} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="month-select-monthly" className="block text-sm font-medium text-gray-700">Mes:</label>
                        <select id="month-select-monthly" value={viewMonth} onChange={e => setViewMonth(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex justify-center items-center gap-4 mb-6 p-3 bg-gray-100 rounded-lg">
                    <span className="font-semibold">Estado del Programa:</span>
                    <span className={`px-3 py-1 text-sm font-bold rounded-full ${isPublic ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {isPublic ? 'Visible' : 'Oculto'}
                    </span>
                    <button onClick={handleToggleVisibility} disabled={isSaving} className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                        {isPublic ? 'Ocultar Programa' : 'Hacer Público'}
                    </button>
                </div>

                {monthlyTalks.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Tema del Discurso</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Canción</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Orador</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {monthlyTalks.map((talk, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {new Date(talk.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700">
                                            {talk.talkInfo.number}. {talk.talkInfo.title}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {talk.song}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {talk.speakerName}
                                        </td>
                                    </tr>
                                ))}

                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-center text-gray-500 py-8">No hay discursos programados para este mes.</p>
                )}
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 bg-white rounded-lg shadow-md">
            <AssignmentModal />
            {isOutgoingModalOpen && <OutgoingAssignmentModal />}
            {whatsAppModalData && (
                <WhatsAppShareModal
                    talkNumber={whatsAppModalData.talkNumber}
                    data={whatsAppModalData.data}
                    onClose={() => setWhatsAppModalData(null)}
                />
            )}
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-center text-gray-800">Registro de Discursos Públicos</h1>
                <div className="flex items-center gap-4">
                    <div className="h-6 text-blue-600 font-semibold">{status}</div>
                    <button onClick={handleSaveChanges} disabled={isSaving || !canManage} title={!canManage ? "No tiene permiso para guardar cambios" : ""} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                        {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>

            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-8 overflow-x-auto scrollbar-hide pb-0.5" aria-label="Tabs">
                    <button onClick={() => setActiveTab('planner')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'planner' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Planificador Anual
                    </button>
                    <button onClick={() => setActiveTab('monthly')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'monthly' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Programa Mensual
                    </button>
                    <button onClick={() => setActiveTab('outgoing')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'outgoing' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
                        Oradores Locales
                    </button>
                </nav>
            </div>

            {activeTab === 'planner' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
                        <div>
                            <label htmlFor="search-query" className="block text-sm font-medium text-gray-700">Buscar por Título o Número:</label>
                            <input type="search" id="search-query" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Ej: Jehová, el 'Gran Creador' o 101" className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                        <div>
                            <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700">Filtrar por Categoría:</label>
                            <select id="category-filter" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="mt-1 w-full p-2 border rounded-md">
                                <option value="all">Todas las categorías</option>
                                {CATEGORY_NAMES.map(cat => <option key={cat} value={cat}>{cat.replace('/', ' / ')}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700">Filtrar por Fecha:</label>
                            <input type="date" id="date-filter" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="mt-1 w-full p-2 border rounded-md" />
                        </div>
                    </div>

                    <div className="flex justify-center items-center gap-4 my-4">
                        <button
                            onClick={() => setYearPage(p => Math.max(0, p - 1))}
                            disabled={yearPage === 0}
                            className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50"
                        >
                            Anterior
                        </button>
                        <span className="font-semibold text-gray-700">
                            Años: {displayedYears[0]} – {displayedYears[YEARS_PER_PAGE - 1]}
                        </span>
                        <button
                            onClick={() => setYearPage(p => p + 1)}
                            className="px-4 py-2 bg-gray-200 rounded-md"
                        >
                            Siguiente
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <div className="min-w-[800px]">
                            {/* Header */}
                            <div className="flex items-center bg-gray-100 p-2 font-bold border-b-2 border-gray-300 sticky top-0 z-10">
                                <div className="flex-1">Título del Discurso</div>
                                <div className="grid grid-cols-6 gap-2 w-1/2 text-center text-sm">
                                    {displayedYears.map(year => <span key={year}>{year}</span>)}
                                </div>
                            </div>
                            {/* Body */}
                            <div className="max-h-[70vh] overflow-y-auto">
                                {filteredDiscursos.length > 0 ? filteredDiscursos.map(talk => {
                                    const isNoUsar = talk.title.toLowerCase().includes('(no usar)');
                                    return (
                                        <div key={talk.number} className={`flex items-center p-2 border-b ${isNoUsar ? 'bg-gray-200 text-gray-500' : 'hover:bg-blue-50'}`}>
                                            <div className="flex-1 text-sm">
                                                <span className="font-semibold">{talk.number}.</span> {talk.title}
                                            </div>
                                            <div className="grid grid-cols-6 gap-2 w-1/2">
                                                {displayedYears.map((year, localSlotIndex) => {
                                                    const globalSlotIndex = yearPage * YEARS_PER_PAGE + localSlotIndex;
                                                    const assignment = localSchedule[talk.number.toString()]?.[globalSlotIndex];
                                                    return (
                                                        <button
                                                            key={globalSlotIndex}
                                                            disabled={isNoUsar || !canManage}
                                                            onClick={() => handleSlotClick(talk.number, globalSlotIndex)}
                                                            title={assignment ? `${assignment.date}\n${assignment.speakerName}` : 'Asignar discurso'}
                                                            className={`h-8 text-xs border rounded-md transition-colors disabled:cursor-not-allowed ${assignment?.date ? (new Date(assignment.date + 'T00:00:00') < new Date() ? 'bg-gray-300' : 'bg-blue-200 hover:bg-blue-300') : 'bg-white hover:bg-gray-200'
                                                                } disabled:bg-gray-300 truncate px-1`}
                                                        >
                                                            {assignment?.date || ''}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                }) : (
                                    <div className="text-center p-6 text-gray-500">
                                        No se encontraron discursos que coincidan con los filtros aplicados.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
            {activeTab === 'monthly' && <MonthlyView />}
            {activeTab === 'outgoing' && <LocalSpeakersView />}
        </div>
    );
};

export default ReunionPublica;
