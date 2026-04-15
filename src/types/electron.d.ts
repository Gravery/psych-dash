export interface IElectronAPI {
  db: {
    query: (sql: string, bind?: any[]) => Promise<any>;
    exec: (sql: string, bind?: any[]) => Promise<any>;
    export: () => Promise<any>;
  };
  file: {
    upload: (patientId: string) => Promise<{ success: boolean; path?: string }>;
    open: (filePath: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}
