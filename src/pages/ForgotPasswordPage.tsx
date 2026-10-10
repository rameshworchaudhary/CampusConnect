import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { apiClient } from '../api/client';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage(null);
    setLoading(true);

    try {
      const res = await apiClient.post('/auth/forgot-password', { email });
      const msg = res.data.message || 'Password reset link sent to your registered email.';
      setMessage(msg);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Account Recovery" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-space-lg shadow-xl flex flex-col gap-space-md">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-headline-md text-on-surface font-bold tracking-tight">
              Reset Password
            </h1>
            <p className="font-body-sm text-on-surface-variant">
              Enter your registered college email to receive a password recovery link
            </p>
          </div>

          {error && (
            <div className="p-3 bg-surface-container border border-outline-variant/60 rounded-xl text-on-surface font-body-sm">
              <span className="font-semibold block mb-0.5 text-on-surface">Error</span>
              {error}
            </div>
          )}

          {message ? (
            <div className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-xl flex flex-col gap-3 text-center">
              <span className="material-symbols-outlined text-[32px] text-primary mx-auto">
                mark_email_read
              </span>
              <p className="font-body-md text-on-surface-variant">{message}</p>
              <Link
                to="/login"
                className="h-11 bg-primary text-on-primary font-label-md rounded-xl flex items-center justify-center font-semibold hover:opacity-95 shadow-md transition-opacity mt-2"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                  College Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="student@univ.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-11 bg-primary text-on-primary font-label-md rounded-xl font-semibold hover:opacity-95 shadow-md active:scale-[0.98] transition-all mt-2 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Send Reset Link'}
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
