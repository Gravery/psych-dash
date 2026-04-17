import React, { useState } from 'react';
import { Monitor, Globe, CheckCircle2 } from 'lucide-react';
import { execSQL } from '../../db/db';

interface OnboardingModalProps {
  onComplete: () => void;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onComplete }) => {
  const [mode, setMode] = useState<'desktop' | 'browser'>('desktop');
  const [step, setStep] = useState(1);

  const handleFinish = async () => {
    try {
      await execSQL("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", ['execution_mode', mode]);
      await execSQL("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", ['accent_color', '#0ea5e9']);
      await execSQL("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", ['notification_sound', 'bell']);
      
      if ((window as any).electronAPI) {
        (window as any).electronAPI.updateAppSettings({ executionMode: mode, startWithWindows: false });
      }
      
      onComplete();
    } catch (err) {
      console.error('Erro ao salvar onboarding:', err);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
    }}>
      <div className="card" style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '40px' }}>
        {step === 1 ? (
          <>
            <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--accent-primary)', borderRadius: '16px', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <Monitor size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Bem-vindo ao PsychDash!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
              Como você prefere utilizar o sistema no dia a dia? Você pode mudar isso depois nas configurações.
            </p>
            
            <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
              <button 
                onClick={() => setMode('desktop')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '12px',
                  border: `2px solid ${mode === 'desktop' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  backgroundColor: mode === 'desktop' ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                  textAlign: 'left', transition: 'all 0.2s ease'
                }}
              >
                <Monitor size={24} color={mode === 'desktop' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                <div>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Modo Aplicativo</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Interface independente em janela própria.</div>
                </div>
              </button>

              <button 
                onClick={() => setMode('browser')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderRadius: '12px',
                  border: `2px solid ${mode === 'browser' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  backgroundColor: mode === 'browser' ? 'rgba(14, 165, 233, 0.05)' : 'transparent',
                  textAlign: 'left', transition: 'all 0.2s ease'
                }}
              >
                <Globe size={24} color={mode === 'browser' ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                <div>
                  <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>Modo Navegador</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>O sistema abre como uma aba no seu navegador.</div>
                </div>
              </button>
            </div>

            <button onClick={() => setStep(2)} className="btn-primary" style={{ width: '100%', padding: '14px' }}>
              Continuar
            </button>
          </>
        ) : (
          <>
            <div style={{ width: '64px', height: '64px', backgroundColor: 'var(--success)', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <CheckCircle2 size={32} color="white" />
            </div>
            <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Tudo pronto!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
              O PsychDash foi configurado com sucesso. Agora você pode gerenciar seus pacientes e agenda com facilidade.
            </p>
            <button onClick={handleFinish} className="btn-primary" style={{ width: '100%', padding: '14px' }}>
              Começar a usar
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default OnboardingModal;
