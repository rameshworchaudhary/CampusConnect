import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Toast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/login', { email, password });
      const { token, user: loggedInUser } = res.data;
      login(token, loggedInUser);

      if (loggedInUser.role === 'SUPER_ADMIN') {
        navigate('/admin');
      } else if (loggedInUser.role === 'CLUB_ADMIN') {
        navigate('/club-admin');
      } else {
        navigate('/student');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Account Sign In" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border-2 border-primary rounded-lg p-space-lg shadow-xl flex flex-col gap-space-md">
          <div className="flex flex-col gap-1 text-center">
            <div className="w-10 h-10 rounded-DEFAULT bg-primary flex items-center justify-center text-on-primary mx-auto mb-1">
              <span className="material-symbols-outlined text-[24px]">school</span>
            </div>
            <h1 className="font-headline-md text-primary font-bold tracking-tight">
              Sign In to CampusConnect
            </h1>
            <p className="font-body-sm text-secondary">
              Academic affairs, college clubs, and student management
            </p>
          </div>

          {error && (
            <div className="p-3 bg-surface-container border border-border-default rounded text-primary font-body-sm">
              <span className="font-semibold block mb-0.5">Authentication Error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm">
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-secondary uppercase font-semibold">
                College Email
              </label>
              <input
                type="email"
                required
                placeholder="student@univ.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md text-primary focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="font-label-sm text-secondary uppercase font-semibold">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="font-label-sm text-secondary hover:text-primary underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md text-primary focus:outline-none focus:border-black"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-10 bg-primary text-on-primary font-label-lg rounded font-semibold hover:bg-neutral-800 transition-colors mt-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-border-subtle">
            <p className="font-body-sm text-secondary">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-primary underline">
                Register as Student
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
};
