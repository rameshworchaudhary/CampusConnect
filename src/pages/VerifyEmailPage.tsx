import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      if (isSupabaseConfigured) {
        // Supabase passes tokens or access_token in the URL hash / query
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          setVerified(true);
          setMessage('Your email address has been verified successfully!');
          setLoading(false);
          return;
        }

        if (token) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'email',
          });

          if (!error) {
            setVerified(true);
            setMessage('Your email has been verified successfully!');
          } else {
            setVerified(false);
            setMessage(error.message || 'Verification link is invalid or has expired.');
          }
        } else {
          setVerified(true);
          setMessage('Email verification status confirmed.');
        }
      } else {
        setVerified(true);
        setMessage('Your college email account has been verified.');
      }
      setLoading(false);
    };

    verifyToken();
  }, [token]);

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Email Verification" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-24 md:pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-border-default rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md text-center">
          {loading ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[32px] animate-spin text-primary">
                progress_activity
              </span>
              <p className="font-body-md text-on-surface-variant text-xs">Verifying credentials with registry...</p>
            </div>
          ) : verified ? (
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center mx-auto text-primary">
                <span className="material-symbols-outlined text-[28px]">verified</span>
              </div>
              <h1 className="font-headline-md text-on-surface font-bold tracking-tight">Email Verified</h1>
              <p className="font-body-md text-on-surface-variant text-xs">{message}</p>
              <Link
                to="/login"
                className="h-10 bg-primary text-on-primary font-label-md rounded-xl font-semibold flex items-center justify-center hover:opacity-90 shadow-sm transition-opacity mt-2 text-xs"
              >
                Proceed to Sign In
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center mx-auto text-primary">
                <span className="material-symbols-outlined text-[28px]">error</span>
              </div>
              <h1 className="font-headline-md text-on-surface font-bold tracking-tight">Verification Failed</h1>
              <p className="font-body-md text-on-surface-variant text-xs">{message}</p>
              <Link
                to="/login"
                className="h-10 bg-surface-container text-on-surface font-label-md rounded-xl font-semibold flex items-center justify-center hover:bg-surface-container-high transition-colors mt-2 border border-border-default text-xs"
              >
                Return to Sign In
              </Link>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default VerifyEmailPage;
