import React, { useState, useEffect } from 'react';
import { X, Clock, DollarSign, Trash2, Calendar as CalendarIcon, Save, Repeat } from 'lucide-react';
import { execSQL, querySQL } from '../../db/db';

interface Session {
  id: string;
  patient_id: string;
  patient_name: string;
  start_time: string;
  status: string;
  payment_status: string;
  payment_value: number;
  payment_method?: string;
  notes?: string;
  confirmed: boolean;
  recurring_id?: string;
  recurrence_period?: string;
}

interface SessionDialogProps {
  session: Session;
  onClose: () => void;
  onUpdate: () => void;
}

const SessionDialog: React.FC<SessionDialogProps> = ({ session, onClose, onUpdate }) => {
  const [editedSession, setEditedSession] = useState({ ...session });
  const [displayPrice, setDisplayPrice] = useState(session.payment_value?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);
  const notesRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.focus();
    }
  }, []);
  const [patientBilling, setPatientBilling] = useState<{ payer_name: string; billing_cycle: string } | null>(null);

  useEffect(() => {
    const fetchBilling = async () => {
      const result: any = await querySQL('SELECT payer_name, billing_cycle FROM patients WHERE id = ?', [session.patient_id]);
      if (result && result[0]) {
        setPatientBilling(result[0]);
      }
    };
    fetchBilling();
  }, [session.patient_id]);

  useEffect(() => {
    setEditedSession({ ...session });
    setDisplayPrice(session.payment_value?.toString() || '');
  }, [session.id]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const finalRecurringId = editedSession.recurrence_period && !session.recurring_id 
        ? crypto.randomUUID() 
        : session.recurring_id;

      await execSQL(
        `UPDATE sessions SET 
          status = ?, 
          payment_status = ?, 
          payment_value = ?, 
          payment_method = ?, 
          notes = ?, 
          confirmed = ?,
          start_time = ?,
          recurrence_period = ?,
          recurring_id = ?
        WHERE id = ?`,
        [
          editedSession.status,
          editedSession.payment_status,
          parseFloat(displayPrice) || 0,
          editedSession.payment_method || null,
          editedSession.notes || null,
          editedSession.confirmed ? 1 : 0,
          editedSession.start_time,
          editedSession.recurrence_period || null,
          finalRecurringId || null,
          session.id
        ]
      );

      if (finalRecurringId || editedSession.recurrence_period) {
        // Sempre sincroniza para garantir que o horizonte de 2 meses esteja preenchido
        await (window as any).electronAPI.syncRecurringSessions();
      }

      // Sincroniza faturamento para atualizar os valores de "Acerto" no calendário
      await (window as any).electronAPI.syncBillingReminders({ patientId: session.patient_id });

      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error saving session:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const [showConfirmDelete, setShowConfirmDelete] = useState<{ isSeries: boolean } | null>(null);

  const handleDelete = async (isSeries: boolean) => {
    setShowConfirmDelete(null);
    setIsSaving(true);
    try {
      if (isSeries) {
        // Para a recorrência e deleta sessões futuras
        await execSQL(
          `UPDATE sessions 
            SET recurrence_period = NULL 
            WHERE (recurring_id = ? OR id = ?)`,
          [session.recurring_id, session.recurring_id]
        );

        await execSQL(
          `UPDATE sessions 
            SET deleted_at = CURRENT_TIMESTAMP 
            WHERE (recurring_id = ? OR id = ?) 
            AND status = 'scheduled' 
            AND start_time >= ?`,
          [session.recurring_id, session.recurring_id, session.start_time]
        );
      } else {
        await execSQL('UPDATE sessions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [session.id]);
      }

      // Sincroniza faturamento para atualizar os valores de "Acerto" no calendário
      await (window as any).electronAPI.syncBillingReminders({ patientId: session.patient_id });

      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error deleting session:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
      <div className="card glass" style={{ width: '100%', maxWidth: '550px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        {showConfirmDelete && (
          <div style={{ 
            position: 'absolute', inset: 0, backgroundColor: 'var(--bg-secondary)', 
            zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', padding: '24px', textAlign: 'center', borderRadius: '16px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ padding: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', marginBottom: '16px' }}>
              <Trash2 size={32} color="var(--error)" />
            </div>
            <h3 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>
              {showConfirmDelete.isSeries ? 'Excluir Série?' : 'Excluir Sessão?'}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {showConfirmDelete.isSeries 
                ? 'Todos os agendamentos futuros desta série serão excluídos.' 
                : 'Esta ação não pode ser desfeita.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '300px' }}>
              <button onClick={() => setShowConfirmDelete(null)} className="btn-ghost" style={{ flex: 1, border: '1px solid var(--border-color)' }}>Voltar</button>
              <button onClick={() => handleDelete(showConfirmDelete.isSeries)} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--error)', border: '1px solid rgba(0,0,0,0.1)' }}>Confirmar</button>
            </div>
          </div>
        )}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <CalendarIcon size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Detalhes da Sessão</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{session.patient_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '8px' }}><X size={20} /></button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', border: 'none' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>
              <Clock size={16} color="#38bdf8" strokeWidth={2.5} style={{ stroke: '#38bdf8' }} /> STATUS DA SESSÃO
            </label>
            <select
              value={editedSession.status || 'scheduled'}
              onChange={e => setEditedSession({ ...editedSession, status: e.target.value })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="scheduled">Agendada</option>
              <option value="completed">Realizada (Concluída)</option>
              <option value="cancelled">Cancelada pelo Paciente</option>
              <option value="missed">Falta do Paciente</option>
            </select>
          </div>

          <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', border: 'none' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)' }}>
              <DollarSign size={16} color="#38bdf8" strokeWidth={2.5} style={{ stroke: '#38bdf8' }} /> PAGAMENTO
            </label>
            <select
              value={editedSession.payment_status || 'pending'}
              onChange={e => setEditedSession({ ...editedSession, payment_status: e.target.value })}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="refunded">Reembolsado</option>
            </select>
          </div>
        </div>

        {patientBilling && (patientBilling.payer_name || patientBilling.billing_cycle === 'monthly') && (
          <div className="card" style={{ 
            padding: '12px 16px', 
            backgroundColor: 'rgba(14, 165, 233, 0.05)', 
            border: '1px solid rgba(14, 165, 233, 0.2)', 
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <DollarSign size={20} color="var(--accent-primary)" />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-primary)', marginBottom: '2px' }}>
                LEMBRETE DE FATURAMENTO
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {patientBilling.payer_name ? `Pagador: ${patientBilling.payer_name}` : 'Pagador: Próprio Paciente'} 
                {patientBilling.billing_cycle === 'monthly' ? ' • Acerto Mensal (Fim do Mês)' : ' • Acerto por Sessão'}
              </p>
            </div>
            {patientBilling.billing_cycle === 'monthly' && session.payment_status !== 'paid' && (
              <span style={{ 
                padding: '4px 8px', 
                borderRadius: '6px', 
                fontSize: '10px', 
                backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                color: '#f59e0b',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                Pendente p/ Mensal
              </span>
            )}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: 'var(--text-secondary)' }}>
            <Repeat size={16} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Recorrência
          </label>
          <select 
            value={editedSession.recurrence_period || 'none'} 
            onChange={e => setEditedSession({ ...editedSession, recurrence_period: e.target.value === 'none' ? undefined : e.target.value })}
            style={{ width: '100%' }}
          >
            <option value="none">Sem recorrência</option>
            <option value="weekly">Semanal</option>
            <option value="biweekly">Quinzenal</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
            <CalendarIcon size={16} color="#38bdf8" strokeWidth={2.5} style={{ stroke: '#38bdf8', marginRight: '8px', verticalAlign: 'middle' }} />
            Horário da Sessão
          </label>
          <input
            type="datetime-local"
            value={
              editedSession.start_time
                ? (() => {
                    const d = new Date(editedSession.start_time);
                    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                  })()
                : ''
            }
            onChange={e => {
              const localDate = new Date(e.target.value);
              setEditedSession({ ...editedSession, start_time: localDate.toISOString() });
            }}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Valor (R$)</label>
            <input
              type="text"
              value={displayPrice}
              onChange={e => setDisplayPrice(e.target.value)}
              placeholder="0.00"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Meio de Pagamento</label>
            <select
              value={editedSession.payment_method || ''}
              onChange={e => setEditedSession({ ...editedSession, payment_method: e.target.value })}
              style={{ width: '100%', padding: '10px' }}
            >
              <option value="">Selecione...</option>
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão</option>
              <option value="transferencia">Transferência</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Observações Rápidas (Sessão)</label>
          <textarea
            ref={notesRef}
            value={editedSession.notes || ''}
            onChange={e => setEditedSession({ ...editedSession, notes: e.target.value })}
            placeholder="Ex: Teve atraso, falou sobre tal tema..."
            style={{ width: '100%', minHeight: '100px' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowConfirmDelete({ isSeries: false })} className="btn-ghost" disabled={isSaving} style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Trash2 size={16} /> Excluir
            </button>
            {session.recurring_id && (
              <button onClick={() => setShowConfirmDelete({ isSeries: true })} className="btn-ghost" disabled={isSaving} style={{ color: 'var(--error)', fontSize: '12px' }}>
                Excluir Série
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={onClose} className="btn-ghost">Cancelar</button>
            <button onClick={handleSave} className="btn-primary" disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isSaving ? 'Salvando...' : <><Save size={18} /> Salvar Alterações</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDialog;
