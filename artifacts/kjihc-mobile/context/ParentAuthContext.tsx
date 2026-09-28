import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getBaseUrl } from '@workspace/api-client-react';
import { registerParentPushToken, unregisterParentPushToken } from '@/lib/pushNotifications';

const TOKEN_KEY        = 'kjihc_parent_token';
const EMAIL_KEY        = 'kjihc_parent_email';
const SELECTED_CHILD_KEY = 'kjihc_selected_child_id';

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function secureSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}

async function secureDelete(key: string): Promise<void> {
  if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}

interface ParentAuthContextValue {
  token: string | null;
  email: string | null;
  selectedChildId: number | null;
  setSession: (token: string, email: string) => Promise<void>;
  clearSession: () => Promise<void>;
  setSelectedChildId: (id: number) => void;
  isLoaded: boolean;
}

const ParentAuthContext = createContext<ParentAuthContextValue | null>(null);

export function ParentAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildIdState] = useState<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedEmail, storedChild] = await Promise.all([
          secureGet(TOKEN_KEY),
          secureGet(EMAIL_KEY),
          AsyncStorage.getItem(SELECTED_CHILD_KEY),
        ]);

        if (storedToken) {
          // Validate the stored token before trusting it — a 401 means it
          // expired or was revoked, so we clear it immediately rather than
          // letting every screen fail silently with 401s.
          try {
            const base = getBaseUrl() ?? '';
            const res = await fetch(`${base}/api/parent/children`, {
              headers: { Authorization: `Bearer ${storedToken}` },
            });
            if (res.status === 401) {
              // Token rejected — wipe storage and leave state null so the
              // tab layout redirects to the login screen.
              await Promise.all([
                secureDelete(TOKEN_KEY),
                secureDelete(EMAIL_KEY),
                AsyncStorage.removeItem(SELECTED_CHILD_KEY),
              ]);
            } else {
              setToken(storedToken);
              setEmail(storedEmail);
              if (storedChild) setSelectedChildIdState(parseInt(storedChild, 10));
              registerParentPushToken(storedToken).catch(() => {});
            }
          } catch {
            // Network error — assume token is still good so we don't log out
            // offline users; the individual screens will show their own errors.
            setToken(storedToken);
            setEmail(storedEmail);
            if (storedChild) setSelectedChildIdState(parseInt(storedChild, 10));
          }
        }
      } catch {
        // ignore — user will log in again
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  const setSession = async (t: string, e: string) => {
    await Promise.all([secureSet(TOKEN_KEY, t), secureSet(EMAIL_KEY, e)]);
    setToken(t);
    setEmail(e);
    registerParentPushToken(t).catch(() => {});
  };

  const clearSession = async () => {
    if (token) await unregisterParentPushToken(token).catch(() => {});
    await Promise.all([
      secureDelete(TOKEN_KEY),
      secureDelete(EMAIL_KEY),
      AsyncStorage.removeItem(SELECTED_CHILD_KEY),
    ]);
    setToken(null);
    setEmail(null);
    setSelectedChildIdState(null);
  };

  const setSelectedChildId = (id: number) => {
    AsyncStorage.setItem(SELECTED_CHILD_KEY, String(id)).catch(() => {});
    setSelectedChildIdState(id);
  };

  return (
    <ParentAuthContext.Provider
      value={{ token, email, selectedChildId, setSession, clearSession, setSelectedChildId, isLoaded }}
    >
      {children}
    </ParentAuthContext.Provider>
  );
}

export function useParentAuth() {
  const ctx = useContext(ParentAuthContext);
  if (!ctx) throw new Error('useParentAuth must be used within ParentAuthProvider');
  return ctx;
}
