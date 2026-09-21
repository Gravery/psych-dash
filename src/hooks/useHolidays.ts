import { useState, useEffect, useCallback } from 'react';
import { fetchHolidays, clearHolidaysCache, type Holiday } from '../utils/holidays';
import { querySQL } from '../db/db';

let cachedClinicConfig: { stateCode: string; city: string } | null = null;
const holidaysYearCache = new Map<number, Holiday[]>();

export function useHolidays(year: number) {
  const [holidays, setHolidays] = useState<Holiday[]>(() => holidaysYearCache.get(year) || []);
  const [loading, setLoading] = useState(false);

  const loadHolidays = useCallback(async () => {
    if (holidaysYearCache.has(year)) {
      setHolidays(holidaysYearCache.get(year)!);
    } else {
      setLoading(true);
    }

    try {
      let stateCode = '';
      let city = '';

      if (cachedClinicConfig) {
        stateCode = cachedClinicConfig.stateCode;
        city = cachedClinicConfig.city;
      } else {
        try {
          const rows: any = await querySQL(
            "SELECT key, value FROM config WHERE key IN ('clinic_state', 'clinic_city')"
          );
          if (Array.isArray(rows)) {
            rows.forEach((r: any) => {
              if (r.key === 'clinic_state') stateCode = r.value;
              if (r.key === 'clinic_city') city = r.value;
            });
          }
          cachedClinicConfig = { stateCode, city };
        } catch (dbErr) {
          console.warn('Config de estado/cidade ainda não acessível:', dbErr);
        }
      }

      const data = await fetchHolidays(year, stateCode, city);
      holidaysYearCache.set(year, data);
      setHolidays(data);
    } catch (err) {
      console.error('Erro ao carregar feriados:', err);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    loadHolidays();

    const handleConfigUpdate = () => {
      cachedClinicConfig = null;
      holidaysYearCache.clear();
      clearHolidaysCache();
      loadHolidays();
    };

    window.addEventListener('config-updated', handleConfigUpdate);
    window.addEventListener('holidays-updated', handleConfigUpdate);

    return () => {
      window.removeEventListener('config-updated', handleConfigUpdate);
      window.removeEventListener('holidays-updated', handleConfigUpdate);
    };
  }, [loadHolidays]);

  const isHoliday = useCallback((dateString: string): Holiday | undefined => {
    if (!dateString) return undefined;
    return holidays.find(h => h.date === dateString);
  }, [holidays]);

  return { holidays, loading, isHoliday, reload: loadHolidays };
}
