import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { resetPasswordForEmail } from '../services/authService';

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
      await resetPasswordForEmail(email);
      setMessage('A password reset link has been sent to your registered college email.');
    } catch (err: any) {
      setError(err.message || 'Could not process the request. Please verify the email and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Account Recovery" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-24 md:pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-border-default rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-headline-md text-on-surface font-bold tracking-tight">
              Reset Password
            </h1>
            <p className="font-body-sm text-on-surface-variant text-xs">
              Enter your registered college email to receive a password recovery link
            </p>
          </div>

          {error && (
            <div className="p-3 bg-surface-container border border-border-default rounded-xl text-on-surface font-body-sm text-xs">
              <span className="font-semibold block mb-0.5 text-on-surface">Error</span>
              {error}
            </div>
          )}

          {message ? (
            <div className="p-4 bg-surface-container-low border border-border-default rounded-xl flex flex-col gap-3 text-center">
              <span className="material-symbols-outlined text-[32px] text-primary mx-auto">
                mark_email_read
              </span>
              <p className="font-body-md text-on-surface-variant text-xs">{message}</p>
              <Link
                to="/login"
                className="h-10 bg-primary text-on-primary font-label-md rounded-xl flex items-center justify-center font-semibold hover:opacity-90 shadow-sm transition-opacity mt-2 text-xs"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
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

              <button
                type="submit"
                disabled={loading}
                className="h-11 bg-primary text-on-primary font-label-md rounded-xl font-semibold hover:opacity-90 shadow-sm active:scale-[0.98] transition-all mt-2 disabled:opacity-50 text-xs"
              >
                {loading ? 'Submitting...' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-border-default">
            <Link to="/login" className="font-body-sm text-on-surface-variant hover:text-primary underline text-xs">
              Return to Sign In
            </Link>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default ForgotPasswordPage;
