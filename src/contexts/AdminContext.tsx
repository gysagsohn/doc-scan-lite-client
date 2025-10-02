import { createContext, useContext, useState, ReactNode } from "react";

interface AdminContextType {
  adminMode: boolean;
  setAdminMode: (enabled: boolean) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [adminMode, setAdminMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('admin-mode-enabled');
    return saved === 'true';
  });

  const handleSetAdminMode = (enabled: boolean) => {
    setAdminMode(enabled);
    localStorage.setItem('admin-mode-enabled', String(enabled));
  };

  return (
    <AdminContext.Provider value={{ adminMode, setAdminMode: handleSetAdminMode }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
}