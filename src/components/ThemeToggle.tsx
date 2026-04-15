import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className="btn-ghost"
      title={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        backgroundColor: 'var(--bg-secondary)',
        border: `2px solid ${isDark ? 'var(--accent-primary)' : 'var(--border-color)'}`,
        boxShadow: isDark ? '0 0 15px rgba(56, 189, 248, 0.4)' : 'var(--shadow)',
        marginBottom: '20px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: '0 !important',
        minWidth: '48px'
      }}
    >
      {isDark ? (
        <Sun size={32} color="#f59e0b" fill="#f59e0b" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.4))' }} />
      ) : (
        <Moon size={32} color="#1d4ed8" fill="#1d4ed8" strokeWidth={2} style={{ filter: 'drop-shadow(0 0 4px rgba(29, 78, 216, 0.3))' }} />
      )}
    </button>
  );
};

export default ThemeToggle;
