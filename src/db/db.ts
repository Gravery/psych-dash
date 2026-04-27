// @ts-nocheck
import initSqlJs from 'sql.js';
import localforage from 'localforage';

// Configurações
const isElectron = (window as any).electronAPI !== undefined;
const LOCAL_SERVER_URL = 'http://127.0.0.1:3001';
const DB_STORAGE_KEY = 'psychology_dashboard_db';

let webDB: any = null;
let useLocalServer = false;

export const initDB = async () => {
  if (isElectron) {
    console.log('DB: Usando SQLite Nativo via IPC (App Mode)');
    return true;
  }

  try {
    const response = await fetch(`${LOCAL_SERVER_URL}`, { method: 'OPTIONS', mode: 'cors' });
    if (response.ok || response.status === 200) {
      console.log('DB: Servidor local detectado. Unificando dados.');
      useLocalServer = true;
      return true;
    }
  } catch (e) {
    console.log('DB: Servidor local não detectado. Usando armazenamento isolado.');
  }

  if (webDB) return true;

  try {
    const SQL = await initSqlJs({ locateFile: file => `/${file}` });
    const savedDb: Uint8Array | null = await localforage.getItem(DB_STORAGE_KEY);
    
    if (savedDb) {
      webDB = new SQL.Database(savedDb);
    } else {
      webDB = new SQL.Database();
      webDB.run(`
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT, email TEXT,
            session_value REAL, status TEXT DEFAULT 'active', cpf TEXT,
            birth_date TEXT, address TEXT, deleted_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY, patient_id TEXT, start_time DATETIME, end_time DATETIME,
            status TEXT DEFAULT 'scheduled', payment_status TEXT DEFAULT 'pending',
            payment_value REAL, payment_method TEXT, notes TEXT, confirmed BOOLEAN DEFAULT 0,
            recurring_id TEXT, deleted_at DATETIME,
            FOREIGN KEY(patient_id) REFERENCES patients(id)
        );
        CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE IF NOT EXISTS medical_records (
            id TEXT PRIMARY KEY, patient_id TEXT, content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP, deleted_at DATETIME,
            FOREIGN KEY(patient_id) REFERENCES patients(id)
        );
        CREATE TABLE IF NOT EXISTS billing_reminders (
            id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, due_date TEXT NOT NULL,
            amount REAL DEFAULT 0, status TEXT DEFAULT 'pending', payment_method TEXT,
            notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid_at DATETIME, deleted_at DATETIME,
            FOREIGN KEY(patient_id) REFERENCES patients(id)
        );
      `);
      await syncWebDB();
    }
    return true;
  } catch (err) {
    console.error('DB Web: Falha na inicialização do Fallback:', err);
    return false;
  }
};

const syncWebDB = async () => {
  if (!webDB || isElectron || useLocalServer) return;
  const data = webDB.export();
  await localforage.setItem(DB_STORAGE_KEY, data);
};

export const execSQL = async (sql: string, bind: any[] = []) => {
  if (isElectron) return (window as any).electronAPI.db.exec(sql, bind);
  if (useLocalServer) {
    const response = await fetch(`${LOCAL_SERVER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'exec', sql, bind })
    });
    return response.json();
  }
  if (!webDB) await initDB();
  const result = webDB.run(sql, bind);
  await syncWebDB();
  return result;
};

export const querySQL = async (sql: string, bind: any[] = []) => {
  if (isElectron) return (window as any).electronAPI.db.query(sql, bind);
  if (useLocalServer) {
    const response = await fetch(`${LOCAL_SERVER_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'query', sql, bind })
    });
    return response.json();
  }
  if (!webDB) await initDB();
  const stmt = webDB.prepare(sql);
  const rows = [];
  stmt.bind(bind);
  while (stmt.step()) { rows.push(stmt.getAsObject()); }
  stmt.free();
  return rows;
};

export const exportDB = async () => {
    if (isElectron || useLocalServer) {
      if (isElectron) return (window as any).electronAPI.db.export();
      alert('A exportação deve ser realizada através do Aplicativo Desktop.');
      return;
    }
    if (!webDB) await initDB();
    const data = webDB.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'psychology_dashboard_web.sqlite3';
    a.click();
    URL.revokeObjectURL(url);
};

export default { init: initDB, exec: execSQL, query: querySQL, export: exportDB };
