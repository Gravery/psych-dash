const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  db: {
    query: (sql, bind) => ipcRenderer.invoke('db-query', { sql, bind }),
    exec: (sql, bind) => ipcRenderer.invoke('db-exec', { sql, bind }),
    export: () => ipcRenderer.invoke('db-export')
  },
  file: {
    upload: (patientId) => ipcRenderer.invoke('file-upload', { patientId }),
    open: (filePath) => ipcRenderer.invoke('file-open', { filePath })
  }
});
