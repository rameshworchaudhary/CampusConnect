import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { ImageUploader } from '../components/ImageUploader';
import { Club, EventItem, Membership } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getClubById, updateClub } from '../services/clubService';
import { getClubAdminStats } from '../services/statsService';
import { getMembershipRequestsForClub, reviewMembership } from '../services/membershipService';
import { getEventsForClub, createEvent, updateEvent, deleteEvent } from '../services/eventService';
import { getAnnouncementsForClub, createAnnouncement, deleteAnnouncement } from '../services/announcementService';
import { STORAGE_BUCKETS } from '../services/storageService';
import { StorageImage } from '../components/StorageImage';

export const ClubAdminDashboard: React.FC = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [club, setClub] = useState<Club | null>(null);
  const [stats, setStats] = useState({
    totalMembers: 0,
    pendingRequests: 0,
    totalEvents: 0,
    upcomingEvents: 0,
  });

  const [pendingRequests, setPendingRequests] = useState<Membership[]>([]);
  const [approvedMembers, setApprovedMembers] = useState<Membership[]>([]);
  const [clubEvents, setClubEvents] = useState<EventItem[]>([]);
  const [clubAnnouncements, setClubAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showEditClubModal, setShowEditClubModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);

  // Form states - Event
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventLink, setEventLink] = useState('');
  const [eventCapacity, setEventCapacity] = useState(50);
  const [eventDescription, setEventDescription] = useState('');
  const [eventPosterUrl, setEventPosterUrl] = useState('');
  const [eventCreating, setEventCreating] = useState(false);

  // Form states - Announcement
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementImagePath, setAnnouncementImagePath] = useState('');
  const [announcementPosting, setAnnouncementPosting] = useState(false);

  // Form states - Edit Club Charter & Logo
  const [editSchedule, setEditSchedule] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAdvisor, setEditAdvisor] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [clubSaving, setClubSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role === 'SUPER_ADMIN') {
      navigate('/admin');
      return;
    }
    if (user && user.role !== 'CLUB_ADMIN') {
      navigate('/student');
      return;
    }
    fetchClubData();
  }, [authLoading, isAuthenticated, user?.role, user?.assignedClubId]);

  const fetchClubData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setLoadError(null);
      const targetClubId = user.assignedClubId;
      if (!targetClubId) {
        setClub(null);
        setLoading(false);
        return;
      }

      const clubData = await getClubById(targetClubId);
      if (clubData) {
        setClub(clubData);
        setEditSchedule(clubData.meetingSchedule || '');
        setEditLocation(clubData.meetingLocation || '');
        setEditAdvisor(clubData.facultyAdvisor || '');
        setEditDesc(clubData.description || '');
        setEditEmail(clubData.contactEmail || '');
        setEditPhone(clubData.contactPhone || '');
        setEditLogoUrl(clubData.logoPath || '');

        const [statsData, reqs, approved, evts, anns] = await Promise.all([
          getClubAdminStats(targetClubId),
          getMembershipRequestsForClub(targetClubId, 'PENDING'),
          getMembershipRequestsForClub(targetClubId, 'APPROVED'),
          getEventsForClub(targetClubId),
          getAnnouncementsForClub(targetClubId),
        ]);

        setStats(statsData);
        setPendingRequests(reqs);
        setApprovedMembers(approved);
        setClubEvents(evts);
        setClubAnnouncements(anns);
      }
    } catch (err: any) {
      console.warn('Error fetching club officer data:', err);
      setLoadError(err?.message || 'Could not load club data. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewRequest = async (membershipId: string, status: 'APPROVED' | 'REJECTED') => {
    if (!user) return;
    try {
      await reviewMembership(membershipId, status, user.id, { email: user.email, role: user.role });
      setToastMessage(`Application ${status.toLowerCase()} successfully.`);
      await fetchClubData();
    } catch (err: any) {
      setToastMessage(err.message || 'Error updating membership request.');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club || !user) return;
    try {
      setEventCreating(true);
      await createEvent(
        {
          clubId: club.id,
          title: eventTitle.trim(),
          eventDate: eventDate.trim(),
          location: eventLocation.trim(),
          eventLink: eventLink.trim() || undefined,
          capacity: eventCapacity,
          description: eventDescription.trim() || undefined,
          posterUrl: eventPosterUrl || undefined,
          badgeLabel: `${club.name} Event`,
          isPublished: true,
        },
        { id: user.id, email: user.email, role: user.role }
      );

      setToastMessage('Club event published successfully!');
      setShowCreateEventModal(false);
      setEventTitle('');
      setEventDate('');
      setEventLocation('');
      setEventLink('');
      setEventDescription('');
      setEventPosterUrl('');
      await fetchClubData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to publish event.');
    } finally {
      setEventCreating(false);
    }
  };

  const confirmDeleteEvent = async () => {
    if (!eventToDelete || !user) return;
    try {
      await deleteEvent(eventToDelete.id, { email: user.email, role: user.role });
      setToastMessage('Event deleted.');
      setEventToDelete(null);
      await fetchClubData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to delete event.');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club || !user) return;
    try {
      setAnnouncementPosting(true);
      await createAnnouncement(
        {
          clubId: club.id,
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
          postedByName: user.fullName || club.name,
          imagePath: announcementImagePath || null,
        },
        { id: user.id, email: user.email, role: user.role }
      );

      setToastMessage('Announcement broadcasted to members!');
      setShowAnnouncementModal(false);
      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementImagePath('');
      await fetchClubData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to post announcement.');
    } finally {
      setAnnouncementPosting(false);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!user) return;
    try {
      await deleteAnnouncement(announcementId, { email: user.email, role: user.role });
      setToastMessage('Announcement removed.');
      await fetchClubData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to delete announcement.');
    }
  };

  const handleUpdateClubInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!club || !user) return;
    try {
      setClubSaving(true);
      await updateClub(
        club.id,
        {
          meetingSchedule: editSchedule.trim(),
          meetingLocation: editLocation.trim(),
          facultyAdvisor: editAdvisor.trim(),
          description: editDesc.trim(),
          contactEmail: editEmail.trim(),
          contactPhone: editPhone.trim(),
          logoUrl: editLogoUrl || null,
        },
        { email: user.email, role: user.role }
      );

      setToastMessage('Club information & logo updated.');
      setShowEditClubModal(false);
      await fetchClubData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to update club profile.');
    } finally {
      setClubSaving(false);
    }
  };

  return (
    <div className="bg-app font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Club Officer Hub" />

      <main className="flex-1 w-full pt-20 pb-24 md:pb-12 bg-app px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {loadError && !loading ? (
            <div role="alert" className="bg-surface-container-lowest p-8 rounded-2xl border border-border-default shadow-sm text-center flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant">error</span>
              <h1 className="text-lg font-bold text-on-surface">Could not load your club</h1>
              <p className="text-xs text-on-surface-variant max-w-md">{loadError}</p>
              <button type="button" onClick={fetchClubData} className="h-9 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold">Retry</button>
            </div>
          ) : !club && !loading ? (
            <div className="bg-surface-container-lowest p-8 rounded-2xl border border-border-default shadow-sm text-center flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                assignment_late
              </span>
              <h1 className="text-lg font-bold text-on-surface">No Assigned Club</h1>
              <p className="text-xs text-on-surface-variant max-w-md">
                You have not yet been assigned as an officer to a specific student organization. Please contact the Super Admin to link your account to a club charter.
              </p>
            </div>
          ) : (
            <>
              {/* Header Status */}
              <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-border-default shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  {club?.logoUrl ? (
                    <div className="w-14 h-14 rounded-xl border border-border-default overflow-hidden bg-surface-container shrink-0">
                      <StorageImage bucket={STORAGE_BUCKETS.clubLogos} path={club.logoPath} alt={club.name} className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-surface-container flex items-center justify-center text-primary font-bold text-lg shrink-0 border border-border-default">
                      {club?.name ? club.name.charAt(0).toUpperCase() : 'C'}
                    </div>
                  )}

                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold text-[11px]">
                        Charter: {club?.refId || 'N/A'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs bg-surface-container text-primary font-semibold px-2 py-0.5 rounded-full border border-border-default">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                        Club Officer
                      </span>
                    </div>

                    <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight truncate">
                      {club?.name || 'Assigned Student Organization'}
                    </h1>

                    <p className="text-xs sm:text-sm text-on-surface-variant">
                      Officer: <span className="font-semibold text-on-surface">{user?.fullName}</span> • Advisor:{' '}
                      <span className="font-semibold text-on-surface">{club?.facultyAdvisor || 'Unassigned'}</span>
                    </p>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowCreateEventModal(true)}
                    className="h-10 px-4 bg-accent text-on-accent text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 hover:opacity-90 shadow-sm transition-opacity"
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
                    <span>Post Bulletin</span>
                  </button>
                </div>
              </div>

              {/* Metrics Grid (Actual database records) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold text-[10px] sm:text-[11px]">
                    Approved Members
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                      {loading ? '...' : stats.totalMembers}
                    </span>
                    <span className="text-xs text-on-surface-variant">Active</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold text-[10px] sm:text-[11px]">
                    Pending Applications
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl sm:text-3xl text-on-surface font-bold tabular-nums">
                      {loading ? '...' : stats.pendingRequests}
                    </span>
                    <span className="text-xs text-on-surface-variant">To Review</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold text-[10px] sm:text-[11px]">
                    Total Events
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                      {loading ? '...' : stats.totalEvents}
                    </span>
                    <span className="text-xs text-on-surface-variant">Hosted</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-4 rounded-xl border border-border-default shadow-sm flex flex-col justify-between min-h-[5.5rem]">
                  <span className="font-label-caps text-label-caps uppercase text-on-surface-variant font-bold text-[10px] sm:text-[11px]">
                    Announcements
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                      {loading ? '...' : clubAnnouncements.length}
                    </span>
                    <span className="text-xs text-on-surface-variant">Bulletins</span>
                  </div>
                </div>
              </div>

              {/* 2-Column Officer Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column (8 cols): Applications & Events */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                  {/* Pending Membership Requests */}
                  <section className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
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
                                {req.userName ? req.userName.charAt(0).toUpperCase() : 'S'}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-sm sm:text-base text-on-surface truncate">
                                  {req.userName}
                                </span>
                                <span className="text-xs text-on-surface-variant mt-0.5">
                                  ID: {req.studentId || 'N/A'} • Dept: {req.department || 'Undergraduate'}
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
                                className="h-8 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold hover:opacity-90 shadow-sm"
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
                        + Create Event
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
                              {evt.posterUrl && (
                                <div className="w-full h-32 rounded-lg overflow-hidden border border-border-default bg-surface-container">
                                  <StorageImage bucket={STORAGE_BUCKETS.eventPosters} path={evt.posterPath} alt={evt.title} className="w-full h-full object-contain" />
                                </div>
                              )}

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
                                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${percent}%` }}></div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-border-default text-xs">
                                <span className="text-on-surface-variant">
                                  ID: #{evt.id.substring(0, 8)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEventToDelete(evt)}
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

                {/* Right Column (4 cols): Charter Details, Logo & Bulletins */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                  {/* Organization Charter Profile */}
                  <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-3 border-b border-border-default">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px] text-primary">description</span>
                        <h2 className="text-base text-on-surface font-semibold">
                          Charter Profile
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowEditClubModal(true)}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        Edit Profile
                      </button>
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

                      {club?.contactEmail && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-on-surface-variant tracking-wider block">
                            Contact
                          </span>
                          <p className="font-medium text-on-surface mt-0.5">
                            {club.contactEmail} {club.contactPhone ? `• ${club.contactPhone}` : ''}
                          </p>
                        </div>
                      )}

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
                      <span>Update Charter &amp; Logo</span>
                    </button>
                  </div>

                  {/* Club Announcements */}
                  <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 shadow-sm flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-3 border-b border-border-default">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[20px] text-primary">campaign</span>
                        <h2 className="text-base text-on-surface font-semibold">
                          Bulletins ({clubAnnouncements.length})
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAnnouncementModal(true)}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        + Post
                      </button>
                    </div>

                    {clubAnnouncements.length === 0 ? (
                      <p className="text-xs text-on-surface-variant py-2">
                        No club bulletins posted yet.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {clubAnnouncements.map((ann) => (
                          <div key={ann.id} className="p-3 bg-surface-container-low border border-border-default rounded-xl flex flex-col gap-1 text-xs">
                            <div className="flex justify-between items-start gap-2">
                              <span className="font-semibold text-on-surface line-clamp-1">{ann.title}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnnouncement(ann.id)}
                                className="text-on-surface-variant hover:text-primary underline text-[11px]"
                              >
                                Delete
                              </button>
                            </div>
                            <p className="text-on-surface-variant line-clamp-2 leading-relaxed">{ann.content}</p>
                            {ann.imagePath && <StorageImage bucket={STORAGE_BUCKETS.announcementImages} path={ann.imagePath} alt="Announcement attachment" className="mt-2 max-h-32 w-full rounded-lg object-contain" />}
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setShowAnnouncementModal(true)}
                      className="w-full h-9 rounded-lg bg-accent text-on-accent text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-sm mt-1"
                    >
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      <span>Post Announcement</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Create Event Modal with ImageUploader for Event Poster */}
      <Modal
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        title="Create Club Event"
      >
        <form onSubmit={handleCreateEvent} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Event Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. AI Hackathon Workshop"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Date &amp; Time *
              </label>
              <input
                type="text"
                required
                placeholder="Oct 24 • 10:00 AM"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Capacity *
              </label>
              <input
                type="number"
                required
                min={1}
                value={eventCapacity}
                onChange={(e) => setEventCapacity(Number(e.target.value))}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Location *
            </label>
            <input
              type="text"
              required
              placeholder="Hall B, Tech Center"
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Virtual Meeting Link (Optional)
            </label>
            <input
              type="url"
              placeholder="https://meet.univ.edu/session"
              value={eventLink}
              onChange={(e) => setEventLink(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Outline the agenda, requirements, or session details..."
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          {/* Event Poster Upload */}
          <ImageUploader
            bucket={STORAGE_BUCKETS.eventPosters}
            folderId={user?.assignedClubId}
            label="Event Poster / Banner (Optional)"
            currentImageUrl={eventPosterUrl}
            onImageUploaded={(_url, path) => setEventPosterUrl(path)}
            onImageRemoved={() => setEventPosterUrl('')}
            helperText="JPG, PNG, WebP (max 5 MB)"
            aspectRatio="banner"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={() => setShowCreateEventModal(false)}
              className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={eventCreating}
              className="h-9 px-5 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {eventCreating ? 'Publishing...' : 'Publish Event'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Post Announcement Modal */}
      <Modal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        title="Post Organization Announcement"
      >
        <form onSubmit={handleCreateAnnouncement} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Schedule Update for Lab B"
              value={announcementTitle}
              onChange={(e) => setAnnouncementTitle(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Content *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Broadcast message to all club members..."
              value={announcementContent}
              onChange={(e) => setAnnouncementContent(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <ImageUploader
            bucket={STORAGE_BUCKETS.announcementImages}
            folderId={club?.id}
            label="Announcement Image (Optional)"
            currentImageUrl={announcementImagePath}
            onImageUploaded={(_url, path) => setAnnouncementImagePath(path)}
            onImageRemoved={() => setAnnouncementImagePath('')}
            aspectRatio="banner"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={() => setShowAnnouncementModal(false)}
              className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={announcementPosting}
              className="h-9 px-5 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {announcementPosting ? 'Posting...' : 'Post Bulletin'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Charter & Logo Modal */}
      <Modal
        isOpen={showEditClubModal}
        onClose={() => setShowEditClubModal(false)}
        title="Edit Organization Profile"
      >
        <form onSubmit={handleUpdateClubInfo} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Meeting Schedule
            </label>
            <input
              type="text"
              value={editSchedule}
              onChange={(e) => setEditSchedule(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Meeting Location
            </label>
            <input
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Faculty Advisor
              </label>
              <input
                type="text"
                value={editAdvisor}
                onChange={(e) => setEditAdvisor(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Contact Email
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Mission / Description
            </label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          {/* Club Logo Upload */}
          <ImageUploader
            bucket={STORAGE_BUCKETS.clubLogos}
            folderId={user?.assignedClubId}
            label="Club Logo"
            currentImageUrl={editLogoUrl}
            onImageUploaded={(_url, path) => setEditLogoUrl(path)}
            onImageRemoved={() => setEditLogoUrl('')}
            helperText="JPG, PNG, WebP (max 5 MB)"
            aspectRatio="square"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={() => setShowEditClubModal(false)}
              className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={clubSaving}
              className="h-9 px-5 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {clubSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Event Confirmation Modal */}
      <Modal
        isOpen={Boolean(eventToDelete)}
        onClose={() => setEventToDelete(null)}
        title="Confirm Event Deletion"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-on-surface-variant">
            Are you sure you want to delete <span className="font-semibold text-on-surface">"{eventToDelete?.title}"</span>? This will remove all student registrations.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={() => setEventToDelete(null)}
              className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteEvent}
              className="h-9 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90"
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

export default ClubAdminDashboard;
