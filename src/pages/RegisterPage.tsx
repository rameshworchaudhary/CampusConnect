import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { apiClient } from '../api/client';

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
      const res = await apiClient.post('/auth/register', {
        fullName,
        email,
        password,
        studentId,
        department,
      });

      setSuccessInfo(
        res.data.message ||
        'Registration successful! You may now sign in with your credentials.'
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Registration" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/40 rounded-2xl p-space-lg shadow-xl flex flex-col gap-space-md">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-headline-md text-on-surface font-bold tracking-tight">
              Create Student Account
            </h1>
            <p className="font-body-sm text-on-surface-variant">
              Join college organizations, discover clubs, and RSVP to campus events
            </p>
          </div>

          {error && (
            <div className="p-3 bg-surface-container border border-outline-variant/60 rounded-xl text-on-surface font-body-sm">
              <span className="font-semibold block mb-0.5 text-on-surface">Registration Error</span>
              {error}
            </div>
          )}

          {successInfo ? (
            <div className="p-4 bg-surface-container-low border border-outline-variant/40 rounded-xl flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">verified</span>
                <span className="font-headline-sm text-on-surface font-semibold">Registration Completed</span>
              </div>
              <p className="font-body-md text-on-surface-variant">{successInfo}</p>

              <Link
                to="/login"
                className="h-11 bg-primary text-on-primary font-label-md rounded-xl flex items-center justify-center font-semibold hover:opacity-95 shadow-md transition-opacity mt-2"
              >
                Go to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm">
              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                  College Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="alex.morgan@univ.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                    Student ID
                  </label>
                  <input
                    type="text"
                    placeholder="STU-91823"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="CS Dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

              <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/30 text-xs text-on-surface-variant">
                <span className="font-semibold block text-primary mb-0.5">Notice</span>
                Public registrations provision standard STUDENT privileges. Role elevations must be granted by campus administration.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-11 bg-primary text-on-primary font-label-md rounded-xl font-semibold hover:opacity-95 shadow-md active:scale-[0.98] transition-all mt-2 disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Register as Student'}
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-outline-variant/20">
            <p className="font-body-sm text-on-surface-variant">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-primary underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
