import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Publisher, MeetingAssignmentSchedule, LMMeetingSchedule, PublicTalksSchedule, ModalInfo, View, MONTHS, PublicTalkAssignment, DayAssignment } from '../App';
import ShareModal from './ShareModal';
import { DISCURSOS_PUBLICOS } from './discursos';
import VidaYMinisterio from './VidaYMinisterio';

declare const jspdf: any;
declare const html2canvas: any;

interface HomeDashboardProps {
    lmSchedules: LMMeetingSchedule[];
    schedules: MeetingAssignmentSchedule[];
    publicTalksSchedule: PublicTalksSchedule;
    publishers: Publisher[];
    onShowModal: (info: ModalInfo) => void;
    setActiveView: (view: View) => void;
}

const findLatestSchedule = <T extends { year: number; month: string; isPublic?: boolean }>(schedules: T[]): T | undefined => {
    const now = new Date();
    const currentMonth = MONTHS[now.getMonth()];
    const currentYear = now.getFullYear();
    
    // Find for current month first
    const currentMonthSchedule = schedules.find(s => s.year === currentYear && s.month === currentMonth && s.isPublic);
    if (currentMonthSchedule) return currentMonthSchedule;

    // If not found, find for next month
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonth = MONTHS[nextMonthDate.getMonth()];
    const nextMonthYear = nextMonthDate.getFullYear();
    const nextMonthSchedule = schedules.find(s => s.year === nextMonthYear && s.month === nextMonth && s.isPublic);
    return nextMonthSchedule;
};


const HomeDashboard: React.FC<HomeDashboardProps> = ({ lmSchedules, schedules, publicTalksSchedule, publishers, onShowModal, setActiveView }) => {
    
    const latestAuxSchedule = useMemo(() => findLatestSchedule(schedules), [schedules]);
    
    const getPublisherName = useCallback((id: string | null | undefined): string => {
        if (!id) return '';
        const pub = publishers.find(p => p.id === id);
        return pub ? [pub.Nombre, pub.Apellido].filter(Boolean).join(' ') : 'N/A';
    }, [publishers]);

    const handleShowNotAvailableModal = (programName: string) => {
        onShowModal({
            type: 'info',
            title: 'Programa no Disponible',
            message: `El programa para "${programName}" de este mes o el próximo aún no ha sido publicado. Por favor, consulte más tarde.`
        });
    };

    const upcomingTalk = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let nextTalk: (PublicTalkAssignment & { talkNumber: number }) | null = null;
        let nextDate = new Date('9999-12-31');

        const visibilityMap = publicTalksSchedule.publicVisibility || {};

        Object.entries(publicTalksSchedule).forEach(([talkNumStr, assignments]) => {
            if (Array.isArray(assignments)) {
                assignments.forEach(a => {
                    if (a && a.date) {
                        const talkDate = new Date(a.date + 'T00:00:00');
                        const yearMonthKey = `${talkDate.getFullYear()}-${MONTHS[talkDate.getMonth()]}`;

                        // Only consider if the month is public
                        if (visibilityMap[yearMonthKey] && talkDate >= today && talkDate < nextDate) {
                            nextDate = talkDate;
                            nextTalk = { ...a, talkNumber: parseInt(talkNumStr, 10) };
                        }
                    }
                });
            }
        });
        return nextTalk;
    }, [publicTalksSchedule]);

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">Panel de Inicio</h1>
            
            <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-blue-500">
                 <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-bold text-gray-800">Vida y Ministerio</h2>
                 </div>
                 <VidaYMinisterio 
                    publishers={publishers}
                    lmSchedules={lmSchedules.filter(s => s.isPublic)}
                    onSaveSchedule={async () => {}}
                    onUpdatePublisherVyMAssignments={async () => {}}
                    onShowModal={onShowModal}
                    canConfig={false}
                 />
            </div>

            <AuxServicesScheduleCard
                schedule={latestAuxSchedule}
                getPublisherName={getPublisherName}
                onShowNotAvailable={() => handleShowNotAvailableModal('Servicios Auxiliares')}
            />

            <PublicTalksScheduleCard 
                schedule={publicTalksSchedule}
                upcomingTalk={upcomingTalk}
                onShowNotAvailable={() => handleShowNotAvailableModal('Reunión Pública')}
                onShowModal={onShowModal}
            />
            
            <div className="p-6 bg-white rounded-2xl shadow-lg border-t-4 border-gray-500">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Otros Accesos</h2>
                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    <button onClick={() => setActiveView('informeServicio')} className="p-3 bg-gray-100 rounded-lg text-center font-semibold text-gray-700 hover:bg-gray-200 transition-colors">Informar Servicio</button>
                    <button onClick={() => setActiveView('territorios')} className="p-3 bg-gray-100 rounded-lg text-center font-semibold text-gray-700 hover:bg-gray-200 transition-colors">Territorios</button>
                    <button onClick={() => setActiveView('dashboardCursos')} className="p-3 bg-gray-100 rounded-lg text-center font-semibold text-gray-700 hover:bg-gray-200 transition-colors">Dashboard Cursos</button>
                 </div>
            </div>
        </div>
    );
};

// ... Internal components (AuxServicesScheduleCard, PublicTalksScheduleCard) ...
// NOTE: These components will be defined below inside this same file.

