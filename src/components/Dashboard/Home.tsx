import React, { useState, useEffect } from 'react';
import { Users, Calendar as CalendarIcon, DollarSign, TrendingUp, Clock, CheckCircle, ArrowRight, Plus } from 'lucide-react';
import { querySQL } from '../../db/db';
import SessionDialog from '../Calendar/SessionDialog';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  onSelectPatient: (id: string) => void;
  onSelectSession: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = (props) => {
  const { onNavigate, onSelectSession } = props;
  const [stats, setStats] = useState({
    activePatients: 0,
    sessionsToday: 0,
    pendingPayments: 0,
    monthlyIncome: 0
  });
  const [nextSessions, setNextSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);

  const fetchData = async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const pActive: any = await querySQL("SELECT COUNT(*) as count FROM patients WHERE status = 'active' AND deleted_at IS NULL");
      const sToday: any = await querySQL(
        "SELECT s.*, p.name as patient_name FROM sessions s JOIN patients p ON s.patient_id = p.id WHERE s.start_time BETWEEN ? AND ? AND s.deleted_at IS NULL AND (s.type IS NULL OR s.type = 'session')",
        [todayStart.toISOString(), todayEnd.toISOString()]
      );

      const firstDayMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const lastDayMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString();
      
      // Pendentes: sessões pendentes + cobranças pendentes
      const sPending: any = await querySQL(
        "SELECT SUM(payment_value) as total FROM sessions WHERE payment_status = 'pending' AND start_time BETWEEN ? AND ? AND deleted_at IS NULL AND (type IS NULL OR type = 'session')",
        [firstDayMonth, lastDayMonth]
      );
      const bPending: any = await querySQL(
        "SELECT SUM(amount) as total FROM billing_reminders WHERE status = 'pending' AND due_date BETWEEN ? AND ? AND deleted_at IS NULL",
        [firstDayMonth, lastDayMonth]
      );

      // Receita: sessões pagas + cobranças pagas
      const sIncome: any = await querySQL(
        "SELECT SUM(payment_value) as total FROM sessions WHERE payment_status = 'paid' AND start_time BETWEEN ? AND ? AND deleted_at IS NULL AND (type IS NULL OR type = 'session')",
        [firstDayMonth, lastDayMonth]
      );
      const bIncome: any = await querySQL(
        "SELECT SUM(amount) as total FROM billing_reminders WHERE status = 'paid' AND due_date BETWEEN ? AND ? AND deleted_at IS NULL",
        [firstDayMonth, lastDayMonth]
      );

      setStats({
        activePatients: pActive[0]?.count || 0,
        sessionsToday: sToday.length || 0,
        pendingPayments: (sPending[0]?.total || 0) + (bPending[0]?.total || 0),
        monthlyIncome: (sIncome[0]?.total || 0) + (bIncome[0]?.total || 0)
      });
      setNextSessions(sToday || []);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Bem-vindo de volta!</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Aqui está o resumo do seu consultório para o dia de hoje.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <div className="card glass" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>PACIENTES ATIVOS</p>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.activePatients}</h2>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'rgba(14, 165, 233, 0.1)', borderRadius: '12px', color: 'var(--accent-primary)' }}>
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="card glass" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>SESSÕES HOJE</p>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold' }}>{stats.sessionsToday}</h2>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: 'var(--warning)' }}>
              <Clock size={24} />
            </div>
          </div>
        </div>

        <div className="card glass" style={{ borderLeft: '4px solid var(--error)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>A RECEBER (MÊS)</p>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold' }}>R$ {stats.pendingPayments.toFixed(2)}</h2>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', color: 'var(--error)' }}>
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="card glass" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>RECEITA (MÊS)</p>
              <h2 style={{ fontSize: '32px', fontWeight: 'bold' }}>R$ {stats.monthlyIncome.toFixed(2)}</h2>
            </div>
            <div style={{ padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: 'var(--success)' }}>
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>Sessões para Hoje</h2>
            <button
              onClick={() => onNavigate('calendar')}
              style={{ color: 'var(--accent-primary)', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Ver Agenda Completa <ArrowRight size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {nextSessions.length === 0 ? (
              <div className="card glass" style={{ textAlign: 'center', padding: '40px' }}>
                <CalendarIcon size={40} color="var(--text-secondary)" style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ color: 'var(--text-secondary)' }}>Nenhuma sessão agendada para hoje.</p>
              </div>
            ) : (
              nextSessions.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(session => (
                <div
                  key={session.id}
                  className="card glass"
                  onClick={() => onSelectSession(session.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 24px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    borderLeft: `4px solid ${
                        session.status === 'completed' ? 'var(--success)' : 
                        (session.status === 'cancelled' || session.status === 'missed' ? 'var(--error)' : 'var(--accent-primary)')
                    }`
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                      <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h4 style={{ fontWeight: 'bold', fontSize: '16px' }}>{session.patient_name}</h4>
                        <div 
                          title={session.payment_status === 'paid' ? 'Pago' : 'Pagamento Pendente'}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '18px', height: '18px', borderRadius: '50%',
                            backgroundColor: session.payment_status === 'paid' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: session.payment_status === 'paid' ? 'var(--success)' : 'var(--error)',
                          }}
                        >
                          <DollarSign size={10} />
                        </div>
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {session.status === 'completed' ? <CheckCircle size={12} color="var(--success)" /> : 
                         (session.status === 'cancelled' || session.status === 'missed' ? <Clock size={12} color="var(--error)" /> : <Clock size={12} />)}
                        {session.status === 'completed' ? 'Realizada' : 
                         (session.status === 'cancelled' ? 'Cancelada' : (session.status === 'missed' ? 'Falta' : 'Agendada'))}
                      </p>
                    </div>
                  </div>
                  <button className="btn-ghost" style={{ padding: '8px' }}>
                    <ArrowRight size={20} color="var(--accent-primary)" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '20px' }}>Acesso Rápido</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button
              className="card glass"
              onClick={() => onNavigate('patients')}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}
            >
              <div style={{ padding: '10px', backgroundColor: 'var(--accent-primary)', borderRadius: '10px', color: 'white' }}>
                <Plus size={20} />
              </div>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Novo Paciente</span>
            </button>
            <button
              className="card glass"
              onClick={() => onNavigate('calendar')}
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}
            >
              <div style={{ padding: '10px', backgroundColor: 'var(--warning)', borderRadius: '10px', color: 'white' }}>
                <CalendarIcon size={20} />
              </div>
              <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Agendar Sessão</span>
            </button>
          </div>
        </section>
      </div>

      {selectedSession && (
        <SessionDialog
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onUpdate={fetchData}
        />
      )}
    </div>
  );
};

export default Dashboard;
