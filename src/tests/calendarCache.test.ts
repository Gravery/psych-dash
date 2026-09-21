import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCalendarCacheKey,
  getCalendarCache,
  setCalendarCache,
  hasCalendarCache,
  isPeriodVisited,
  invalidateCalendarCache,
  getVisitedPeriods,
  clearAllCalendarCache,
} from '../utils/calendarCache';

describe('Sistema de Cache de Meses e Períodos Visitados do Calendário', () => {
  beforeEach(() => {
    clearAllCalendarCache();
  });

  it('deve gerar chave de cache correta para modo mensal', () => {
    const date = new Date(2026, 8, 15); // Setembro de 2026 (mês 8 em 0-index)
    const key = getCalendarCacheKey('month', date);
    expect(key).toBe('month_2026-09');
  });

  it('deve gerar chave de cache correta para modo semanal correspondente ao início da semana', () => {
    // 2026-09-23 é quarta-feira; o domingo anterior é 2026-09-20
    const date = new Date(2026, 8, 23);
    const key = getCalendarCacheKey('week', date);
    expect(key).toBe('week_2026-09-20');
  });

  it('deve salvar e recuperar dados do cache para um mês visitado', () => {
    const key = 'month_2026-09';
    const mockSessions = [{ id: 's1', patient_name: 'Paciente Teste' }];
    const mockBillings = [{ id: 'b1', amount: 150 }];
    const mockPatients = [{ id: 'p1', name: 'Paciente Teste' }];

    expect(hasCalendarCache(key)).toBe(false);
    expect(isPeriodVisited(key)).toBe(false);

    setCalendarCache(key, {
      sessions: mockSessions,
      billings: mockBillings,
      patients: mockPatients,
    });

    expect(hasCalendarCache(key)).toBe(true);
    expect(isPeriodVisited(key)).toBe(true);

    const cached = getCalendarCache(key);
    expect(cached).toBeDefined();
    expect(cached?.sessions).toEqual(mockSessions);
    expect(cached?.billings).toEqual(mockBillings);
    expect(cached?.patients).toEqual(mockPatients);
    expect(cached?.fetchedAt).toBeGreaterThan(0);
  });

  it('deve registrar múltiplos meses visitados', () => {
    setCalendarCache('month_2026-08', { sessions: [], billings: [] });
    setCalendarCache('month_2026-09', { sessions: [], billings: [] });
    setCalendarCache('month_2026-10', { sessions: [], billings: [] });

    const visited = getVisitedPeriods();
    expect(visited).toContain('month_2026-08');
    expect(visited).toContain('month_2026-09');
    expect(visited).toContain('month_2026-10');
    expect(visited.length).toBe(3);
  });

  it('deve permitir invalidar um mês específico quando ocorrer alteração de sessão', () => {
    setCalendarCache('month_2026-09', { sessions: [{ id: '1' }], billings: [] });
    setCalendarCache('month_2026-10', { sessions: [{ id: '2' }], billings: [] });

    invalidateCalendarCache('month_2026-09');

    expect(hasCalendarCache('month_2026-09')).toBe(false);
    expect(hasCalendarCache('month_2026-10')).toBe(true);
  });

  it('deve invalidar todos os meses do cache quando solicitado sem parâmetro', () => {
    setCalendarCache('month_2026-08', { sessions: [], billings: [] });
    setCalendarCache('month_2026-09', { sessions: [], billings: [] });

    invalidateCalendarCache();

    expect(hasCalendarCache('month_2026-08')).toBe(false);
    expect(hasCalendarCache('month_2026-09')).toBe(false);
  });
});
