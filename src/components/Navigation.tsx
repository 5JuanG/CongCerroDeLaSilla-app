import React, { useEffect, useRef, useState } from 'react';
import { View } from '../types';
import { NavGroup, flattenGroupItems, findGroupForView } from '../navConfig';
import { DEFAULT_AVATAR } from '../constants';

interface NavigationProps {
    groups: NavGroup[];
    activeView: View;
    setActiveView: (view: View) => void;
    onLogout: () => void;
    user: { displayName: string; email: string; photoURL: string };
    isSidePanelOpen: boolean; // panel vertical visible en escritorio
    setSidePanelCollapsed: (collapsed: boolean) => void;
    sidePanelCollapsed: boolean;
}

const ICON_PATHS: Record<string, string> = {
    inicio: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
    predicacion: 'M12 21a9.003 9.003 0 008.341-5.589m-8.341 5.589a9.003 9.003 0 01-8.341-5.589m8.341 5.589V3m0 18a9.003 9.003 0 018.341-5.589M12 3a9.003 9.003 0 00-8.341 5.589M12 3a9.003 9.003 0 018.341 5.589m-8.341-5.589A9.003 9.003 0 013.659 8.589M12 3v18',
    reuniones: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    publicadores: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-1.78-4.125',
    informes: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    administracion: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
};

const GroupIcon: React.FC<{ id: string; className?: string }> = ({ id, className = 'h-5 w-5' }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[id] || ICON_PATHS.inicio} />
    </svg>
);

