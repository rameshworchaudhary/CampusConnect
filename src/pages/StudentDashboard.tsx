import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { ImageUploader } from '../components/ImageUploader';
import { EventItem, AnnouncementItem, Membership } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { getStudentStats } from '../services/statsService';
import { getUserRegisteredEvents, cancelEventRegistration } from '../services/eventService';
import { getMembershipsForUser, cancelMembershipRequest } from '../services/membershipService';
import { getPublicAnnouncements, markAnnouncementAsRead } from '../services/announcementService';
import { updateProfile, changePassword } from '../services/authService';
import { STORAGE_BUCKETS } from '../services/storageService';
import { StorageImage } from '../components/StorageImage';

export const StudentDashboard: React.FC = () => {
  const { user, setUser, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    enrolledClubs: 0,
    registeredEvents: 0,
    pendingClubRequests: 0,
    unreadAnnouncements: 0,
  });

  const [registeredEvents, setRegisteredEvents] = useState<EventItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Settings & Profile Modals
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileStudentId, setProfileStudentId] = useState('');
  const [profileDepartment, setProfileDepartment] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [profileAvatarPath, setProfileAvatarPath] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user && user.role !== 'STUDENT') {
      navigate(user.role === 'SUPER_ADMIN' ? '/admin' : '/club-admin');
      return;
    }
    if (user) {
      setProfileName(user.fullName || '');
      setProfileStudentId(user.studentId || '');
      setProfileDepartment(user.department || '');
      setProfileAvatarUrl(user.avatarUrl || '');
      setProfileAvatarPath(user.avatarPath || '');
      fetchDashboardData();
    }
  }, [authLoading, isAuthenticated, user?.role, user?.id]);

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setLoadError(null);
      const [statsData, eventsData, annData, memData] = await Promise.all([
        getStudentStats(user.id),
        getUserRegisteredEvents(user.id),
        getPublicAnnouncements(user.id),
        getMembershipsForUser(user.id),
      ]);

      setStats(statsData);
      setRegisteredEvents(eventsData);
      setAnnouncements(annData);
      setMemberships(memData);
    } catch (err: any) {
      console.warn('Dashboard data fetch error:', err);
      setLoadError(err?.message || 'Could not load your dashboard. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRegistration = async (eventId: string) => {
    if (!user) return;
    try {
      await cancelEventRegistration(eventId, user.id, { email: user.email, role: user.role });
      setToastMessage('Event registration cancelled.');
      setRegisteredEvents((prev) => prev.filter((e) => e.id !== eventId));
      setStats((prev) => ({ ...prev, registeredEvents: Math.max(0, prev.registeredEvents - 1) }));
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to cancel registration.');
    }
  };

  const handleCancelMembership = async (clubId: string) => {
    if (!user) return;
    try {
      await cancelMembershipRequest(clubId, user.id, { email: user.email, role: user.role });
      setToastMessage('Membership request withdrawn.');
      setMemberships((prev) => prev.filter((m) => m.clubId !== clubId));
      setStats((prev) => ({ ...prev, pendingClubRequests: Math.max(0, prev.pendingClubRequests - 1) }));
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to cancel request.');
    }
  };

  const handleMarkAnnouncementRead = async (announcementId: string) => {
    if (!user) return;
    try {
      await markAnnouncementAsRead(announcementId, user.id);
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcementId ? { ...a, isRead: true } : a))
      );
      setStats((prev) => ({ ...prev, unreadAnnouncements: Math.max(0, prev.unreadAnnouncements - 1) }));
      setToastMessage('Announcement marked as read.');
    } catch (err: any) {
      setToastMessage(err.message || 'Error updating status.');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      setProfileSaving(true);
      const savedProfile = await updateProfile(
        user.id,
        {
          fullName: profileName.trim(),
          studentId: profileStudentId.trim(),
          department: profileDepartment.trim(),
          avatarPath: profileAvatarPath || null,
        },
        { email: user.email, role: user.role }
      );
      setUser({
        ...user,
        fullName: savedProfile.fullName,
        studentId: savedProfile.studentId || undefined,
        department: savedProfile.department || undefined,
        avatarPath: savedProfile.avatarPath && !savedProfile.avatarPath.startsWith('http')
          ? savedProfile.avatarPath
          : undefined,
        avatarUrl: profileAvatarUrl || undefined,
      });
      setToastMessage('Profile updated successfully.');
      setShowProfileModal(false);
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      await changePassword(newPassword);
      setPasswordSuccess('Password successfully updated.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    }
  };

  return (
    <div className="bg-app font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Student Workspace" unreadCount={stats.unreadAnnouncements} />

      <main className="flex-1 w-full pt-20 pb-24 md:pb-12 bg-app px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {loadError && !loading && (
            <div role="alert" className="bg-surface-container-lowest p-4 rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-on-surface-variant">Dashboard data could not be loaded: {loadError}</p>
              <button type="button" onClick={fetchDashboardData} className="h-9 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold shrink-0">Retry</button>
            </div>
          )}
          {/* Welcome Header */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-border-default shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant font-bold text-[11px]">
                  Campus Portal
                </span>
                <span className="inline-flex items-center gap-1 text-xs bg-surface-container text-primary font-semibold px-2 py-0.5 rounded-full border border-border-default">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                  Verified Student
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
                Welcome back, {user?.fullName || 'Student'}
              </h1>
              <p className="text-xs sm:text-sm text-on-surface-variant">
                ID: <span className="font-medium text-on-surface">{user?.studentId || 'STU-ID'}</span> • Department:{' '}
                <span className="font-medium text-on-surface">{user?.department || 'Undergraduate'}</span> •{' '}
                {user?.email}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="h-10 px-3.5 bg-surface-container text-on-surface text-xs font-semibold rounded-xl flex items-center gap-1.5 hover:bg-surface-container-high transition-colors border border-border-default"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                <span>Edit Profile</span>
              </button>
              <Link
                to="/clubs"
                className="h-10 px-4 bg-accent text-on-accent text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 hover:opacity-90 shadow-sm transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">groups</span>
                <span>Browse Clubs</span>
              </Link>
              <Link
                to="/events"
                className="h-10 px-4 bg-surface-container text-on-surface text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 hover:bg-surface-container-high transition-colors border border-border-default"
              >
                <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                <span>Campus Events</span>
              </Link>
            </div>
          </div>

          {/* Real Metrics Grid (No random data) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="font-label-caps text-label-caps uppercase font-bold text-[10px] sm:text-[11px]">
                  Enrolled Clubs
                </span>
                <span className="material-symbols-outlined text-[18px]">groups</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {loading ? '...' : stats.enrolledClubs}
                </span>
                <span className="text-xs text-on-surface-variant">Active</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="font-label-caps text-label-caps uppercase font-bold text-[10px] sm:text-[11px]">
                  Pending Requests
                </span>
                <span className="material-symbols-outlined text-[18px]">hourglass_top</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {loading ? '...' : stats.pendingClubRequests}
                </span>
                <span className="text-xs text-on-surface-variant">In Review</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="font-label-caps text-label-caps uppercase font-bold text-[10px] sm:text-[11px]">
                  RSVP Events
                </span>
                <span className="material-symbols-outlined text-[18px]">event</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {loading ? '...' : stats.registeredEvents}
                </span>
                <span className="text-xs text-on-surface-variant">Confirmed</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span className="font-label-caps text-label-caps uppercase font-bold text-[10px] sm:text-[11px]">
                  Announcements
                </span>
                <span className="material-symbols-outlined text-[18px]">campaign</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {loading ? '...' : stats.unreadAnnouncements}
                </span>
                <span className="text-xs text-on-surface-variant">Unread</span>
              </div>
            </div>
          </div>

          {/* 2-Column Responsive Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (8 cols): My Events & Memberships */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* My Registered Events */}
              <section className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-border-default">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">event_available</span>
                    <h2 className="text-base sm:text-lg text-on-surface font-semibold">
                      My Registered Events
                    </h2>
                  </div>
                  <span className="text-xs text-on-surface-variant font-semibold px-2 py-0.5 rounded bg-surface-container border border-border-default">
                    {registeredEvents.length} {registeredEvents.length === 1 ? 'Event' : 'Events'}
                  </span>
                </div>

                <div className="flex flex-col gap-3">
                  {registeredEvents.length === 0 ? (
                    <div className="py-8 text-center text-on-surface-variant flex flex-col items-center gap-1.5">
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant">event_busy</span>
                      <p className="font-semibold text-on-surface text-sm">No upcoming event registrations</p>
                      <p className="text-xs text-on-surface-variant max-w-sm">
                        Browse the campus calendar to RSVP for workshops, hackathons, and guest lectures.
                      </p>
                      <Link to="/events" className="mt-2 text-xs text-primary font-semibold hover:underline">
                        View Campus Calendar →
                      </Link>
                    </div>
                  ) : (
                    registeredEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className="bg-surface-container-low p-4 rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-on-surface text-sm sm:text-base truncate">
                              {evt.title}
                            </h3>
                            <span className="bg-accent text-on-accent text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full">
                              Confirmed
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-on-surface-variant mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                              {evt.eventDate}
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">location_on</span>
                              {evt.location}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCancelRegistration(evt.id)}
                            className="h-8 px-3 rounded-lg border border-border-default text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors"
                          >
                            Cancel RSVP
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Club Membership Status */}
              <section className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-border-default">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">groups</span>
                    <h2 className="text-base sm:text-lg text-on-surface font-semibold">
                      Club Membership Status
                    </h2>
                  </div>
                  <span className="text-xs text-on-surface-variant font-semibold px-2 py-0.5 rounded bg-surface-container border border-border-default">
                    {memberships.length} {memberships.length === 1 ? 'Club' : 'Clubs'}
                  </span>
                </div>

                {memberships.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant">groups</span>
                    <p className="font-semibold text-on-surface text-sm">
                      No club memberships yet
                    </p>
                    <p className="text-xs text-on-surface-variant max-w-sm">
                      Browse the organizations directory and send a membership application to join student clubs.
                    </p>
                    <Link to="/clubs" className="mt-2 text-xs text-primary font-semibold hover:underline">
                      Browse Organizations Directory →
                    </Link>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {memberships.map((m) => (
                      <div
                        key={m.id}
                        className="bg-surface-container-low p-4 rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-on-surface text-sm sm:text-base truncate">
                              {m.clubName}
                            </h3>
                            <span
                              className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full border ${
                                m.status === 'APPROVED'
                                  ? 'bg-accent text-on-accent border-accent'
                                  : m.status === 'PENDING'
                                  ? 'bg-surface-container text-primary border-border-default'
                                  : 'bg-surface-container-high text-on-surface border-border-default'
                              }`}
                            >
                              {m.status === 'APPROVED' ? 'Active Member' : m.status}
                            </span>
                          </div>
                          <span className="text-xs text-on-surface-variant mt-1">
                            Applied on {new Date(m.appliedAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default shrink-0">
                          {m.status === 'PENDING' && (
                            <button
                              type="button"
                              onClick={() => handleCancelMembership(m.clubId)}
                              className="h-8 px-3 rounded-lg border border-border-default text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors"
                            >
                              Withdraw Request
                            </button>
                          )}
                          {m.status === 'APPROVED' && (
                            <span className="text-xs text-on-surface-variant flex items-center gap-1 font-medium">
                              <span className="material-symbols-outlined text-[16px]">verified</span>
                              Good Standing
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right Column (4 cols): Announcements & Security */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Campus Announcements */}
              <section className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between pb-3 border-b border-border-default">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">campaign</span>
                    <h2 className="text-base text-on-surface font-semibold">
                      Announcements
                    </h2>
                  </div>
                  {stats.unreadAnnouncements > 0 && (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-accent text-on-accent">
                      {stats.unreadAnnouncements} New
                    </span>
                  )}
                </div>

                {announcements.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-4 text-center">
                    No active bulletins at this time.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {announcements.slice(0, 5).map((ann) => (
                      <div
                        key={ann.id}
                        className="p-3 rounded-xl bg-surface-container-low border border-border-default flex flex-col gap-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-semibold text-xs sm:text-sm text-on-surface line-clamp-1">
                            {ann.title}
                          </h4>
                          {!ann.isRead && (
                            <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1"></span>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                          {ann.content}
                        </p>
                        {ann.imagePath && <StorageImage bucket={STORAGE_BUCKETS.announcementImages} path={ann.imagePath} alt="Announcement attachment" className="max-h-36 w-full rounded-lg object-contain" />}
                        <div className="flex items-center justify-between pt-1 border-t border-border-default/50 text-[11px] text-on-surface-variant">
                          <span>{ann.postedByName}</span>
                          {!ann.isRead ? (
                            <button
                              type="button"
                              onClick={() => handleMarkAnnouncementRead(ann.id)}
                              className="font-semibold text-primary hover:underline"
                            >
                              Mark Read
                            </button>
                          ) : (
                            <span className="text-on-surface-variant">Read</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Account Profile & Security */}
              <div className="bg-surface-container-lowest rounded-2xl border border-border-default shadow-sm p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-sm text-on-surface truncate">
                      Profile &amp; Credentials
                    </span>
                    <span className="text-xs text-on-surface-variant truncate">
                      Manage your student details
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(true)}
                    className="w-full h-9 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">person</span>
                    <span>Edit Profile Details</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(true)}
                    className="w-full h-9 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                    <span>Change Password</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        title="Edit Student Profile"
      >
        <form onSubmit={handleUpdateProfile} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Student ID
            </label>
            <input
              type="text"
              value={profileStudentId}
              onChange={(e) => setProfileStudentId(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Department
            </label>
            <input
              type="text"
              value={profileDepartment}
              onChange={(e) => setProfileDepartment(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1 pt-1">
            <ImageUploader
              bucket={STORAGE_BUCKETS.avatars}
              folderId={user?.id}
              label="Profile Picture (Avatar)"
              currentImageUrl={profileAvatarPath || profileAvatarUrl}
              onImageUploaded={(url, path) => { setProfileAvatarUrl(url); setProfileAvatarPath(path); }}
              onImageRemoved={() => { setProfileAvatarUrl(''); setProfileAvatarPath(''); }}
              aspectRatio="square"
              helperText="JPG, PNG or WebP image (max 5 MB)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={() => setShowProfileModal(false)}
              className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={profileSaving}
              className="h-9 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {profileSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
      >
        <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
          {passwordError && (
            <div className="p-2.5 bg-surface-container text-on-surface font-body-sm rounded-xl border border-border-default text-xs">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="p-2.5 bg-secondary-container text-on-surface font-body-sm rounded-xl text-xs">
              {passwordSuccess}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={() => setShowPasswordModal(false)}
              className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90"
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

export default StudentDashboard;
