import { describe, it, expect } from 'vitest';

interface Session {
  id: string;
  payment_value: number;
  payment_status: 'paid' | 'pending';
  status: 'scheduled' | 'completed' | 'cancelled' | 'missed';
}

// Simulando a lógica de cálculo financeiro do front-end
const calculateFinancialSummary = (data: Session[]) => {
  const total = data
    .filter((s) => s.status !== 'cancelled')
    .reduce((acc, s) => acc + (s.payment_value || 0), 0);

  const paid = data
    .filter((s) => s.status !== 'cancelled' && s.payment_status === 'paid')
    .reduce((acc, s) => acc + (s.payment_value || 0), 0);

  const pending = total - paid;

  return { total, paid, pending };
};

describe('Lógica de Cálculo de Ganhos Estimados', () => {
  it('deve calcular corretamente o total de sessões ativas (agendadas/realizadas/faltas) e ignorar as canceladas', () => {
    const sessions: Session[] = [
      { id: '1', payment_value: 150, payment_status: 'paid', status: 'completed' },     // Pago e realizado
      { id: '2', payment_value: 150, payment_status: 'pending', status: 'scheduled' }, // Pendente e agendado
      { id: '3', payment_value: 150, payment_status: 'pending', status: 'cancelled' }, // Cancelado (deve ignorar)
      { id: '4', payment_value: 150, payment_status: 'pending', status: 'missed' },    // Falta (deve cobrar conforme regra)
    ];

    const result = calculateFinancialSummary(sessions);

    // Total esperado: 150 (sessão 1) + 150 (sessão 2) + 150 (sessão 4) = 450 (ignora a 3)
    expect(result.total).toBe(450);
    // Total pago: 150 (sessão 1)
    expect(result.paid).toBe(150);
    // Pendente: 450 - 150 = 300
    expect(result.pending).toBe(300);
  });

  it('deve retornar 0 se todas as sessões forem canceladas', () => {
    const sessions: Session[] = [
      { id: '1', payment_value: 100, payment_status: 'pending', status: 'cancelled' },
      { id: '2', payment_value: 150, payment_status: 'paid', status: 'cancelled' },
    ];

    const result = calculateFinancialSummary(sessions);

    expect(result.total).toBe(0);
    expect(result.paid).toBe(0);
    expect(result.pending).toBe(0);
  });

  it('deve processar lista vazia sem dar erro', () => {
    const result = calculateFinancialSummary([]);
    expect(result.total).toBe(0);
    expect(result.paid).toBe(0);
    expect(result.pending).toBe(0);
  });
});
