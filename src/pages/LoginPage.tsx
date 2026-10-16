import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Toast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { signIn } from '../services/authService';

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
      const { user: loggedInUser, token } = await signIn({ email, password });
      login(token, loggedInUser);

      if (loggedInUser.role === 'SUPER_ADMIN') {
        navigate('/admin');
      } else if (loggedInUser.role === 'CLUB_ADMIN') {
        navigate('/club-admin');
      } else {
        navigate('/student');
      }
    } catch (err: any) {
      const msg = err.message || 'Login failed. Please verify your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Sign In" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-24 md:pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-border-default rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
          <div className="flex flex-col gap-1 text-center">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary mx-auto mb-1 shadow-sm">
              <span className="material-symbols-outlined text-[24px]">school</span>
            </div>
            <h1 className="font-headline-md text-on-surface font-bold tracking-tight">
              Sign In to CampusConnect
            </h1>
            <p className="font-body-sm text-on-surface-variant">
              Academic affairs, college clubs, and student management portal
            </p>
          </div>

          {error && (
            <div className="p-3 bg-surface-container border border-border-default rounded-xl text-on-surface font-body-sm">
              <span className="font-semibold block mb-0.5 text-on-surface">Authentication Error</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm">
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                College Email
              </label>
              <input
                type="email"
                required
                placeholder="student@univ.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 px-3.5 bg-surface-container-lowest border border-border-default rounded-xl font-body-md text-on-surface focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="font-label-sm text-label-sm text-primary hover:underline text-[12px]"
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
                className="h-11 px-3.5 bg-surface-container-lowest border border-border-default rounded-xl font-body-md text-on-surface focus:outline-none focus:border-black transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 bg-primary text-on-primary font-label-md rounded-xl font-semibold hover:opacity-90 shadow-sm active:scale-[0.98] transition-all mt-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-border-default">
            <p className="font-body-sm text-on-surface-variant text-xs">
              Don't have an account?{' '}
              <Link to="/register" className="font-semibold text-primary underline">
                Register as Student
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      <BottomNav />
    </div>
  );
};

export default LoginPage;
