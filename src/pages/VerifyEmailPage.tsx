import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { apiClient } from '../api/client';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');
  const attemptedToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setMessage('No verification token provided in the URL.');
      return;
    }

    if (attemptedToken.current === token) {
      return;
    }
    attemptedToken.current = token;

    const doVerify = async () => {
      try {
        const res = await apiClient.get(`/auth/verify-email?token=${encodeURIComponent(token)}`);
        setVerified(true);
        setMessage(res.data.message || 'Your email has been verified successfully!');
      } catch (err: any) {
        setVerified(false);
        setMessage(err.response?.data?.message || 'Verification failed. The link may have expired or was already used.');
      } finally {
        setLoading(false);
      }
    };

    doVerify();
  }, [token]);

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Email Verification" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-space-lg shadow-xl flex flex-col gap-space-md text-center">
          {loading ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[32px] animate-spin text-primary">
                progress_activity
              </span>
              <p className="font-body-md text-on-surface-variant">Verifying credentials with registry...</p>
            </div>
          ) : verified ? (
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center mx-auto text-primary">
                <span className="material-symbols-outlined text-[28px]">verified</span>
              </div>
              <h1 className="font-headline-md text-on-surface font-bold tracking-tight">Email Verified</h1>
              <p className="font-body-md text-on-surface-variant">{message}</p>
              <Link
                to="/login"
                className="h-11 bg-primary text-on-primary font-label-md rounded-xl font-semibold flex items-center justify-center hover:opacity-95 shadow-md transition-opacity mt-2"
              >
                Proceed to Sign In
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center mx-auto text-primary">
                <span className="material-symbols-outlined text-[28px]">error</span>
              </div>
              <h1 className="font-headline-md text-on-surface font-bold tracking-tight">Verification Failed</h1>
              <p className="font-body-md text-on-surface-variant">{message}</p>
              <Link
                to="/login"
                className="h-11 bg-surface-container text-on-surface font-label-md rounded-xl font-semibold flex items-center justify-center hover:bg-surface-container-high transition-colors mt-2 border border-outline-variant/30"
              >
                Return to Sign In
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