const AuxServicesScheduleCard: React.FC<{
    schedule: MeetingAssignmentSchedule | undefined;
    getPublisherName: (id: string | null | undefined) => string;
    onShowNotAvailable: () => void;
}> = ({ schedule, getPublisherName, onShowNotAvailable }) => {
    const displayData = useMemo(() => {
        if (!schedule?.schedule) return [];

        const saturdayMeetings = Object.entries(schedule.schedule)
            .filter(([key]) => key.startsWith('saturday'))
            .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

        return saturdayMeetings.map(([dateKey, assignmentUntyped]) => {
            // FIX: Cast assignment to DayAssignment to access its properties.
            const assignment = assignmentUntyped as DayAssignment;
            const satDate = new Date(dateKey.substring(dateKey.indexOf('-') + 1) + 'T00:00:00');
            const tueDate = new Date(satDate);
            tueDate.setDate(satDate.getDate() - 4);
            const sunDate = new Date(satDate);
            sunDate.setDate(satDate.getDate() + 1);

            const getAssignmentsWithRole = (roleKey: keyof DayAssignment, roleAbbr: string) => {
                const ids = (assignment as any)[roleKey] as string[] | undefined;
                return (ids || []).map(id => ({ name: getPublisherName(id), role: roleAbbr }));
            };

            const acomodadoresYMicrofonos = [
                ...getAssignmentsWithRole('acomodadoresPrincipal', 'AP'),
                ...getAssignmentsWithRole('acomodadoresAuditorio', 'APA'),
                ...getAssignmentsWithRole('acomodadoresSala', 'AA'),
                ...getAssignmentsWithRole('microfonos', 'AM'),
                ...getAssignmentsWithRole('vigilantes', 'V'),
            ];

            return {
                weekDateRange: `Martes ${tueDate.getDate()} de ${MONTHS[tueDate.getMonth()].toLowerCase()}\nDomingo ${sunDate.getDate()} de ${MONTHS[sunDate.getMonth()].toLowerCase()}`,
                presidente: getPublisherName(assignment.presidente),
                lectorAtalaya: getPublisherName(assignment.lectorAtalaya),
                acomodadoresYMicrofonos,
                aseo: assignment.aseo ? `Aseo: Grupo ${assignment.aseo}` : '',
                hospitalidad: assignment.hospitalidad ? `Hospitalidad: Grupo ${assignment.hospitalidad}` : '',
            };
        });
    }, [schedule, getPublisherName]);

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-green-500">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800">Programa de Acomodadores</h2>
                <button onClick={() => onShowNotAvailable()} className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200">Ver Más</button>
            </div>
            {schedule && displayData.length > 0 ? (
                <div>
                     <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-800 flex flex-wrap justify-center gap-x-4 gap-y-1">
                        <span className="font-semibold">Leyenda:</span>
                        <span><strong>(AP)</strong>: P. Principal</span>
                        <span><strong>(APA)</strong>: P. Auditorio</span>
                        <span><strong>(AA)</strong>: Asistentes</span>
                        <span><strong>(AM)</strong>: Micrófonos</span>
                        <span><strong>(V)</strong>: Vigilantes</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[800px] text-xs">
                            <thead className="bg-gray-800 text-white">
                                <tr>
                                    <th className="p-2 border border-gray-600 w-1/5">Semana</th>
                                    <th className="p-2 border border-gray-600">Presidente</th>
                                    <th className="p-2 border border-gray-600">Acomodadores, Micrófonos, Vigilantes</th>
                                    <th className="p-2 border border-gray-600">Lector</th>
                                    <th className="p-2 border border-gray-600">Aseo y Hospitalidad</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayData.map((week, index) => (
                                    <tr key={index} className="align-top border-b">
                                        <td className="p-2 border-l border-r font-semibold bg-gray-100 whitespace-pre-line text-center">{week.weekDateRange}</td>
                                        <td className="p-2 border-r text-center">{week.presidente}</td>
                                        <td className="p-2 border-r">
                                            {week.acomodadoresYMicrofonos.map((item, idx) => (
                                                <p key={idx}>{item.name} ({item.role})</p>
                                            ))}
                                        </td>
                                        <td className="p-2 border-r text-center">{week.lectorAtalaya}</td>
                                        <td className="p-2 border-r text-center whitespace-pre-line">
                                            {week.aseo ? <div>{week.aseo}</div> : null}
                                            {week.hospitalidad ? <div>{week.hospitalidad}</div> : null}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                 <p className="text-center text-gray-500 py-4">Programa no disponible.</p>
            )}
        </div>
    );
};

const PublicTalksScheduleCard: React.FC<{
    schedule: PublicTalksSchedule;
    upcomingTalk: (PublicTalkAssignment & { talkNumber: number; }) | null;
    onShowNotAvailable: () => void;
    onShowModal: (info: ModalInfo) => void;
}> = ({ schedule, upcomingTalk, onShowNotAvailable, onShowModal }) => {
    
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-purple-500">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800">Reunión Pública</h2>
            </div>
            {upcomingTalk ? (
                 <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-center">
                    <h3 className="text-lg font-semibold text-purple-800">Próximo Discurso Público</h3>
                    <p className="mt-2 text-gray-800"><strong>Fecha:</strong> {new Date(upcomingTalk.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p><strong>Orador:</strong> {upcomingTalk.speakerName}</p>
                    <p><strong>Discurso:</strong> {upcomingTalk.talkNumber}. {DISCURSOS_PUBLICOS.find(t => t.number === upcomingTalk.talkNumber)?.title}</p>
                </div>
            ) : (
                <p className="text-center text-gray-500 py-4">No hay próximos discursos públicos publicados.</p>
            )}
        </div>
    );
};

export default HomeDashboard;
