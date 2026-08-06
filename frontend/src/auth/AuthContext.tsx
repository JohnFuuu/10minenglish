import { createContext, useContext, useState, type ReactNode } from 'react';

export type AccountRole = 'user' | 'buddy' | 'admin';

export interface Account {
  id: string;
  role: AccountRole;
}

interface AuthContextValue {
  account: Account | null;
  login: (role: AccountRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);

  const login = (role: AccountRole) => setAccount({ id: 'stub-account', role });
  const logout = () => setAccount(null);

  return (
    <AuthContext.Provider value={{ account, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