const Navigation: React.FC<NavigationProps> = ({
    groups, activeView, setActiveView, onLogout, user,
    isSidePanelOpen, sidePanelCollapsed, setSidePanelCollapsed,
}) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const lastViewByGroup = useRef<Record<string, View>>({});

    const activeGroup = findGroupForView(groups, activeView);
    const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(activeGroup?.id ?? null);

    // Recordar la última página visitada de cada categoría.
    useEffect(() => {
        if (activeGroup) lastViewByGroup.current[activeGroup.id] = activeView;
    }, [activeView, activeGroup]);

    useEffect(() => {
        if (activeGroup) setOpenMobileGroup(activeGroup.id);
    }, [activeGroup?.id]);

    // Cerrar menú de usuario al hacer clic fuera.
    useEffect(() => {
        if (!userMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [userMenuOpen]);

    const goTo = (view: View) => {
        setActiveView(view);
        setDrawerOpen(false);
    };

    const goToGroup = (group: NavGroup) => {
        const items = flattenGroupItems(group);
        const remembered = lastViewByGroup.current[group.id];
        const target = items.find(i => i.view === remembered)?.view ?? items[0].view;
        goTo(target);
    };

    return (
        <>
            {/* ───────── Barra horizontal ───────── */}
            <header className="fixed top-0 left-0 right-0 h-14 z-30 bg-white border-b border-gray-200 flex items-center px-3 sm:px-4 gap-2">
                {/* Hamburguesa (móvil) */}
                <button
                    onClick={() => setDrawerOpen(true)}
                    className="lg:hidden p-2 -ml-1 rounded-md text-gray-600 hover:bg-gray-100"
                    aria-label="Abrir menú"
                >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>

                {/* Mostrar/ocultar panel vertical (escritorio) */}
                <button
                    onClick={() => setSidePanelCollapsed(!sidePanelCollapsed)}
                    className="hidden lg:inline-flex p-2 rounded-md text-gray-500 hover:bg-gray-100"
                    title={sidePanelCollapsed ? 'Mostrar submenú' : 'Ocultar submenú'}
                    aria-label="Mostrar u ocultar submenú"
                >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" /></svg>
                </button>

                <button onClick={() => goTo('home')} className="font-semibold text-gray-800 text-sm sm:text-base whitespace-nowrap mr-2 lg:mr-6">
                    Cerro de la Silla
                </button>

                {/* Categorías (escritorio) */}
                <nav className="hidden lg:flex items-center gap-1 flex-1 min-w-0">
                    {groups.map(group => {
                        const isActive = activeGroup?.id === group.id;
                        return (
                            <button
                                key={group.id}
                                onClick={() => goToGroup(group)}
                                className={`relative px-3 h-14 text-sm font-medium transition-colors whitespace-nowrap ${isActive ? 'text-blue-700' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                {group.label}
                                <span className={`absolute left-3 right-3 bottom-0 h-0.5 rounded-full transition-colors ${isActive ? 'bg-blue-600' : 'bg-transparent'}`} />
                            </button>
                        );
                    })}
                </nav>
                <div className="flex-1 lg:hidden" />

                {/* Usuario */}
                <div className="relative" ref={userMenuRef}>
                    <button onClick={() => setUserMenuOpen(o => !o)} className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100" aria-label="Menú de usuario">
                        <img
                            src={user.photoURL}
                            alt="Foto de perfil"
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                            onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR; }}
                        />
                    </button>
                    {userMenuOpen && (
                        <div className="absolute right-0 mt-2 w-60 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-40">
                            <div className="px-4 pb-2 border-b border-gray-100">
                                <div className="text-sm font-semibold text-gray-800 truncate">{user.displayName}</div>
                                <div className="text-xs text-gray-500 truncate">{user.email}</div>
                            </div>
                            <button
                                onClick={() => { setUserMenuOpen(false); onLogout(); }}
                                className="w-full text-left px-4 py-2 mt-1 text-sm text-red-600 hover:bg-red-50"
                            >
                                Cerrar sesión
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* ───────── Panel vertical (escritorio): subcategorías de la categoría activa ───────── */}
            {isSidePanelOpen && activeGroup && (
                <aside className="hidden lg:block fixed top-14 bottom-0 left-0 w-56 z-20 bg-white border-r border-gray-200 overflow-y-auto">
                    <div className="px-5 pt-5 pb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase">{activeGroup.label}</div>
                    <nav className="px-3 pb-6">
                        {activeGroup.sections.map((section, idx) => (
                            <div key={idx} className="mt-3">
                                {section.title && <div className="px-2 mb-1 text-[11px] font-medium text-gray-400">{section.title}</div>}
                                {section.items.map(item => {
                                    const isActive = item.view === activeView;
                                    return (
                                        <button
                                            key={item.view}
                                            onClick={() => goTo(item.view)}
                                            title={item.tooltip}
                                            className={`w-full text-left flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                                        >
                                            <span className={`h-4 w-0.5 rounded-full ${isActive ? 'bg-blue-600' : 'bg-transparent'}`} />
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        ))}
                    </nav>
                </aside>
            )}

            {/* ───────── Cajón móvil: categorías con acordeón ───────── */}
            {drawerOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setDrawerOpen(false)} />}
            <aside className={`lg:hidden fixed top-0 bottom-0 left-0 w-72 max-w-[85%] z-50 bg-white shadow-xl flex flex-col transition-transform duration-200 ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 flex-shrink-0">
                    <span className="font-semibold text-gray-800">Cerro de la Silla</span>
                    <button onClick={() => setDrawerOpen(false)} className="p-2 -mr-2 rounded-md text-gray-500 hover:bg-gray-100" aria-label="Cerrar menú">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <nav className="flex-1 overflow-y-auto px-3 py-3">
                    {groups.map(group => {
                        const items = flattenGroupItems(group);
                        const single = items.length === 1;
                        const isOpen = openMobileGroup === group.id;
                        const isGroupActive = activeGroup?.id === group.id;
                        return (
                            <div key={group.id} className="mb-1">
                                <button
                                    onClick={() => (single ? goTo(items[0].view) : setOpenMobileGroup(isOpen ? null : group.id))}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium ${isGroupActive ? 'text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                                >
                                    <GroupIcon id={group.id} />
                                    <span className="flex-1 text-left">{group.label}</span>
                                    {!single && (
                                        <svg className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                    )}
                                </button>
                                {!single && isOpen && (
                                    <div className="ml-5 pl-3 border-l border-gray-200 mt-1 mb-2">
                                        {group.sections.map((section, idx) => (
                                            <div key={idx} className="mb-1">
                                                {section.title && <div className="px-2 pt-1 text-[11px] font-medium text-gray-400">{section.title}</div>}
                                                {section.items.map(item => {
                                                    const isActive = item.view === activeView;
                                                    return (
                                                        <button
                                                            key={item.view}
                                                            onClick={() => goTo(item.view)}
                                                            className={`w-full text-left px-2 py-2 rounded-md text-sm ${isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                                                        >
                                                            {item.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
                <div className="border-t border-gray-200 p-3 flex-shrink-0">
                    <button onClick={() => { setDrawerOpen(false); onLogout(); }} className="w-full text-left px-3 py-2.5 rounded-md text-sm text-red-600 hover:bg-red-50">
                        Cerrar sesión
                    </button>
                </div>
            </aside>
        </>
    );
};

export default Navigation;
