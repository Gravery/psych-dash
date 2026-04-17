const SALT = 'psychology-dashboard-salt';

export async function hashPassword(password: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const getStoredPassword = () => {
  return localStorage.getItem('app_password');
};

export const setStoredPassword = (hashedPassword: string) => {
  localStorage.setItem('app_password', hashedPassword);
};

// Nova função para buscar a senha no banco de dados (tabela config)
export const getDBPassword = async () => {
  try {
    const response = await fetch('http://127.0.0.1:3001', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'query', sql: "SELECT value FROM config WHERE key = 'app_password'" })
    });
    const data = await response.json();
    return data && data.length > 0 ? data[0].value : null;
  } catch (e) {
    return null;
  }
};

export const saveDBPassword = async (hashedPassword: string) => {
  try {
    await fetch('http://127.0.0.1:3001', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'exec', 
        sql: "INSERT OR REPLACE INTO config (key, value) VALUES ('app_password', ?)",
        bind: [hashedPassword]
      })
    });
  } catch (e) {
    console.error('Erro ao salvar senha no DB:', e);
  }
};

export const isAuthenticated = () => {
  return sessionStorage.getItem('is_authenticated') === 'true';
};

export const setAuthenticated = (status: boolean) => {
  sessionStorage.setItem('is_authenticated', status.toString());
};
