import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { Toast } from '../components/Toast';
import { apiClient } from '../api/client';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();

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
        'Registration successful! Please check your email for the verification link.'
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Student Registration" />

      <main className="flex-1 flex flex-col items-center justify-center pt-20 pb-16 px-4">
        <div className="w-full max-w-md bg-surface-container-lowest border-2 border-primary rounded-lg p-space-lg shadow-xl flex flex-col gap-space-md">
          <div className="flex flex-col gap-1 text-center">
            <h1 className="font-headline-md text-primary font-bold tracking-tight">
              Create Student Account
            </h1>
            <p className="font-body-sm text-secondary">
              Join college organizations, discover clubs, and RSVP to campus events
            </p>
          </div>

          {error && (
            <div className="p-3 bg-surface-container border border-border-default rounded text-primary font-body-sm">
              <span className="font-semibold block mb-0.5">Registration Error</span>
              {error}
            </div>
          )}

          {successInfo ? (
            <div className="p-4 bg-surface-container-low border-2 border-black rounded flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">mark_email_read</span>
                <span className="font-headline-sm text-primary font-bold">Verify Your Email</span>
              </div>
              <p className="font-body-md text-secondary">{successInfo}</p>

              <Link
                to="/login"
                className="h-10 bg-primary text-on-primary font-label-md rounded flex items-center justify-center font-semibold hover:bg-neutral-800 transition-colors mt-2"
              >
                Go to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm">
              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-secondary uppercase font-semibold">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md text-primary focus:outline-none focus:border-black"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-secondary uppercase font-semibold">
                  College Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="alex.morgan@univ.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md text-primary focus:outline-none focus:border-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-secondary uppercase font-semibold">
                    Student ID
                  </label>
                  <input
                    type="text"
                    placeholder="STU-91823"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md text-primary focus:outline-none focus:border-black"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-secondary uppercase font-semibold">
                    Department
                  </label>
                  <input
                    type="text"
                    placeholder="CS Dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md text-primary focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-sm text-secondary uppercase font-semibold">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md text-primary focus:outline-none focus:border-black"
                />
              </div>

              <div className="p-2 bg-surface-container rounded border border-border-subtle text-xs text-secondary">
                <span className="font-semibold block text-primary">Notice</span>
                Public registrations automatically provision standard STUDENT privileges. Role elevations must be granted by campus administration.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="h-10 bg-primary text-on-primary font-label-lg rounded font-semibold hover:bg-neutral-800 transition-colors mt-2 disabled:opacity-50"
              >
                {loading ? 'Creating Account...' : 'Register as Student'}
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-border-subtle">
            <p className="font-body-sm text-secondary">
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
