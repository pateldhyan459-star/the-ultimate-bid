import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthState {
  /** True until we know whether someone is signed in and whether they are an admin. */
  loading: boolean;
  session: Session | null;
  /** Decided by the database function is_admin(), never by the browser. */
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Asks the database "am I on the admin allow-list?". */
async function checkAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState<boolean>(supabase !== null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    async function apply(next: Session | null) {
      const admin = next ? await checkAdmin() : false;
      if (cancelled) return;
      setSession(next);
      setIsAdmin(admin);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session));

    // Do not call other Supabase methods directly inside this callback
    // (it can deadlock); defer the work with setTimeout.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setTimeout(() => {
        void apply(next);
      }, 0);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback<AuthState['signIn']>(async (email, password) => {
    if (!supabase) return { error: 'The backend is not configured.' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: 'Incorrect email or password.' };

    // Signed in is not the same as administrator. Check the allow-list.
    if (!(await checkAdmin())) {
      await supabase.auth.signOut();
      // Same wording as a wrong password, so the page does not reveal which accounts exist.
      return { error: 'Incorrect email or password.' };
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ loading, session, isAdmin, signIn, signOut }),
    [loading, session, isAdmin, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
