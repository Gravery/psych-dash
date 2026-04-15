import React, { useState, useEffect } from 'react';
import { Plus, Search, Phone, Mail, Users, ArrowRight, Trash2, UserX, UserCheck } from 'lucide-react';
import { querySQL, execSQL } from '../../db/db';

interface Patient {
  id: string;
  name: string;
  phone: string;
  email: string;
  session_value: number;
  status: 'active' | 'inactive';
  cpf?: string;
  birth_date?: string;
  address?: string;
  created_at: string;
}

interface PatientsListProps {
  onSelectPatient: (id: string) => void;
}

const PatientsList: React.FC<PatientsListProps> = ({ onSelectPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<{ show: boolean, patient?: Patient }>({ show: false });
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  const [newPatient, setNewPatient] = useState({
    name: '',
    phone: '',
    email: '',
    session_value: '',
    cpf: '',
    birth_date: '',
    address: ''
  });

  const fetchPatients = async () => {
    try {
      const result: any = await querySQL('SELECT * FROM patients WHERE deleted_at IS NULL ORDER BY name ASC');
      setPatients(result || []);
    } catch (err) {
      console.error('Error fetching patients:', err);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    try {
      await execSQL(
        'INSERT INTO patients (id, name, phone, email, session_value, cpf, birth_date, address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, newPatient.name, newPatient.phone.replace(/\D/g, ''), newPatient.email, parseFloat(newPatient.session_value) || 0, newPatient.cpf.replace(/\D/g, ''), newPatient.birth_date, newPatient.address, 'active']
      );
      setShowAddModal(false);
      setNewPatient({ name: '', phone: '', email: '', session_value: '', cpf: '', birth_date: '', address: '' });
      fetchPatients();
    } catch (err) {
      console.error('Error adding patient:', err);
    }
  };

  const formatCPF = (v: string) => v.replace(/\D/g, '').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2').slice(0, 14);
  const formatPhone = (v: string) => v.replace(/\D/g, '').replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2').slice(0, 15);

  const toggleStatus = async (patient: Patient) => {
    const newStatus = patient.status === 'active' ? 'inactive' : 'active';
    try {
      await execSQL('UPDATE patients SET status = ? WHERE id = ?', [newStatus, patient.id]);
      fetchPatients();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleDeletePatient = async () => {
    if (showDeleteModal.patient && deleteConfirmName === showDeleteModal.patient.name) {
      try {
        await execSQL('UPDATE patients SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [showDeleteModal.patient.id]);
        setShowDeleteModal({ show: false });
        setDeleteConfirmName('');
        fetchPatients();
      } catch (err) {
        console.error('Error deleting patient:', err);
      }
    }
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Meus Pacientes</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Gerencie seus pacientes, prontuários e agendamentos.</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setShowAddModal(true)}>
          <Plus size={20} /> Novo Paciente
        </button>
      </header>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div className="card glass" style={{ flex: 1, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Search color="var(--text-secondary)" size={20} />
          <input
            type="text" placeholder="Buscar por nome ou email..."
            style={{ flex: 1, border: 'none', background: 'transparent' }}
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
          style={{ width: '180px', padding: '12px' }}
        >
          <option value="active">Apenas Ativos</option>
          <option value="inactive">Inativos</option>
          <option value="all">Todos</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        {filteredPatients.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px' }}>
            <Users size={48} color="var(--text-secondary)" style={{ marginBottom: '16px', opacity: 0.5 }} />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum paciente encontrado com os filtros atuais.</p>
          </div>
        ) : (
          filteredPatients.map(patient => (
            <div key={patient.id} className="card glass" style={{
              position: 'relative',
              borderLeft: `4px solid ${patient.status === 'active' ? 'var(--accent-primary)' : 'var(--text-secondary)'}`,
              opacity: patient.status === 'active' ? 1 : 0.7
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>{patient.name}</h3>
                  {patient.status === 'inactive' && (
                    <span style={{ fontSize: '10px', backgroundColor: 'var(--border-color)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>Inativo</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => toggleStatus(patient)} title={patient.status === 'active' ? 'Inativar' : 'Ativar'}>
                    {patient.status === 'active' ? <UserX size={18} color="var(--text-secondary)" /> : <UserCheck size={18} color="var(--success)" />}
                  </button>
                  <button onClick={() => setShowDeleteModal({ show: true, patient })} title="Excluir Definitivamente">
                    <Trash2 size={18} color="var(--error)" />
                  </button>
                </div>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Phone size={14} /> {patient.phone || '--'}</p>
                <p style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Mail size={14} /> {patient.email || '--'}</p>
                {patient.cpf && <p style={{ fontSize: '12px' }}>CPF: {patient.cpf}</p>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <p style={{ fontWeight: '600', color: patient.status === 'active' ? 'var(--success)' : 'var(--text-secondary)' }}>
                  R$ {patient.session_value.toFixed(2)}/sessão
                </p>
                <button onClick={() => onSelectPatient(patient.id)} style={{ color: 'var(--accent-primary)', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Acessar <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="card glass" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '24px' }}>Cadastrar Novo Paciente</h2>
            <form onSubmit={handleAddPatient}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Nome Completo *</label>
                <input type="text" value={newPatient.name} onChange={e => setNewPatient({ ...newPatient, name: e.target.value })} style={{ width: '100%' }} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>CPF</label>
                  <input type="text" value={newPatient.cpf} onChange={e => setNewPatient({ ...newPatient, cpf: formatCPF(e.target.value) })} style={{ width: '100%' }} placeholder="000.000.000-00" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>Data Nasc.</label>
                  <input type="date" value={newPatient.birth_date} onChange={e => setNewPatient({ ...newPatient, birth_date: e.target.value })} style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>Telefone</label>
                  <input type="text" value={newPatient.phone} onChange={e => setNewPatient({ ...newPatient, phone: formatPhone(e.target.value) })} style={{ width: '100%' }} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px' }}>Valor Padrão Sessão</label>
                  <input type="text" value={newPatient.session_value} onChange={e => setNewPatient({ ...newPatient, session_value: e.target.value })} style={{ width: '100%' }} placeholder="0.00" />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>E-mail</label>
                <input type="email" value={newPatient.email} onChange={e => setNewPatient({ ...newPatient, email: e.target.value })} style={{ width: '100%' }} />
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Endereço Residencial</label>
                <textarea value={newPatient.address} onChange={e => setNewPatient({ ...newPatient, address: e.target.value })} style={{ width: '100%', minHeight: '80px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost">Cancelar</button>
                <button type="submit" className="btn-primary">Criar Cadastro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal.show && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass" style={{ width: '90%', maxWidth: '400px', textAlign: 'center' }}>
            <Trash2 size={48} color="var(--error)" style={{ marginBottom: '16px' }} />
            <h2 style={{ marginBottom: '8px' }}>Excluir Paciente?</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
              Esta ação é irreversível. Para confirmar, digite o nome completo do paciente abaixo:<br />
              <strong>{showDeleteModal.patient?.name}</strong>
            </p>
            <input
              type="text" value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)}
              placeholder="Digite o nome aqui..." style={{ width: '100%', marginBottom: '24px', textAlign: 'center' }}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setShowDeleteModal({ show: false }); setDeleteConfirmName(''); }}
                className="btn-ghost" style={{ flex: 1 }}
              >Cancelar</button>
              <button
                onClick={handleDeletePatient}
                className="btn-primary"
                style={{ flex: 1, backgroundColor: deleteConfirmName === showDeleteModal.patient?.name ? 'var(--error)' : 'var(--border-color)', cursor: deleteConfirmName === showDeleteModal.patient?.name ? 'pointer' : 'not-allowed' }}
                disabled={deleteConfirmName !== showDeleteModal.patient?.name}
              >Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsList;
