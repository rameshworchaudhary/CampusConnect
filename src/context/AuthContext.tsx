import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { apiClient } from '../api/client';
import { Role, User } from '../types';

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
    if (!saved) return null;

    try {
      return JSON.parse(saved) as User;
    } catch {
      localStorage.removeItem('cc_auth_user');
      return null;
    }
  });

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
      const response = await apiClient.get('/auth/me');
      if (response.data?.data) {
        setUser(response.data.data);
        localStorage.setItem('cc_auth_user', JSON.stringify(response.data.data));
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        logout();
        return;
      }

      console.error('Unable to refresh the authenticated user.', error);
    }
  };

  useEffect(() => {
    if (token) refreshUser();
  }, [token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };

    window.addEventListener('cc:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('cc:unauthorized', handleUnauthorized);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, role: user?.role || null, isAuthenticated: !!token && !!user, login, logout, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
