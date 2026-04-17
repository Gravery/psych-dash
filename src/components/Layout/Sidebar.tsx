import React from 'react';
import { Home, Users, Calendar, LogOut, Download, FileSpreadsheet, Smartphone, FileText, Settings } from 'lucide-react';
import { exportDB, querySQL } from '../../db/db';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'patients', label: 'Pacientes', icon: Users },
    { id: 'calendar', label: 'Agenda', icon: Calendar },
    { id: 'reports', label: 'Relatórios', icon: FileText },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <aside className="glass" style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      padding: '30px 20px',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', padding: '0 10px' }}>
        <div style={{ 
          width: '32px', 
          height: '32px', 
          backgroundColor: 'var(--accent-primary)', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Smartphone size={20} color="white" />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>PsychDash</h2>
      </div>

      <nav style={{ flex: 1 }}>
        <ul style={{ listStyle: 'none' }}>
          {menuItems.map((item) => (
            <li key={item.id} style={{ marginBottom: '8px' }}>
              <button
                onClick={() => onTabChange(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  color: activeTab === item.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  backgroundColor: activeTab === item.id ? 'rgba(14, 165, 233, 0.1)' : 'transparent',
                  fontWeight: activeTab === item.id ? '600' : '500',
                  transition: 'all 0.2s ease'
                }}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={async () => {
            await exportDB();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '10px 16px',
            color: 'var(--text-secondary)',
            fontSize: '14px'
          }}
        >
          <Download size={18} />
          Exportar Banco (.sqlite)
        </button>

        <button
          onClick={async () => {
            const rows: any = await querySQL('SELECT * FROM sessions');
            if (!rows || rows.length === 0) {
              alert('Nenhum dado para exportar.');
              return;
            }
            const csvContent = "data:text/csv;charset=utf-8," 
              + "ID,PatientID,StartTime,Status,Notes\n"
              + rows.map((r: any) => `${r.id},${r.patient_id},${r.start_time},${r.status},"${(r.notes || '').replace(/"/g, '""')}"`).join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "relatorio_sessoes.csv");
            document.body.appendChild(link);
            link.click();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '10px 16px',
            color: 'var(--text-secondary)',
            fontSize: '14px'
          }}
        >
          <FileSpreadsheet size={18} />
          Exportar Sessões (CSV)
        </button>

        <button
          onClick={() => {
            sessionStorage.removeItem('is_authenticated');
            window.location.reload();
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            padding: '12px 16px',
            color: 'var(--error)',
            fontWeight: '600'
          }}
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>

    </aside>
  );
};

export default Sidebar;
