import React, { useState, useEffect } from 'react';
import { AlertTriangle, Terminal, XCircle } from 'lucide-react';

const ErrorLogger: React.FC = () => {
  const [errors, setErrors] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const isElectron = (window as any).electronAPI !== undefined;
  const [isIsolated, setIsIsolated] = useState((window as any).crossOriginIsolated);


  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setErrors((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${event.message}`]);
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      setErrors((prev) => [...prev, `${new Date().toLocaleTimeString()}: Promise error: ${event.reason?.message || event.reason}`]);
    };

    // Monkey patch console.log
    const originalLog = console.log;
    console.log = (...args) => {
      setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${args.join(' ')}`]);
      originalLog(...args);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    const checkIsolated = setInterval(() => {
      setIsIsolated((window as any).crossOriginIsolated);
    }, 1000);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      console.log = originalLog;
      clearInterval(checkIsolated);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: isVisible ? '0' : '-80vh',
      left: '0',
      width: '100%',
      height: '80vh',
      backgroundColor: '#1E1E1E',
      color: '#D4D4D4',
      zIndex: 9999,
      transition: 'bottom 0.3s ease',
      display: 'flex',
      flexDirection: 'column',
      borderTop: '4px solid var(--accent-primary)',
      fontFamily: 'monospace',
      pointerEvents: isVisible ? 'auto' : 'none'
    }}>
      <div
        onClick={() => setIsVisible(!isVisible)}
        style={{
          padding: '10px 20px',
          backgroundColor: '#333',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <Terminal size={18} />
          <span>Console de Depuração ({errors.length} Erros / {logs.length} Logs)</span>

          <div style={{
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: isIsolated ? '#10B981' : (isElectron ? '#10B981' : '#F59E0B'),
            color: 'white',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {isElectron ? 'Storage: ELECTRON NATIVE' : 'Storage: BROWSER INDEXEDDB'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {errors.length > 0 && <AlertTriangle size={18} color="orange" />}
          <span>{isVisible ? 'Recolher' : 'Expandir'}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {errors.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ color: '#F44747', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <XCircle size={16} /> ERROS DETECTADOS
            </h4>
            {errors.map((err, i) => (
              <div key={i} style={{ color: '#F44747', marginBottom: '4px', fontSize: '12px' }}>{err}</div>
            ))}
          </div>
        )}

        <div>
          <h4 style={{ color: '#4FC1FF', marginBottom: '10px' }}>MENSAGENS DE LOG</h4>
          {logs.map((log, i) => (
            <div key={i} style={{ marginBottom: '4px', fontSize: '11px', opacity: 0.8 }}>{log}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ErrorLogger;
