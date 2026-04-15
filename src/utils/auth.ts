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

export const isAuthenticated = () => {
  return sessionStorage.getItem('is_authenticated') === 'true';
};

export const setAuthenticated = (status: boolean) => {
  sessionStorage.setItem('is_authenticated', status.toString());
};
