import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { Club, EventItem, Membership, AuditLogItem } from '../types';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const ClubAdminDashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [club, setClub] = useState<Club | null>(null);
  const [stats, setStats] = useState({
    totalMembers: 0,
    pendingRequests: 0,
    totalEvents: 0,
    upcomingEvents: 0,
  });

  const [pendingRequests, setPendingRequests] = useState<Membership[]>([]);
  const [clubEvents, setClubEvents] = useState<EventItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showEditClubModal, setShowEditClubModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);

  // Form states
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventLink, setEventLink] = useState('');
  const [eventCapacity, setEventCapacity] = useState(50);
  const [eventDescription, setEventDescription] = useState('');

  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');

  const [editSchedule, setEditSchedule] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAdvisor, setEditAdvisor] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'CLUB_ADMIN' && user?.role !== 'SUPER_ADMIN') {
      navigate('/student');
      return;
    }
    fetchClubData();
  }, [isAuthenticated, user?.role]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      const myClubRes = await apiClient.get('/club-admin/my-club').catch(() => null);
      if (myClubRes?.data?.data) {
        const c: Club = myClubRes.data.data;
        setClub(c);
        setEditSchedule(c.meetingSchedule || '');
        setEditLocation(c.meetingLocation || '');
        setEditAdvisor(c.facultyAdvisor || '');
        setEditDesc(c.description || '');

        const reqRes = await apiClient.get(`/club-admin/clubs/${c.id}/requests`).catch(() => null);
        if (reqRes?.data?.data) {
          setPendingRequests(reqRes.data.data);
        }

        const eventsRes = await apiClient.get('/events/public').catch(() => null);
        if (eventsRes?.data?.data) {
          const clubEvts = (eventsRes.data.data as EventItem[]).filter((e) => e.clubId === c.id);
          setClubEvents(clubEvts);
        }
      }

      const statsRes = await apiClient.get('/club-admin/stats').catch(() => null);
      if (statsRes?.data?.data) {
        setStats(statsRes.data.data);
      }

      const auditRes = await apiClient.get('/admin/audit-logs').catch(() => null);
      if (auditRes?.data?.data) {
        setActivityLogs(auditRes.data.data);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  const handleReviewRequest = async (membershipId: number, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiClient.put(`/club-admin/memberships/${membershipId}/review`, { status });
      setToastMessage(`Application ${status.toLowerCase()} successfully.`);
      setPendingRequests((prev) => prev.filter((m) => m.id !== membershipId));
      fetchClubData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Error updating membership request.');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/club-admin/events', {
        title: eventTitle,
        eventDate,
        location: eventLocation,
        eventLink,
        capacity: eventCapacity,
        description: eventDescription,
        badgeLabel: 'Club Event',
      });
      setToastMessage('Club event published successfully!');
      setShowCreateEventModal(false);
      setEventTitle('');
      setEventDate('');
      setEventLocation('');
      setEventLink('');
      setEventDescription('');
      fetchClubData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to publish event.');
    }
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      await apiClient.delete(`/club-admin/events/${eventToDelete.id}`);
      setToastMessage('Event deleted.');
      setEventToDelete(null);
      fetchClubData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to delete event.');
    }
  };

  const handleDeleteEvent = (event: EventItem) => {
    setEventToDelete(event);
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/club-admin/announcements', {
        title: announcementTitle,
        content: announcementContent,
      });
      setToastMessage('Announcement broadcasted!');
      setShowAnnouncementModal(false);
      setAnnouncementTitle('');
      setAnnouncementContent('');
      fetchClubData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to post announcement.');
    }
  };

  const handleUpdateClubInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club) return;
    try {
      await apiClient.put(`/club-admin/clubs/${club.id}`, {
        meetingSchedule: editSchedule,
        meetingLocation: editLocation,
        facultyAdvisor: editAdvisor,
        description: editDesc,
      });
      setToastMessage('Club information saved.');
      setShowEditClubModal(false);
      fetchClubData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to update club information.');
    }
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Club Officer Hub" />

      <main className="flex-1 w-full pt-20 pb-24 md:pb-12 bg-surface px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Status Header */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-border-default shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold text-[11px]">
                  Charter ID: {club?.refId || 'N/A'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs bg-surface-container text-primary font-semibold px-2 py-0.5 rounded-full border border-border-default">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                  Officer Privileges
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
                {club?.name || 'Assigned Student Organization'}
              </h1>

              <p className="text-xs sm:text-sm text-on-surface-variant">
                Officer: <span className="font-semibold text-on-surface">{user?.fullName}</span> • Advisor:{' '}
                <span className="font-semibold text-on-surface">{club?.facultyAdvisor || 'Unassigned'}</span>
              </p>
            </div>

            {/* Top Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateEventModal(true)}
                className="h-10 px-4 bg-primary text-on-primary text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 hover:opacity-90 shadow-sm transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Create Event</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(true)}
                className="h-10 px-4 bg-surface-container text-on-surface text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 hover:bg-surface-container-high transition-colors border border-border-default"
              >
                <span className="material-symbols-outlined text-[18px]">campaign</span>
                <span>Broadcast</span>
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold text-[10px] sm:text-[11px]">
                Approved Members
              </span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {stats.totalMembers}
                </span>
                <span className="text-xs text-on-surface-variant">Active</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold text-[10px] sm:text-[11px]">
                Pending Review
              </span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-on-surface font-bold tabular-nums">
                  {stats.pendingRequests}
                </span>
                <span className="text-xs text-on-surface-variant">Review</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold text-[10px] sm:text-[11px]">
                Active Events
              </span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {stats.totalEvents}
                </span>
                <span className="text-xs text-on-surface-variant">Hosted</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold text-[10px] sm:text-[11px]">
                Upcoming
              </span>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {stats.upcomingEvents}
                </span>
                <span className="text-xs text-on-surface-variant">Upcoming</span>
              </div>
            </div>
          </div>

          {/* 2-Column Responsive Officer Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column (8 cols): Applications & Events */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Pending Membership Requests */}
              <section id="pending-requests" className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-border-default">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">person_add</span>
                    <h2 className="text-base sm:text-lg text-on-surface font-semibold">
                      Pending Membership Applications
                    </h2>
                  </div>
                  <span className="text-xs text-on-surface-variant font-semibold px-2 py-0.5 rounded bg-surface-container border border-border-default">
                    {pendingRequests.length} {pendingRequests.length === 1 ? 'Applicant' : 'Applicants'}
                  </span>
                </div>

                {pendingRequests.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant">check_circle</span>
                    <p className="font-semibold text-on-surface text-sm">No Pending Applications</p>
                    <p className="text-xs text-on-surface-variant">All student requests for this organization have been reviewed.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="bg-surface-container-low p-4 rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary font-bold text-sm shrink-0 border border-border-default">
                            {req.userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-sm sm:text-base text-on-surface truncate">
                              {req.userName}
                            </span>
                            <span className="text-xs text-on-surface-variant mt-0.5">
                              ID: {req.studentId} • {req.department}
                            </span>
                            <span className="text-xs text-on-surface-variant">
                              {req.userEmail}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default shrink-0">
                          <button
                            type="button"
                            onClick={() => handleReviewRequest(req.id, 'REJECTED')}
                            className="h-8 px-3 rounded-lg border border-border-default text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReviewRequest(req.id, 'APPROVED')}
                            className="h-8 px-4 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 shadow-sm"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Club Events */}
              <section className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-border-default">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">event</span>
                    <h2 className="text-base sm:text-lg text-on-surface font-semibold">
                      Organization Events
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateEventModal(true)}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    + Add Event
                  </button>
                </div>

                {clubEvents.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-[28px] text-on-surface-variant">event_busy</span>
                    <p className="font-semibold text-on-surface text-sm">No Events Created Yet</p>
                    <p className="text-xs text-on-surface-variant">Create and publish events for your student organization members.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {clubEvents.map((evt) => {
                      const percent = Math.min(100, Math.round((evt.registeredCount / (evt.capacity || 1)) * 100));
                      return (
                        <div
                          key={evt.id}
                          className="bg-surface-container-low p-4 rounded-xl border border-border-default flex flex-col gap-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex flex-col min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base text-on-surface truncate">
                                {evt.title}
                              </h3>
                              <span className="text-xs text-on-surface-variant mt-0.5">
                                {evt.eventDate} • {evt.location}
                              </span>
                            </div>
                            <span className="self-start sm:self-auto px-2.5 py-0.5 bg-surface-container text-primary text-[10px] uppercase font-bold rounded-full border border-border-default">
                              {evt.badgeLabel || 'Published'}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-on-surface-variant">Capacity Status</span>
                              <span className="font-semibold text-on-surface tabular-nums">
                                {evt.registeredCount} / {evt.capacity} registered ({percent}%)
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-border-default text-xs">
                            <span className="text-on-surface-variant">
                              ID: #{evt.id}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(evt)}
                              className="text-on-surface hover:text-primary font-medium underline"
                            >
                              Delete Event
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Right Column (4 cols): Charter Details & Quick Actions */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Organization Charter Information */}
              <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between pb-3 border-b border-border-default">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-primary">description</span>
                    <h2 className="text-base text-on-surface font-semibold">
                      Charter Profile
                    </h2>
                  </div>
                  {club && (
                    <button
                      type="button"
                      onClick={() => setShowEditClubModal(true)}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                      Meeting Schedule
                    </span>
                    <p className="font-medium text-on-surface mt-0.5">
                      {club?.meetingSchedule || 'Not set'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                      Meeting Location
                    </span>
                    <p className="font-medium text-on-surface mt-0.5">
                      {club?.meetingLocation || 'Not set'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                      Faculty Advisor
                    </span>
                    <p className="font-medium text-on-surface mt-0.5">
                      {club?.facultyAdvisor || 'Unassigned'}
                    </p>
                  </div>

                  {club?.description && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                        Mission Statement
                      </span>
                      <p className="text-on-surface-variant mt-0.5 line-clamp-3 leading-relaxed">
                        {club.description}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowEditClubModal(true)}
                  className="w-full mt-2 h-9 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  <span>Update Charter Details</span>
                </button>
              </div>

              {/* Fast Announcement Broadcast */}
              <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 shadow-sm flex flex-col gap-3">
                <div className="flex items-center gap-2 pb-3 border-b border-border-default">
                  <span className="material-symbols-outlined text-[20px] text-primary">campaign</span>
                  <h2 className="text-base text-on-surface font-semibold">
                    Member Communications
                  </h2>
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Post bulletins directly to all students enrolled in {club?.name || 'this organization'}.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(true)}
                  className="w-full h-9 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  <span>Post Announcement</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Create Event Modal */}
      <Modal
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        title="Create Club Event"
      >
        <form onSubmit={handleCreateEvent} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
              Event Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. AI Hackathon Workshop"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                Date &amp; Time
              </label>
              <input
                type="text"
                required
                placeholder="Oct 24 • 10:00 AM"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                Capacity
              </label>
              <input
                type="number"
                required
                min={1}
                value={eventCapacity}
                onChange={(e) => setEventCapacity(Number(e.target.value))}
                className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
              Location
            </label>
            <input
              type="text"
              required
              placeholder="Hall B, Tech Center"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Event description..."
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => setShowCreateEventModal(false)}
              className="h-10 px-4 rounded-xl bg-surface-container text-on-surface font-label-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 px-5 rounded-xl bg-primary text-on-primary font-label-sm font-semibold shadow-sm"
            >
              Publish Event
            </button>
          </div>
        </form>
      </Modal>

      {/* Announcement Modal */}
      <Modal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        title="Post Organization Announcement"
      >
        <form onSubmit={handleCreateAnnouncement} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
              Title
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Schedule Update for Lab B"
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
              className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
              Content
            </label>
            <textarea
              rows={4}
              required
              placeholder="Broadcast message..."
              value={announcementContent}
              onChange={(e) => setAnnouncementContent(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => setShowAnnouncementModal(false)}
              className="h-10 px-4 rounded-xl bg-surface-container text-on-surface font-label-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 px-5 rounded-xl bg-primary text-on-primary font-label-sm font-semibold shadow-sm"
            >
              Broadcast
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Charter Modal */}
      <Modal
        isOpen={showEditClubModal}
        onClose={() => setShowEditClubModal(false)}
        title="Edit Organization Charter"
      >
        <form onSubmit={handleUpdateClubInfo} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
              Meeting Schedule
            </label>
            <input
              type="text"
              value={editSchedule}
              onChange={(e) => setEditSchedule(e.target.value)}
              className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
              Meeting Location
            </label>
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
              Faculty Advisor
            </label>
            <input
              type="text"
              value={editAdvisor}
              onChange={(e) => setEditAdvisor(e.target.value)}
              className="h-11 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
              Description
            </label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-outline-variant/40 rounded-xl font-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => setShowEditClubModal(false)}
              className="h-10 px-4 rounded-xl bg-surface-container text-on-surface font-label-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 px-5 rounded-xl bg-primary text-on-primary font-label-sm font-semibold shadow-sm"
            >
              Save Charter
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Event Confirmation Modal */}
      <Modal
        isOpen={!!eventToDelete}
        onClose={() => setEventToDelete(null)}
        title="Confirm Event Deletion"
      >
        <div className="flex flex-col gap-4">
          <p className="font-body-md text-on-surface-variant">
            Are you sure you want to delete <span className="font-semibold text-on-surface">"{eventToDelete?.title}"</span>? This will remove all student registrations.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => setEventToDelete(null)}
              className="h-10 px-4 rounded-xl bg-surface-container text-on-surface font-label-sm font-semibold hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteEvent}
              className="h-10 px-5 rounded-xl bg-primary text-on-primary font-label-sm font-semibold shadow-sm hover:opacity-95 transition-opacity"
            >
              Delete Event
            </button>
          </div>
        </div>
      </Modal>

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      <BottomNav />
    </div>
  );
};
