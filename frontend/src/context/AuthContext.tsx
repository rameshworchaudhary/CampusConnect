import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User | null) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cc_auth_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('cc_auth_user');
    return saved ? JSON.parse(saved) : null;
  });

  const role = user ? user.role : null;
  const isAuthenticated = !!token && !!user;

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('cc_auth_token', newToken);
    localStorage.setItem('cc_auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('cc_auth_token');
    localStorage.removeItem('cc_auth_user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const res = await apiClient.get('/auth/me');
      if (res.data && res.data.data) {
        setUser(res.data.data);
        localStorage.setItem('cc_auth_user', JSON.stringify(res.data.data));
      }
    } catch {
      localStorage.removeItem('cc_auth_token');
      localStorage.removeItem('cc_auth_user');
      setToken(null);
      setUser(null);
    }
  };

  useEffect(() => {
    if (token) {
      refreshUser();
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, role, isAuthenticated, login, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
