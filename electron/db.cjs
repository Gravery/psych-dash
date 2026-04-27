const Database = require('better-sqlite3');
const path = require('path');
const { app, ipcMain, dialog } = require('electron');
const http = require('http');
const fs = require('fs');
const os = require('os');
const QRCode = require('qrcode');
const crypto = require('crypto');

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
        category TEXT DEFAULT 'general',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
    CREATE TABLE IF NOT EXISTS billing_reminders (
        id TEXT PRIMARY KEY,
        patient_id TEXT NOT NULL,
        due_date TEXT NOT NULL,
        amount REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        payment_method TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        paid_at DATETIME,
        deleted_at DATETIME,
        FOREIGN KEY(patient_id) REFERENCES patients(id)
    );
  `);

  // Migração manual de colunas (caso a tabela já exista sem elas)
  try { db.exec("ALTER TABLE patients ADD COLUMN status TEXT DEFAULT 'active'"); } catch (e) { }
  try { db.exec("ALTER TABLE patients ADD COLUMN cpf TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE patients ADD COLUMN birth_date TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE patients ADD COLUMN address TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE patients ADD COLUMN anamnesis TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE patients ADD COLUMN deleted_at DATETIME"); } catch (e) { }
  try { db.exec("ALTER TABLE documents ADD COLUMN category TEXT DEFAULT 'general'"); } catch (e) { }

  try { db.exec("ALTER TABLE sessions ADD COLUMN payment_value REAL"); } catch (e) { }
  try { db.exec("ALTER TABLE sessions ADD COLUMN payment_method TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE sessions ADD COLUMN notes TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE sessions ADD COLUMN confirmed BOOLEAN DEFAULT 0"); } catch (e) { }
  try { db.exec("ALTER TABLE sessions ADD COLUMN deleted_at DATETIME"); } catch (e) { }

  try { db.exec("ALTER TABLE patients ADD COLUMN payer_name TEXT"); } catch (e) { }
  try { db.exec("ALTER TABLE patients ADD COLUMN billing_cycle TEXT DEFAULT 'per_session'"); } catch (e) { }
  try { db.exec("ALTER TABLE patients ADD COLUMN billing_day INTEGER"); } catch (e) { }

  try { db.exec("ALTER TABLE sessions ADD COLUMN type TEXT DEFAULT 'session'"); } catch (e) { }

  // Migra lembretes antigos da tabela sessions para billing_reminders
  migrateBillingToNewTable();
  syncBillingReminders();
  startLocalServer();
}

function migrateBillingToNewTable() {
  try {
    const oldBillings = db.prepare("SELECT * FROM sessions WHERE type = 'billing' AND deleted_at IS NULL").all();
    if (oldBillings.length > 0) {
      console.log(`[Migration] Migrando ${oldBillings.length} lembretes antigos para billing_reminders...`);
      for (const b of oldBillings) {
        const exists = db.prepare("SELECT id FROM billing_reminders WHERE patient_id = ? AND due_date = ?").get(b.patient_id, b.start_time);
        if (!exists) {
          db.prepare(
            "INSERT INTO billing_reminders (id, patient_id, due_date, amount, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
          ).run(crypto.randomUUID(), b.patient_id, b.start_time, b.payment_value || 0, b.payment_status === 'paid' ? 'paid' : 'pending', b.notes, b.start_time);
        }
      }
      db.prepare("DELETE FROM sessions WHERE type = 'billing'").run();
      console.log(`[Migration] Migração concluída.`);
    }
  } catch (err) {
    console.error('[Migration] Erro:', err);
  }
}

function startLocalServer() {
  const server = http.createServer((req, res) => {
    const remoteIp = req.socket.remoteAddress;
    const isLocal = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // Rota para a página de upload mobile
    if (req.method === 'GET' && req.url.startsWith('/m/')) {
      const parts = req.url.split('/');
      const patientId = parts[2];
      const category = parts[3] || 'general';
      const categoryName = category === 'anamnesis' ? 'Anamnese' : 'Documentos';

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Enviar para PsychDash</title>
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; padding: 20px; background: #f8fafc; color: #1e293b; text-align: center; }
            .card { background: white; padding: 32px 24px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); margin: 0 auto; max-width: 400px; }
            .file-box { 
              display: block;
              border: 2px dashed #0ea5e9; 
              padding: 40px 20px; 
              border-radius: 12px; 
              margin: 24px 0; 
              background: #f0f9ff; 
              cursor: pointer;
              transition: all 0.2s;
            }
            .file-box:active { background: #e0f2fe; transform: scale(0.98); }
            input { display: none; }
            button { background: #0ea5e9; color: white; border: none; padding: 16px 24px; border-radius: 10px; font-weight: bold; width: 100%; cursor: pointer; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(14, 165, 233, 0.4); }
            button:disabled { background: #94a3b8; box-shadow: none; }
            #status { margin-top: 24px; font-size: 15px; line-height: 1.5; }
            #file-name { margin-top: 12px; font-weight: 600; font-size: 14px; color: #0369a1; word-break: break-all; }
            .hint { font-size: 12px; color: #64748b; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2 style="color: #0ea5e9; margin-bottom: 4px; font-size: 28px;">PsychDash</h2>
            <p style="margin-top: 0; color: #64748b; font-size: 14px;">Upload para: <b style="color: #1e293b">${categoryName}</b></p>
            
            <label for="fileInput" class="file-box">
              <div id="file-label" style="font-weight: 500; color: #0369a1">Toque para escolher um arquivo</div>
              <div style="font-size: 12px; color: #0ea5e9; margin-top: 4px;">(PDF, Documentos, Imagens, etc.)</div>
              <div id="file-name"></div>
              <input type="file" id="fileInput">
            </label>

            <button id="uploadBtn">Enviar para o Computador</button>
            <div id="status"></div>
            <p class="hint">Mantenha o Wi-Fi ligado durante o envio.</p>
          </div>
          <script>
            const btn = document.getElementById('uploadBtn');
            const status = document.getElementById('status');
            const fileInput = document.getElementById('fileInput');
            const fileNameDiv = document.getElementById('file-name');
            const fileLabel = document.getElementById('file-label');

            fileInput.onchange = () => {
              if (fileInput.files[0]) {
                fileNameDiv.innerText = fileInput.files[0].name;
                fileLabel.innerText = 'Arquivo selecionado:';
              }
            };

            btn.onclick = async () => {
              if (!fileInput.files[0]) return alert('Por favor, selecione um arquivo primeiro.');
              
              btn.disabled = true;
              status.innerText = 'Lendo arquivo...';
              
              const file = fileInput.files[0];
              const reader = new FileReader();
              
              reader.onload = async () => {
                status.innerText = 'Enviando...';
                try {
                  const response = await fetch('/api/mobile-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      patientId: '${patientId}',
                      category: '${category}',
                      fileName: file.name,
                      fileData: reader.result.split(',')[1]
                    })
                  });
                  const res = await response.json();
                  if (res.success) {
                    status.innerHTML = '<b style="color:green; font-size: 18px;">✅ Enviado com sucesso!</b><br><p style="color:#64748b">O arquivo já aparece no seu computador.</p>';
                    fileInput.value = '';
                    fileNameDiv.innerText = '';
                    fileLabel.innerText = 'Enviar outro arquivo?';
                    btn.disabled = false;
                    btn.innerText = 'Enviar Outro';
                  } else {
                    throw new Error(res.error);
                  }
                } catch (err) {
                  status.innerHTML = '<b style="color:red">❌ Erro: ' + err.message + '</b>';
                  btn.disabled = false;
                }
              };
              reader.readAsDataURL(file);
            };
          </script>
        </body>
        </html>
      `);
      return;
    }

    // API de Upload Mobile
    if (req.method === 'POST' && req.url === '/api/mobile-upload') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const { patientId, fileName, fileData, category } = JSON.parse(body);
          if (!patientId || !fileName || !fileData) throw new Error('Dados incompletos');

          const finalCategory = category || 'general';
          const userDataPath = app.getPath('userData');
          const docsDir = path.join(userDataPath, 'patient_documents', patientId);
          if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

          const destPath = path.join(docsDir, fileName);
          fs.writeFileSync(destPath, Buffer.from(fileData, 'base64'));

          const id = crypto.randomUUID();
          db.prepare('INSERT INTO documents (id, patient_id, name, path, category) VALUES (?, ?, ?, ?, ?)').run(id, patientId, fileName, destPath, finalCategory);

          app.emit('refresh-patient-data', { patientId });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    if (!isLocal) {
      res.writeHead(403);
      res.end(JSON.stringify({ error: 'Acesso negado: Apenas o computador local pode acessar o banco de dados.' }));
      return;
    }

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

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Main DB: Porta ${SERVER_PORT} em uso. Outra instância deve estar ativa.`);
    } else {
      console.error('Main DB: Erro no servidor local:', err.message);
    }
  });

  server.listen(SERVER_PORT, '0.0.0.0', () => {
    console.log(`Main DB: Servidor LAN rodando em port ${SERVER_PORT}`);
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

ipcMain.handle('db-import', async (event) => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Importar Banco de Dados',
    filters: [{ name: 'SQLite Database', extensions: ['sqlite3', 'db'] }],
    properties: ['openFile']
  });

  if (filePaths && filePaths.length > 0) {
    const sourcePath = filePaths[0];
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'psychology_dashboard.sqlite3');
    const backupPath = path.join(userDataPath, `backup_${Date.now()}.sqlite3`);

    try {
      if (db) {
        db.close();
      }

      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, backupPath);
      }

      fs.copyFileSync(sourcePath, dbPath);

      initDatabase();

      return { success: true, backupPath };
    } catch (err) {
      console.error('Erro ao importar banco:', err);
      try { initDatabase(); } catch (e) { }
      return { success: false, error: err.message };
    }
  }
  return { success: false };
});

ipcMain.handle('file-upload', async (event, { patientId, category = 'general' }) => {
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
    db.prepare('INSERT INTO documents (id, patient_id, name, path, category) VALUES (?, ?, ?, ?, ?)').run(id, patientId, fileName, destPath, category);

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

ipcMain.handle('file-delete', async (event, { id }) => {
  try {
    db.prepare('UPDATE documents SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-lan-info', async (event, params = {}) => {
  const { patientId, category = 'general' } = params;
  const interfaces = os.networkInterfaces();
  const ips = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }

  let localIp = ips.find(ip => ip.startsWith('192.168.')) ||
    ips.find(ip => ip.startsWith('10.')) ||
    ips.find(ip => ip.startsWith('172.')) ||
    ips[0] || '127.0.0.1';

  const url = `http://${localIp}:${SERVER_PORT}/m/${patientId}/${category}`;
  const qrCode = await QRCode.toDataURL(url);

  return { ip: localIp, port: SERVER_PORT, url, qrCode };
});

