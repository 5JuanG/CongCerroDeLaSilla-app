

import React, { useState, useMemo } from 'react';
import { UserRole, View, Permission } from '../App';

interface SidebarProps {
    activeView: View;
    setActiveView: (view: View) => void;
    onLogout: () => void;
    userRole: UserRole;
    onResetData: () => void;
    userPermissions: Permission[];
    isCommitteeMember: boolean;
}

const NavLink: React.FC<{
    view: View;
    label: string;
    icon: React.ReactElement;
    activeView: View;
    setActiveView: (view: View) => void;
    setSidebarOpen: (open: boolean) => void;
    isCollapsed: boolean;
}> = ({ view, label, icon, activeView, setActiveView, setSidebarOpen, isCollapsed }) => (
    <button
        onClick={() => {
            setActiveView(view);
            setSidebarOpen(false); // Close sidebar on mobile after navigation
        }}
        className={`w-full flex items-center p-3 my-1 rounded-lg transition-colors duration-200 ${isCollapsed ? 'justify-center' : ''} ${
            activeView === view
                ? 'bg-blue-600 text-white'
                : 'text-gray-200 hover:bg-blue-800 hover:text-white'
        }`}
        title={isCollapsed ? label : ''}
    >
        {icon}
        <span className={`mx-4 font-medium whitespace-nowrap ${isCollapsed ? 'hidden' : 'block'}`}>{label}</span>
    </button>
);

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, onLogout, userRole, onResetData, userPermissions, isCommitteeMember }) => {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const allNavItems: { view: View; label: string; icon: React.ReactElement }[] = [
        { view: 'home', label: 'Inicio', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
        { view: 'informeServicio', label: 'Informar Servicio', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
        { view: 'precursorAuxiliar', label: 'Prec. Auxiliar', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg> },
        { view: 'vidaYMinisterio', label: 'Vida y Ministerio', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 6.25278C12 6.25278 5.72266 10 3 10C3 18 12 22 12 22C12 22 21 18 21 10C18.2773 10 12 6.25278 12 6.25278Z" /><path d="M12 12L3 10" /></svg> },
        { view: 'asignacionesReunion', label: 'Asignaciones Reunión', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
        { view: 'reunionPublica', label: 'Reunión Pública', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg> },
        { view: 'programaServiciosAuxiliares', label: 'Programa Serv. Aux.', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
        { view: 'asistenciaForm', label: 'Form. Asistencia', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
        { view: 'asistenciaReporte', label: 'Reporte Anual Asistencia', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
        { view: 'publicadores', label: 'Publicadores', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-1.78-4.125" /></svg> },
        { view: 'registrosServicio', label: 'Tarjetas de Publicador', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h4M8 7a2 2 0 012-2h4a2 2 0 012 2v8a2 2 0 01-2 2h-4a2 2 0 01-2-2z" /></svg> },
        { view: 'dashboardCursos', label: 'Dashboard de Cursos', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        { view: 'dashboardPrecursores', label: 'Dashboard Precursores', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg> },
        { view: 'informeMensualGrupo', label: 'Informe Mensual', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> },
        { view: 'informeMensualConsolidado', label: 'Informe a la Sucursal', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
        { view: 'grupos', label: 'Grupos', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
        { view: 'territorios', label: 'Territorios', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg> },
        { view: 'gestionContenidoInvitacion', label: 'Contenido Invitación', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
        { view: 'controlAcceso', label: 'Control de Acceso', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> },
        { view: 'registroTransaccion', label: 'Registro Transacción', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    ];
    
    const navItems = useMemo(() => {
        // Admin sees everything
        if (userRole === 'admin') {
            return allNavItems;
        }

        const alwaysAllowed = new Set<View>(['home', 'informeServicio', 'precursorAuxiliar']);
        
        // Publisher sees only the essentials
        if (userRole === 'publisher') {
            return allNavItems.filter(item => alwaysAllowed.has(item.view));
        }
        
        // Other roles get essentials + their specific permissions
        const allowedViews = new Set<Permission>([...alwaysAllowed, ...userPermissions]);
        
        return allNavItems.filter(item => allowedViews.has(item.view));

    }, [userRole, userPermissions]);

    const sidebarContent = (
        <>
            <div className="flex items-center justify-center mt-8">
                <div className="flex items-center">
                    <span className={`text-white text-xl mx-2 font-semibold text-center leading-tight ${isCollapsed ? 'hidden' : 'block'}`}>Cong Cerro de la Silla- Guadalupe</span>
                </div>
            </div>
            <nav className="mt-10 px-2 flex-1 overflow-y-auto">
                {navItems.map(item => (
                    <NavLink key={item.view} {...item} activeView={activeView} setActiveView={setActiveView} setSidebarOpen={setSidebarOpen} isCollapsed={isCollapsed}/>
                ))}
            </nav>
            <div className="px-2 pb-4">
                {userPermissions.includes('resetData') && (
                     <button
                        onClick={onResetData}
                        className={`w-full flex items-center p-3 my-1 rounded-lg transition-colors duration-200 text-yellow-300 hover:bg-yellow-800 hover:text-white ${isCollapsed ? 'justify-center' : ''}`}
                        title={isCollapsed ? 'Limpiar Todos los Datos' : ''}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className={`mx-4 font-medium whitespace-nowrap ${isCollapsed ? 'hidden' : 'block'}`}>Limpiar Datos</span>
                    </button>
                )}
                 <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`hidden lg:flex w-full items-center p-3 my-1 rounded-lg transition-colors duration-200 text-gray-200 hover:bg-blue-800 hover:text-white ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
                >
                    {isCollapsed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
                    )}
                    <span className={`mx-4 font-medium whitespace-nowrap ${isCollapsed ? 'hidden' : 'block'}`}>Contraer</span>
                </button>
                 <button
                    onClick={onLogout}
                    className={`w-full flex items-center p-3 my-1 rounded-lg transition-colors duration-200 text-red-300 hover:bg-red-800 hover:text-white ${isCollapsed ? 'justify-center' : ''}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    <span className={`mx-4 font-medium whitespace-nowrap ${isCollapsed ? 'hidden' : 'block'}`}>Cerrar Sesión</span>
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Mobile Burger Menu */}
            <div className="lg:hidden fixed top-0 left-0 z-30 p-4">
                <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 rounded-md bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
                    <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isSidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                    </svg>
                </button>
            </div>

            {/* Sidebar */}
            <aside className={`flex flex-col bg-blue-900 fixed lg:relative lg:translate-x-0 h-full z-20 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64'} ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}>
                {sidebarContent}
            </aside>
            
            {/* Overlay for mobile */}
             {isSidebarOpen && <div className="fixed inset-0 bg-black opacity-50 z-10 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}
        </>
    );
};

export default Sidebar;
