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
      const msg = res.data.message || 'Password reset link sent.';
      setMessage(msg);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Password Recovery" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border-2 border-primary rounded-lg p-space-lg shadow-xl flex flex-col gap-space-md">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-headline-md text-primary font-bold">Reset Password</h1>
            <p className="font-body-sm text-secondary">
              Enter your registered college email to receive a password reset link
            </p>
          </div>

          {error && (
            <div className="p-3 bg-surface-container border border-border-default rounded text-primary font-body-sm">
              {error}
            </div>
          )}

          {message ? (
            <div className="p-4 bg-surface-container-low border border-border-default rounded flex flex-col gap-3 text-center">
              <span className="material-symbols-outlined text-[32px] text-primary mx-auto">
                mark_email_read
              </span>
              <p className="font-body-md text-secondary">{message}</p>
              <Link
                to="/login"
                className="h-10 bg-primary text-on-primary font-label-md rounded flex items-center justify-center font-semibold hover:bg-neutral-800 transition-colors mt-2"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
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

              <button
                type="submit"
                disabled={loading}
                className="h-10 bg-primary text-on-primary font-label-lg rounded font-semibold hover:bg-neutral-800 transition-colors mt-2 disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Send Reset Link'}
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