function syncBillingReminders(patientId = null) {
  console.log(`[Sync] Iniciando para patientId: ${patientId || 'TODOS'}`);

  try {
    if (patientId) {
      const del = db.prepare("DELETE FROM billing_reminders WHERE patient_id = ? AND status = 'pending' AND deleted_at IS NULL").run(patientId);
      console.log(`[Sync] Removidos ${del.changes} lembretes pendentes.`);
    } else {
      const now = new Date().toISOString();
      const del = db.prepare("DELETE FROM billing_reminders WHERE status = 'pending' AND due_date >= ? AND deleted_at IS NULL").run(now);
      console.log(`[Sync] Global: Removidos ${del.changes} lembretes.`);
    }

    const patients = patientId
      ? db.prepare("SELECT * FROM patients WHERE id = ? AND billing_cycle = 'monthly' AND billing_day IS NOT NULL AND billing_day > 0").all(patientId)
      : db.prepare("SELECT * FROM patients WHERE billing_cycle = 'monthly' AND billing_day IS NOT NULL AND billing_day > 0").all();

    console.log(`[Sync] ${patients.length} paciente(s) com faturamento mensal.`);

    const now = new Date();
    for (const p of patients) {
      for (let i = 0; i < 6; i++) {
        const firstOfTarget = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const lastDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate();
        const day = Math.min(p.billing_day, lastDay);

        const reminderDate = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), day, 9, 0, 0);
        const isoStr = reminderDate.toISOString();

        const yy = firstOfTarget.getFullYear();
        const mm = String(firstOfTarget.getMonth() + 1).padStart(2, '0');
        const searchPrefix = `${yy}-${mm}`;

        const existing = db.prepare(
          "SELECT id FROM billing_reminders WHERE patient_id = ? AND due_date LIKE ? AND deleted_at IS NULL"
        ).get(p.id, searchPrefix + '%');

        if (!existing) {
          const monthStart = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), 1).toISOString();
          const monthEnd = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0, 23, 59, 59).toISOString();
          const sessionsInMonth = db.prepare(
            "SELECT SUM(payment_value) as total, COUNT(*) as count FROM sessions WHERE patient_id = ? AND start_time BETWEEN ? AND ? AND deleted_at IS NULL AND (type IS NULL OR type = 'session')"
          ).get(p.id, monthStart, monthEnd);

          const amount = sessionsInMonth?.total || 0;

          db.prepare(
            "INSERT INTO billing_reminders (id, patient_id, due_date, amount, status, notes) VALUES (?, ?, ?, ?, ?, ?)"
          ).run(
            crypto.randomUUID(), p.id, isoStr, amount, 'pending',
            `Acerto Mensal - ${sessionsInMonth?.count || 0} sessão(ões)`
          );
        }
      }
    }
  } catch (err) {
    console.error('[Sync] Erro:', err);
  }
}

