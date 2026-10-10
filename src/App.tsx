import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { ClubsPage } from './pages/ClubsPage';
import { EventsPage } from './pages/EventsPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { ClubAdminDashboard } from './pages/ClubAdminDashboard';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
