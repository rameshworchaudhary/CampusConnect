import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Role } from '../types';
import { getCurrentUser, signOut as supabaseSignOut } from '../services/authService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await supabaseSignOut();
    } catch (err) {
      console.warn('Sign out warning:', err);
    }
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const refreshed = await getCurrentUser();
      if (refreshed) {
        setUser(refreshed);
      } else {
        setUser(null);
        setToken(null);
      }
    } catch (err) {
      console.error('Error refreshing user session:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        if (isSupabaseConfigured) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            setToken(data.session.access_token);
            const profile = await getCurrentUser();
            if (mounted && profile) {
              setUser(profile);
            }
          } else {
            if (mounted) {
              setToken(null);
              setUser(null);
            }
          }
        }
      } catch (err) {
        console.warn('Auth initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    if (isSupabaseConfigured) {
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;
          if (session) {
            setToken(session.access_token);
            const refreshed = await getCurrentUser();
            if (mounted && refreshed) {
              setUser(refreshed);
            }
          } else if (event === 'SIGNED_OUT') {
            if (mounted) {
              setToken(null);
              setUser(null);
            }
          }
        }
      );

      return () => {
        mounted = false;
        authListener.subscription.unsubscribe();
      };
    }

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role: user?.role || null,
        isAuthenticated: Boolean(user),
        loading,
        login,
        logout,
        setUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
