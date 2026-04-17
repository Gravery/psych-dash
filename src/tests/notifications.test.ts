import { describe, it, expect } from 'vitest';

// Função simulada com a mesma lógica do hook para teste unitário
const calculateDiff = (startTime: string, now: Date) => {
  const sessionTime = new Date(startTime);
  return (sessionTime.getTime() - now.getTime()) / 60000;
};

const shouldTrigger = (diffInMinutes: number, leadTime: number) => {
  return diffInMinutes > -1 && diffInMinutes <= (leadTime + 0.5);
};

describe('Lógica de Notificações', () => {
  it('deve calcular a diferença de tempo corretamente em minutos', () => {
    const now = new Date('2026-04-16T10:00:00Z');
    const startTime = '2026-04-16T10:05:00Z';
    expect(calculateDiff(startTime, now)).toBe(5);
  });

  it('deve disparar se estiver dentro do lead time (5 min)', () => {
    const leadTime = 5;
    
    // Exatamente 5 min antes
    expect(shouldTrigger(5, leadTime)).toBe(true);
    
    // 4 min antes
    expect(shouldTrigger(4, leadTime)).toBe(true);
    
    // 5.4 min antes (dentro da margem de 0.5)
    expect(shouldTrigger(5.4, leadTime)).toBe(true);
    
    // 10 min antes (fora)
    expect(shouldTrigger(10, leadTime)).toBe(false);
    
    // Já começou há 30 segundos (dentro da margem de -1)
    expect(shouldTrigger(-0.5, leadTime)).toBe(true);
    
    // Já começou há 2 minutos (fora da margem de -1)
    expect(shouldTrigger(-2, leadTime)).toBe(false);
  });

  it('deve disparar se estiver dentro do lead time (10 min)', () => {
    const leadTime = 10;
    expect(shouldTrigger(10, leadTime)).toBe(true);
    expect(shouldTrigger(8, leadTime)).toBe(true);
    expect(shouldTrigger(11, leadTime)).toBe(false);
  });
});
