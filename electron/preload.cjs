const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    query: (sql, bind) => ipcRenderer.invoke('db-query', { sql, bind }),
    exec: (sql, bind) => ipcRenderer.invoke('db-exec', { sql, bind }),
    export: () => ipcRenderer.invoke('db-export')
  },
  file: {
    upload: (patientId, category = 'general') => ipcRenderer.invoke('file-upload', { patientId, category }),
    open: (filePath) => ipcRenderer.invoke('file-open', { filePath }),
    delete: (id) => ipcRenderer.invoke('file-delete', { id })
  },
  updateAppSettings: (settings) => ipcRenderer.invoke('update-app-settings', settings)
});
