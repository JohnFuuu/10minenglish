import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMe } from '../lib/api';

export type AccountRole = 'user' | 'buddy' | 'admin';

export interface Account {
  id: string;
  role: AccountRole;
  onboardingCompleted: boolean;
  credits: number;
  isNZLocated: boolean;
}

interface AuthContextValue {
  account: Account | null;
  token: string | null;
  isLoading: boolean;
  setSession: (token: string, account: Account) => void;
  completeOnboarding: () => void;
  setCredits: (credits: number) => void;
  refreshAccount: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const TOKEN_STORAGE_KEY = '10me.token';

function toAccount(me: Awaited<ReturnType<typeof fetchMe>>): Account {
  return {
    id: me.id,
    role: me.role as AccountRole,
    onboardingCompleted: me.onboardingCompleted,
    credits: me.credits,
    isNZLocated: me.isNZLocated,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    fetchMe(storedToken)
      .then((me) => {
        setToken(storedToken);
        setAccount(toAccount(me));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      })
      .finally(() => setIsLoading(false));
  }, []);

  function setSession(newToken: string, newAccount: Account) {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
    setAccount(newAccount);
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setAccount(null);
  }

  function completeOnboarding() {
    setAccount((prev) => (prev ? { ...prev, onboardingCompleted: true } : prev));
  }

  function setCredits(credits: number) {
    setAccount((prev) => (prev ? { ...prev, credits } : prev));
  }

  // Profile edits can change values the session carries — editing Location
  // flips isNZLocated, which decides whether POLi is offered — so the account
  // has to be re-read rather than patched field by field.
  const refreshAccount = useCallback(async () => {
    if (!token) return;
    setAccount(toAccount(await fetchMe(token)));
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        account,
        token,
        isLoading,
        setSession,
        completeOnboarding,
        setCredits,
        refreshAccount,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
