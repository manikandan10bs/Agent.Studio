import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  theme?: 'light' | 'dark';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', theme = 'light' }) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base font-bold',
    lg: 'text-xl font-extrabold',
  };

  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Proprietary Agent.Studio Neural Core Prism Emblem */}
      <div className={`relative flex items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-0.5 shadow-md shadow-indigo-500/20 ${iconSizes[size]}`}>
        <div className="w-full h-full rounded-[10px] bg-[#0B0F17] flex items-center justify-center p-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
          >
            <path
              d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"
              stroke="url(#agent-gradient)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M12 8L16 12L12 16L8 12L12 8Z"
              fill="url(#agent-gradient)"
              fillOpacity="0.8"
            />
            <circle cx="12" cy="12" r="1.5" fill="#FFFFFF" />
            <defs>
              <linearGradient id="agent-gradient" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
                <stop stopColor="#6366F1" />
                <stop offset="0.5" stopColor="#8B5CF6" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Brand Name Typography */}
      <div className="flex items-center tracking-tight">
        <span className={`font-black tracking-wider ${isDark ? 'text-white' : 'text-slate-900'} ${textSizes[size]}`}>
          AGENT
        </span>
        <span className={`font-black tracking-wider bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent ${textSizes[size]}`}>
          .STUDIO
        </span>
      </div>
    </div>
  );
};
