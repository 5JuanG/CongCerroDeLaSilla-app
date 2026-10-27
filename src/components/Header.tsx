import React from 'react';

interface HeaderProps {
    activeViewLabel: string;
    groupLabel?: string;
}

// Encabezado de página (solo título). El usuario y "Cerrar sesión" ahora viven en la barra superior (Navigation).
const Header: React.FC<HeaderProps> = ({ activeViewLabel, groupLabel }) => {
    return (
        <div className="flex-shrink-0 px-4 sm:px-6 py-3 border-b border-gray-200 bg-white">
            {groupLabel && groupLabel !== activeViewLabel && (
                <div className="text-xs text-gray-400 mb-0.5">{groupLabel}</div>
            )}
            <h1 className="text-lg sm:text-xl font-semibold text-gray-800 truncate">{activeViewLabel}</h1>
        </div>
    );
};

export default Header;
