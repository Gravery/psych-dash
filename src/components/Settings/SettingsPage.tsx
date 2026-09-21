import React, { useState, useEffect } from 'react';
import { Palette, Monitor, Bell, Volume2, Save, Info, AlertTriangle, CheckCircle2, Database, Download, Upload, MapPin, Plus, Trash2 } from 'lucide-react';
import { execSQL, querySQL } from '../../db/db';
import bellSound from '../../assets/sounds/bell.wav';
import digitalSound from '../../assets/sounds/digital.wav';
import modernSound from '../../assets/sounds/modern.wav';

const BRAZIL_STATES = [
  { uf: '', label: 'Selecione um estado...' },
  { uf: 'AC', label: 'Acre (AC)' },
  { uf: 'AL', label: 'Alagoas (AL)' },
  { uf: 'AP', label: 'Amapá (AP)' },
  { uf: 'AM', label: 'Amazonas (AM)' },
  { uf: 'BA', label: 'Bahia (BA)' },
  { uf: 'CE', label: 'Ceará (CE)' },
  { uf: 'DF', label: 'Distrito Federal (DF)' },
  { uf: 'ES', label: 'Espírito Santo (ES)' },
  { uf: 'GO', label: 'Goiás (GO)' },
  { uf: 'MA', label: 'Maranhão (MA)' },
  { uf: 'MT', label: 'Mato Grosso (MT)' },
  { uf: 'MS', label: 'Mato Grosso do Sul (MS)' },
  { uf: 'MG', label: 'Minas Gerais (MG)' },
  { uf: 'PA', label: 'Pará (PA)' },
  { uf: 'PB', label: 'Paraíba (PB)' },
  { uf: 'PR', label: 'Paraná (PR)' },
  { uf: 'PE', label: 'Pernambuco (PE)' },
  { uf: 'PI', label: 'Piauí (PI)' },
  { uf: 'RJ', label: 'Rio de Janeiro (RJ)' },
  { uf: 'RN', label: 'Rio Grande do Norte (RN)' },
  { uf: 'RS', label: 'Rio Grande do Sul (RS)' },
  { uf: 'RO', label: 'Rondônia (RO)' },
  { uf: 'RR', label: 'Roraima (RR)' },
  { uf: 'SC', label: 'Santa Catarina (SC)' },
  { uf: 'SP', label: 'São Paulo (SP)' },
  { uf: 'SE', label: 'Sergipe (SE)' },
  { uf: 'TO', label: 'Tocantins (TO)' },
];

