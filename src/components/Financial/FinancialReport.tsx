import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { querySQL } from '../../db/db';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const FinancialReport: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [reportData, setReportData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, paid: 0, pending: 0 });
  const [chartData, setChartData] = useState<any[]>([]);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const fetchReportData = async () => {
    const startOfMonth = new Date(selectedYear, selectedMonth, 1).toISOString();
    const endOfMonth = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString();

    try {
      const [result, historyResult]: any = await Promise.all([
        querySQL(
          `SELECT s.*, p.name as patient_name 
           FROM sessions s 
           JOIN patients p ON s.patient_id = p.id 
           WHERE s.start_time BETWEEN ? AND ? 
           AND s.deleted_at IS NULL
           ORDER BY s.start_time ASC`,
          [startOfMonth, endOfMonth]
        ),
        querySQL(
          `SELECT 
             strftime('%m', s.start_time) as month_num,
             strftime('%Y', s.start_time) as year_val,
             SUM(CASE WHEN s.status != 'cancelled' THEN s.payment_value ELSE 0 END) as total_val,
             SUM(CASE WHEN s.status != 'cancelled' AND s.payment_status = 'paid' THEN s.payment_value ELSE 0 END) as paid_val
           FROM sessions s
           WHERE s.deleted_at IS NULL 
           AND (s.type IS NULL OR s.type = 'session')
           GROUP BY year_val, month_num
           ORDER BY year_val ASC, month_num ASC
           LIMIT 6`
        )
      ]);

      const data = result || [];
      setReportData(data);

      const total = data.filter((s: any) => s.status !== 'cancelled').reduce((acc: number, s: any) => acc + (s.payment_value || 0), 0);
      const paid = data.filter((s: any) => s.status !== 'cancelled' && s.payment_status === 'paid').reduce((acc: number, s: any) => acc + (s.payment_value || 0), 0);
      const pending = total - paid;

      setSummary({ total, paid, pending });

      const formattedChart = (historyResult || []).map((h: any) => {
        const monthName = months[parseInt(h.month_num) - 1]?.slice(0, 3) || '';
        return {
          name: `${monthName}/${h.year_val.slice(2)}`,
          'Faturamento': h.total_val || 0,
          'Recebido': h.paid_val || 0,
          'Pendente': (h.total_val || 0) - (h.paid_val || 0)
        };
      });
      setChartData(formattedChart);

    } catch (err) {
      console.error('Error fetching report data:', err);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [selectedMonth, selectedYear]);

  const getStatusLabel = (status: string) => {
    if (status === 'completed') return 'Realizada';
    if (status === 'cancelled') return 'Cancelada';
    if (status === 'missed') return 'Falta';
    return 'Agendada';
  };

  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: 'var(--success)', backgroundColor: 'rgba(16, 185, 129, 0.1)' };
      case 'cancelled':
        return { color: 'var(--error)', backgroundColor: 'rgba(239, 68, 68, 0.1)' };
      case 'missed':
        return { color: 'var(--warning)', backgroundColor: 'rgba(245, 158, 11, 0.1)' };
      default:
        return { color: 'var(--accent-primary)', backgroundColor: 'rgba(14, 165, 233, 0.1)' };
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF() as any;
    doc.setFontSize(20);
    doc.text(`Relatório Financeiro Mensal - ${months[selectedMonth]} / ${selectedYear}`, 20, 20);

    doc.setFontSize(12);
    doc.text(`Faturamento Esperado: R$ ${summary.total.toFixed(2)}`, 20, 30);
    doc.text(`Total Recebido: R$ ${summary.paid.toFixed(2)}`, 20, 37);
    doc.text(`Pendente: R$ ${summary.pending.toFixed(2)}`, 20, 44);

    const tableData = reportData.map(s => [
      new Date(s.start_time).toLocaleDateString('pt-BR'),
      s.patient_name,
      getStatusLabel(s.status),
      s.payment_status === 'paid' ? 'Pago' : 'Pendente',
      `R$ ${s.payment_value.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 55,
      head: [['Data', 'Paciente', 'Status Sessão', 'Status Pagto', 'Valor']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [14, 165, 233] }
    });

    doc.save(`Relatorio_Financeiro_${months[selectedMonth]}_${selectedYear}.pdf`);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>Relatórios Financeiros</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Acompanhe o faturamento mensal e pagamentos pendentes.</p>
        </div>
        <button onClick={handleExportPDF} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={20} /> Exportar Relatório PDF
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '40px' }}>
        <div className="card glass" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>TOTAL ESPERADO</p>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {summary.total.toFixed(2)}</h3>
        </div>
        <div className="card glass" style={{ borderLeft: '4px solid var(--success)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>TOTAL RECEBIDO</p>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {summary.paid.toFixed(2)}</h3>
        </div>
        <div className="card glass" style={{ borderLeft: '4px solid var(--error)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>PENDENTE</p>
          <h3 style={{ fontSize: '24px', fontWeight: 'bold' }}>R$ {summary.pending.toFixed(2)}</h3>
        </div>
      </div>

      {/* Histórico Financeiro - Gráfico */}
      {chartData.length > 0 && (
        <section className="card glass" style={{ marginBottom: '40px', padding: '24px' }}>
          <h3 style={{ fontWeight: 'bold', marginBottom: '20px' }}>Evolução de Ganhos (Últimos 6 meses)</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRecebido" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$ ${v}`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderColor: 'var(--border-color)', 
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }} 
                  formatter={(value: any) => [`R$ ${parseFloat(value).toFixed(2)}`, '']}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area type="monotone" dataKey="Faturamento" stroke="var(--accent-primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFaturamento)" />
                <Area type="monotone" dataKey="Recebido" stroke="var(--success)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRecebido)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="card glass">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h3 style={{ fontWeight: 'bold' }}>Sessões do Período</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} style={{ padding: '8px' }}>
              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} style={{ padding: '8px' }}>
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Data</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Paciente</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Status Sessão</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Pagamento</th>
                <th style={{ padding: '12px', color: 'var(--text-secondary)' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map(s => {
                const statusStyle = getStatusStyles(s.status);
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '14px' }}>
                    <td style={{ padding: '12px' }}>{new Date(s.start_time).toLocaleDateString('pt-BR')}</td>
                    <td style={{ padding: '12px', fontWeight: '600' }}>{s.patient_name}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold', ...statusStyle }}>
                        {getStatusLabel(s.status)}
                      </span>
                    </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      color: s.payment_status === 'paid' ? 'var(--success)' : 'var(--error)',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}>
                      {s.payment_status === 'paid' ? 'PAGO' : 'PENDENTE'}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>R$ {(s.payment_value || 0).toFixed(2)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default FinancialReport;
