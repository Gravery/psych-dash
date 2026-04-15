import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, CheckCircle, Clock, DollarSign, FileText, User } from 'lucide-react';
import { querySQL, execSQL } from '../../db/db';

interface SessionDetailProps {
  id: string | null;
  onBack: () => void;
}

const SessionDetail: React.FC<SessionDetailProps> = ({ id, onBack }) => {
  const [session, setSession] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [paymentValue, setPaymentValue] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const sResult: any = await querySQL('SELECT * FROM sessions WHERE id = ?', [id]);
        if (sResult && sResult[0]) {
          const s = sResult[0];
          setSession(s);
          setNotes(s.notes || '');
          setPaymentValue(s.payment_value?.toString() || '');
          setPaymentStatus(s.payment_status || 'pending');

          const pResult: any = await querySQL('SELECT * FROM patients WHERE id = ?', [s.patient_id]);
          if (pResult && pResult[0]) setPatient(pResult[0]);
        }
      } catch (err) {
        console.error('Error fetching session detail:', err);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSave = async (complete: boolean = false) => {
    if (!id) return;
    setIsSaving(true);
    try {
      const status = complete ? 'completed' : session.status;
      await execSQL(
        'UPDATE sessions SET notes = ?, payment_value = ?, payment_status = ?, status = ? WHERE id = ?',
        [notes, parseFloat(paymentValue) || 0, paymentStatus, status, id]
      );
      setToast({ message: complete ? 'Sessão Concluída e Prontuário Atualizado!' : 'Alterações Salvas!', type: 'success' });
      if (complete) {
        setSession({ ...session, status: 'completed' });
      }
    } catch (err) {
      console.error('Error saving session:', err);
      setToast({ message: 'Erro ao salvar sessao.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!session || !patient) return <div style={{ padding: '40px', color: 'var(--text-secondary)' }}>Carregando dados da sessão...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative' }}>
      {toast && (
          <div style={{ 
              position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', 
              backgroundColor: toast.type === 'success' ? 'var(--success)' : 'var(--error)',
              color: 'white', padding: '12px 24px', borderRadius: '12px', zIndex: 9999,
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontWeight: '600', animation: 'slideUp 0.3s ease'
          }}>
              {toast.message}
              <style>{`@keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>
          </div>
      )}

      <button onClick={onBack} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <ArrowLeft size={18} /> Voltar
      </button>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold' }}>Sessão de Psicoterapia</h1>
            <span style={{ 
                padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                backgroundColor: session.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                color: session.status === 'completed' ? 'var(--success)' : 'var(--accent-primary)'
            }}>
                {session.status === 'completed' ? 'Realizada' : 'Agendada'}
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={16} /> {patient.name}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={16} /> {new Date(session.start_time).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => handleSave(false)} disabled={isSaving} className="btn-ghost" style={{ border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Save size={18} /> Salvar Rascunho
            </button>
            {session.status !== 'completed' && (
                <button onClick={() => handleSave(true)} disabled={isSaving} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={18} /> Concluir Sessão
                </button>
            )}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px' }}>
        <section>
            <div className="card glass" style={{ minHeight: '500px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--accent-primary)' }}>
                    <FileText size={20} />
                    <h3 style={{ fontWeight: 'bold' }}>Evolução Clínica / Anotações</h3>
                </div>
                <textarea 
                    value={notes} 
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Descreva o que foi trabalhado na sessão, observações relevantes, sentimentos e progresso do paciente..."
                    style={{ width: '100%', minHeight: '400px', border: 'none', background: 'transparent', resize: 'vertical', lineHeight: '1.7', fontSize: '16px' }}
                />
            </div>
        </section>

        <aside>
            <div className="card glass" style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--success)' }}>
                    <DollarSign size={20} />
                    <h3 style={{ fontWeight: 'bold' }}>Financeiro</h3>
                </div>
                
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Valor da Sessão (R$)</label>
                    <input 
                        type="text" 
                        value={paymentValue} 
                        onChange={e => setPaymentValue(e.target.value)}
                        style={{ width: '100%', fontSize: '18px', fontWeight: 'bold' }}
                    />
                </div>

                <div style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Status de Pagamento</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button 
                            onClick={() => setPaymentStatus('paid')}
                            style={{ 
                                padding: '10px', borderRadius: '8px', textAlign: 'left', fontSize: '14px', border: '1px solid var(--border-color)',
                                backgroundColor: paymentStatus === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                color: paymentStatus === 'paid' ? 'var(--success)' : 'var(--text-secondary)',
                                fontWeight: paymentStatus === 'paid' ? '600' : '400'
                            }}
                        >
                            Confirmar Pagamento
                        </button>
                        <button 
                            onClick={() => setPaymentStatus('pending')}
                            style={{ 
                                padding: '10px', borderRadius: '8px', textAlign: 'left', fontSize: '14px', border: '1px solid var(--border-color)',
                                backgroundColor: paymentStatus === 'pending' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                                color: paymentStatus === 'pending' ? 'var(--error)' : 'var(--text-secondary)',
                                fontWeight: paymentStatus === 'pending' ? '600' : '400'
                            }}
                        >
                            Marcar como Pendente
                        </button>
                    </div>
                </div>
            </div>

            <div className="card glass" style={{ backgroundColor: 'rgba(14, 165, 233, 0.05)' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px' }}>DICA CLÍNICA</h4>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    As anotações desta tela serão consolidadas no prontuário do paciente após a conclusão. Utilize este espaço para rascunhos durante ou logo após o atendimento.
                </p>
            </div>
        </aside>
      </div>
    </div>
  );
};

export default SessionDetail;
