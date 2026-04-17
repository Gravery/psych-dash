import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, FileText, Plus, Clock, History, File, Download, Upload, DollarSign, Calendar as CalendarIcon, Repeat, Trash2 } from 'lucide-react';
import { querySQL, execSQL } from '../../db/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SessionDialog from '../Calendar/SessionDialog';

interface Document {
  id: string;
  name: string;
  path: string;
  category: string;
  created_at: string;
}

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string;
  session_value: number;
  cpf?: string;
  birth_date?: string;
  address?: string;
  anamnesis?: string;
  status: string;
  created_at: string;
}

interface PatientDetailProps {
  id: string | null;
  onBack: () => void;
}

const PatientDetail: React.FC<PatientDetailProps> = ({ id, onBack }) => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [newRecord, setNewRecord] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'sessions' | 'data' | 'anamnesis' | 'docs'>('records');
  const [isSaving, setIsSaving] = useState(false);
  const [anamnesis, setAnamnesis] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [newSession, setNewSession] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    payment_value: '',
    notes: '',
    recurrence: 'none'
  });
  const [editForm, setEditForm] = useState({
    name: '',
    cpf: '',
    phone: '',
    email: '',
    address: ''
  });

  const fetchData = async () => {
    if (!id) return;
    try {
      const pResult: any = await querySQL('SELECT * FROM patients WHERE id = ?', [id]);
      if (pResult && pResult[0]) {
        setPatient(pResult[0]);
        setAnamnesis(pResult[0].anamnesis || '');
        setEditForm({
          name: pResult[0].name || '',
          cpf: formatCPF(pResult[0].cpf || ''),
          phone: formatPhone(pResult[0].phone || ''),
          email: pResult[0].email || '',
          address: pResult[0].address || ''
        });
      }

      const dResult: any = await querySQL('SELECT * FROM documents WHERE patient_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', [id]);
      setDocuments(dResult || []);

      const rResult: any = await querySQL('SELECT * FROM medical_records WHERE patient_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', [id]);
      setMedicalRecords(rResult || []);

      const sResult: any = await querySQL('SELECT * FROM sessions WHERE patient_id = ? AND deleted_at IS NULL ORDER BY start_time DESC', [id]);
      setSessions(sResult || []);

    } catch (err) {
      console.error('Error fetching patient detail:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.trim() || !id) return;

    try {
      await execSQL(
        'INSERT INTO medical_records (id, patient_id, content) VALUES (?, ?, ?)',
        [crypto.randomUUID(), id, newRecord]
      );
      setNewRecord('');
      fetchData();
    } catch (err) {
      console.error('Error adding medical record:', err);
    }
  };

  const handleExportPDF = () => {
    if (!patient) return;
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`Prontuário - ${patient.name}`, 20, 20);
    doc.setFontSize(12);
    doc.text(`CPF: ${patient.cpf || '---'} | Tel: ${patient.phone || '---'}`, 20, 30);
    doc.text(`Email: ${patient.email || '---'}`, 20, 37);
    doc.line(20, 42, 190, 42);

    let y = 52;
    medicalRecords.forEach(record => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(new Date(record.created_at).toLocaleDateString('pt-BR'), 20, y);
      doc.setTextColor(0);
      doc.setFontSize(11);
      const splitText = doc.splitTextToSize(record.content, 170);
      doc.text(splitText, 20, y + 7);
      y += (splitText.length * 6) + 15;
    });

    doc.save(`${patient.name.replace(/\s+/g, '_')}_prontuario.pdf`);
  };

  const toggleSessionPayment = async (sessionId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    try {
      await execSQL('UPDATE sessions SET payment_status = ? WHERE id = ?', [newStatus, sessionId]);
      fetchData();
    } catch (err) {
      console.error('Error toggling payment status:', err);
    }
  };

  const handleUpdatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsSaving(true);
    try {
      await execSQL(
        'UPDATE patients SET name = ?, cpf = ?, phone = ?, email = ?, address = ?, anamnesis = ? WHERE id = ?',
        [editForm.name, editForm.cpf.replace(/\D/g, ''), editForm.phone.replace(/\D/g, ''), editForm.email, editForm.address, anamnesis, id]
      );
      await fetchData();
      setToast({ message: 'Dados atualizados com sucesso!', type: 'success' });
    } catch (err) {
      console.error('Error updating patient:', err);
      setToast({ message: 'Erro ao salvar dados.', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (category: string = 'general') => {
    if (!id) return;
    const res = await (window as any).electronAPI.file.upload(id, category);
    if (res.success) {
      fetchData();
      setToast({ message: 'Documento anexado!', type: 'success' });
    }
  };

  const handleFileOpen = async (path: string) => {
    await (window as any).electronAPI.file.open(path);
  };

  const handleFileDelete = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o arquivo "${name}"?`)) return;
    
    const api = (window as any).electronAPI;
    if (!api?.file?.delete) {
      console.error('API de exclusão não encontrada. Reinicie o aplicativo.');
      setToast({ message: 'Erro técnico: Reinicie o app para aplicar a atualização.', type: 'error' });
      return;
    }

    const res = await api.file.delete(id);
    if (res.success) {
      fetchData();
      setToast({ message: 'Arquivo excluído!', type: 'success' });
    } else {
      setToast({ message: 'Erro ao excluir arquivo.', type: 'error' });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!id) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      setToast({ message: 'Para segurança, utilize o botão "Anexar" para selecionar arquivos.', type: 'error' });
    }
  };

  const formatCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14);
  const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15);

  const handleAddSessionFromDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    const startDateTime = `${newSession.date}T${newSession.time}:00`;
    const value = parseFloat(newSession.payment_value) || patient?.session_value || 0;
    const recurringId = newSession.recurrence !== 'none' ? crypto.randomUUID() : null;

    try {
      await execSQL(
        'INSERT INTO sessions (id, patient_id, start_time, status, payment_value, recurring_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [crypto.randomUUID(), id, new Date(startDateTime).toISOString(), 'scheduled', value, recurringId, newSession.notes]
      );

      if (newSession.recurrence !== 'none') {
        let nextDate = new Date(startDateTime);
        if (newSession.recurrence === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
        else if (newSession.recurrence === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
        else if (newSession.recurrence === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);

        await execSQL(
          'INSERT INTO sessions (id, patient_id, start_time, status, payment_value, recurring_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [crypto.randomUUID(), id, nextDate.toISOString(), 'scheduled', value, recurringId, newSession.notes]
        );
      }

      setShowAddModal(false);
      fetchData();
    } catch (err) {
      console.error('Error adding session:', err);
    }
  };

  const handleGenerateBillingPDF = () => {
    if (!patient) return;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const monthlySessions = sessions.filter(s => s.start_time >= firstDay && s.start_time <= lastDay && s.status === 'completed');

    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(14, 165, 233); // Primary accent
    doc.text("RECIBO DE PRESTAÇÃO DE SERVIÇOS", 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(50);
    doc.text(`Paciente: ${patient.name}`, 20, 40);
    doc.text(`Mês de Referência: ${now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`, 20, 48);

    const tableData = monthlySessions.map(s => [
      new Date(s.start_time).toLocaleDateString('pt-BR'),
      "Sessão de Psicoterapia",
      `R$ ${(s.payment_value || 0).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 60,
      head: [['Data', 'Descrição', 'Valor']],
      body: tableData,
      theme: 'striped',
      headStyles: { textColor: [255, 255, 255], fontStyle: 'bold', fillColor: [14, 165, 233] },
      styles: { fontSize: 10 }
    });

    const total = monthlySessions.reduce((acc, s) => acc + (s.payment_value || 0), 0);
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text(`TOTAL DO MÊS: R$ ${total.toFixed(2)}`, 140, finalY);

    doc.save(`Recibo_${patient.name.replace(/\s+/g, '_')}_${now.getMonth() + 1}.pdf`);
  };

  if (!patient) return null;

  const generalDocs = documents.filter(d => !d.category || d.category === 'general');
  const anamnesisDocs = documents.filter(d => d.category === 'anamnesis');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>
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
        <ArrowLeft size={18} /> Voltar para lista
      </button>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '8px' }}>{patient.name}</h1>
          <div style={{ display: 'flex', gap: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
            <span>CPF: {patient.cpf || 'Não informado'}</span>
            <span>Tel: {patient.phone}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={handleGenerateBillingPDF} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)' }}>
            <Download size={18} /> Gerar Cobrança Mês
          </button>
          <button onClick={handleExportPDF} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)' }}>
            <FileText size={18} /> Exportar Prontuário PDF
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} /> Novo Agendamento
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '40px', marginBottom: '32px' }}>
        <button onClick={() => setActiveTab('records')} style={{ paddingBottom: '12px', borderBottom: `2px solid ${activeTab === 'records' ? 'var(--accent-primary)' : 'transparent'}`, color: activeTab === 'records' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: '600' }}>
          Prontuário Clínico
        </button>
        <button onClick={() => setActiveTab('anamnesis')} style={{ paddingBottom: '12px', borderBottom: `2px solid ${activeTab === 'anamnesis' ? 'var(--accent-primary)' : 'transparent'}`, color: activeTab === 'anamnesis' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: '600' }}>
          Anamnese
        </button>
        <button onClick={() => setActiveTab('sessions')} style={{ paddingBottom: '12px', borderBottom: `2px solid ${activeTab === 'sessions' ? 'var(--accent-primary)' : 'transparent'}`, color: activeTab === 'sessions' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: '600' }}>
          Histórico de Sessões
        </button>
        <button onClick={() => setActiveTab('docs')} style={{ paddingBottom: '12px', borderBottom: `2px solid ${activeTab === 'docs' ? 'var(--accent-primary)' : 'transparent'}`, color: activeTab === 'docs' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: '600' }}>
          Documentos Anexos
        </button>
        <button onClick={() => setActiveTab('data')} style={{ paddingBottom: '12px', borderBottom: `2px solid ${activeTab === 'data' ? 'var(--accent-primary)' : 'transparent'}`, color: activeTab === 'data' ? 'var(--accent-primary)' : 'var(--text-secondary)', fontWeight: '600' }}>
          Dados Cadastrais
        </button>
      </div>

      {activeTab === 'records' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '32px' }}>
          <section>
            <div className="card glass" style={{ marginBottom: '32px' }}>
              <h3 style={{ marginBottom: '16px', fontWeight: 'bold' }}>Adicionar Evolução Clínica</h3>
              <form onSubmit={handleAddRecord}>
                <textarea
                  value={newRecord}
                  onChange={(e) => setNewRecord(e.target.value)}
                  placeholder="Escreva as anotações profundas da última sessão..."
                  style={{ width: '100%', minHeight: '150px', marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Save size={18} /> Salvar no Prontuário
                  </button>
                </div>
              </form>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {[
                ...medicalRecords.map(r => ({ ...r, type: 'manual' })),
                ...sessions.filter(s => s.notes && s.notes.trim()).map(s => ({ ...s, type: 'session', content: s.notes, created_at: s.start_time }))
              ].sort((a, b) => b.created_at.localeCompare(a.created_at)).map(record => (
                <div key={record.id} className="card glass" style={{ borderLeft: `4px solid ${record.type === 'session' ? 'var(--accent-primary)' : 'var(--success)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <span style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {record.type === 'session' ? <Clock size={16} color="#38bdf8" strokeWidth={2.5} style={{ stroke: '#38bdf8' }} /> : <FileText size={16} color="#38bdf8" strokeWidth={2.5} style={{ stroke: '#38bdf8' }} />}
                      {record.type === 'session' ? 'Evolução de Sessão' : 'Anotação Manual'}
                    </span>
                    <span>{new Date(record.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{record.content}</p>
                </div>
              ))}
            </div>
          </section>

          <aside>
            <div className="card glass" style={{ marginBottom: '20px' }}>
              <h4 style={{ fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>ANOTAÇÕES RÁPIDAS</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Anotações rápidas da última sessão aparecerão aqui para fácil consulta no início da próxima.
              </p>
            </div>
          </aside>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="card glass">
          <h3 style={{ marginBottom: '24px', fontWeight: 'bold' }}>Histórico de Agendamentos e Pagamentos</h3>
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Data/Hora</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Status Sessão</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Valor (R$)</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Pagamento</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const isCompleted = s.status === 'completed';
                  const isCancelled = s.status === 'cancelled' || s.status === 'missed';
                  const isPaid = s.payment_status === 'paid';

                  let statusColor = 'var(--accent-primary)';
                  let statusText = 'Agendada';
                  if (isCompleted) { statusColor = 'var(--success)'; statusText = 'Realizada'; }
                  else if (isCancelled) {
                    statusColor = 'var(--error)';
                    statusText = s.status === 'cancelled' ? 'Cancelada' : 'Falta';
                  }

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: '500' }}>{new Date(s.start_time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px', borderRadius: '6px', fontSize: '12px',
                          backgroundColor: `${statusColor}1A`, color: statusColor,
                          fontWeight: '600'
                        }}>
                          {statusText}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: '600' }}>R$ {(s.payment_value || 0).toFixed(2)}</td>
                      <td style={{ padding: '12px' }}>
                        <button
                          onClick={() => toggleSessionPayment(s.id, s.payment_status)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', borderRadius: '6px', fontSize: '12px',
                            backgroundColor: isPaid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: isPaid ? 'var(--success)' : 'var(--error)'
                          }}
                        >
                          <DollarSign size={14} />
                          {isPaid ? 'Pago' : 'Pendente'}
                        </button>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button onClick={() => setSelectedSession(s)} className="btn-ghost" style={{ padding: '6px' }}><History size={16} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'data' && (
        <div className="card glass" style={{ maxWidth: '700px' }}>
          <h3 style={{ marginBottom: '24px', fontWeight: 'bold' }}>Editar Dados Cadastrais</h3>
          <form onSubmit={handleUpdatePatient}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px' }}>Nome Completo</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  style={{ width: '100%' }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px' }}>CPF</label>
                <input
                  type="text"
                  value={editForm.cpf}
                  onChange={e => setEditForm({ ...editForm, cpf: formatCPF(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px' }}>Telefone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: formatPhone(e.target.value) })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px' }}>E-mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '6px' }}>Endereço Residencial</label>
              <textarea
                value={editForm.address}
                onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                style={{ width: '100%', minHeight: '80px' }}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={18} /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'anamnesis' && (
        <div className="card glass">
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: 'bold' }}>Anamnese Psicológica</h3>
            <button onClick={handleUpdatePatient} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Save size={18} /> Salvar Anamnese
            </button>
          </header>
          <textarea
            value={anamnesis}
            onChange={(e) => setAnamnesis(e.target.value)}
            placeholder="História de vida, queixa principal, antecedentes familiares..."
            style={{ width: '100%', minHeight: '300px', lineHeight: '1.6', marginBottom: '24px' }}
          />

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h4 style={{ fontWeight: 'bold', fontSize: '15px' }}>Anexos da Anamnese</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Testes, desenhos, fotos ou relatórios iniciais específicos do paciente.</p>
              </div>
              <button onClick={() => handleFileUpload('anamnesis')} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', border: '1px solid var(--border-color)' }}>
                <Upload size={14} /> Anexar Arquivo
              </button>
            </header>
            
            {anamnesisDocs.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {anamnesisDocs.map(doc => (
                  <div 
                    key={doc.id} 
                    onClick={() => handleFileOpen(doc.path)}
                    className="card" 
                    style={{ 
                      padding: '12px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px', 
                      backgroundColor: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(14, 165, 233, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  >
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', flexShrink: 0 }}>
                      <File size={20} />
                    </div>
                    <div style={{ overflow: 'hidden', flex: 1 }}>
                      <p style={{ fontSize: '12px', fontWeight: '600', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleFileDelete(doc.id, doc.name); }} 
                      style={{ 
                        padding: '6px', 
                        color: 'var(--error)', 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Nenhum arquivo anexado à anamnese ainda.</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'docs' && (
        <div
          className={`card glass ${isDragging ? 'dragging' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          style={{
            border: isDragging ? '2px dashed var(--accent-primary)' : '1px solid var(--border-color)',
            transition: 'all 0.2s ease'
          }}
        >
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <div>
              <h3 style={{ fontWeight: 'bold' }}>Documentos e Anexos</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Contratos, exames e avaliações externas.</p>
            </div>
            <button onClick={() => handleFileUpload('general')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={18} /> Anexar Documento
            </button>
          </header>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
            {generalDocs.map(doc => (
              <div 
                key={doc.id} 
                onClick={() => handleFileOpen(doc.path)}
                className="card" 
                style={{ 
                  padding: '16px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '12px', 
                  alignItems: 'center', 
                  textAlign: 'center', 
                  backgroundColor: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(14, 165, 233, 0.05)';
                  e.currentTarget.style.borderColor = 'var(--accent-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); handleFileDelete(doc.id, doc.name); }}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    padding: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--error)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2
                  }}
                  title="Excluir"
                >
                  <Trash2 size={14} />
                </button>
                <div style={{ width: '50px', height: '50px', borderRadius: '12px', backgroundColor: 'rgba(14, 165, 233, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)' }}>
                  <File size={24} />
                </div>
                <div style={{ flex: 1, width: '100%' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{doc.name}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{new Date(doc.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: '20px' }}>
          <div className="card glass" style={{ width: '100%', maxWidth: '450px' }}>
            <h2 style={{ marginBottom: '24px' }}>Novo Agendamento</h2>
            <form onSubmit={handleAddSessionFromDetail}>
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
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Valor (R$)</label>
                  <input type="text" value={newSession.payment_value} onChange={e => setNewSession({ ...newSession, payment_value: e.target.value })} style={{ width: '100%' }} placeholder={patient.session_value.toString()} />
                </div>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Observações Rápidas</label>
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

export default PatientDetail;
