import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchHolidays, clearHolidaysCache, STATE_HOLIDAYS } from '../utils/holidays';
import * as dbModule from '../db/db';

vi.mock('../db/db', () => ({
  querySQL: vi.fn(),
  execSQL: vi.fn(),
}));

describe('Serviço de Feriados (BrasilAPI + Estaduais + Municipais)', () => {
  const mockNationalHolidays = [
    { date: '2026-01-01', name: 'Confraternização Universal', type: 'national' },
    { date: '2026-04-21', name: 'Tiradentes', type: 'national' },
    { date: '2026-05-01', name: 'Dia do Trabalho', type: 'national' },
    { date: '2026-09-07', name: 'Independência do Brasil', type: 'national' },
    { date: '2026-10-12', name: 'Nossa Senhora Aparecida', type: 'national' },
    { date: '2026-11-02', name: 'Finados', type: 'national' },
    { date: '2026-11-15', name: 'Proclamação da República', type: 'national' },
    { date: '2026-11-20', name: 'Dia Nacional de Zumbi e da Consciência Negra', type: 'national' },
    { date: '2026-12-25', name: 'Natal', type: 'national' },
  ];

  beforeEach(() => {
    clearHolidaysCache();
    vi.clearAllMocks();

    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // Default mock para querySQL retornando lista vazia de feriados customizados
    vi.mocked(dbModule.querySQL).mockResolvedValue([]);

    // Mock do fetch global
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNationalHolidays,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve buscar feriados nacionais da BrasilAPI e retornar ordenados', async () => {
    const holidays = await fetchHolidays(2026);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://brasilapi.com.br/api/feriados/v1/2026',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    expect(holidays.length).toBeGreaterThanOrEqual(9);
    const anoNovo = holidays.find(h => h.date === '2026-01-01');
    expect(anoNovo).toBeDefined();
    expect(anoNovo?.name).toBe('Confraternização Universal');
    expect(anoNovo?.type).toBe('national');
  });

  it('deve incluir feriados estaduais correspondentes ao estado configurado (ex: SP)', async () => {
    const holidays = await fetchHolidays(2026, 'SP');

    const revConst = holidays.find(h => h.date === '2026-07-09');
    expect(revConst).toBeDefined();
    expect(revConst?.name).toBe('Revolução Constitucionalista de 1932');
    expect(revConst?.type).toBe('state');
  });

  it('deve incluir feriados estaduais para outros estados (ex: RJ)', async () => {
    const holidays = await fetchHolidays(2026, 'RJ');

    const saoJorge = holidays.find(h => h.date === '2026-04-23');
    expect(saoJorge).toBeDefined();
    expect(saoJorge?.name).toBe('Dia de São Jorge');
    expect(saoJorge?.type).toBe('state');
  });

  it('deve conter definições de feriados estaduais para todas as 27 UFs brasileiras', () => {
    const ufs = [
      'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
      'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
      'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ];

    ufs.forEach(uf => {
      expect(STATE_HOLIDAYS[uf]).toBeDefined();
      expect(STATE_HOLIDAYS[uf].length).toBeGreaterThanOrEqual(1);
    });
  });

  it('deve incluir feriados municipais/locais cadastrados no banco de dados', async () => {
    vi.mocked(dbModule.querySQL).mockResolvedValueOnce([
      { date: '2026-08-15', name: 'Aniversário de Araras / Padroeira', type: 'municipal' },
    ]);

    const holidays = await fetchHolidays(2026, 'SP', 'Araras');

    const ararasHoliday = holidays.find(h => h.date === '2026-08-15');
    expect(ararasHoliday).toBeDefined();
    expect(ararasHoliday?.name).toBe('Aniversário de Araras / Padroeira');
    expect(ararasHoliday?.type).toBe('municipal');
  });

  it('deve usar o cache em memória e não chamar a BrasilAPI repetidamente', async () => {
    await fetchHolidays(2026, 'SP');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    await fetchHolidays(2026, 'SP');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    clearHolidaysCache();
    await fetchHolidays(2026, 'SP');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
