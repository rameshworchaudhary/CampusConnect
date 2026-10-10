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
    upcomingEvents: 0,
    activeRegistrations: 0,
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

  // Form states
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventLink, setEventLink] = useState('');
  const [eventCapacity, setEventCapacity] = useState(100);
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
    if (user?.role !== 'CLUB_ADMIN') {
      navigate(user?.role === 'SUPER_ADMIN' ? '/admin' : '/student');
      return;
    }
    fetchClubData();
  }, [isAuthenticated, user?.role]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      // Fetch assigned club
      const myClubRes = await apiClient.get('/club-admin/my-club').catch(() => null);
      if (myClubRes?.data?.data) {
        const c: Club = myClubRes.data.data;
        setClub(c);
        setEditSchedule(c.meetingSchedule || '');
        setEditLocation(c.meetingLocation || '');
        setEditAdvisor(c.facultyAdvisor || '');
        setEditDesc(c.description || '');

        // Fetch requests for this club
        const reqRes = await apiClient.get(`/club-admin/clubs/${c.id}/requests`).catch(() => null);
        if (reqRes?.data?.data) {
          setPendingRequests(reqRes.data.data);
        }

        // Fetch events for this club
        const eventsRes = await apiClient.get('/events/public').catch(() => null);
        if (eventsRes?.data?.data) {
          const clubEvts = (eventsRes.data.data as EventItem[]).filter((e) => e.clubId === c.id);
          setClubEvents(clubEvts);
        }
      }

      // Fetch stats
      const statsRes = await apiClient.get('/club-admin/stats').catch(() => null);
      if (statsRes?.data?.data) {
        setStats(statsRes.data.data);
      }

      // Fetch activity logs
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
      const res = await apiClient.put(`/club-admin/memberships/${membershipId}/review`, { status });
      setToastMessage(`Request ${status.toLowerCase()} successfully.`);
      setPendingRequests((prev) => prev.filter((m) => m.id !== membershipId));
      setStats((prev) => ({
        ...prev,
        pendingRequests: Math.max(0, prev.pendingRequests - 1),
        totalMembers: status === 'APPROVED' ? prev.totalMembers + 1 : prev.totalMembers,
      }));
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Error updating membership request.');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club) return;
    try {
      const res = await apiClient.post('/club-admin/events', {
        clubId: club.id,
        title: eventTitle,
        eventDate: eventDate,
        location: eventLocation,
        eventLink: eventLink,
        capacity: eventCapacity,
        description: eventDescription,
        published: true,
        badgeLabel: 'Published',
      });
      setToastMessage('Event created successfully!');
      setShowCreateEventModal(false);
      setEventTitle('');
      setEventDate('');
      setEventLocation('');
      setEventLink('');
      setEventDescription('');
      fetchClubData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to create event.');
    }
  };

  const handleDeleteEvent = async (event: EventItem) => {
    if (!window.confirm(`Delete "${event.title}" and its registrations?`)) return;
    try {
      await apiClient.delete(`/club-admin/events/${event.id}`);
      setToastMessage('Event deleted successfully.');
      fetchClubData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to delete event.');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club) return;
    try {
      await apiClient.post('/club-admin/announcements', {
        clubId: club.id,
        title: announcementTitle,
        content: announcementContent,
        postedByName: user?.fullName || 'Club Admin',
      });
      setToastMessage('Announcement posted!');
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
      const res = await apiClient.put(`/club-admin/clubs/${club.id}`, {
        meetingSchedule: editSchedule,
        meetingLocation: editLocation,
        facultyAdvisor: editAdvisor,
        description: editDesc,
      });
      setToastMessage('Club information updated successfully.');
      setShowEditClubModal(false);
      fetchClubData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to update club information.');
    }
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Approvals Hub" />

      <main className="flex-1 flex flex-col relative w-full pt-20 pb-8 bg-surface px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col w-full pb-8">
          {/* Status Chip & Header Section */}
          <header className="flex flex-col gap-space-xs mb-space-md pt-space-xs mt-4">
            <div className="flex items-center gap-space-xs flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-DEFAULT bg-surface-container-highest text-tertiary font-label-sm text-label-sm uppercase tracking-wider font-semibold border border-border-default">
                ROLE: CLUB_ADMIN
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-DEFAULT bg-surface-container text-secondary font-label-sm text-label-sm border border-border-subtle">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                Club administration
              </span>
            </div>

            <h1 className="font-headline-xl-mobile text-headline-xl-mobile text-tertiary tracking-tight font-bold">
              Club Overview: {club?.name || 'No club assigned'}
            </h1>

            <div className="flex items-center justify-between">
              <p className="font-body-sm text-body-sm text-secondary">
                Club Admin: <span className="font-semibold text-tertiary">{user?.fullName || 'Authenticated user'}</span>{' '}
                {user?.studentId && `(ID: ${user.studentId})`} • Faculty Advisor:{' '}
                <span className="font-semibold text-tertiary">{club?.facultyAdvisor || 'Not assigned'}</span>
              </p>
              <button
                type="button"
                onClick={() => setShowEditClubModal(true)}
                className="text-xs font-semibold text-primary underline"
              >
                Edit Details
              </button>
            </div>
          </header>

          {/* Compact Metrics Grid (4 Stat Boxes) */}
          <section aria-label="Key Performance Metrics" className="grid grid-cols-2 gap-space-sm mb-space-md">
            <div className="bg-surface-container-lowest p-space-md rounded-lg border border-border-default flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Total Members
                </span>
                <span className="material-symbols-outlined text-secondary text-[18px]">groups</span>
              </div>
              <div className="mt-space-xs flex items-baseline justify-between">
                <span className="font-headline-lg text-headline-lg text-tertiary font-bold tracking-tight tabular-nums">
                  {stats.totalMembers}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-lg border border-border-default flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Pending Requests
                </span>
                <span className="material-symbols-outlined text-tertiary text-[18px]">person_add</span>
              </div>
              <div className="mt-space-xs flex items-baseline justify-between">
                <span className="font-headline-lg text-headline-lg text-tertiary font-bold tracking-tight tabular-nums">
                  {stats.pendingRequests}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-lg border border-border-default flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Upcoming Events
                </span>
                <span className="material-symbols-outlined text-secondary text-[18px]">event</span>
              </div>
              <div className="mt-space-xs flex items-baseline justify-between">
                <span className="font-headline-lg text-headline-lg text-tertiary font-bold tracking-tight tabular-nums">
                  {stats.upcomingEvents}
                </span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-lg border border-border-default flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-secondary uppercase tracking-wider">
                  Active Regs
                </span>
                <span className="material-symbols-outlined text-secondary text-[18px]">how_to_reg</span>
              </div>
              <div className="mt-space-xs flex items-baseline justify-between">
                <span className="font-headline-lg text-headline-lg text-tertiary font-bold tracking-tight tabular-nums">
                  {stats.activeRegistrations}
                </span>
              </div>
            </div>
          </section>

          {/* Primary Quick Actions Row */}
          <section aria-label="Quick Actions" className="flex flex-col gap-space-xs mb-space-lg">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-xs">
              <button
                type="button"
                onClick={() => setShowCreateEventModal(true)}
                className="h-10 px-space-md bg-tertiary text-on-tertiary rounded-lg font-label-lg text-label-lg font-semibold flex items-center justify-center gap-space-xs hover:bg-neutral-800 active:scale-[0.99] transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>+ Create Event</span>
              </button>

              <a
                href="#pending-requests"
                className="h-10 px-space-md bg-surface-container-lowest text-tertiary rounded-lg font-label-lg text-label-lg font-medium flex items-center justify-center gap-space-xs hover:bg-surface-container active:scale-[0.99] transition-all border border-border-default shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">inbox</span>
                <span>Review Requests ({stats.pendingRequests})</span>
              </a>

              <button
                type="button"
                onClick={() => setShowAnnouncementModal(true)}
                className="h-10 px-space-md bg-surface-container-lowest text-tertiary rounded-lg font-label-lg text-label-lg font-medium flex items-center justify-center gap-space-xs hover:bg-surface-container active:scale-[0.99] transition-all border border-border-default shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">campaign</span>
                <span>+ New Announcement</span>
              </button>
            </div>
          </section>

          {/* Pending Membership Requests */}
          <section id="pending-requests" className="bg-surface-container-lowest rounded-lg border border-border-default p-space-md mb-space-md shadow-sm">
            <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-border-subtle">
              <div className="flex items-center gap-space-xs">
                <h2 className="font-headline-sm text-headline-sm text-tertiary font-bold tracking-tight">
                  Pending Membership Requests
                </h2>
                <span className="px-2 py-0.5 rounded-DEFAULT bg-surface-container text-tertiary font-label-sm text-label-sm font-semibold border border-border-subtle tabular-nums">
                  {pendingRequests.length}
                </span>
              </div>
              <a href="#pending-requests" className="font-label-sm text-label-sm text-secondary hover:text-tertiary font-medium">
                View All
              </a>
            </div>

            <div className="flex flex-col gap-space-sm">
              {pendingRequests.length === 0 ? (
                <div className="p-4 text-center text-secondary font-body-sm">
                  No pending membership requests currently requiring review.
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="bg-surface-container-low p-space-sm rounded-DEFAULT border border-border-subtle flex flex-col gap-space-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-space-sm items-start">
                        <div className="w-9 h-9 rounded-DEFAULT bg-surface-container-highest flex items-center justify-center text-tertiary font-semibold text-label-md border border-border-default">
                          {req.userName
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-label-lg text-label-lg font-semibold text-tertiary leading-tight">
                            {req.userName}
                          </span>
                          <span className="font-body-sm text-body-sm text-secondary leading-tight mt-0.5">
                            ID: {req.studentId} • {req.department}
                          </span>
                          <span className="font-label-sm text-label-sm text-secondary mt-1">
                            Applied recently
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-surface-container-highest text-tertiary font-label-sm text-label-sm rounded-DEFAULT uppercase tracking-wider font-semibold border border-border-default text-[10px]">
                        Review
                      </span>
                    </div>

                    <div className="flex items-center gap-space-xs pt-space-xs justify-end border-t border-border-subtle">
                      <button
                        type="button"
                        onClick={() => handleReviewRequest(req.id, 'REJECTED')}
                        className="h-8 px-space-md bg-surface-container-highest text-tertiary rounded-DEFAULT font-label-sm text-label-sm font-medium hover:bg-surface-container-high transition-colors border border-border-default"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewRequest(req.id, 'APPROVED')}
                        className="h-8 px-space-md bg-tertiary text-on-tertiary rounded-DEFAULT font-label-sm text-label-sm font-semibold hover:bg-neutral-800 transition-colors"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Upcoming Club Events */}
          <section className="bg-surface-container-lowest rounded-lg border border-border-default p-space-md mb-space-md shadow-sm">
            <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-border-subtle">
              <h2 className="font-headline-sm text-headline-sm text-tertiary font-bold tracking-tight">
                Upcoming Club Events
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateEventModal(true)}
                className="font-label-sm text-label-sm text-secondary hover:text-tertiary font-medium"
              >
                + Add Event
              </button>
            </div>

            <div className="flex flex-col gap-space-sm">
              {clubEvents.map((evt) => {
                const percent = Math.min(100, Math.round((evt.registeredCount / evt.capacity) * 100));
                return (
                  <div
                    key={evt.id}
                    className="bg-surface-container-low p-space-sm rounded-DEFAULT border border-border-subtle flex flex-col gap-space-sm"
                  >
                    <div className="flex items-start justify-between gap-space-xs">
                      <div className="flex flex-col min-w-0">
                        <span className="font-label-lg text-label-lg font-semibold text-tertiary truncate">
                          {evt.title}
                        </span>
                        <div className="flex items-center gap-space-sm text-secondary font-body-sm text-body-sm mt-0.5">
                          <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">calendar_today</span>{' '}
                            {evt.eventDate}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-medium text-tertiary tabular-nums">
                            <span className="material-symbols-outlined text-[16px]">group</span>{' '}
                            {evt.registeredCount} / {evt.capacity} Reg
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-surface-container-highest text-tertiary font-label-sm text-label-sm rounded-DEFAULT uppercase tracking-wider font-semibold whitespace-nowrap border border-border-default text-[10px]">
                        Published
                      </span>
                    </div>

                    {/* Visual Capacity Progress Bar */}
                    <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                      <div className="bg-tertiary h-1.5 rounded-full" style={{ width: `${percent}%` }}></div>
                    </div>

                    <div className="flex items-center justify-between pt-space-xs">
                      <span className="font-label-sm text-label-sm text-secondary">{evt.location}</span>
                      <div className="flex items-center gap-space-xs">
                        <button
                          type="button"
                          onClick={() => setToastMessage(`Event capacity: ${evt.registeredCount}/${evt.capacity}`)}
                          className="h-8 px-space-sm bg-surface-container-highest text-tertiary rounded-DEFAULT font-label-sm text-label-sm font-medium hover:bg-surface-container-high transition-colors border border-border-default"
                        >
                          Participants
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(evt)}
                          className="h-8 px-space-sm bg-primary text-on-primary rounded-DEFAULT font-label-sm text-label-sm font-medium border border-black"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Club Activity Log */}
          <section className="bg-surface-container-lowest rounded-lg border border-border-default p-space-md shadow-sm">
            <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-border-subtle">
              <h2 className="font-headline-sm text-headline-sm text-tertiary font-bold tracking-tight">
                Club Activity Log
              </h2>
              <button
                type="button"
                className="text-secondary hover:text-tertiary"
                aria-label="Filter activity"
              >
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-xs">
              {activityLogs.slice(0, 4).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-space-sm p-space-xs rounded-DEFAULT hover:bg-surface-container-low transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center shrink-0 mt-0.5 border border-border-default">
                    <span className="material-symbols-outlined text-tertiary text-[14px]">
                      {log.actionType.includes('MEMBERSHIP')
                        ? 'how_to_reg'
                        : log.actionType.includes('EVENT')
                        ? 'trending_up'
                        : 'campaign'}
                    </span>
                  </div>
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="font-body-md text-body-md text-tertiary leading-snug">
                      {log.details}
                    </p>
                    <span className="font-label-sm text-label-sm text-secondary">
                      {log.shaHash}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Create Event Modal */}
      <Modal
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        title="Create New Club Event"
      >
        <form onSubmit={handleCreateEvent} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Event Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Fall Campus Hackathon 2025"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-secondary uppercase">Date & Time</label>
              <input
                type="text"
                required
                placeholder="e.g. Oct 24, 2025 • 09:00 AM"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-sm text-secondary uppercase">Capacity</label>
              <input
                type="number"
                required
                min={1}
                value={eventCapacity}
                onChange={(e) => setEventCapacity(Number(e.target.value))}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Location</label>
            <input
              type="text"
              required
              placeholder="e.g. Engineering Hall 302"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Description</label>
            <textarea
              rows={3}
              placeholder="Event agenda and requirements..."
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Event Link (optional)</label>
            <input
              type="url"
              placeholder="https://meet.example.com/event"
              value={eventLink}
              onChange={(e) => setEventLink(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setShowCreateEventModal(false)}
              className="h-9 px-4 bg-surface-container text-on-surface font-label-md rounded hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 bg-primary text-on-primary font-label-md rounded hover:bg-neutral-800 transition-colors"
            >
              Publish Event
            </button>
          </div>
        </form>
      </Modal>

      {/* New Announcement Modal */}
      <Modal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        title="Post Club Announcement"
      >
        <form onSubmit={handleCreateAnnouncement} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Workshop venue change"
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Notice Content</label>
            <textarea
              rows={4}
              required
              placeholder="Details regarding meetings, schedule, or room updates..."
              value={announcementContent}
              onChange={(e) => setAnnouncementContent(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setShowAnnouncementModal(false)}
              className="h-9 px-4 bg-surface-container text-on-surface font-label-md rounded hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 bg-primary text-on-primary font-label-md rounded hover:bg-neutral-800 transition-colors"
            >
              Post Announcement
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Club Info Modal */}
      <Modal
        isOpen={showEditClubModal}
        onClose={() => setShowEditClubModal(false)}
        title="Edit Club Information"
      >
        <form onSubmit={handleUpdateClubInfo} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Meeting Schedule</label>
            <input
              type="text"
              value={editSchedule}
              onChange={(e) => setEditSchedule(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Meeting Location</label>
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Faculty Advisor</label>
            <input
              type="text"
              value={editAdvisor}
              onChange={(e) => setEditAdvisor(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Description</label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setShowEditClubModal(false)}
              className="h-9 px-4 bg-surface-container text-on-surface font-label-md rounded hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 bg-primary text-on-primary font-label-md rounded hover:bg-neutral-800 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      <BottomNav />
    </div>
  );
};
