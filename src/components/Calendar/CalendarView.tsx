import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, User, Repeat, DollarSign, CheckCircle } from 'lucide-react';
import { querySQL, execSQL } from '../../db/db';
import SessionDialog from './SessionDialog';
import BillingDialog from './BillingDialog';

const CalendarView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sessions, setSessions] = useState<any[]>([]);
  const [billings, setBillings] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [selectedBilling, setSelectedBilling] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [filterType, setFilterType] = useState<'all' | 'sessions' | 'billings'>('all');

  const [newSession, setNewSession] = useState({
    patient_id: '',
    date: '',
    time: '',
    recurrence: 'none',
    payment_value: '',
    notes: ''
  });

  const [newBilling, setNewBilling] = useState({
    patient_id: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    notes: ''
  });

  const isRefreshing = React.useRef(false);

  const fetchData = async (silent = false) => {
    if (isRefreshing.current) return;

    if (!silent) setIsLoading(true);
    isRefreshing.current = true;

    try {
      let start, end;
      if (viewMode === 'month') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const startDate = new Date(year, month, 1);
        startDate.setDate(startDate.getDate() - firstDayOfMonth);

        const lastDayOfMonth = new Date(year, month + 1, 0);
        const endDate = new Date(lastDayOfMonth);
        endDate.setDate(lastDayOfMonth.getDate() + (6 - lastDayOfMonth.getDay()));
        endDate.setHours(23, 59, 59, 999);

        start = startDate.toISOString();
        end = endDate.toISOString();
      } else {
        const d = new Date(currentDate);
        const day = d.getDay();
        const diff = d.getDate() - day;
        const weekStart = new Date(d.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        start = weekStart.toISOString();
        end = weekEnd.toISOString();
      }

      const [sResult, bResult, pResult] = await Promise.all([
        querySQL(
          `SELECT s.*, p.name as patient_name 
           FROM sessions s 
           JOIN patients p ON s.patient_id = p.id 
           WHERE s.start_time BETWEEN ? AND ? 
           AND s.deleted_at IS NULL
           AND (s.type IS NULL OR s.type = 'session')`,
          [start, end]
        ),
        querySQL(
          `SELECT b.*, p.name as patient_name 
           FROM billing_reminders b 
           JOIN patients p ON b.patient_id = p.id 
           WHERE b.due_date BETWEEN ? AND ? 
           AND b.deleted_at IS NULL`,
          [start, end]
        ),
        querySQL("SELECT id, name, session_value FROM patients WHERE status = 'active' AND deleted_at IS NULL ORDER BY name ASC")
      ]);

      setSessions(sResult || []);
      setBillings(bResult || []);
      setPatients(pResult || []);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      if (!silent) setIsLoading(false);
      isRefreshing.current = false;
    }
  };

  useEffect(() => {
    fetchData();

    let unsubscribe: (() => void) | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    if ((window as any).electronAPI?.onRefreshData) {
      unsubscribe = (window as any).electronAPI.onRefreshData(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => fetchData(true), 300);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [currentDate, viewMode]);

  const handlePatientChange = (id: string) => {
    const patient = patients.find(p => p.id === id);
    setNewSession({
      ...newSession,
      patient_id: id,
      payment_value: patient ? patient.session_value.toString() : ''
    });
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const startDateTime = `${newSession.date}T${newSession.time}:00`;
    const recurringId = newSession.recurrence !== 'none' ? crypto.randomUUID() : null;
    const value = parseFloat(newSession.payment_value) || 0;

    try {
      await execSQL(
        'INSERT INTO sessions (id, patient_id, start_time, status, payment_value, recurring_id, recurrence_period, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), newSession.patient_id, new Date(startDateTime).toISOString(), 'scheduled', value, recurringId, newSession.recurrence !== 'none' ? newSession.recurrence : null, newSession.notes]
      );

      if (newSession.recurrence !== 'none') {
        // Gatilha sincronização no backend para preencher os próximos meses
        await (window as any).electronAPI.syncRecurringSessions();
      }

      // Sincroniza faturamento para atualizar os valores de "Acerto" no calendário
      await (window as any).electronAPI.syncBillingReminders({ patientId: newSession.patient_id });

      setShowAddModal(false);
      setNewSession({ patient_id: '', date: '', time: '', recurrence: 'none', payment_value: '', notes: '' });
      fetchData();
    } catch (err) {
      console.error('Error adding session:', err);
    }
  };

  const handleAddBillingReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const startDateTime = new Date(`${newBilling.date}T09:00:00`);
      const patient = patients.find(p => p.id === newBilling.patient_id);
      const notes = newBilling.notes || `Acerto Avulso - ${patient?.name || 'N/A'}`;

      await execSQL(
        "INSERT INTO billing_reminders (id, patient_id, due_date, amount, status, notes) VALUES (?, ?, ?, ?, ?, ?)",
        [crypto.randomUUID(), newBilling.patient_id, startDateTime.toISOString(), parseFloat(newBilling.amount) || 0, 'pending', notes]
      );

      setShowBillingModal(false);
      setNewBilling({ patient_id: '', date: new Date().toISOString().split('T')[0], amount: '', notes: '' });
      fetchData();
    } catch (err) {
      console.error('Error adding billing reminder:', err);
    }
  };

  const renderDays = () => {
    const days = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const isWeek = viewMode === 'week';

    let startDate: Date;
    let totalDays: number;

    if (isWeek) {
      const d = new Date(currentDate);
      const day = d.getDay();
      startDate = new Date(d.setDate(d.getDate() - day));
      totalDays = 7;
    } else {
      const firstDayOfMonth = new Date(year, month, 1).getDay();
      startDate = new Date(year, month, 1);
      startDate.setDate(startDate.getDate() - firstDayOfMonth);

      const lastDayOfMonth = new Date(year, month + 1, 0);
      const lastDayWeek = lastDayOfMonth.getDay();
      const daysInMonth = lastDayOfMonth.getDate();

      totalDays = firstDayOfMonth + daysInMonth + (6 - lastDayWeek);
    }

    for (let i = 0; i < totalDays; i++) {
      const dObj = new Date(startDate);
      dObj.setDate(startDate.getDate() + i);
      const datePrefix = dObj.toISOString().split('T')[0];

      const daySessions = sessions.filter(s => s.start_time.startsWith(datePrefix))
        .filter(() => filterType === 'all' || filterType === 'sessions');
      const dayBillings = billings.filter(b => b.due_date.startsWith(datePrefix))
        .filter(() => filterType === 'all' || filterType === 'billings');

      const today = new Date();
      const isToday = dObj.getDate() === today.getDate() && dObj.getMonth() === today.getMonth() && dObj.getFullYear() === today.getFullYear();
      const isCurrentMonth = dObj.getMonth() === month;
      const shouldShade = !isWeek && !isCurrentMonth;

      days.push(
        <div key={dObj.toISOString()} style={{
          minHeight: isWeek ? '400px' : '120px',
          padding: '8px',
          backgroundColor: shouldShade ? 'var(--bg-primary)' : 'var(--bg-secondary)',
          opacity: shouldShade ? 0.4 : 1,
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease'
        }}>
          <span style={{
            fontSize: '12px',
            fontWeight: isToday ? 'bold' : 'normal',
            color: isToday ? 'var(--accent-primary)' : 'var(--text-secondary)',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {dObj.getDate()} {isToday && '•'}
          </span>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Billing reminders */}
            {dayBillings.map(b => {
              const isPaid = b.status === 'paid';
              const isOverdue = !isPaid && new Date(b.due_date) < new Date();
              const billingColor = isPaid ? 'var(--success)' : isOverdue ? 'var(--error)' : '#f59e0b';
              const billingBg = isPaid ? 'rgba(16, 185, 129, 0.12)' : isOverdue ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)';

              return (
                <div
                  key={`billing-${b.id}`}
                  onClick={(e) => { e.stopPropagation(); setSelectedBilling(b); }}
                  style={{
                    fontSize: isWeek ? '11px' : '10px', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer',
                    backgroundColor: billingBg,
                    borderLeft: `3px solid ${billingColor}`,
                    color: billingColor,
                    fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  {isPaid ? <CheckCircle size={10} /> : <DollarSign size={10} />}
                  <span>{isPaid ? '✓' : ''} ACERTO: {b.patient_name}</span>
                </div>
              );
            })}

            {/* Sessions */}
            {daySessions.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(s => {
              const isCompleted = s.status === 'completed';
              const isCancelled = s.status === 'cancelled' || s.status === 'missed';
              const isPaid = s.payment_status === 'paid';
              const statusColor = isCompleted ? 'var(--success)' : (isCancelled ? 'var(--error)' : 'var(--accent-primary)');
              const bgColor = isCompleted ? 'rgba(16, 185, 129, 0.08)' : (isCancelled ? 'rgba(239, 68, 68, 0.08)' : 'rgba(14, 165, 233, 0.08)');

              return (
                <div
                  key={s.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedSession(s); }}
                  style={{
                    fontSize: isWeek ? '11px' : '10px', padding: '4px 6px', borderRadius: '4px', cursor: 'pointer',
                    backgroundColor: bgColor,
                    borderLeft: `3px solid ${statusColor}`,
                    color: statusColor,
                    fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <span style={{
                    color: isPaid ? 'var(--success)' : 'var(--error)',
                    fontWeight: '900',
                    fontSize: '11px'
                  }} title={isPaid ? 'Pago' : 'Pendente'}>$</span>
                  {new Date(s.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {s.patient_name}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
      {isLoading && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(2px)'
        }}>
          <div className="card glass" style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '40px', height: '40px', border: '4px solid var(--accent-primary)', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 1s linear infinite'
            }} />
            <p style={{ fontWeight: '600' }}>Carregando agenda...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold' }}>Agenda</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => {
                const d = new Date(currentDate);
                if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
                else d.setDate(d.getDate() - 7);
                setCurrentDate(d);
              }}
              className="btn-ghost" style={{ padding: '6px' }}
            >
              <ChevronLeft size={18} />
            </button>
            <h2 style={{ fontSize: '15px', fontWeight: 'bold', width: '180px', textAlign: 'center' }}>
              {viewMode === 'month'
                ? currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                : (() => {
                  const d = new Date(currentDate);
                  d.setDate(d.getDate() - d.getDay());
                  return `Semana de ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
                })()}
            </h2>
            <button
              onClick={() => {
                const d = new Date(currentDate);
                if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
                else d.setDate(d.getDate() + 7);
                setCurrentDate(d);
              }}
              className="btn-ghost" style={{ padding: '6px' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setViewMode('month')}
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', backgroundColor: viewMode === 'month' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'month' ? 'white' : 'var(--text-secondary)' }}
            >
              Mês
            </button>
            <button
              onClick={() => setViewMode('week')}
              style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', backgroundColor: viewMode === 'week' ? 'var(--accent-primary)' : 'transparent', color: viewMode === 'week' ? 'white' : 'var(--text-secondary)' }}
            >
              Semana
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={{ fontSize: '13px', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            <option value="all">Todos os itens</option>
            <option value="sessions">Apenas Sessões</option>
            <option value="billings">Apenas Acertos</option>
          </select>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />

          <button
            className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(245, 158, 11, 0.4)', color: '#f59e0b', fontSize: '13px' }}
            onClick={() => setShowBillingModal(true)}
          >
            <DollarSign size={18} /> Acerto
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }} onClick={() => setShowAddModal(true)}>
            <Plus size={18} /> Sessão
          </button>
        </div>
      </header>

      <div className="card glass" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', backgroundColor: 'rgba(14, 165, 233, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
          {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(day => (
            <div key={day} style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{day}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {renderDays()}
        </div>
      </div>

      {/* Modal: Novo Agendamento */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card glass" style={{ width: '100%', maxWidth: '450px' }}>
            <h2 style={{ marginBottom: '24px' }}>Novo Agendamento</h2>
            <form onSubmit={handleAddSession}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  <User size={16} color="#38bdf8" strokeWidth={2.5} style={{ stroke: '#38bdf8', marginRight: '8px', verticalAlign: 'middle' }} /> Paciente
                </label>
                <select value={newSession.patient_id} onChange={e => handlePatientChange(e.target.value)} style={{ width: '100%' }} required>
                  <option value="">Selecione...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    <CalendarIcon size={16} color="#38bdf8" strokeWidth={2.5} style={{ stroke: '#38bdf8', marginRight: '8px', verticalAlign: 'middle' }} /> Data
                  </label>
                  <input type="date" value={newSession.date} onChange={e => setNewSession({ ...newSession, date: e.target.value })} style={{ width: '100%' }} required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    <Clock size={16} color="#38bdf8" strokeWidth={2.5} style={{ stroke: '#38bdf8', marginRight: '8px', verticalAlign: 'middle' }} /> Hora
                  </label>
                  <input type="time" value={newSession.time} onChange={e => setNewSession({ ...newSession, time: e.target.value })} style={{ width: '100%' }} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    <Repeat size={16} color="#38bdf8" strokeWidth={2.5} style={{ stroke: '#38bdf8', marginRight: '8px', verticalAlign: 'middle' }} /> Recorrência
                  </label>
                  <select value={newSession.recurrence} onChange={e => setNewSession({ ...newSession, recurrence: e.target.value })} style={{ width: '100%' }}>
                    <option value="none">Nenhuma</option>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quinzenal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>R$ Sessão</label>
                  <input type="text" value={newSession.payment_value} onChange={e => setNewSession({ ...newSession, payment_value: e.target.value })} style={{ width: '100%' }} placeholder="0.00" />
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Observações Iniciais</label>
                <textarea
                  value={newSession.notes}
                  onChange={e => setNewSession({ ...newSession, notes: e.target.value })}
                  placeholder="Ex: Primeira consulta, demanda específica..."
                  style={{ width: '100%', minHeight: '80px' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" className="btn-primary">Criar Agendamento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Lembrete de Acerto */}
      {showBillingModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card glass" style={{ width: '100%', maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <div style={{ padding: '10px', backgroundColor: 'rgba(245, 158, 11, 0.15)', borderRadius: '12px' }}>
                <DollarSign size={22} color="#f59e0b" />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Novo Lembrete de Acerto</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Crie um lembrete avulso de cobrança</p>
              </div>
            </div>
            <form onSubmit={handleAddBillingReminder}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                  <User size={16} color="#f59e0b" strokeWidth={2.5} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Paciente
                </label>
                <select
                  value={newBilling.patient_id}
                  onChange={e => setNewBilling({ ...newBilling, patient_id: e.target.value })}
                  style={{ width: '100%' }}
                  required
                >
                  <option value="">Selecione...</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    <CalendarIcon size={16} color="#f59e0b" strokeWidth={2.5} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Data do Acerto
                  </label>
                  <input
                    type="date"
                    value={newBilling.date}
                    onChange={e => setNewBilling({ ...newBilling, date: e.target.value })}
                    style={{ width: '100%' }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    <DollarSign size={16} color="#f59e0b" strokeWidth={2.5} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Valor (R$)
                  </label>
                  <input
                    type="text"
                    value={newBilling.amount}
                    onChange={e => setNewBilling({ ...newBilling, amount: e.target.value })}
                    style={{ width: '100%' }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Observação (opcional)</label>
                <textarea
                  value={newBilling.notes}
                  onChange={e => setNewBilling({ ...newBilling, notes: e.target.value })}
                  placeholder="Ex: Cobrança referente a março, pagamento via PIX..."
                  style={{ width: '100%', minHeight: '70px' }}
                />
              </div>
              <div style={{ padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', marginBottom: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                💡 Lembretes automáticos podem ser configurados nos <strong>Dados Cadastrais</strong> do paciente, definindo um dia fixo para acerto mensal.
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowBillingModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" className="btn-primary" style={{ backgroundColor: '#f59e0b', borderColor: '#f59e0b' }}>Criar Lembrete</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dialog: Detalhes da Sessão */}
      {selectedSession && (
        <SessionDialog
          key={selectedSession.id}
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onUpdate={() => fetchData(true)}
        />
      )}

      {/* Dialog: Detalhes da Cobrança */}
      {selectedBilling && (
        <BillingDialog
          key={selectedBilling.id}
          billing={selectedBilling}
          onClose={() => setSelectedBilling(null)}
          onUpdate={() => fetchData(true)}
        />
      )}
    </div>
  );
};

export default CalendarView;