const SettingsPage: React.FC = () => {
  const [accentColor, setAccentColor] = useState('#0ea5e9');
  const [startWithWindows, setStartWithWindows] = useState(false);
  const [notificationSound, setNotificationSound] = useState('bell');
  const [notificationLeadTime, setNotificationLeadTime] = useState('5');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [clinicState, setClinicState] = useState('SP');
  const [clinicCity, setClinicCity] = useState('');
  const [customHolidays, setCustomHolidays] = useState<any[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [notifPermission, setNotifPermission] = useState(Notification.permission);

  const sounds = [
    { id: 'bell', label: 'Sino Clássico', url: bellSound },
    { id: 'digital', label: 'Bipe Digital', url: digitalSound },
    { id: 'modern', label: 'Ding Moderno', url: modernSound },
  ];

  const loadCustomHolidays = async () => {
    try {
      const list: any = await querySQL("SELECT id, date, name, type FROM custom_holidays ORDER BY date ASC");
      if (Array.isArray(list)) {
        setCustomHolidays(list);
      }
    } catch (e) {
      console.warn('custom_holidays ainda não acessível:', e);
    }
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const rows: any = await querySQL(
          "SELECT key, value FROM config WHERE key IN ('accent_color', 'execution_mode', 'start_with_windows', 'notification_sound', 'notification_lead_time', 'notifications_enabled', 'clinic_state', 'clinic_city')"
        );
        rows?.forEach((row: any) => {
          if (row.key === 'accent_color') setAccentColor(row.value);
          if (row.key === 'start_with_windows') setStartWithWindows(row.value === 'true');
          if (row.key === 'notification_sound') setNotificationSound(row.value);
          if (row.key === 'notification_lead_time') setNotificationLeadTime(row.value);
          if (row.key === 'notifications_enabled') setNotificationsEnabled(row.value === 'true');
          if (row.key === 'clinic_state') setClinicState(row.value);
          if (row.key === 'clinic_city') setClinicCity(row.value);
        });
      } catch (err) {
        console.error('Erro ao carregar configurações:', err);
      }
      await loadCustomHolidays();
    };
    loadSettings();
  }, []);

  const handleAddCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName.trim()) return;
    try {
      const id = crypto.randomUUID();
      await execSQL(
        "INSERT INTO custom_holidays (id, date, name, type) VALUES (?, ?, ?, ?)",
        [id, newHolidayDate, newHolidayName.trim(), 'municipal']
      );
      setNewHolidayDate('');
      setNewHolidayName('');
      await loadCustomHolidays();
      window.dispatchEvent(new Event('holidays-updated'));
    } catch (err) {
      console.error('Erro ao adicionar feriado customizado:', err);
    }
  };

  const handleDeleteCustomHoliday = async (id: string) => {
    try {
      await execSQL("DELETE FROM custom_holidays WHERE id = ?", [id]);
      await loadCustomHolidays();
      window.dispatchEvent(new Event('holidays-updated'));
    } catch (err) {
      console.error('Erro ao excluir feriado customizado:', err);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      const settings = [
        ['accent_color', accentColor],
        ['start_with_windows', startWithWindows.toString()],
        ['notification_sound', notificationSound],
        ['notification_lead_time', notificationLeadTime],
        ['notifications_enabled', notificationsEnabled.toString()],
        ['clinic_state', clinicState],
        ['clinic_city', clinicCity]
      ];

      for (const [key, value] of settings) {
        await execSQL("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", [key, value]);
      }

      window.dispatchEvent(new Event('config-updated'));
      window.dispatchEvent(new Event('holidays-updated'));

      document.documentElement.style.setProperty('--accent-primary', accentColor);

      if ((window as any).electronAPI) {
        (window as any).electronAPI.updateAppSettings({ 
          startWithWindows
        });
      }

      setMessage({ type: 'success', text: 'Configurações salvas com sucesso!' });
    } catch (err) {
      console.error('Erro ao salvar:', err);
      setMessage({ type: 'error', text: 'Falha ao salvar configurações.' });
    } finally {
      setIsSaving(false);
    }
  };

  const testSound = () => {
    const sound = sounds.find(s => s.id === notificationSound);
    if (sound) {
      try {
        const audio = new Audio(sound.url);
        audio.volume = 1.0;
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.warn('Som de teste bloqueado, usando voz:', e);
            speakTestFallback();
          });
        }
      } catch (err) {
        speakTestFallback();
      }
    }
  };

  const speakTestFallback = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance('Teste de áudio do PsychDash');
      utterance.lang = 'pt-BR';
      window.speechSynthesis.speak(utterance);
    }
  };

  const requestNotifPermission = async () => {
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    if (permission === 'granted') {
      new Notification('PsychDash', { body: 'Notificações ativadas com sucesso!' });
    }
  };


  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '40px' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Palette color="var(--accent-primary)" /> Configurações do Sistema
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Personalize sua experiência e o comportamento do PsychDash.</p>
      </header>

      {message.text && (
        <div style={{ 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '24px',
          backgroundColor: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--error)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {message.type === 'success' ? <Info size={20} /> : <AlertTriangle size={20} />}
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* Seção de Cores */}
        <section className="card glass">
          <h2 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
            <Palette size={20} /> Identidade Visual
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Cor de Destaque (Accent)</label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={accentColor} 
                  onChange={(e) => setAccentColor(e.target.value)}
                  style={{ width: '60px', height: '40px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                />
                <code style={{ backgroundColor: 'var(--bg-primary)', padding: '4px 8px', borderRadius: '4px' }}>{accentColor}</code>
              </div>
            </div>
            <div style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Esta cor será aplicada em botões, ícones e elementos de destaque em todo o sistema.
            </div>
          </div>
        </section>

        {/* Seção de Modo de Uso */}
        <section className="card glass">
          <h2 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
            <Monitor size={20} /> Inicialização
          </h2>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <label style={{ fontWeight: '600', display: 'block' }}>Iniciar com o Windows</label>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>O servidor iniciará automaticamente ao ligar o computador.</p>
              </div>
              <input 
                type="checkbox" 
                checked={startWithWindows} 
                onChange={(e) => setStartWithWindows(e.target.checked)}
                style={{ width: '20px', height: '20px' }}
              />
            </div>
          </div>
        </section>

        {/* Seção de Notificações */}
        <section className="card glass">
          <h2 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
            <Bell size={20} /> Notificações de Atendimento
          </h2>
          <div style={{ display: 'grid', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div>
                 <label style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>Habilitar Alertas</label>
                 <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ativar som e popups de agendamento.</p>
               </div>
               <input 
                 type="checkbox" 
                 checked={notificationsEnabled} 
                 onChange={(e) => setNotificationsEnabled(e.target.checked)}
                 style={{ width: '20px', height: '20px' }}
               />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <label style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Permissão do Navegador</label>
               {notifPermission === 'granted' ? (
                 <span style={{ color: 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <CheckCircle2 size={16} /> Ativadas
                 </span>
               ) : (
                 <button onClick={requestNotifPermission} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>
                   Permitir no Navegador
                 </button>
               )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Tempo de Antecedência</label>
              <select 
                value={notificationLeadTime} 
                onChange={(e) => setNotificationLeadTime(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="5">5 Minutos antes</option>
                <option value="10">10 Minutos antes</option>
                <option value="15">15 Minutos antes</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>Som de Alerta</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <select 
                  value={notificationSound} 
                  onChange={(e) => setNotificationSound(e.target.value)}
                  style={{ flex: 1 }}
                >
                  {sounds.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                <button 
                  onClick={testSound}
                  className="btn-ghost" 
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)' }}
                >
                  <Volume2 size={18} /> Testar
                </button>
              </div>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={16} /> Você receberá um alerta visual e sonoro antes de cada sessão agendada.
            </div>
          </div>
        </section>

        {/* Seção de Localização e Feriados Regionais */}
        <section className="card glass">
          <h2 style={{ fontSize: '18px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
            <MapPin size={20} color="var(--accent-primary)" /> Localização da Clínica & Feriados Regionais
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            Selecione seu Estado e Cidade para carregar automaticamente os feriados estaduais correspondentes na sua agenda e cadastrar datas municipais.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                Estado (UF)
              </label>
              <select
                value={clinicState}
                onChange={(e) => setClinicState(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                {BRAZIL_STATES.map(st => (
                  <option key={st.uf} value={st.uf}>{st.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                Cidade
              </label>
              <input
                type="text"
                placeholder="Ex: Araras, São Paulo, Curitiba..."
                value={clinicCity}
                onChange={(e) => setClinicCity(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          {/* Feriados Municipais / Específicos da Clínica */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontWeight: '600', display: 'block', color: 'var(--text-primary)' }}>Feriados Municipais & Locais</label>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Cadastre feriados ou datas municipais da sua cidade que não constam nas listas nacionais/estaduais.
              </p>
            </div>

            <form onSubmit={handleAddCustomHoliday} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                required
              />
              <input
                type="text"
                placeholder="Nome (ex: Aniversário da Cidade, Padroeiro)"
                value={newHolidayName}
                onChange={(e) => setNewHolidayName(e.target.value)}
                style={{ flex: 1, minWidth: '220px', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                required
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
              >
                <Plus size={16} /> Adicionar
              </button>
            </form>

            {customHolidays.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {customHolidays.map((h: any) => (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-primary)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontWeight: '600', color: '#d97706' }}>
                        {new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                      <span>{h.name}</span>
                      <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(217, 119, 6, 0.1)', color: '#d97706', fontWeight: 'bold' }}>
                        Municipal
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomHoliday(h.id)}
                      className="btn-ghost"
                      style={{ padding: '4px', color: 'var(--error)' }}
                      title="Excluir feriado"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Seção de Banco de Dados */}
        <section className="card glass">
          <h2 style={{ fontSize: '18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
            <Database size={20} /> Banco de Dados & Backups
          </h2>
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <label style={{ fontWeight: '600', display: 'block' }}>Exportar Backup</label>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Salve uma cópia de segurança completa dos seus pacientes e atendimentos.</p>
              </div>
              <button 
                onClick={async () => {
                  if ((window as any).electronAPI) {
                    const res = await (window as any).electronAPI.db.export();
                    if (res.success) {
                      setMessage({ type: 'success', text: `Cópia de segurança criada com sucesso!` });
                    }
                  }
                }} 
                className="btn-ghost" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)' }}
              >
                <Download size={18} /> Exportar .sqlite3
              </button>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
              <div>
                <label style={{ fontWeight: '600', display: 'block', color: 'var(--error)' }}>Importar Dados</label>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Substitui todos os dados atuais. Um backup automático do banco atual será criado.</p>
              </div>
              <button 
                onClick={async () => {
                  if (!window.confirm('ATENÇÃO: Importar um novo banco de dados substituirá TODOS os seus dados atuais. Um backup automático do seu banco atual será criado na pasta do aplicativo. Deseja continuar?')) return;
                  
                  if ((window as any).electronAPI) {
                    const res = await (window as any).electronAPI.db.import();
                    if (res.success) {
                      setMessage({ type: 'success', text: 'Banco de dados importado! Reiniciando aplicativo...' });
                      setTimeout(() => window.location.reload(), 2000);
                    } else if (res.error) {
                      setMessage({ type: 'error', text: `Erro na importação: ${res.error}` });
                    }
                  }
                }} 
                className="btn-ghost" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--error)', border: '1px solid var(--error)' }}
              >
                <Upload size={18} /> Importar Arquivo
              </button>
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 32px' }}
          >
            <Save size={20} /> {isSaving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
