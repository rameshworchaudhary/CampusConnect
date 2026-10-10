import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { apiClient } from '../api/client';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      await apiClient.post('/auth/reset-password', {
        token,
        newPassword,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reset password. Link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Reset Password" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-space-lg shadow-xl flex flex-col gap-space-md">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-headline-md text-on-surface font-bold tracking-tight">Set New Password</h1>
            <p className="font-body-sm text-on-surface-variant">
              Enter your new secure password below
            </p>
          </div>

          {error && (
            <div className="p-3 bg-surface-container border border-outline-variant/60 rounded-xl text-on-surface font-body-sm">
              <span className="font-semibold block mb-0.5 text-on-surface">Error</span>
              {error}
            </div>
          )}

          {success ? (
            <div className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-xl flex flex-col gap-3 text-center">
              <span className="material-symbols-outlined text-[32px] text-primary mx-auto">
                check_circle
              </span>
              <p className="font-body-md text-on-surface-variant">
                Your password has been reset successfully! You can now sign in with your new credentials.
              </p>
              <Link
                to="/login"
                className="h-11 bg-primary text-on-primary font-label-md rounded-xl flex items-center justify-center font-semibold hover:opacity-95 shadow-md transition-opacity mt-2"
              >
                Sign In Now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-11 bg-primary text-on-primary font-label-md rounded-xl font-semibold hover:opacity-95 shadow-md active:scale-[0.98] transition-all mt-2 disabled:opacity-50"
              >
                {loading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-outline-variant/20">
            <Link to="/login" className="font-body-sm text-on-surface-variant hover:text-primary underline">
              Return to Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
