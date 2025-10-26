import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Publisher, MeetingAssignmentSchedule, LMMeetingSchedule, PublicTalksSchedule, ModalInfo, View, MONTHS, PublicTalkAssignment, DayAssignment, MeetingConfig } from '../App';
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
    meetingConfig: MeetingConfig;
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


const HomeDashboard: React.FC<HomeDashboardProps> = ({ lmSchedules, schedules, publicTalksSchedule, publishers, onShowModal, setActiveView, meetingConfig }) => {
    
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
                onShowNotAvailable={() => handleShowNotAvailableModal('Programa de Acomodadores')}
                setActiveView={setActiveView}
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
    onShowNotAvailable: () => void;
    setActiveView: (view: View) => void;
}> = ({ schedule, onShowNotAvailable, setActiveView }) => {
    
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-green-500">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-gray-800">Programa de Acomodadores</h2>
                <button 
                    onClick={() => schedule ? setActiveView('programaServiciosAuxiliares') : onShowNotAvailable()} 
                    className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200"
                >
                    Ver Programa
                </button>
            </div>
            {schedule ? (
                <div className="text-center p-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="mt-2 font-semibold text-gray-700">El programa para {schedule.month} está disponible.</p>
                    <p className="text-sm text-gray-500">Haz clic en "Ver Programa" para ver los detalles.</p>
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