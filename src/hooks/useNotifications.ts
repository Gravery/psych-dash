import { useEffect, useRef } from 'react';
import { querySQL } from '../db/db';
import bellSound from '../assets/sounds/bell.wav';
import digitalSound from '../assets/sounds/digital.wav';
import modernSound from '../assets/sounds/modern.wav';

export const useNotifications = () => {
  const notifiedSessions = useRef<Set<string>>(new Set());

  const sounds = {
    bell: bellSound,
    digital: digitalSound,
    modern: modernSound,
  };

  const checkSessions = async () => {
    try {
      // 1. Verificar se as notificações estão habilitadas
      const enabledConfig: any = await querySQL("SELECT value FROM config WHERE key = 'notifications_enabled'");
      const isEnabled = !enabledConfig || enabledConfig.length === 0 || enabledConfig[0].value === 'true';
      
      if (!isEnabled) return;

      // 2. Obter configuração de tempo de antecedência (default 5 min)
      const leadTimeConfig: any = await querySQL("SELECT value FROM config WHERE key = 'notification_lead_time'");
      const leadTimeMinutes = leadTimeConfig && leadTimeConfig.length > 0 ? parseInt(leadTimeConfig[0].value) : 5;

      // 3. Buscar sessões de HOJE (para evitar problemas de fuso/formato no SQL)
      const todayStr = new Date().toISOString().split('T')[0];
      
      const sql = `
        SELECT s.id, s.start_time, p.name as patient_name 
        FROM sessions s 
        JOIN patients p ON s.patient_id = p.id 
        WHERE s.start_time LIKE ?
        AND s.deleted_at IS NULL
        AND s.status = 'scheduled'
      `;
      
      const todaysSessions: any = await querySQL(sql, [`${todayStr}%`]);

      if (todaysSessions && todaysSessions.length > 0) {
        const now = new Date();
        
        // Obter configuração de som
        const config: any = await querySQL("SELECT value FROM config WHERE key = 'notification_sound'");
        const soundKey = (config && config.length > 0) ? config[0].value : 'bell';

        console.log(`Monitor: Verificando ${todaysSessions.length} sessões de hoje. Lead Time: ${leadTimeMinutes}min`);

        for (const session of todaysSessions) {
          const sessionTime = new Date(session.start_time);
          const diffInMinutes = (sessionTime.getTime() - now.getTime()) / 60000;

          // Se faltar entre 0 e LEAD_TIME minutos (com margem de segurança de 0.5 min para o timer)
          if (diffInMinutes > -1 && diffInMinutes <= (leadTimeMinutes + 0.5)) {
            if (!notifiedSessions.current.has(session.id)) {
              console.log(`!!! NOTIFICANDO AGORA !!! Sessão: ${session.patient_name} às ${session.start_time}. Diff: ${diffInMinutes.toFixed(2)}min`);
              triggerNotification(session, soundKey);
              notifiedSessions.current.add(session.id);
            }
          }
        }
      }
    } catch (err) {
      console.error('Erro ao verificar notificações:', err);
    }
  };

  const triggerNotification = (session: any, soundKey: string) => {
    const time = new Date(session.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Alerta Visual (Notification API)
    if (Notification.permission === 'granted') {
      new Notification('Atendimento em breve!', {
        body: `Sessão com ${session.patient_name} às ${time}`,
        icon: '/favicon.svg'
      });
    }

    // Alerta Sonoro + Fallback de Voz (Muito mais robusto)
    try {
      const soundUrl = (sounds as any)[soundKey] || sounds.bell;
      const audio = new Audio(soundUrl);
      audio.volume = 1.0;
      
      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn('Som bloqueado pelo navegador, usando Fallback de Voz:', e.message);
          speakFallback(session.patient_name, time);
        });
      }
    } catch (err) {
      console.error('Erro ao tentar tocar som, usando Fallback de Voz:', err);
      speakFallback(session.patient_name, time);
    }
  };

  const speakFallback = (name: string, time: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(`Atenção: Atendimento com ${name} às ${time}`);
      utterance.lang = 'pt-BR';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    // Verificar imediatamente e depois a cada minuto
    checkSessions();
    const interval = setInterval(checkSessions, 60000);
    
    return () => clearInterval(interval);
  }, []);
};
