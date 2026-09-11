import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchMe } from '../lib/api';

export type AccountRole = 'user' | 'buddy' | 'admin';

export interface Account {
  id: string;
  name?: string;
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
// Persisted (not just in-memory) so a hard page reload can render the
// signed-in shell immediately instead of RequireAuth blanking the screen
// while the token re-verifies — see readSessionCache's doc comment.
const ACCOUNT_STORAGE_KEY = '10me.cachedAccount';

export function toAccount(me: Awaited<ReturnType<typeof fetchMe>>): Account {
  return {
    id: me.id,
    name: me.name,
    role: me.role as AccountRole,
    onboardingCompleted: me.onboardingCompleted,
    credits: me.credits,
    isNZLocated: me.isNZLocated,
  };
}

function readCachedAccount(): Account | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    return raw !== null ? (JSON.parse(raw) as Account) : null;
  } catch {
    return null;
  }
}

function writeCachedAccount(account: Account | null): void {
  try {
    if (account === null) localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    else localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(account));
  } catch {
    // Storage can be full or unavailable — caching is a nice-to-have.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [storedToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  // Seeded from cache so a hard reload shows the signed-in shell right away;
  // fetchMe below re-verifies and corrects it in the background.
  const [account, setAccount] = useState<Account | null>(() =>
    storedToken ? readCachedAccount() : null,
  );
  const [token, setToken] = useState<string | null>(storedToken);
  const [isLoading, setIsLoading] = useState(Boolean(storedToken) && account === null);

  useEffect(() => {
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    fetchMe(storedToken)
      .then((me) => {
        const nextAccount = toAccount(me);
        setToken(storedToken);
        setAccount(nextAccount);
        writeCachedAccount(nextAccount);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        writeCachedAccount(null);
        setToken(null);
        setAccount(null);
      })
      .finally(() => setIsLoading(false));
    // Runs once on mount against the token captured at load — logging out
    // or setSession afterwards update `token` state directly instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setSession(newToken: string, newAccount: Account) {
    localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    writeCachedAccount(newAccount);
    setToken(newToken);
    setAccount(newAccount);
  }

  function logout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    writeCachedAccount(null);
    setToken(null);
    setAccount(null);
  }

  function completeOnboarding() {
    setAccount((prev) => {
      const next = prev ? { ...prev, onboardingCompleted: true } : prev;
      if (next) writeCachedAccount(next);
      return next;
    });
  }

  function setCredits(credits: number) {
    setAccount((prev) => {
      const next = prev ? { ...prev, credits } : prev;
      if (next) writeCachedAccount(next);
      return next;
    });
  }

  // Profile edits can change values the session carries — editing Location
  // flips isNZLocated, which decides whether POLi is offered — so the account
  // has to be re-read rather than patched field by field.
  const refreshAccount = useCallback(async () => {
    if (!token) return;
    const next = toAccount(await fetchMe(token));
    writeCachedAccount(next);
    setAccount(next);
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
