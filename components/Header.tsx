import React from 'react';

interface HeaderProps {
    user: {
        displayName: string;
        email: string;
        photoURL: string;
    };
    activeViewLabel: string;
}

const Header: React.FC<HeaderProps> = ({ user, activeViewLabel }) => {
    return (
        <header className="flex-shrink-0 flex justify-between items-center pb-4 border-b border-gray-200">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">{activeViewLabel}</h1>
            <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-right hidden sm:block">
                    <div className="font-semibold text-gray-700 truncate max-w-[200px]">{user.displayName}</div>
                    <div className="text-sm text-gray-500 truncate max-w-[200px]">{user.email}</div>
                </div>
                <img 
                    src={user.photoURL} 
                    alt="Foto de perfil" 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-blue-500"
                    onError={(e) => {
                        // Fallback to a default image if the provided URL fails
                        (e.target as HTMLImageElement).src = 'https://i.imgur.com/83itvIu.png';
                    }}
                />
            </div>
        </header>
    );
};

export default Header;
