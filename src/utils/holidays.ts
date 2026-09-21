import { querySQL } from '../db/db';

export interface Holiday {
  date: string; // Formato 'YYYY-MM-DD'
  name: string;
  type: 'national' | 'state' | 'municipal';
}

export const STATE_HOLIDAYS: Record<string, Array<{ day: number; month: number; name: string }>> = {
  AC: [
    { day: 23, month: 1, name: 'Dia do Evangélico' },
    { day: 8, month: 3, name: 'Dia da Mulher' },
    { day: 15, month: 6, name: 'Aniversário do Acre' },
    { day: 5, month: 9, name: 'Dia da Amazônia' },
    { day: 17, month: 11, name: 'Tratado de Petrópolis' }
  ],
  AL: [
    { day: 24, month: 6, name: 'São João' },
    { day: 29, month: 6, name: 'São Pedro' },
    { day: 16, month: 9, name: 'Emancipação Política de Alagoas' }
  ],
  AP: [
    { day: 19, month: 3, name: 'Dia de São José' },
    { day: 13, month: 9, name: 'Criação do Território Federal' },
    { day: 5, month: 10, name: 'Criação do Estado do Amapá' }
  ],
  AM: [
    { day: 5, month: 9, name: 'Elevação do Amazonas a Província' }
  ],
  BA: [
    { day: 2, month: 7, name: 'Independência da Bahia' }
  ],
  CE: [
    { day: 25, month: 3, name: 'Data Magna do Ceará' }
  ],
  DF: [
    { day: 21, month: 4, name: 'Fundação de Brasília' },
    { day: 30, month: 11, name: 'Dia do Evangélico' }
  ],
  ES: [
    { day: 28, month: 10, name: 'Dia do Servidor Público Estadual' }
  ],
  GO: [
    { day: 24, month: 10, name: 'Pedestal de Goiânia' }
  ],
  MA: [
    { day: 28, month: 7, name: 'Adesão do Maranhão à Independência' }
  ],
  MT: [
    { day: 20, month: 11, name: 'Consciência Negra' }
  ],
  MS: [
    { day: 11, month: 10, name: 'Criação do Estado do MS' }
  ],
  MG: [
    { day: 21, month: 4, name: 'Data Magna de Minas Gerais' }
  ],
  PA: [
    { day: 15, month: 8, name: 'Adesão do Grão-Pará à Independência' }
  ],
  PB: [
    { day: 26, month: 7, name: 'Homenagem a João Pessoa' },
    { day: 5, month: 8, name: 'Fundação do Estado da Paraíba' }
  ],
  PR: [
    { day: 19, month: 12, name: 'Emancipação Política do Paraná' }
  ],
  PE: [
    { day: 6, month: 3, name: 'Data Magna de Pernambuco' },
    { day: 24, month: 6, name: 'São João' }
  ],
  PI: [
    { day: 19, month: 10, name: 'Dia do Piauí' }
  ],
  RJ: [
    { day: 23, month: 4, name: 'Dia de São Jorge' },
    { day: 28, month: 10, name: 'Dia do Servidor Público' }
  ],
  RN: [
    { day: 3, month: 10, name: 'Mártires de Cunhaú e Uruaçu' }
  ],
  RS: [
    { day: 20, month: 9, name: 'Revolução Farroupilha (Dia do Gaúcho)' }
  ],
  RO: [
    { day: 4, month: 1, name: 'Criação do Estado de Rondônia' },
    { day: 18, month: 6, name: 'Dia do Evangélico' }
  ],
  RR: [
    { day: 5, month: 10, name: 'Criação de Roraima' }
  ],
  SC: [
    { day: 11, month: 8, name: 'Dia de Santa Catarina' }
  ],
  SP: [
    { day: 9, month: 7, name: 'Revolução Constitucionalista de 1932' }
  ],
  SE: [
    { day: 8, month: 7, name: 'Emancipação Política de Sergipe' }
  ],
  TO: [
    { day: 18, month: 3, name: 'Autonomia do Tocantins' },
    { day: 8, month: 9, name: 'Padroeira do Tocantins' },
    { day: 5, month: 10, name: 'Criação do Tocantins' }
  ]
};

const holidaysMemoryCache = new Map<string, Holiday[]>();

export async function fetchHolidays(year: number, stateCode?: string, city?: string): Promise<Holiday[]> {
  const normState = stateCode ? stateCode.trim().toUpperCase() : '';
  const normCity = city ? city.trim().toLowerCase() : '';
  const cacheKey = `${year}_${normState}_${normCity}`;

  if (holidaysMemoryCache.has(cacheKey)) {
    return holidaysMemoryCache.get(cacheKey)!;
  }

  const holidaysMap = new Map<string, Holiday>();

  const storageCacheKey = `psychdash_national_holidays_${year}`;
  let nationalHolidaysRaw: any[] | null = null;

  try {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(storageCacheKey) : null;
    if (cached) {
      nationalHolidaysRaw = JSON.parse(cached);
    }
  } catch (e) {
    console.warn('Erro ao ler cache local de feriados:', e);
  }

  if (!nationalHolidaysRaw) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        nationalHolidaysRaw = await response.json();
        try {
          if (typeof localStorage !== 'undefined' && nationalHolidaysRaw) {
            localStorage.setItem(storageCacheKey, JSON.stringify(nationalHolidaysRaw));
          }
        } catch (storageErr) {
          console.warn('Não foi possível salvar cache no localStorage:', storageErr);
        }
      }
    } catch (apiError) {
      console.warn('BrasilAPI indisponível ou offline. Usando fallback:', apiError);
    }
  }

  if (Array.isArray(nationalHolidaysRaw)) {
    nationalHolidaysRaw.forEach((h: any) => {
      if (h.date && h.name) {
        holidaysMap.set(h.date, {
          date: h.date,
          name: h.name,
          type: 'national'
        });
      }
    });
  }

  if (normState && STATE_HOLIDAYS[normState]) {
    const stateList = STATE_HOLIDAYS[normState];
    stateList.forEach(item => {
      const mStr = String(item.month).padStart(2, '0');
      const dStr = String(item.day).padStart(2, '0');
      const dateStr = `${year}-${mStr}-${dStr}`;
      if (!holidaysMap.has(dateStr)) {
        holidaysMap.set(dateStr, {
          date: dateStr,
          name: item.name,
          type: 'state'
        });
      }
    });
  }

  try {
    const dbHolidays: any = await querySQL(
      "SELECT date, name, type FROM custom_holidays WHERE date LIKE ?",
      [`${year}-%`]
    );

    if (Array.isArray(dbHolidays)) {
      dbHolidays.forEach((h: any) => {
        if (h.date && h.name) {
          holidaysMap.set(h.date, {
            date: h.date,
            name: h.name,
            type: (h.type as any) || 'municipal'
          });
        }
      });
    }
  } catch (dbErr) {
    // Ignora se tabela ainda não existe ou estiver rodando fora de contexto SQL
  }

  const result = Array.from(holidaysMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  holidaysMemoryCache.set(cacheKey, result);
  return result;
}

export function clearHolidaysCache() {
  holidaysMemoryCache.clear();
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('psychdash_national_holidays_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  } catch (e) {
    console.warn('Erro ao limpar localStorage de feriados:', e);
  }
}
