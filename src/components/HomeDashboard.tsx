import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Publisher, MeetingAssignmentSchedule, LMMeetingSchedule, PublicTalksSchedule, ModalInfo, View, PublicTalkAssignment, DayAssignment, MeetingConfig, HomepageContent } from '../types';
import { MONTHS } from '../constants';
import ShareModal from './ShareModal';
import { DISCURSOS_PUBLICOS } from './discursos';
import VidaYMinisterio from './VidaYMinisterio';
import Carousel from './Carousel';

declare const jspdf: any;
declare const html2canvas: any;

interface HomeDashboardProps {
    lmSchedules: LMMeetingSchedule[];
    schedules: MeetingAssignmentSchedule[];
    publicTalksSchedule: PublicTalksSchedule;
    publishers: Publisher[];
    onShowModal: (info: ModalInfo) => void;
    setActiveView: (view: View) => void;
    meetingConfig: MeetingConfig;
    homepageContent: HomepageContent[];
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


const HomeDashboard: React.FC<HomeDashboardProps> = ({ lmSchedules, schedules, publicTalksSchedule, publishers, onShowModal, setActiveView, meetingConfig, homepageContent }) => {

    const [isVyMCollapsed, setIsVyMCollapsed] = useState(true);
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
        <div className="space-y-10 pb-10">
            {/* Carousel Section */}
            <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-8 fade-in-up">
                <Carousel slides={homepageContent} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Vida y Ministerio Section */}
                <div className="glass p-8 rounded-[2.5rem] dashboard-card border border-white/20 h-fit">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                            <span className="p-2 bg-blue-100 rounded-xl">📅</span>
                            Vida y Ministerio
                        </h2>
                        <button
                            onClick={() => setIsVyMCollapsed(!isVyMCollapsed)}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 flex items-center gap-2 text-sm font-medium"
                        >
                            {isVyMCollapsed ? (
                                <>
                                    <span>Expandir</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </>
                            ) : (
                                <>
                                    <span>Contraer</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>

                    {!isVyMCollapsed && (
                        <div className="fade-in">
                            <VidaYMinisterio
                                publishers={publishers}
                                lmSchedules={lmSchedules.filter(s => s.isPublic)}
                                onSaveSchedule={async () => { }}
                                onUpdatePublisherVyMAssignments={async () => { }}
                                onShowModal={onShowModal}
                                canConfig={false}
                            />
                        </div>
                    )}

                    {isVyMCollapsed && (
                        <div className="text-center py-4 bg-blue-50/50 rounded-3xl border border-dashed border-blue-200">
                            <p className="text-blue-600 font-medium text-sm">El programa semanal está contraído.</p>
                        </div>
                    )}
                </div>

                <div className="space-y-8">
                    <AuxServicesScheduleCard
                        schedule={latestAuxSchedule}
                        onShowNotAvailable={() => handleShowNotAvailableModal('Programa de Acomodadores')}
                        setActiveView={setActiveView}
                    />

                    <PublicTalksScheduleCard
                        schedule={publicTalksSchedule}
                        upcomingTalk={upcomingTalk}
                        onShowNotAvailable={() => handleShowNotAvailableModal('Reunión Pública')}
                        onShowModal={onShowModal}
                    />
                </div>
            </div>

            {/* Quick Access Grid */}
            <div className="glass p-8 rounded-[2.5rem] border border-white/20">
                <h2 className="text-2xl font-bold text-gray-800 mb-8 flex items-center gap-3">
                    <span className="p-2 bg-indigo-100 rounded-xl">🚀</span>
                    Accesos Rápidos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <button
                        onClick={() => setActiveView('informeServicio')}
                        className="group p-6 bg-white/50 hover:bg-blue-600 hover:text-white rounded-3xl transition-all duration-300 shadow-sm hover:shadow-xl text-left"
                    >
                        <div className="w-12 h-12 bg-blue-100 group-hover:bg-blue-500 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-lg mb-1">Informar Servicio</h3>
                        <p className="text-sm opacity-70">Envía tus informes mensuales aquí.</p>
                    </button>

                    <button
                        onClick={() => setActiveView('territorios')}
                        className="group p-6 bg-white/50 hover:bg-green-600 hover:text-white rounded-3xl transition-all duration-300 shadow-sm hover:shadow-xl text-left"
                    >
                        <div className="w-12 h-12 bg-green-100 group-hover:bg-green-500 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-lg mb-1">Territorios</h3>
                        <p className="text-sm opacity-70">Consulta y asigna tus territorios.</p>
                    </button>

                    <button
                        onClick={() => setActiveView('dashboardCursos')}
                        className="group p-6 bg-white/50 hover:bg-purple-600 hover:text-white rounded-3xl transition-all duration-300 shadow-sm hover:shadow-xl text-left"
                    >
                        <div className="w-12 h-12 bg-purple-100 group-hover:bg-purple-500 rounded-2xl flex items-center justify-center mb-4 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600 group-hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <h3 className="font-bold text-lg mb-1">Cursos</h3>
                        <p className="text-sm opacity-70">Sigue el progreso de tus cursos bíblicos.</p>
                    </button>
                </div>
            </div>
        </div>
    );
};

const AuxServicesScheduleCard: React.FC<{
    schedule: MeetingAssignmentSchedule | undefined;
    onShowNotAvailable: () => void;
    setActiveView: (view: View) => void;
}> = ({ schedule, onShowNotAvailable, setActiveView }) => {

    return (
        <div className="glass p-8 rounded-[2.5rem] dashboard-card border border-white/20">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="p-2 bg-green-100 rounded-xl">🛡️</span>
                    Prog de Acomodadores
                </h2>
                <button
                    onClick={() => schedule ? setActiveView('programaServiciosAuxiliares') : onShowNotAvailable()}
                    className="text-sm px-4 py-2 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
                >
                    Ver Programa
                </button>
            </div>
            {schedule ? (
                <div className="bg-white/40 p-6 rounded-3xl border border-white/40">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-bold text-gray-800">Programa Disponible</p>
                            <p className="text-sm text-gray-600">Mes: {schedule.month} {schedule.year}</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center p-6 bg-gray-50/50 rounded-3xl border border-dashed border-gray-300">
                    <p className="text-gray-500 font-medium">Programa no disponible actualmente.</p>
                </div>
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
        <div className="glass p-8 rounded-[2.5rem] dashboard-card border border-white/20">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="p-2 bg-purple-100 rounded-xl">🎙️</span>
                    Reunión Pública
                </h2>
            </div>
            {upcomingTalk ? (
                <div className="p-6 bg-purple-600 text-white rounded-[2rem] shadow-xl shadow-purple-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5-9h10v2H7z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-bold opacity-80 mb-4 uppercase tracking-wider text-purple-100">Próxima Reunión</h3>
                    <div className="space-y-3 relative z-10">
                        <p className="text-2xl font-black">{new Date(upcomingTalk.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        <div className="h-px bg-white/20 my-2"></div>
                        <p className="font-semibold text-lg">{upcomingTalk.speakerName}</p>
                        <p className="text-purple-100 text-sm italic">"{upcomingTalk.talkNumber}. {schedule.talksCatalog?.find(t => t.number === upcomingTalk.talkNumber)?.title || DISCURSOS_PUBLICOS.find(t => t.number === upcomingTalk.talkNumber)?.title}"</p>
                        {upcomingTalk.song && <p className="text-white font-bold text-sm mt-1">Canción: {upcomingTalk.song}</p>}
                    </div>
                </div>
            ) : (
                <div className="text-center p-6 bg-gray-50/50 rounded-3xl border border-dashed border-gray-300">
                    <p className="text-gray-500 font-medium">No hay discursos próximos programados.</p>
                </div>
            )}
        </div>
    );
};

export default HomeDashboard;
