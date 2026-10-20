import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

const LandingPage = React.lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })));
const ClubsPage = React.lazy(() => import('./pages/ClubsPage').then((module) => ({ default: module.ClubsPage })));
const EventsPage = React.lazy(() => import('./pages/EventsPage').then((module) => ({ default: module.EventsPage })));
const StudentDashboard = React.lazy(() => import('./pages/StudentDashboard').then((module) => ({ default: module.StudentDashboard })));
const ClubAdminDashboard = React.lazy(() => import('./pages/ClubAdminDashboard').then((module) => ({ default: module.ClubAdminDashboard })));
const SuperAdminDashboard = React.lazy(() => import('./pages/SuperAdminDashboard').then((module) => ({ default: module.SuperAdminDashboard })));
const LoginPage = React.lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const VerifyEmailPage = React.lazy(() => import('./pages/VerifyEmailPage').then((module) => ({ default: module.VerifyEmailPage })));
const ForgotPasswordPage = React.lazy(() => import('./pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = React.lazy(() => import('./pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <React.Suspense fallback={<div role="status" aria-live="polite" className="min-h-screen bg-app px-4 flex items-center justify-center text-on-surface-variant">Loading CampusConnect…</div>}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/clubs" element={<ClubsPage />} />
            <Route path="/events" element={<EventsPage />} />
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/club-admin" element={<ClubAdminDashboard />} />
            <Route path="/admin" element={<SuperAdminDashboard />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
