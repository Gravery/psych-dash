import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar as CalendarIcon, Save, CheckCircle, RotateCcw, Trash2, CreditCard, FileText } from 'lucide-react';
import { execSQL, querySQL } from '../../db/db';

interface BillingReminder {
  id: string;
  patient_id: string;
  patient_name: string;
  due_date: string;
  amount: number;
  status: string;
  payment_method?: string;
  notes?: string;
  paid_at?: string;
}

interface BillingDialogProps {
  billing: BillingReminder;
  onClose: () => void;
  onUpdate: () => void;
}

const BillingDialog: React.FC<BillingDialogProps> = ({ billing, onClose, onUpdate }) => {
  const [amount, setAmount] = useState(billing.amount?.toString() || '0');
  const [paymentMethod, setPaymentMethod] = useState(billing.payment_method || '');
  const [notes, setNotes] = useState(billing.notes || '');
  const [linkedSessions, setLinkedSessions] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const notesRef = React.useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (notesRef.current) {
      notesRef.current.focus();
    }
  }, []);

  useEffect(() => {
    fetchLinkedSessions();
  }, [billing]);

  const fetchLinkedSessions = async () => {
    try {
      const dueDate = new Date(billing.due_date);
      const monthStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), 1).toISOString();
      const monthEnd = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const sessions: any = await querySQL(
        "SELECT * FROM sessions WHERE patient_id = ? AND start_time BETWEEN ? AND ? AND deleted_at IS NULL AND (type IS NULL OR type = 'session') ORDER BY start_time ASC",
        [billing.patient_id, monthStart, monthEnd]
      );
      setLinkedSessions(sessions || []);

      if (parseFloat(amount) === 0 && sessions && sessions.length > 0) {
        const total = sessions.reduce((sum: number, s: any) => sum + (s.payment_value || 0), 0);
        setAmount(total.toFixed(2));
      }
    } catch (err) {
      console.error('Error fetching linked sessions:', err);
    }
  };

  const handleMarkPaid = async () => {
    setIsSaving(true);
    try {
      await (window as any).electronAPI.markBillingPaid({
        billingId: billing.id,
        paymentMethod: paymentMethod || null,
        amount: parseFloat(amount) || 0
      });
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error marking billing as paid:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const [showConfirmRevert, setShowConfirmRevert] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const handleRevert = async () => {
    setShowConfirmRevert(false);
    setIsSaving(true);
    try {
      await (window as any).electronAPI.revertBilling({ billingId: billing.id });
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error reverting billing:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      await execSQL(
        "UPDATE billing_reminders SET notes = ?, amount = ? WHERE id = ?",
        [notes, parseFloat(amount) || 0, billing.id]
      );
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error saving billing notes:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setShowConfirmDelete(false);
    setIsSaving(true);
    try {
      await execSQL("UPDATE billing_reminders SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [billing.id]);
      onUpdate();
      onClose();
    } catch (err) {
      console.error('Error deleting billing:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const isPaid = billing.status === 'paid';
  const dueDate = new Date(billing.due_date);
  const isOverdue = !isPaid && dueDate < new Date();
  const monthLabel = dueDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const statusColor = isPaid ? 'var(--success)' : isOverdue ? 'var(--error)' : '#f59e0b';
  const statusBg = isPaid ? 'rgba(16, 185, 129, 0.12)' : isOverdue ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)';
  const statusText = isPaid ? 'PAGO' : isOverdue ? 'ATRASADO' : 'PENDENTE';

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
      <div className="card glass" style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: statusBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: statusColor }}>
              <DollarSign size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Acerto de Pagamento</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{billing.patient_name} • {monthLabel}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost" style={{ padding: '8px' }}><X size={20} /></button>
        </header>

        {/* Status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px', borderRadius: '12px', backgroundColor: statusBg,
          marginBottom: '24px', border: `1px solid ${statusColor}30`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isPaid ? <CheckCircle size={20} color={statusColor} /> : <DollarSign size={20} color={statusColor} />}
            <div>
              <span style={{ fontSize: '13px', fontWeight: '700', color: statusColor, letterSpacing: '0.5px' }}>{statusText}</span>
              {isPaid && billing.paid_at && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Pago em {new Date(billing.paid_at).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Vencimento</p>
            <p style={{ fontSize: '14px', fontWeight: '600' }}>{dueDate.toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Valor e método */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              <DollarSign size={14} /> VALOR (R$)
            </label>
            <input
              type="text"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              style={{ width: '100%', fontSize: '18px', fontWeight: '700' }}
              disabled={isPaid}
            />
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
              <CreditCard size={14} /> MEIO DE PAGAMENTO
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              style={{ width: '100%', padding: '10px' }}
              disabled={isPaid}
            >
              <option value="">Selecione...</option>
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao">Cartão</option>
              <option value="transferencia">Transferência</option>
            </select>
          </div>
        </div>

        {/* Sessões vinculadas */}
        {linkedSessions.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', marginBottom: '10px', color: 'var(--text-secondary)' }}>
              <CalendarIcon size={14} /> SESSÕES DO MÊS ({linkedSessions.length})
            </label>
            <div style={{ maxHeight: '160px', overflowY: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {linkedSessions.map(s => {
                const sessionPaid = s.payment_status === 'paid';
                return (
                  <div key={s.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
                    fontSize: '13px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        backgroundColor: s.status === 'completed' ? 'var(--success)' : s.status === 'cancelled' ? 'var(--error)' : 'var(--accent-primary)'
                      }} />
                      <span>{new Date(s.start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {new Date(s.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '600' }}>R$ {(s.payment_value || 0).toFixed(2)}</span>
                      <span style={{
                        fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px',
                        backgroundColor: sessionPaid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: sessionPaid ? 'var(--success)' : 'var(--error)'
                      }}>
                        {sessionPaid ? 'PAGO' : 'PENDENTE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Observação */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)' }}>
            <FileText size={14} /> OBSERVAÇÃO
          </label>
          <textarea
            ref={notesRef}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Observações sobre esta cobrança..."
            style={{ width: '100%', minHeight: '70px' }}
            disabled={isSaving}
          />
        </div>

        {/* Ações */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowConfirmDelete(true)} className="btn-ghost" disabled={isSaving} style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
              <Trash2 size={14} /> Excluir
            </button>
            {isPaid && (
              <button onClick={() => setShowConfirmRevert(true)} className="btn-ghost" disabled={isSaving} style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                <RotateCcw size={14} /> Reverter
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} className="btn-ghost">Cancelar</button>
            {isPaid ? (
              <button onClick={handleSaveNotes} className="btn-primary" disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Save size={16} /> Salvar
              </button>
            ) : (
              <button onClick={handleMarkPaid} className="btn-primary" disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--success)', borderColor: 'var(--success)' }}>
                <CheckCircle size={16} /> {isSaving ? 'Processando...' : 'Marcar como Pago'}
              </button>
            )}
          </div>
        </div>

        {/* Overlays de Confirmação */}
        {(showConfirmDelete || showConfirmRevert) && (
          <div style={{
            position: 'absolute', inset: 0, backgroundColor: 'var(--bg-secondary)',
            zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', padding: '24px', textAlign: 'center', borderRadius: '16px',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ padding: '16px', backgroundColor: showConfirmDelete ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', borderRadius: '50%', marginBottom: '16px' }}>
              {showConfirmDelete ? <Trash2 size={32} color="var(--error)" /> : <RotateCcw size={32} color="#f59e0b" />}
            </div>
            <h3 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>
              {showConfirmDelete ? 'Excluir Lembrete?' : 'Reverter Pagamento?'}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
              {showConfirmDelete
                ? 'Esta ação não pode ser desfeita.'
                : 'A cobrança voltará a ser pendente e as sessões vinculadas também serão revertidas.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button
                onClick={() => { setShowConfirmDelete(false); setShowConfirmRevert(false); }}
                className="btn-ghost"
                style={{ flex: 1, border: '1px solid var(--border-color)' }}
              >
                Voltar
              </button>
              <button
                onClick={showConfirmDelete ? handleDelete : handleRevert}
                className="btn-primary"
                style={{ flex: 1, backgroundColor: showConfirmDelete ? 'var(--error)' : '#f59e0b', border: '1px solid rgba(0,0,0,0.1)' }}
              >
                Confirmar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BillingDialog;
