import React, { useState, useEffect } from 'react';
import LoginPage from './components/Auth/LoginPage.tsx';
import Sidebar from './components/Layout/Sidebar.tsx';
import Dashboard from './components/Dashboard/Home.tsx';
import PatientsList from './components/Patients/List.tsx';
import PatientDetail from './components/Patients/Detail.tsx';
import CalendarView from './components/Calendar/CalendarView.tsx';
import SessionDetail from './components/Calendar/SessionDetail.tsx';
import FinancialReport from './components/Financial/FinancialReport.tsx';
import ThemeToggle from './components/ThemeToggle.tsx';
import ErrorLogger from './components/ErrorLogger.tsx';
import { initDB } from './db/db';
import { isAuthenticated } from './utils/auth';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isDBReady, setIsDBReady] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);

    document.documentElement.classList.toggle('dark', isDark);

    if (isLoggedIn) {
      initDB().then(() => {
        setIsDBReady(true);
      }).catch(err => {
        console.error('DB Init Error:', err);
      });
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  if (!isDBReady) {
    return (
      <div style={{
        display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '20px', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)'
      }}>
        <div style={{
          width: '40px', height: '40px', border: '4px solid var(--accent-primary)', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 1s linear infinite'
        }} />
        <p>Inicializando Banco de Dados Local...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard
          onNavigate={(tab) => setActiveTab(tab)}
          onSelectPatient={(id) => { setSelectedPatientId(id); setActiveTab('patient-detail'); }}
          onSelectSession={(id) => { setSelectedSessionId(id); setActiveTab('session-detail'); }}
        />;
      case 'patients':
        return <PatientsList onSelectPatient={(id) => { setSelectedPatientId(id); setActiveTab('patient-detail'); }} />;
      case 'patient-detail':
        return <PatientDetail id={selectedPatientId} onBack={() => setActiveTab('patients')} />;
      case 'calendar':
        return <CalendarView />;
      case 'reports':
        return <FinancialReport />;
      case 'session-detail':
        return <SessionDetail id={selectedSessionId} onBack={() => setActiveTab('dashboard')} />;
      default:
        return <Dashboard
          onNavigate={(tab) => setActiveTab(tab)}
          onSelectPatient={(id) => { setSelectedPatientId(id); setActiveTab('patient-detail'); }}
          onSelectSession={(id) => { setSelectedSessionId(id); setActiveTab('session-detail'); }}
        />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', backgroundColor: 'var(--bg-primary)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 10 }}>
          <ThemeToggle />
        </div>
        {renderContent()}
      </main>
      <ErrorLogger />
    </div>
  );
};

export default App;
