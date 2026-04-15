const Database = require('better-sqlite3');
const path = require('path');
const { app, ipcMain, dialog } = require('electron');
const http = require('http');
const fs = require('fs');

let db;
const SERVER_PORT = 3001;

function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'psychology_dashboard.sqlite3');
  
  console.log('Main DB: Abrindo banco em', dbPath);
  
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // Adicionando colunas novas ao pacientes se não existirem
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        session_value REAL,
        status TEXT DEFAULT 'active',
        cpf TEXT,
        birth_date TEXT,
        address TEXT,
        deleted_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        start_time DATETIME,
        end_time DATETIME,
        status TEXT DEFAULT 'scheduled',
        payment_status TEXT DEFAULT 'pending',
        payment_value REAL,
        payment_method TEXT,
        notes TEXT,
        confirmed BOOLEAN DEFAULT 0,
        recurring_id TEXT,
        deleted_at DATETIME,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    CREATE TABLE IF NOT EXISTS medical_records (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        patient_id TEXT,
        name TEXT,
        path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
  `);

  // Migração manual de colunas (caso a tabela já exista sem elas)
  try { db.exec("ALTER TABLE patients ADD COLUMN status TEXT DEFAULT 'active'"); } catch(e){}
  try { db.exec("ALTER TABLE patients ADD COLUMN cpf TEXT"); } catch(e){}
  try { db.exec("ALTER TABLE patients ADD COLUMN birth_date TEXT"); } catch(e){}
  try { db.exec("ALTER TABLE patients ADD COLUMN address TEXT"); } catch(e){}
  try { db.exec("ALTER TABLE patients ADD COLUMN anamnesis TEXT"); } catch(e){}
  try { db.exec("ALTER TABLE patients ADD COLUMN deleted_at DATETIME"); } catch(e){}
  
  try { db.exec("ALTER TABLE sessions ADD COLUMN payment_value REAL"); } catch(e){}
  try { db.exec("ALTER TABLE sessions ADD COLUMN payment_method TEXT"); } catch(e){}
  try { db.exec("ALTER TABLE sessions ADD COLUMN notes TEXT"); } catch(e){}
  try { db.exec("ALTER TABLE sessions ADD COLUMN confirmed BOOLEAN DEFAULT 0"); } catch(e){}
  try { db.exec("ALTER TABLE sessions ADD COLUMN deleted_at DATETIME"); } catch(e){}

  startLocalServer();
}

function startLocalServer() {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { action, sql, bind } = JSON.parse(body);
          let result;
          if (action === 'query') result = db.prepare(sql).all(bind || []);
          else if (action === 'exec') result = db.prepare(sql).run(bind || []);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else { res.writeHead(404); res.end(); }
  });
  server.listen(SERVER_PORT, '127.0.0.1', () => {
    console.log(`Main DB: Servidor local rodando em http://127.0.0.1:${SERVER_PORT}`);
  });
}

ipcMain.handle('db-query', async (event, { sql, bind = [] }) => {
  return db.prepare(sql).all(bind);
});

ipcMain.handle('db-exec', async (event, { sql, bind = [] }) => {
  const result = db.prepare(sql).run(bind);
  return result;
});

ipcMain.handle('db-export', async (event) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Exportar Banco de Dados',
    defaultPath: 'psychology_dashboard_backup.sqlite3',
    filters: [{ name: 'SQLite Database', extensions: ['sqlite3', 'db'] }]
  });
  if (filePath) {
    await db.backup(filePath);
    return { success: true, path: filePath };
  }
  return { success: false };
});

ipcMain.handle('file-upload', async (event, { patientId }) => {
    const { filePaths } = await dialog.showOpenDialog({
        title: 'Selecionar Documento',
        properties: ['openFile'],
        filters: [{ name: 'Documentos', extensions: ['pdf', 'doc', 'docx', 'jpg', 'png'] }]
    });

    if (filePaths && filePaths.length > 0) {
        const sourcePath = filePaths[0];
        const fileName = path.basename(sourcePath);
        const userDataPath = app.getPath('userData');
        const docsDir = path.join(userDataPath, 'patient_documents', patientId);
        
        if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });
        
        const destPath = path.join(docsDir, fileName);
        fs.copyFileSync(sourcePath, destPath);
        
        const id = require('crypto').randomUUID();
        db.prepare('INSERT INTO documents (id, patient_id, name, path) VALUES (?, ?, ?, ?)').run(id, patientId, fileName, destPath);
        
        return { success: true, fileName };
    }
    return { success: false };
});

ipcMain.handle('file-open', async (event, { filePath }) => {
    const { shell } = require('electron');
    if (fs.existsSync(filePath)) {
        await shell.openPath(filePath);
        return { success: true };
    }
    return { success: false, error: 'Arquivo não encontrado' };
});

module.exports = { initDatabase };
