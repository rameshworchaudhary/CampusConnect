import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { signUp } from '../services/authService';

export const RegisterPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signUp({
        fullName,
        email,
        password,
        studentId,
        department,
      });

      setSuccessInfo(
        res.message ||
        'Registration successful! You may now sign in with your credentials.'
      );
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-app font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Registration" />

      <main className="flex-1 flex flex-col items-center justify-start md:justify-center pt-24 md:pt-20 pb-24 md:pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-border-default rounded-2xl p-space-lg shadow-sm flex flex-col gap-space-md">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-headline-md text-on-surface font-bold tracking-tight">
              Create Student Account
            </h1>
            <p className="font-body-sm text-on-surface-variant text-xs">
              Join college organizations, discover clubs, and RSVP to campus events
            </p>
          </div>

          {error && (
            <div className="p-3 bg-surface-container border border-border-default rounded-xl text-on-surface font-body-sm">
              <span className="font-semibold block mb-0.5 text-on-surface text-xs">Registration Error</span>
              <span className="text-xs">{error}</span>
            </div>
          )}

          {successInfo ? (
            <div className="p-4 bg-surface-container-low border border-border-default rounded-xl flex flex-col gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center mx-auto text-primary">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <h2 className="font-headline-sm text-on-surface font-semibold text-sm">Registration Completed</h2>
              <p className="font-body-md text-on-surface-variant text-xs">{successInfo}</p>

              <Link
                to="/login"
                className="h-10 bg-accent text-on-accent font-label-md rounded-xl flex items-center justify-center font-semibold hover:opacity-90 shadow-sm transition-opacity mt-2 text-xs"
              >
                Go to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="Alex Morgan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 px-3.5 bg-surface-container-lowest border border-border-default rounded-xl font-body-md text-on-surface focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                  College Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="alex.morgan@univ.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 px-3.5 bg-surface-container-lowest border border-border-default rounded-xl font-body-md text-on-surface focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                    Student ID
                  </label>
                  <input
                    type="text"
                    placeholder="STU-91823"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="h-11 px-3.5 bg-surface-container-lowest border border-border-default rounded-xl font-body-md text-on-surface focus:outline-none focus:border-black transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="Computer Science"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="h-11 px-3.5 bg-surface-container-lowest border border-border-default rounded-xl font-body-md text-on-surface focus:outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 px-3.5 bg-surface-container-lowest border border-border-default rounded-xl font-body-md text-on-surface focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div className="p-3 bg-surface-container rounded-xl border border-border-default text-xs text-on-surface-variant">
                <span className="font-semibold block text-primary mb-0.5">Notice</span>
                Public registrations provision standard Student privileges. Role elevations must be granted by campus administration.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-11 bg-accent text-on-accent font-label-md rounded-xl font-semibold hover:opacity-90 shadow-sm active:scale-[0.98] transition-all mt-2 disabled:opacity-50 text-xs"
              >
                {loading ? 'Creating Account...' : 'Register as Student'}
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-border-default">
            <p className="font-body-sm text-on-surface-variant text-xs">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default RegisterPage;
