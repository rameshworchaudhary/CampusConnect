import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { verifySignupEmailCallback } from '../services/authService';

const removeAuthCallbackFromAddressBar = (callbackUrl: string) => {
  try {
    const url = new URL(callbackUrl);
    ['token', 'token_hash', 'type', 'access_token', 'refresh_token', 'expires_in', 'expires_at', 'error', 'error_code', 'error_description'].forEach((key) => {
      url.searchParams.delete(key);
    });
    url.hash = '';
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
  } catch {
    // The verifier will show a safe malformed-link message.
  }
};

export const VerifyEmailPage: React.FC = () => {
  // Supabase may consume callback tokens while restoring its session in an
  // effect. Capture the original URL during render before that can happen.
  const callbackUrlRef = useRef(typeof window === 'undefined' ? '' : window.location.href);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');

  const verify = useCallback(async () => {
    setLoading(true);
    setVerified(false);
    setMessage('');
    try {
      await verifySignupEmailCallback(callbackUrlRef.current);
      setVerified(true);
      setMessage('Your email address has been verified successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not verify this link. Please retry or request a new one.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    removeAuthCallbackFromAddressBar(callbackUrlRef.current);
    void verify();
  }, [verify]);

  return (
    <div className="bg-app font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Email Verification" />

      <main className="flex-1 flex flex-col items-center justify-start md:justify-center pt-24 md:pt-20 pb-24 md:pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-border-default rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md text-center">
          {loading ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[32px] animate-spin text-primary">progress_activity</span>
              <p className="font-body-md text-on-surface-variant text-xs">Verifying your email with Supabase...</p>
            </div>
          ) : verified ? (
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center mx-auto text-primary">
                <span className="material-symbols-outlined text-[28px]">verified</span>
              </div>
              <h1 className="font-headline-md text-on-surface font-bold tracking-tight">Email Verified</h1>
              <p className="font-body-md text-on-surface-variant text-xs">{message}</p>
              <Link to="/login" className="h-10 bg-accent text-on-accent font-label-md rounded-xl font-semibold flex items-center justify-center hover:opacity-90 shadow-sm transition-opacity mt-2 text-xs">
                Proceed to Sign In
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center mx-auto text-primary">
                <span className="material-symbols-outlined text-[28px]">error</span>
              </div>
              <h1 className="font-headline-md text-on-surface font-bold tracking-tight">Email Verification Incomplete</h1>
              <p className="font-body-md text-on-surface-variant text-xs">{message}</p>
              <button type="button" onClick={() => void verify()} className="h-10 bg-accent text-on-accent font-label-md rounded-xl font-semibold hover:opacity-90 transition-opacity text-xs">
                Retry Verification
              </button>
              <Link to="/register" className="text-primary underline font-label-sm text-xs">Return to registration</Link>
              <Link to="/login" className="text-on-surface-variant underline font-label-sm text-xs">Return to sign in</Link>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default VerifyEmailPage;
