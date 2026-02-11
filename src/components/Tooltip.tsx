import React from 'react';

interface TooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ text, position = 'top' }) => {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
      top: 'left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-gray-800 transform rotate-45',
      bottom: 'left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-800 transform rotate-45',
      left: 'top-1/2 -translate-y-1/2 -right-1 w-2 h-2 bg-gray-800 transform rotate-45',
      right: 'top-1/2 -translate-y-1/2 -left-1 w-2 h-2 bg-gray-800 transform rotate-45',
  }

  return (
      <div className={`absolute ${positionClasses[position]} w-max max-w-xs p-2 text-sm text-white bg-gray-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 invisible group-hover:visible z-50`}>
        {text}
        <div className={`absolute ${arrowClasses[position]}`}></div>
      </div>
  );
};

export default Tooltip;
