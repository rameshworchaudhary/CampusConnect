import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { EventItem, AnnouncementItem, Membership } from '../types';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const StudentDashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    joinedClubs: 0,
    pendingRequests: 0,
    upcomingEvents: 0,
    unreadAnnouncements: 0,
  });

  const [registeredEvents, setRegisteredEvents] = useState<EventItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Settings & Profile Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'STUDENT') {
      navigate(user?.role === 'SUPER_ADMIN' ? '/admin' : '/club-admin');
      return;
    }
    fetchDashboardData();
  }, [isAuthenticated, user?.role]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, eventsRes, annRes, memRes] = await Promise.all([
        apiClient.get('/student/stats').catch(() => null),
        apiClient.get('/student/my-events').catch(() => null),
        apiClient.get('/announcements/public').catch(() => null),
        apiClient.get('/student/memberships').catch(() => null),
      ]);

      if (statsRes?.data?.data) setStats(statsRes.data.data);
      if (eventsRes?.data?.data) setRegisteredEvents(eventsRes.data.data);
      if (annRes?.data?.data) setAnnouncements(annRes.data.data);
      if (memRes?.data?.data) setMemberships(memRes.data.data);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRegistration = async (eventId: number) => {
    try {
      await apiClient.delete(`/student/events/${eventId}/cancel`);
      setToastMessage('Event registration cancelled successfully.');
      setRegisteredEvents((prev) => prev.filter((e) => e.id !== eventId));
      setStats((prev) => ({ ...prev, upcomingEvents: Math.max(0, prev.upcomingEvents - 1) }));
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to cancel registration.');
    }
  };

  const handleCancelMembership = async (clubId: number) => {
    try {
      await apiClient.delete(`/student/clubs/${clubId}/cancel-request`);
      setToastMessage('Membership request cancelled.');
      setMemberships((prev) => prev.filter((m) => m.clubId !== clubId));
      setStats((prev) => ({ ...prev, pendingRequests: Math.max(0, prev.pendingRequests - 1) }));
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to cancel request.');
    }
  };

  const handleMarkAnnouncementRead = async (announcementId: number) => {
    try {
      await apiClient.post(`/student/announcements/${announcementId}/read`);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcementId ? { ...a, isRead: true } : a))
      );
      setStats((prev) => ({ ...prev, unreadAnnouncements: Math.max(0, prev.unreadAnnouncements - 1) }));
      setToastMessage('Announcement marked as read.');
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Error updating status.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    try {
      await apiClient.post('/auth/change-password', { oldPassword, newPassword });
      setPasswordSuccess('Password successfully changed.');
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Failed to change password.');
    }
  };

  const pendingRequestsList = memberships.filter((m) => m.status === 'PENDING');

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Officer Dashboard" />

      <main className="flex-1 flex flex-col relative w-full pt-20 pb-8 bg-surface px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col w-full gap-space-lg pb-6">
          {/* Welcome / Identification Header */}
          <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-border-default shadow-sm flex flex-col gap-space-xs mt-4">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                Academic Year 2025–2026
              </span>
              <span className="inline-flex items-center gap-1 font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded text-on-surface">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Active Student
              </span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
              Student Dashboard
            </h1>
            <p className="font-body-md text-body-md text-secondary">
              Welcome back, <span className="font-semibold text-primary">{user?.fullName || 'Authenticated user'}</span>{' '}
              (ID: {user?.studentId || 'STU-84920'}) • {user?.department || 'Computer Science Dept'}
            </p>
          </div>

          {/* Primary Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-space-sm">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="h-10 bg-primary text-on-primary font-label-lg text-label-lg rounded-lg flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-sm font-semibold"
            >
              <span className="material-symbols-outlined text-[18px]">travel_explore</span>
              <span>Explore Clubs</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/events')}
              className="h-10 bg-surface-container text-on-surface font-label-lg text-label-lg rounded-lg flex items-center justify-center gap-2 hover:bg-surface-container-high transition-colors font-medium border border-border-default"
            >
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              <span>Browse Events</span>
            </button>
          </div>

          {/* Compact Metrics Grid (4 Monochrome Stat Cards) */}
          <div className="grid grid-cols-2 gap-space-sm">
            <div className="bg-surface-container-lowest p-space-md rounded-xl border border-border-default shadow-sm flex flex-col justify-between h-24">
              <div className="flex items-center justify-between text-secondary">
                <span className="font-label-sm text-label-sm uppercase tracking-wider">Joined Clubs</span>
                <span className="material-symbols-outlined text-[18px]">groups</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-headline-xl-mobile text-headline-xl-mobile text-primary leading-none font-bold tabular-nums">
                  {stats.joinedClubs}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">Active</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl border border-border-default shadow-sm flex flex-col justify-between h-24">
              <div className="flex items-center justify-between text-secondary">
                <span className="font-label-sm text-label-sm uppercase tracking-wider">Pending Requests</span>
                <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-headline-xl-mobile text-headline-xl-mobile text-primary leading-none font-bold tabular-nums">
                  {stats.pendingRequests}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">In review</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl border border-border-default shadow-sm flex flex-col justify-between h-24">
              <div className="flex items-center justify-between text-secondary">
                <span className="font-label-sm text-label-sm uppercase tracking-wider">Upcoming Events</span>
                <span className="material-symbols-outlined text-[18px]">event</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-headline-xl-mobile text-headline-xl-mobile text-primary leading-none font-bold tabular-nums">
                  {stats.upcomingEvents}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">Registered</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl border border-border-default shadow-sm flex flex-col justify-between h-24">
              <div className="flex items-center justify-between text-secondary">
                <span className="font-label-sm text-label-sm uppercase tracking-wider">Announcements</span>
                <span className="material-symbols-outlined text-[18px]">campaign</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-headline-xl-mobile text-headline-xl-mobile text-primary leading-none font-bold tabular-nums">
                  {stats.unreadAnnouncements}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">Unread</span>
              </div>
            </div>
          </div>

          {/* Section: My Registered Events */}
          <section className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">event_available</span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  My Registered Events
                </h2>
              </div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary tabular-nums">
                {registeredEvents.length} Events
              </span>
            </div>

            <div className="flex flex-col gap-space-sm">
              {registeredEvents.length === 0 ? (
                <div className="bg-surface-container-lowest p-space-md rounded-xl border border-border-default text-center text-secondary">
                  No upcoming event registrations. Browse campus events to RSVP!
                </div>
              ) : (
                registeredEvents.map((evt) => (
                  <article
                    key={evt.id}
                    className="bg-surface-container-lowest p-space-md rounded-xl border border-border-default shadow-sm flex flex-col gap-space-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <h3 className="font-label-lg text-label-lg text-primary truncate font-semibold">
                          {evt.title}
                        </h3>
                        <span className="font-body-sm text-body-sm text-secondary">
                          {evt.eventDate} • {evt.location}
                        </span>
                      </div>
                      <span className="shrink-0 bg-primary text-on-primary font-label-sm text-label-sm px-2 py-0.5 rounded uppercase tracking-wider text-[11px] font-semibold">
                        Registered
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
                      <div className="flex items-center gap-1.5 text-secondary">
                        <span className="material-symbols-outlined text-[16px]">location_on</span>
                        <span className="font-body-sm text-body-sm">Check-in at {evt.location}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCancelRegistration(evt.id)}
                        className="font-label-sm text-label-sm text-secondary underline hover:text-primary transition-colors py-1 px-2"
                      >
                        Cancel Registration
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          {/* Section: Recent Announcements */}
          <section className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">notifications_active</span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Recent Announcements
                </h2>
              </div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                Official Notice
              </span>
            </div>

            {announcements.slice(0, 3).map((ann) => (
              <div
                key={ann.id}
                className="bg-surface-container-lowest p-space-md rounded-xl border border-border-default shadow-sm flex flex-col gap-space-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      {!ann.isRead && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                      )}
                      <h3 className="font-label-lg text-label-lg text-primary leading-tight font-semibold">
                        {ann.title}
                      </h3>
                    </div>
                    <span className="font-body-sm text-body-sm text-secondary mt-1">
                      Posted by: {ann.postedByName}
                    </span>
                  </div>
                </div>

                <p className="font-body-md text-body-md text-on-surface bg-surface-container-low p-space-sm rounded-lg border border-border-subtle">
                  {ann.content}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-body-sm text-body-sm text-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    Campus Affairs
                  </span>
                  {!ann.isRead ? (
                    <button
                      type="button"
                      onClick={() => handleMarkAnnouncementRead(ann.id)}
                      className="h-8 px-3 bg-surface-container text-on-surface font-label-sm text-label-sm rounded uppercase tracking-wider hover:bg-surface-container-high transition-colors font-medium border border-border-default"
                    >
                      Mark as Read
                    </button>
                  ) : (
                    <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                      Read
                    </span>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* Section: Membership Requests Tracker */}
          <section className="flex flex-col gap-space-sm">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">pending_actions</span>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Membership Requests Tracker
                </h2>
              </div>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary tabular-nums">
                {pendingRequestsList.length} Active
              </span>
            </div>

            {pendingRequestsList.length === 0 ? (
              <div className="bg-surface-container-lowest p-space-lg rounded-xl border border-border-default text-center flex flex-col items-center justify-center gap-1 shadow-sm">
                <span className="material-symbols-outlined text-[28px] text-secondary">check_circle</span>
                <p className="font-label-lg text-label-lg text-primary font-semibold">
                  No pending membership requests
                </p>
                <p className="font-body-sm text-body-sm text-secondary">
                  Browse club directory to request new access.
                </p>
              </div>
            ) : (
              pendingRequestsList.map((m) => (
                <div
                  key={m.id}
                  className="bg-surface-container-lowest p-space-md rounded-xl border border-border-default shadow-sm flex flex-col gap-space-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <h3 className="font-label-lg text-label-lg text-primary truncate font-semibold">
                        {m.clubName}
                      </h3>
                      <span className="font-body-sm text-body-sm text-secondary">
                        Requested: General Member Tier
                      </span>
                    </div>
                    <span className="shrink-0 bg-surface-container text-on-surface font-label-sm text-label-sm px-2 py-0.5 rounded uppercase tracking-wider text-[11px] font-semibold border border-border-default">
                      Pending Review
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                    <div className="flex items-center gap-1 text-secondary">
                      <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
                      <span className="font-body-sm text-body-sm">Awaiting Officer Sign-off</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancelMembership(m.clubId)}
                      className="font-label-sm text-label-sm text-secondary underline hover:text-primary transition-colors py-1 px-2"
                    >
                      Cancel Request
                    </button>
                  </div>
                </div>
              ))
            )}
          </section>

          {/* Profile & Preferences Shortcuts */}
          <section className="flex flex-col gap-space-sm pt-2">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary px-1">
              Account & Settings
            </span>
            <div className="bg-surface-container-lowest rounded-xl border border-border-default shadow-sm overflow-hidden flex flex-col">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="w-full text-left p-space-md flex items-center justify-between hover:bg-surface-container-low transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">badge</span>
                  </span>
                  <div className="flex flex-col">
                    <span className="font-label-lg text-label-lg text-primary font-semibold">
                      View Student Profile
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">
                      Academic ledger, verified badges, active roster
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[20px] text-secondary">chevron_right</span>
              </button>

              <div className="h-[1px] bg-surface-container mx-space-md"></div>

              <button
                type="button"
                onClick={() => setShowPasswordModal(true)}
                className="w-full text-left p-space-md flex items-center justify-between hover:bg-surface-container-low transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-[18px]">tune</span>
                  </span>
                  <div className="flex flex-col">
                    <span className="font-label-lg text-label-lg text-primary font-semibold">
                      Account & Security Settings
                    </span>
                    <span className="font-body-sm text-body-sm text-secondary">
                      Change password, authentication settings
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[20px] text-secondary">chevron_right</span>
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* Profile Details Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Student Profile"
      >
        <div className="flex flex-col gap-4">
          <div className="bg-surface-container-low p-4 rounded-lg flex flex-col gap-2">
            <div className="flex justify-between font-body-sm">
              <span className="text-secondary">Full Name:</span>
              <span className="font-semibold text-primary">{user?.fullName}</span>
            </div>
            <div className="flex justify-between font-body-sm">
              <span className="text-secondary">College Email:</span>
              <span className="font-semibold text-primary">{user?.email}</span>
            </div>
            <div className="flex justify-between font-body-sm">
              <span className="text-secondary">Student ID:</span>
              <span className="font-semibold text-primary">{user?.studentId || 'STU-84920'}</span>
            </div>
            <div className="flex justify-between font-body-sm">
              <span className="text-secondary">Department:</span>
              <span className="font-semibold text-primary">{user?.department || 'Computer Science'}</span>
            </div>
            <div className="flex justify-between font-body-sm">
              <span className="text-secondary">Verification Status:</span>
              <span className="font-semibold text-primary">
                {user?.isVerified ? '● Verified Student' : 'Unverified'}
              </span>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="h-9 px-4 bg-primary text-on-primary font-label-md rounded hover:bg-neutral-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
      >
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
          {passwordError && (
            <div className="p-2 bg-surface-container text-primary font-body-sm rounded border border-border-default">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="p-2 bg-surface-container text-primary font-body-sm rounded border border-border-default">
              {passwordSuccess}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Current Password</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">New Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              className="h-9 px-4 bg-surface-container text-on-surface font-label-md rounded hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 bg-primary text-on-primary font-label-md rounded hover:bg-neutral-800 transition-colors"
            >
              Update Password
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      <BottomNav />
    </div>
  );
};
