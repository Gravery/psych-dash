const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}
const path = require('path');
const { initDatabase, getDb } = require('./db.cjs');
const isDev = process.env.NODE_ENV === 'development';

let mainWin;
let tray;

function createWindow(show = true) {
  mainWin = new BrowserWindow({
    width: 1200,
    height: 1000,
    show: show,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      spellcheck: false,
    },
    icon: path.join(__dirname, '../public/favicon.svg'),
  });

  if (isDev) {
    mainWin.loadURL('http://localhost:5173');
    if (show) mainWin.webContents.openDevTools();
  } else {
    mainWin.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWin.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWin.hide();
    }
    return false;
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../public/favicon.svg');
    // Em Windows, SVGs podem falhar no Tray. Tentamos carregar de forma segura.
    let trayIcon = nativeImage.createFromPath(iconPath);
    
    if (trayIcon.isEmpty()) {
      console.warn('Main: Ícone não carregado, usando fallback de texto.');
      // Se falhar, criamos sem ícone ou com um ícone vazio se possível
      // Mas Tray precisa de um ícone no Windows. 
      // Usaremos o próprio path e deixamos o Electron tentar lidar ou falhar silenciosamente no try-catch
    }

    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Abrir PsychDash', click: () => {
        if (!mainWin) createWindow();
        else mainWin.show();
      }},
      { label: 'Modo Navegador', click: () => {
        shell.openExternal('http://localhost:5173');
      }},
      { type: 'separator' },
      { label: 'Sair', click: () => {
        app.isQuitting = true;
        app.quit();
      }}
    ]);
    tray.setToolTip('PsychDash Server');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWin) mainWin.show();
      else createWindow();
    });
  } catch (err) {
    console.error('Main: Erro crítico ao criar Tray:', err.message);
    // Não deixamos o erro derrubar o app
  }
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
  if (mainWin) {
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show();
    mainWin.focus();
  }
});

app.whenReady().then(() => {
  try {
    initDatabase();
    createTray();
    createWindow(true);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(true);
      else if (mainWin) mainWin.show();
    });
  } catch (err) {
    console.error('Main: Erro crítico na inicialização:', err.message);
  }
}).catch(err => {
  console.error('Main: Rejeição não tratada no app.whenReady:', err);
});

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../public/favicon.svg');
    let trayIcon;
    
    try {
      trayIcon = nativeImage.createFromPath(iconPath);
      if (trayIcon.isEmpty()) throw new Error('Empty icon');
    } catch (e) {
      // Fallback 16x16 PNG azul sólido
      const base64Icon = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEUlEQVR42mNk+M9AHGA0EAQAABCFAEE9y7XAAAAAAElFTkSuQmCC';
      trayIcon = nativeImage.createFromBuffer(Buffer.from(base64Icon, 'base64'));
    }

    tray = new Tray(trayIcon);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Abrir PsychDash', click: () => {
        if (!mainWin) createWindow();
        else mainWin.show();
      }},
      { label: 'Modo Navegador', click: () => {
        shell.openExternal('http://localhost:5173');
      }},
      { type: 'separator' },
      { label: 'Sair', click: () => {
        app.isQuitting = true;
        app.quit();
      }}
    ]);
    tray.setToolTip('PsychDash Server');
    tray.setContextMenu(contextMenu);
    tray.on('double-click', () => {
      if (mainWin) mainWin.show();
      else createWindow();
    });
  } catch (err) {
    console.error('Main: Erro ao criar Tray:', err.message);
  }
}

ipcMain.handle('update-app-settings', async (event, { startWithWindows }) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: startWithWindows,
      path: app.getPath('exe')
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
