import React, { useState, useEffect } from 'react';
import { hashPassword, getStoredPassword, setStoredPassword, setAuthenticated, getDBPassword, saveDBPassword } from '../../utils/auth';
import { Lock } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkPassword = async () => {
      setIsLoading(true);
      const localPwd = getStoredPassword();
      const dbPwd = await getDBPassword();
      
      if (!localPwd && !dbPwd) {
        setIsFirstTime(true);
      } else {
        setIsFirstTime(false);
        // Sincronizar local se existir no DB
        if (dbPwd && !localPwd) {
          setStoredPassword(dbPwd);
        }
      }
      setIsLoading(false);
    };
    
    checkPassword();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isFirstTime) {
      if (password !== confirmPassword) {
        setError('As senhas não coincidem');
        return;
      }
      if (password.length < 4) {
        setError('A senha deve ter pelo menos 4 caracteres');
        return;
      }
      const hashed = await hashPassword(password);
      setStoredPassword(hashed);
      await saveDBPassword(hashed); // Salvar também no banco
      setAuthenticated(true);
      onLogin();
    } else {
      const hashed = await hashPassword(password);
      const stored = getStoredPassword();
      if (hashed === stored) {
        setAuthenticated(true);
        onLogin();
      } else {
        setError('Senha incorreta');
      }
    }
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)'
      }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid var(--accent-primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)'
    }}>
      <div className="card glass" style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ 
            backgroundColor: 'var(--accent-primary)', 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 16px' 
          }}>
            <Lock color="white" size={32} />
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {isFirstTime ? 'Criar Senha de Acesso' : 'Bem-vindo de volta'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            {isFirstTime 
              ? 'Defina uma senha para proteger os dados dos seus pacientes.' 
              : 'Digite sua senha para acessar o painel.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Senha</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              style={{ width: '100%' }}
              required
            />
          </div>

          {isFirstTime && (
            <div style={{ marginBottom: '16px', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>Confirmar Senha</label>
              <input 
                type="password" 
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme sua senha"
                style={{ width: '100%' }}
                required
              />
            </div>
          )}

          {error && (
            <p style={{ color: 'var(--error)', fontSize: '14px', marginBottom: '16px' }}>{error}</p>
          )}

          <button type="submit" className="btn-primary" style={{ width: '100%' }}>
            {isFirstTime ? 'Criar Acesso' : 'Entrar'}
          </button>
          {isFirstTime && (
            <div style={{ padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '24px', textAlign: 'left', lineHeight: '1.4' }}>
              <p><strong>Aviso de Privacidade:</strong> Seus dados são armazenados exclusivamente neste navegador (OPFS). Você é o único responsável pela segurança física e lógica deste dispositivo e pelo backup periódico dos dados através da ferramenta de exportação.</p>
            </div>
          )}
        </form>

        {!isFirstTime && (

          <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Acesso Restrito: Seus dados estão protegidos localmente.
          </p>
        )}
      </div>
    </div>
  );
};

export default LoginPage;
