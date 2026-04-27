const { contextBridge, ipcRenderer } = require('electron');

let refreshCallbacks = new Map();
let callbackIdCounter = 0;
let ipcListenerRegistered = false;

function ensureIpcListener() {
  if (ipcListenerRegistered) return;
  ipcListenerRegistered = true;
  ipcRenderer.on('refresh-data', (_event, data) => {
    for (const [, cb] of refreshCallbacks) {
      try { cb(data); } catch (e) { console.error('refresh-data callback error:', e); }
    }
  });
}

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    query: (sql, bind) => ipcRenderer.invoke('db-query', { sql, bind }),
    exec: (sql, bind) => ipcRenderer.invoke('db-exec', { sql, bind }),
    export: () => ipcRenderer.invoke('db-export'),
    import: () => ipcRenderer.invoke('db-import')
  },
  file: {
    upload: (patientId, category = 'general') => ipcRenderer.invoke('file-upload', { patientId, category }),
    open: (filePath) => ipcRenderer.invoke('file-open', { filePath }),
    delete: (id) => ipcRenderer.invoke('file-delete', { id })
  },
  getLanInfo: (params) => ipcRenderer.invoke('get-lan-info', params),
  onRefreshData: (callback) => {
    ensureIpcListener();
    const id = ++callbackIdCounter;
    refreshCallbacks.set(id, callback);
    return () => {
      refreshCallbacks.delete(id);
    };
  },
  syncBillingReminders: (params) => ipcRenderer.invoke('sync-billing-reminders', params),
  markBillingPaid: (params) => ipcRenderer.invoke('mark-billing-paid', params),
  revertBilling: (params) => ipcRenderer.invoke('revert-billing', params),
  updateAppSettings: (settings) => ipcRenderer.invoke('update-app-settings', settings)
});