ipcMain.handle('sync-billing-reminders', async (event, params = {}) => {
  const { patientId } = params;
  syncBillingReminders(patientId);
  event.sender.send('refresh-data', { patientId });
  return { success: true };
});

ipcMain.handle('mark-billing-paid', async (event, { billingId, paymentMethod, amount }) => {
  try {
    const billing = db.prepare("SELECT * FROM billing_reminders WHERE id = ?").get(billingId);
    if (!billing) return { success: false, error: 'Cobrança não encontrada' };

    db.prepare(
      "UPDATE billing_reminders SET status = 'paid', paid_at = CURRENT_TIMESTAMP, payment_method = ?, amount = ? WHERE id = ?"
    ).run(paymentMethod || null, amount || billing.amount, billingId);

    const dObj = new Date(billing.due_date);
    const year = dObj.getFullYear();
    const month = dObj.getMonth();

    const monthStart = new Date(year, month, 1, 0, 0, 0).toISOString();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const updated = db.prepare(
      "UPDATE sessions SET payment_status = 'paid' WHERE patient_id = ? AND start_time BETWEEN ? AND ? AND payment_status = 'pending' AND deleted_at IS NULL AND (type IS NULL OR type = 'session')"
    ).run(billing.patient_id, monthStart, monthEnd);

    console.log(`[Billing] Cobrança ${billingId} marcada como paga. ${updated.changes} sessões atualizadas.`);

    app.emit('refresh-patient-data', { patientId: billing.patient_id });

    return { success: true, sessionsUpdated: updated.changes };
  } catch (err) {
    console.error('[Billing] Erro:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('revert-billing', async (event, { billingId }) => {
  try {
    const billing = db.prepare("SELECT * FROM billing_reminders WHERE id = ?").get(billingId);
    if (!billing) return { success: false, error: 'Cobrança não encontrada' };

    db.prepare("UPDATE billing_reminders SET status = 'pending', paid_at = NULL, payment_method = NULL WHERE id = ?").run(billingId);

    const dObj = new Date(billing.due_date);
    const year = dObj.getFullYear();
    const month = dObj.getMonth();
    const monthStart = new Date(year, month, 1, 0, 0, 0).toISOString();
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    db.prepare(
      "UPDATE sessions SET payment_status = 'pending' WHERE patient_id = ? AND start_time BETWEEN ? AND ? AND payment_status = 'paid' AND deleted_at IS NULL AND (type IS NULL OR type = 'session')"
    ).run(billing.patient_id, monthStart, monthEnd);

    app.emit('refresh-patient-data', { patientId: billing.patient_id });
    return { success: true };
  } catch (err) {
    console.error('[Billing] Erro ao reverter:', err);
    return { success: false, error: err.message };
  }
});

function getDb() {
  return db;
}

module.exports = { initDatabase, getDb };
