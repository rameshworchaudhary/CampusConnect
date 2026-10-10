import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { apiClient } from '../api/client';

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

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
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Reset Password" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border-2 border-primary rounded-lg p-space-lg shadow-xl flex flex-col gap-space-md">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-headline-md text-primary font-bold">Set New Password</h1>
            <p className="font-body-sm text-secondary">
              Enter your new secure password below
            </p>
          </div>

          {error && (
            <div className="p-3 bg-surface-container border border-border-default rounded text-primary font-body-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="p-4 bg-surface-container-low border border-border-default rounded flex flex-col gap-3 text-center">
              <span className="material-symbols-outlined text-[32px] text-primary mx-auto">
                check_circle
              </span>
              <p className="font-body-md text-secondary">
                Your password has been reset successfully! You can now sign in with your new credentials.
              </p>
              <Link
                to="/login"
                className="h-10 bg-primary text-on-primary font-label-md rounded flex items-center justify-center font-semibold hover:bg-neutral-800 transition-colors mt-2"
              >
                Sign In Now
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-secondary uppercase font-semibold">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md text-primary focus:outline-none focus:border-black"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-secondary uppercase font-semibold">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md text-primary focus:outline-none focus:border-black"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-10 bg-primary text-on-primary font-label-lg rounded font-semibold hover:bg-neutral-800 transition-colors mt-2 disabled:opacity-50"
              >
                {loading ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-border-subtle">
            <Link to="/login" className="font-body-sm text-secondary hover:text-primary underline">
              Return to Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
