import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { ImageUploader } from '../components/ImageUploader';
import { AnnouncementItem, User, Club, AuditLogItem, PlatformStats, EventItem, Role } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getPlatformStats } from '../services/statsService';
import { getAllClubs, registerClub, approveClub, rejectClub, deleteClub, assignClubAdmin } from '../services/clubService';
import { getAllUsers, updateUserRole, toggleUserStatus } from '../services/userService';
import { getAllEvents, createEvent, deleteEvent, updateEvent } from '../services/eventService';
import { getAllAnnouncements, createAnnouncement, deleteAnnouncement, toggleAnnouncementStatus } from '../services/announcementService';
import { STORAGE_BUCKETS } from '../services/storageService';
import { getAuditLogs } from '../services/auditService';
import { StorageImage } from '../components/StorageImage';

export const SuperAdminDashboard: React.FC = () => {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);

  const [searchClub, setSearchClub] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'overview' | 'clubs' | 'users' | 'events' | 'announcements' | 'roles' | 'audit'>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [showCreateClubModal, setShowCreateClubModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Role Management State
  const [selectedUserForRole, setSelectedUserForRole] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<Role>('CLUB_ADMIN');
  const [targetClubId, setTargetClubId] = useState<string>('');

  // Create club form
  const [newClubName, setNewClubName] = useState('');
  const [newClubCat, setNewClubCat] = useState('Academic');
  const [newClubDesc, setNewClubDesc] = useState('');
  const [newClubSchedule, setNewClubSchedule] = useState('');
  const [newClubLocation, setNewClubLocation] = useState('');
  const [newClubAdvisor, setNewClubAdvisor] = useState('');
  const [newClubEmail, setNewClubEmail] = useState('');
  const [newClubLogoUrl, setNewClubLogoUrl] = useState('');

  // Create event form
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventLink, setNewEventLink] = useState('');
  const [newEventCapacity, setNewEventCapacity] = useState('100');
  const [newEventClubId, setNewEventClubId] = useState<string>('');
  const [newEventPosterUrl, setNewEventPosterUrl] = useState('');

  // Announcement form
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementContent, setNewAnnouncementContent] = useState('');
  const [newAnnouncementImagePath, setNewAnnouncementImagePath] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user && user.role !== 'SUPER_ADMIN') {
      navigate(user.role === 'CLUB_ADMIN' ? '/club-admin' : '/student');
      return;
    }
    fetchPlatformData();
  }, [authLoading, isAuthenticated, user?.role]);

  const fetchPlatformData = async () => {
    try {
      setStatsLoading(true);
      setLoadError(null);
      const [statsData, clubsData, usersData, evtsData, annsData, logsData] = await Promise.all([
        getPlatformStats(),
        getAllClubs(),
        getAllUsers(),
        getAllEvents(),
        getAllAnnouncements(),
        getAuditLogs(),
      ]);

      setStats(statsData);
      setClubs(clubsData);
      setUsers(usersData);
      setEvents(evtsData);
      setAnnouncements(annsData);
      setAuditLogs(logsData);

      if (clubsData.length > 0 && !targetClubId) {
        setTargetClubId(clubsData[0].id);
      }
      if (usersData.length > 0 && !selectedUserForRole) {
        setSelectedUserForRole(usersData[0]);
      }
    } catch (err: any) {
      console.warn('Error loading admin platform data:', err);
      setLoadError(err?.message || 'Could not load platform data. Check your connection and try again.');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleApproveClub = async (clubId: string) => {
    if (!user) return;
    try {
      await approveClub(clubId, { email: user.email, role: user.role });
      setToastMessage('Club registration approved and published!');
      await fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to approve club.');
    }
  };

  const handleRejectClub = async (clubId: string) => {
    if (!user) return;
    try {
      await rejectClub(clubId, { email: user.email, role: user.role });
      setToastMessage('Club registration rejected.');
      await fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to reject club.');
    }
  };

  const handleDeleteClub = (club: Club) => {
    if (!user) return;
    setConfirmDialog({
      title: 'Confirm Club Deletion',
      message: `Are you sure you want to delete ${club.name}? All associated memberships and events will be deleted.`,
      actionLabel: 'Delete Club',
      onConfirm: async () => {
        try {
          await deleteClub(club.id, { email: user.email, role: user.role });
          setToastMessage(`Club ${club.name} deleted.`);
          setConfirmDialog(null);
          await fetchPlatformData();
        } catch (err: any) {
          setToastMessage(err.message || 'Failed to delete club.');
        }
      },
    });
  };

  const handleToggleUserStatus = async (targetUser: User) => {
    if (!user) return;
    try {
      await toggleUserStatus(targetUser.id, !targetUser.isActive, { email: user.email, role: user.role });
      setToastMessage(`User ${targetUser.fullName} ${targetUser.isActive ? 'deactivated' : 'activated'}.`);
      await fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to toggle account status.');
    }
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRole || !user) return;
    try {
      await updateUserRole(
        selectedUserForRole.id,
        targetRole,
        targetRole === 'CLUB_ADMIN' ? targetClubId : null,
        { email: user.email, role: user.role }
      );
      setToastMessage(`Updated role of ${selectedUserForRole.fullName} to ${targetRole}.`);
      setShowRoleModal(false);
      await fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to update user role.');
    }
  };

  const handleCreateClubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const created = await registerClub(
        {
          name: newClubName.trim(),
          category: newClubCat,
          description: newClubDesc.trim(),
          meetingSchedule: newClubSchedule.trim() || undefined,
          meetingLocation: newClubLocation.trim() || undefined,
          facultyAdvisor: newClubAdvisor.trim() || undefined,
          contactEmail: newClubEmail.trim() || user.email,
          logoUrl: newClubLogoUrl || undefined,
        },
        { email: user.email, role: user.role }
      );
      // As Super Admin, auto-approve immediately
      await approveClub(created.id, { email: user.email, role: user.role });

      setToastMessage(`Club "${newClubName}" created and approved.`);
      setShowCreateClubModal(false);
      setNewClubName('');
      setNewClubDesc('');
      setNewClubSchedule('');
      setNewClubLocation('');
      setNewClubAdvisor('');
      setNewClubEmail('');
      setNewClubLogoUrl('');
      await fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to create club.');
    }
  };

  const handleCreateEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (newEventPosterUrl && !/^(data:|blob:)/i.test(newEventPosterUrl)) {
      const expectedFolder = newEventClubId || user.id;
      const uploadedFolder = newEventPosterUrl.split('/')[0];
      if (uploadedFolder !== expectedFolder) {
        setToastMessage('The event host changed after this poster was uploaded. Remove it and upload it again for the selected host.');
        return;
      }
    }
    try {
      await createEvent(
        {
          clubId: newEventClubId || null,
          title: newEventTitle.trim(),
          description: newEventDescription.trim() || undefined,
          eventDate: newEventDate.trim(),
          location: newEventLocation.trim(),
          eventLink: newEventLink.trim() || undefined,
          capacity: Number(newEventCapacity) || 100,
          posterUrl: newEventPosterUrl || undefined,
          isPlatformEvent: !newEventClubId,
          badgeLabel: newEventClubId ? 'Club Event' : 'Campus Platform',
          isPublished: true,
        },
        { id: user.id, email: user.email, role: user.role }
      );

      setToastMessage('Event created and published.');
      setShowCreateEventModal(false);
      setNewEventTitle('');
      setNewEventDescription('');
      setNewEventDate('');
      setNewEventLocation('');
      setNewEventLink('');
      setNewEventCapacity('100');
      setNewEventClubId('');
      setNewEventPosterUrl('');
      await fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to create event.');
    }
  };

  const handleDeleteEvent = (event: EventItem) => {
    if (!user) return;
    setConfirmDialog({
      title: 'Confirm Event Deletion',
      message: `Are you sure you want to delete "${event.title}"?`,
      actionLabel: 'Delete Event',
      onConfirm: async () => {
        try {
          await deleteEvent(event.id, { email: user.email, role: user.role });
          setToastMessage('Event deleted.');
          setConfirmDialog(null);
          await fetchPlatformData();
        } catch (err: any) {
          setToastMessage(err.message || 'Failed to delete event.');
        }
      },
    });
  };

  const handleToggleEventPublish = async (event: EventItem) => {
    if (!user) return;
    try {
      await updateEvent(event.id, { isPublished: !event.isPublished }, { email: user.email, role: user.role });
      setToastMessage(`Event ${event.isPublished ? 'unpublished' : 'published'}.`);
      await fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to update event status.');
    }
  };

  const handleCreateAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await createAnnouncement(
        {
          title: newAnnouncementTitle.trim(),
          content: newAnnouncementContent.trim(),
          postedByName: 'Campus Administration',
          imagePath: newAnnouncementImagePath || null,
        },
        { id: user.id, email: user.email, role: user.role }
      );

      setToastMessage('Campus bulletin broadcasted.');
      setShowAnnouncementModal(false);
      setNewAnnouncementTitle('');
      setNewAnnouncementContent('');
      setNewAnnouncementImagePath('');
      await fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to publish bulletin.');
    }
  };

  const handleDeleteAnnouncement = (ann: AnnouncementItem) => {
    if (!user) return;
    setConfirmDialog({
      title: 'Confirm Announcement Deletion',
      message: `Are you sure you want to delete "${ann.title}"?`,
      actionLabel: 'Delete Announcement',
      onConfirm: async () => {
        try {
          await deleteAnnouncement(ann.id, { email: user.email, role: user.role });
          setToastMessage('Announcement deleted.');
          setConfirmDialog(null);
          await fetchPlatformData();
        } catch (err: any) {
          setToastMessage(err.message || 'Failed to delete announcement.');
        }
      },
    });
  };

  const handleToggleAnnouncementStatus = async (ann: AnnouncementItem) => {
    if (!user) return;
    try {
      await toggleAnnouncementStatus(ann.id, !ann.isActive, { email: user.email, role: user.role });
      setToastMessage(`Announcement ${ann.isActive ? 'deactivated' : 'activated'}.`);
      await fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to toggle status.');
    }
  };

  const filteredClubs = clubs.filter((c) => {
    const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
    const matchesSearch =
      !searchClub ||
      c.name.toLowerCase().includes(searchClub.toLowerCase()) ||
      c.refId.toLowerCase().includes(searchClub.toLowerCase()) ||
      (c.assignedAdminName && c.assignedAdminName.toLowerCase().includes(searchClub.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const filteredUsers = users.filter((u) => {
    if (!searchUser) return true;
    const term = searchUser.toLowerCase();
    return (
      u.fullName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.studentId && u.studentId.toLowerCase().includes(term))
    );
  });

  const pendingClubs = clubs.filter((c) => c.approvalStatus === 'PENDING');

  return (
    <div className="bg-app font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Super Admin Portal" />

      <main className="flex-1 w-full pt-20 pb-24 md:pb-12 bg-app px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl flex flex-col gap-6">
          {loadError && !statsLoading && (
            <div role="alert" className="bg-surface-container-lowest p-4 rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-on-surface-variant">Platform data could not be loaded: {loadError}</p>
              <button type="button" onClick={fetchPlatformData} className="h-9 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold shrink-0">Retry</button>
            </div>
          )}
          {/* Header Banner */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-border-default shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold text-[11px]">
                  System Directory
                </span>
                <span className="inline-flex items-center gap-1 text-xs bg-surface-container text-primary font-semibold px-2 py-0.5 rounded-full border border-border-default">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                  Super Administrator
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
                Platform Governance Portal
              </h1>
              <p className="text-xs sm:text-sm text-on-surface-variant">
                Institutional oversight, student organizations charter verification, role privileges &amp; audit trails.
              </p>
            </div>

            {/* Top Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateClubModal(true)}
                className="h-10 px-3.5 bg-accent text-on-accent text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 hover:opacity-90 shadow-sm transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Register Club</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCreateEventModal(true)}
                className="h-10 px-3.5 bg-surface-container text-on-surface text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 hover:bg-surface-container-high transition-colors border border-border-default"
              >
                <span className="material-symbols-outlined text-[18px]">event</span>
                <span>Add Event</span>
              </button>
              <button
                type="button"
                onClick={() => setShowAnnouncementModal(true)}
                className="h-10 px-3.5 bg-surface-container text-on-surface text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 hover:bg-surface-container-high transition-colors border border-border-default"
              >
                <span className="material-symbols-outlined text-[18px]">campaign</span>
                <span>Notice</span>
              </button>
            </div>
          </div>

          {/* Platform Metrics (Actual counts from database) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className="bg-surface-container-lowest p-4 rounded-xl border border-border-default flex flex-col justify-between shadow-sm min-h-[5.5rem] text-left hover:border-black transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Registered Users</span>
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">badge</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.totalUsers : 0}
                </span>
                <span className="text-xs text-on-surface-variant">Accounts</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('clubs')}
              className="bg-surface-container-lowest p-4 rounded-xl border border-border-default flex flex-col justify-between shadow-sm min-h-[5.5rem] text-left hover:border-black transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Registered Clubs</span>
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">account_tree</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.totalClubs : 0}
                </span>
                <span className="text-xs text-on-surface-variant">Approved</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className="bg-surface-container-lowest p-4 rounded-xl border border-border-default flex flex-col justify-between shadow-sm min-h-[5.5rem] text-left hover:border-black transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Published Events</span>
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">event_available</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.publishedEvents : 0}
                </span>
                <span className="text-xs text-on-surface-variant">Active</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="bg-surface-container-lowest p-4 rounded-xl border border-border-default flex flex-col justify-between shadow-sm min-h-[5.5rem] text-left hover:border-black transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">Total RSVPs</span>
                <span className="material-symbols-outlined text-on-surface-variant text-[18px]">how_to_reg</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.totalRegistrations : 0}
                </span>
                <span className="text-xs text-on-surface-variant">Registrations</span>
              </div>
            </button>
          </div>

          {/* Pending Club Approvals Notification Banner */}
          {pendingClubs.length > 0 && (
            <div className="p-4 bg-surface-container-low border border-border-default rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary font-bold shrink-0 border border-border-default">
                  <span className="material-symbols-outlined text-[20px]">hourglass_top</span>
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-on-surface">
                    {pendingClubs.length} Pending Club Registration{pendingClubs.length > 1 ? 's' : ''} Require Approval
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    Review and approve submitted club charters before they appear in the public student directory.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('clubs')}
                className="h-8 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold hover:opacity-90 shrink-0 self-start sm:self-auto"
              >
                Review Submissions
              </button>
            </div>
          )}

          {/* Navigation Tab Bar */}
          <div className="border-b border-border-default flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'overview', label: 'Overview', icon: 'space_dashboard' },
              { id: 'clubs', label: `Clubs (${clubs.length})`, icon: 'account_tree' },
              { id: 'users', label: `Users (${users.length})`, icon: 'group' },
              { id: 'events', label: `Events (${events.length})`, icon: 'event' },
              { id: 'announcements', label: `Bulletins (${announcements.length})`, icon: 'campaign' },
              { id: 'roles', label: 'Role Governance', icon: 'security' },
              { id: 'audit', label: `Audit Trail (${auditLogs.length})`, icon: 'history' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border ${
                  activeTab === tab.id
                    ? 'bg-accent text-on-accent border-accent font-semibold shadow-sm'
                    : 'bg-transparent text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (8 cols): Clubs & Events */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {/* Clubs Ledger */}
                <section className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border-default">
                    <div>
                      <h2 className="text-base sm:text-lg text-on-surface font-semibold">
                        Institutional Clubs Ledger
                      </h2>
                      <p className="text-xs text-on-surface-variant">
                        Charter verification &amp; officer assignments
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('clubs')}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      View All ({clubs.length}) →
                    </button>
                  </div>

                  {clubs.length === 0 ? (
                    <p className="text-xs text-on-surface-variant py-6 text-center">
                      No clubs registered yet. Register a club using the button above.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {clubs.slice(0, 5).map((clubItem) => (
                        <div
                          key={clubItem.id}
                          className="bg-surface-container-low p-4 rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            {clubItem.logoUrl ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-border-default shrink-0 bg-surface-container">
                                <StorageImage bucket={STORAGE_BUCKETS.clubLogos} path={clubItem.logoPath} alt={clubItem.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold shrink-0 border border-border-default text-xs">
                                {clubItem.name.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-on-surface truncate">
                                  {clubItem.name}
                                </span>
                                <span
                                  className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                                    clubItem.approvalStatus === 'APPROVED'
                                      ? 'bg-surface-container text-primary border-border-default'
                                      : clubItem.approvalStatus === 'PENDING'
                                      ? 'bg-surface text-primary border-black font-semibold'
                                      : 'bg-surface-container-high text-on-surface border-border-default'
                                  }`}
                                >
                                  {clubItem.approvalStatus}
                                </span>
                              </div>
                              <span className="text-xs text-on-surface-variant mt-0.5">
                                Ref: {clubItem.refId} • Officer: {clubItem.assignedAdminName || 'Unassigned'} • {clubItem.memberCount} members
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default shrink-0">
                            {clubItem.approvalStatus === 'PENDING' && (
                              <button
                                type="button"
                                onClick={() => handleApproveClub(clubItem.id)}
                                className="h-8 px-3 rounded-lg bg-accent text-on-accent text-xs font-semibold hover:opacity-90 shadow-sm"
                              >
                                Approve
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setTargetClubId(clubItem.id);
                                setActiveTab('roles');
                              }}
                              className="h-8 px-3 rounded-lg bg-surface-container text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors border border-border-default"
                            >
                              Assign Admin
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClub(clubItem)}
                              className="h-8 px-2 text-xs text-on-surface-variant hover:text-primary underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Platform Events */}
                <section className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border-default">
                    <div>
                      <h2 className="text-base sm:text-lg text-on-surface font-semibold">
                        Campus Events Schedule
                      </h2>
                      <p className="text-xs text-on-surface-variant">
                        Moderation and registration monitoring
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('events')}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      View All ({events.length}) →
                    </button>
                  </div>

                  {events.length === 0 ? (
                    <p className="text-xs text-on-surface-variant py-6 text-center">
                      No events scheduled yet.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {events.slice(0, 4).map((evt) => (
                        <div
                          key={evt.id}
                          className="bg-surface-container-low p-4 rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-on-surface truncate">
                                {evt.title}
                              </span>
                              <span className="bg-surface-container text-primary text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-border-default">
                                {evt.isPublished ? 'Published' : 'Unpublished'}
                              </span>
                            </div>
                            <span className="text-xs text-on-surface-variant mt-0.5">
                              {evt.eventDate} • {evt.location} • {evt.registeredCount}/{evt.capacity} registered
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleEventPublish(evt)}
                              className="h-8 px-3 rounded-lg bg-surface-container text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors border border-border-default"
                            >
                              {evt.isPublished ? 'Unpublish' : 'Publish'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEvent(evt)}
                              className="h-8 px-2 text-xs text-on-surface-variant hover:text-primary underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* Right Column (4 cols): Quick Operations & Audit Trail */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                {/* Governance Quick Action Center */}
                <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2 pb-3 border-b border-border-default">
                    <span className="material-symbols-outlined text-[20px] text-primary">admin_panel_settings</span>
                    <h2 className="text-base text-on-surface font-semibold">
                      Administrative Actions
                    </h2>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateClubModal(true)}
                      className="w-full h-9 rounded-lg bg-accent text-on-accent text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Register New Club</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateEventModal(true)}
                      className="w-full h-9 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">event</span>
                      <span>Create Platform Event</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAnnouncementModal(true)}
                      className="w-full h-9 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">campaign</span>
                      <span>Broadcast Campus Notice</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('roles')}
                      className="w-full h-9 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">security</span>
                      <span>Manage User Roles</span>
                    </button>
                  </div>
                </div>

                {/* Audit Trail Excerpt */}
                <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-3 border-b border-border-default">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-primary">history</span>
                      <h2 className="text-base text-on-surface font-semibold">
                        Audit Trail Excerpt
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('audit')}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      Full Log →
                    </button>
                  </div>

                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-on-surface-variant py-4 text-center">
                      No audit events recorded yet.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      {auditLogs.slice(0, 4).map((log) => (
                        <div key={log.id} className="text-xs p-3 rounded-xl bg-surface-container-low border border-border-default flex flex-col gap-1">
                          <div className="flex justify-between items-center text-on-surface font-semibold">
                            <span className="truncate">{log.actionType}</span>
                            <span className="text-[10px] text-on-surface-variant">
                              {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-on-surface-variant line-clamp-2 leading-relaxed">
                            {log.details}
                          </p>
                          <span className="text-[10px] text-on-surface-variant truncate">
                            {log.actorEmail} • {log.actorRole}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLUBS */}
          {activeTab === 'clubs' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-default">
                <div>
                  <h2 className="text-lg font-bold text-on-surface">Campus Clubs Management</h2>
                  <p className="text-xs text-on-surface-variant">Review approvals, assignments, and charter records</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateClubModal(true)}
                  className="h-9 px-4 rounded-xl bg-accent text-on-accent text-xs font-semibold hover:opacity-90 self-start sm:self-auto shadow-sm"
                >
                  + Add New Club
                </button>
              </div>

              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search clubs by name, ref ID, or officer..."
                    value={searchClub}
                    onChange={(e) => setSearchClub(e.target.value)}
                    className="w-full bg-surface-container-low text-on-surface text-xs sm:text-sm pl-10 pr-3 py-2 rounded-xl border border-border-default focus:outline-none focus:border-black"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {['All', 'Academic', 'Humanities', 'Engineering', 'Sports', 'Creative'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                        categoryFilter === cat
                          ? 'bg-accent text-on-accent border-accent font-semibold'
                          : 'bg-surface-container text-on-surface-variant border-border-default hover:text-on-surface'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clubs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                {filteredClubs.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-xs text-on-surface-variant">
                    No clubs match the search criteria.
                  </div>
                ) : (
                  filteredClubs.map((clubItem) => (
                    <div
                      key={clubItem.id}
                      className="p-4 rounded-xl border border-border-default bg-surface-container-low flex flex-col justify-between gap-3"
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {clubItem.logoUrl ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-border-default bg-surface-container shrink-0">
                                <StorageImage bucket={STORAGE_BUCKETS.clubLogos} path={clubItem.logoPath} alt={clubItem.name} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold shrink-0 border border-border-default text-xs">
                                {clubItem.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <span className="font-bold text-sm sm:text-base text-on-surface truncate block">
                                {clubItem.name}
                              </span>
                              <span className="text-[11px] text-on-surface-variant">
                                Ref: {clubItem.refId} • {clubItem.memberCount} Members
                              </span>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border shrink-0 ${
                              clubItem.approvalStatus === 'APPROVED'
                                ? 'bg-surface-container text-primary border-border-default'
                                : clubItem.approvalStatus === 'PENDING'
                                ? 'bg-surface text-primary border-black font-semibold'
                                : 'bg-surface-container-high text-on-surface border-border-default'
                            }`}
                          >
                            {clubItem.approvalStatus}
                          </span>
                        </div>

                        <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                          {clubItem.description}
                        </p>

                        <div className="text-[11px] text-on-surface-variant flex flex-col gap-0.5">
                          <span>Officer: <strong className="text-on-surface">{clubItem.assignedAdminName || 'Unassigned'}</strong></span>
                          <span>Advisor: <strong className="text-on-surface">{clubItem.facultyAdvisor || 'Unassigned'}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border-default text-xs">
                        <div className="flex items-center gap-2">
                          {clubItem.approvalStatus === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveClub(clubItem.id)}
                                className="h-8 px-3 rounded-lg bg-accent text-on-accent text-xs font-semibold hover:opacity-90 shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectClub(clubItem.id)}
                                className="h-8 px-3 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high border border-border-default"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setTargetClubId(clubItem.id);
                              setActiveTab('roles');
                            }}
                            className="h-8 px-3 rounded-lg bg-surface-container text-xs font-medium text-on-surface hover:bg-surface-container-high transition-colors border border-border-default"
                          >
                            Assign Officer
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteClub(clubItem)}
                          className="text-on-surface-variant hover:text-primary underline text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: USERS */}
          {activeTab === 'users' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-default">
                <div>
                  <h2 className="text-lg font-bold text-on-surface">Registered User Directory</h2>
                  <p className="text-xs text-on-surface-variant">Accounts, role privileges, and active statuses</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('roles')}
                  className="h-9 px-4 rounded-xl bg-accent text-on-accent text-xs font-semibold hover:opacity-90 self-start sm:self-auto shadow-sm"
                >
                  Manage Roles
                </button>
              </div>

              {/* Search User */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search users by name, college email, or student ID..."
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full bg-surface-container-low text-on-surface text-xs sm:text-sm pl-10 pr-3 py-2 rounded-xl border border-border-default focus:outline-none focus:border-black"
                />
              </div>

              {/* Users Mobile Card View (block sm:hidden) */}
              <div className="block sm:hidden divide-y divide-border-default">
                {filteredUsers.length === 0 ? (
                  <p className="py-8 text-center text-xs text-on-surface-variant">
                    No users found matching your search.
                  </p>
                ) : (
                  filteredUsers.map((u) => (
                    <div key={u.id} className="py-3.5 flex flex-col gap-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-on-surface text-sm truncate">{u.fullName}</span>
                          <span className="text-xs text-on-surface-variant truncate">{u.email}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-surface-container text-primary border border-border-default shrink-0">
                          {u.role}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1 text-xs text-on-surface-variant bg-surface-container-low p-2.5 rounded-lg border border-border-default">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-on-surface-variant block">ID</span>
                          <span className="text-on-surface font-medium">{u.studentId || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Club</span>
                          <span className="text-on-surface font-medium truncate block">{u.assignedClubName || 'None'}</span>
                        </div>
                        <div className="col-span-2 pt-1 flex items-center justify-between border-t border-border-default">
                          <span className="text-[10px] uppercase font-bold text-on-surface-variant">Status</span>
                          <span
                            className={`inline-flex items-center gap-1 font-semibold text-xs ${
                              u.isActive ? 'text-primary' : 'text-on-surface-variant'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-accent' : 'bg-on-surface-variant'}`}></span>
                            {u.isActive ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserForRole(u);
                            setTargetRole(u.role);
                            if (u.assignedClubId) setTargetClubId(u.assignedClubId);
                            setShowRoleModal(true);
                          }}
                          className="h-8 px-3 rounded-lg bg-surface-container text-on-surface text-xs font-semibold border border-border-default hover:bg-surface-container-high"
                        >
                          Edit Role
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          className="h-8 px-2.5 text-xs text-on-surface-variant hover:text-primary underline"
                        >
                          {u.isActive ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          disabled
                          title="Account deletion requires a protected server-side Auth Admin function."
                          className="h-8 px-2.5 text-xs text-on-surface-variant underline ml-auto opacity-50 cursor-not-allowed"
                        >
                          Deletion unavailable
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Users Desktop Table View (hidden sm:block) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border-default text-on-surface-variant uppercase font-bold text-[10px]">
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Student ID</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Assigned Club</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-on-surface-variant">
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className="font-semibold text-on-surface">{u.fullName}</span>
                              <span className="text-[11px] text-on-surface-variant">{u.email}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-on-surface tabular-nums">
                            {u.studentId || 'N/A'}
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-surface-container text-primary border border-border-default">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-on-surface truncate max-w-[150px]">
                            {u.assignedClubName || 'None'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                                u.isActive ? 'text-primary' : 'text-on-surface-variant'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-accent' : 'bg-on-surface-variant'}`}></span>
                              {u.isActive ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserForRole(u);
                                  setTargetRole(u.role);
                                  if (u.assignedClubId) setTargetClubId(u.assignedClubId);
                                  setShowRoleModal(true);
                                }}
                                className="h-7 px-2.5 rounded bg-surface-container text-on-surface text-[11px] font-semibold border border-border-default hover:bg-surface-container-high"
                              >
                                Edit Role
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(u)}
                                className="h-7 px-2 text-[11px] text-on-surface-variant hover:text-primary underline"
                              >
                                {u.isActive ? 'Suspend' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                disabled
                                title="Account deletion requires a protected server-side Auth Admin function."
                                className="h-7 px-2 text-[11px] text-on-surface-variant underline opacity-50 cursor-not-allowed"
                              >
                                Deletion unavailable
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: EVENTS */}
          {activeTab === 'events' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-default">
                <div>
                  <h2 className="text-lg font-bold text-on-surface">Campus Events Moderation</h2>
                  <p className="text-xs text-on-surface-variant">Manage scheduled platform and club events</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(true)}
                  className="h-9 px-4 rounded-xl bg-accent text-on-accent text-xs font-semibold hover:opacity-90 self-start sm:self-auto shadow-sm"
                >
                  + Create Event
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {events.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-xs text-on-surface-variant">
                    No events scheduled yet.
                  </div>
                ) : (
                  events.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-4 rounded-xl border border-border-default bg-surface-container-low flex flex-col justify-between gap-3"
                    >
                      <div className="flex flex-col gap-2">
                        {evt.posterUrl && (
                          <div className="w-full h-32 rounded-lg overflow-hidden border border-border-default bg-surface-container">
                            <StorageImage bucket={STORAGE_BUCKETS.eventPosters} path={evt.posterPath} alt={evt.title} className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-bold text-sm text-on-surface">{evt.title}</h3>
                            <span className="text-xs text-on-surface-variant mt-0.5 block">
                              {evt.eventDate} • {evt.location}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-surface-container text-primary border border-border-default shrink-0">
                            {evt.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                          {evt.description}
                        </p>
                        <div className="text-xs text-on-surface flex justify-between font-medium">
                          <span>RSVPs: <strong className="tabular-nums">{evt.registeredCount} / {evt.capacity}</strong></span>
                          <span className="text-on-surface-variant">{evt.clubName ? `Club: ${evt.clubName}` : 'Platform-wide'}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border-default text-xs">
                        <button
                          type="button"
                          onClick={() => handleToggleEventPublish(evt)}
                          className="h-8 px-3 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high border border-border-default"
                        >
                          {evt.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(evt)}
                          className="text-on-surface-variant hover:text-primary underline text-xs"
                        >
                          Delete Event
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-default">
                <div>
                  <h2 className="text-lg font-bold text-on-surface">Campus Bulletins &amp; Notices</h2>
                  <p className="text-xs text-on-surface-variant">Broadcast messages to students and review club announcements</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(true)}
                  className="h-9 px-4 rounded-xl bg-accent text-on-accent text-xs font-semibold hover:opacity-90 self-start sm:self-auto shadow-sm"
                >
                  + Post Bulletin
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {announcements.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-8 text-center">
                    No announcements published yet.
                  </p>
                ) : (
                  announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-4 rounded-xl border border-border-default bg-surface-container-low flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm text-on-surface">{ann.title}</h3>
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-surface-container text-primary border border-border-default">
                            {ann.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant leading-relaxed">{ann.content}</p>
                        {ann.imagePath && <StorageImage bucket={STORAGE_BUCKETS.announcementImages} path={ann.imagePath} alt="Announcement attachment" className="max-h-36 w-full rounded-lg object-cover" />}
                        <span className="text-[11px] text-on-surface-variant mt-1">
                          Posted by {ann.postedByName} {ann.clubName ? `(${ann.clubName})` : ''} on {new Date(ann.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default shrink-0 text-xs">
                        <button
                          type="button"
                          onClick={() => handleToggleAnnouncementStatus(ann)}
                          className="h-8 px-3 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high border border-border-default"
                        >
                          {ann.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(ann)}
                          className="text-on-surface-variant hover:text-primary underline text-xs px-2"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 6: ROLE GOVERNANCE */}
          {activeTab === 'roles' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-6 max-w-2xl">
              <div>
                <h2 className="text-lg font-bold text-on-surface">Role Governance &amp; Admin Assignment</h2>
                <p className="text-xs text-on-surface-variant">
                  Elevate students to Club Admin or Super Admin, or assign Club Admins to specific club charters.
                </p>
              </div>

              <form onSubmit={handleRoleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                    Select User
                  </label>
                  <select
                    value={selectedUserForRole?.id || ''}
                    onChange={(e) => {
                      const found = users.find((u) => u.id === e.target.value);
                      setSelectedUserForRole(found || null);
                      if (found) {
                        setTargetRole(found.role);
                        if (found.assignedClubId) setTargetClubId(found.assignedClubId);
                      }
                    }}
                    className="h-10 px-3 bg-surface-container-low border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.email}) — Currently {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                    Assign Target Role
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as Role)}
                    className="h-10 px-3 bg-surface-container-low border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
                  >
                    <option value="STUDENT">STUDENT (Standard membership permissions)</option>
                    <option value="CLUB_ADMIN">CLUB_ADMIN (Manage assigned club charter &amp; events)</option>
                    <option value="SUPER_ADMIN">SUPER_ADMIN (Full platform governance authority)</option>
                  </select>
                </div>

                {targetRole === 'CLUB_ADMIN' && (
                  <div className="flex flex-col gap-1">
                    <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                      Assign to Club Charter
                    </label>
                    <select
                      value={targetClubId}
                      onChange={(e) => setTargetClubId(e.target.value)}
                      className="h-10 px-3 bg-surface-container-low border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
                    >
                      <option value="">-- Select a Club Charter --</option>
                      {clubs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.refId})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="p-3 bg-surface-container rounded-xl border border-border-default text-xs text-on-surface-variant">
                  <span className="font-semibold block text-primary mb-0.5">Security Notice</span>
                  Row Level Security policies enforce that only Super Administrators can elevate user roles. All role changes are recorded in the security audit log.
                </div>

                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90 self-start"
                >
                  Update User Privileges
                </button>
              </form>
            </div>
          )}

          {/* TAB 7: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="pb-3 border-b border-border-default">
                <h2 className="text-lg font-bold text-on-surface">Platform Security &amp; Audit Trail</h2>
                <p className="text-xs text-on-surface-variant">Chronological ledger of registrations, role changes, and system events</p>
              </div>

              <div className="flex flex-col gap-2.5">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-on-surface-variant py-8 text-center">
                    No audit records logged yet.
                  </p>
                ) : (
                  auditLogs.map((log) => (
                    <div key={log.id} className="p-3.5 bg-surface-container-low border border-border-default rounded-xl flex flex-col gap-1 text-xs">
                      <div className="flex justify-between items-center text-on-surface font-semibold">
                        <span className="font-mono text-xs">{log.actionType}</span>
                        <span className="text-[11px] text-on-surface-variant tabular-nums">
                          {new Date(log.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-on-surface leading-relaxed mt-0.5">{log.details}</p>
                      <span className="text-[10px] text-on-surface-variant mt-1">
                        Actor: {log.actorEmail} ({log.actorRole}) {log.targetIdentifier ? `• Target: ${log.targetIdentifier}` : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Club Modal with Logo Upload */}
      <Modal
        isOpen={showCreateClubModal}
        onClose={() => setShowCreateClubModal(false)}
        title="Register New Student Club"
      >
        <form onSubmit={handleCreateClubSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Club Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Artificial Intelligence Society"
              value={newClubName}
              onChange={(e) => setNewClubName(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Category *
              </label>
              <select
                value={newClubCat}
                onChange={(e) => setNewClubCat(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              >
                <option value="Academic">Academic</option>
                <option value="Engineering">Engineering</option>
                <option value="Tech">Tech</option>
                <option value="Humanities">Humanities</option>
                <option value="Creative">Creative</option>
                <option value="Sports">Sports</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Contact Email
              </label>
              <input
                type="email"
                placeholder="club@univ.edu"
                value={newClubEmail}
                onChange={(e) => setNewClubEmail(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Mission / Description *
            </label>
            <textarea
              rows={3}
              required
              placeholder="State the organization charter and objectives..."
              value={newClubDesc}
              onChange={(e) => setNewClubDesc(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Meeting Schedule
              </label>
              <input
                type="text"
                placeholder="Wednesdays • 6:00 PM"
                value={newClubSchedule}
                onChange={(e) => setNewClubSchedule(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Meeting Location
              </label>
              <input
                type="text"
                placeholder="Science Hall 101"
                value={newClubLocation}
                onChange={(e) => setNewClubLocation(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Faculty Advisor
            </label>
            <input
              type="text"
              placeholder="Dr. Samuel Higgins"
              value={newClubAdvisor}
              onChange={(e) => setNewClubAdvisor(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          {/* Logo Uploader */}
          <ImageUploader
            bucket={STORAGE_BUCKETS.clubLogos}
            folderId={user?.id}
            label="Club Logo"
            currentImageUrl={newClubLogoUrl}
            onImageUploaded={(_url, path) => setNewClubLogoUrl(path)}
            onImageRemoved={() => setNewClubLogoUrl('')}
            helperText="JPG, PNG, WebP (max 5 MB)"
            aspectRatio="square"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={() => setShowCreateClubModal(false)}
              className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-5 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90"
            >
              Create Club
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Event Modal with Poster Upload */}
      <Modal
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        title="Create Platform or Club Event"
      >
        <form onSubmit={handleCreateEventSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Event Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Annual Student Assembly"
              value={newEventTitle}
              onChange={(e) => setNewEventTitle(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Host Organization
              </label>
              <select
                value={newEventClubId}
                onChange={(e) => setNewEventClubId(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              >
                <option value="">Campus Platform Event</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Capacity *
              </label>
              <input
                type="number"
                required
                min={1}
                value={newEventCapacity}
                onChange={(e) => setNewEventCapacity(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Date &amp; Time *
              </label>
              <input
                type="text"
                required
                placeholder="Nov 12 • 2:00 PM"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Location *
              </label>
              <input
                type="text"
                required
                placeholder="Main Auditorium"
                value={newEventLocation}
                onChange={(e) => setNewEventLocation(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Meeting / Registration Link (Optional)
            </label>
            <input
              type="url"
              placeholder="https://univ.edu/events/assembly"
              value={newEventLink}
              onChange={(e) => setNewEventLink(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Event agenda and instructions..."
              value={newEventDescription}
              onChange={(e) => setNewEventDescription(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          {/* Event Poster Upload */}
          <ImageUploader
            bucket={STORAGE_BUCKETS.eventPosters}
            folderId={newEventClubId || user?.id}
            label="Event Poster"
            currentImageUrl={newEventPosterUrl}
            onImageUploaded={(_url, path) => setNewEventPosterUrl(path)}
            onImageRemoved={() => setNewEventPosterUrl('')}
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
              className="h-9 px-5 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90"
            >
              Publish Event
            </button>
          </div>
        </form>
      </Modal>

      {/* Broadcast Announcement Modal */}
      <Modal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        title="Broadcast Campus Notice"
      >
        <form onSubmit={handleCreateAnnouncementSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Notice Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Campus Activity Week Guidelines"
              value={newAnnouncementTitle}
              onChange={(e) => setNewAnnouncementTitle(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Message Content *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Campus-wide message..."
              value={newAnnouncementContent}
              onChange={(e) => setNewAnnouncementContent(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs text-on-surface focus:outline-none focus:border-black"
            />
          </div>

          <ImageUploader
            bucket={STORAGE_BUCKETS.announcementImages}
            folderId={user?.id}
            label="Announcement Image (Optional)"
            currentImageUrl={newAnnouncementImagePath}
            onImageUploaded={(_url, path) => setNewAnnouncementImagePath(path)}
            onImageRemoved={() => setNewAnnouncementImagePath('')}
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
              className="h-9 px-5 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90"
            >
              Broadcast
            </button>
          </div>
        </form>
      </Modal>

      {/* Role Management Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title={`Role Governance: ${selectedUserForRole?.fullName || 'User'}`}
      >
        <form onSubmit={handleRoleSubmit} className="flex flex-col gap-3">
          <div className="p-3 bg-surface-container-low border border-border-default rounded-xl text-xs">
            <span className="font-semibold block text-on-surface">{selectedUserForRole?.fullName}</span>
            <span className="text-on-surface-variant">{selectedUserForRole?.email}</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Target Role
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value as Role)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
            >
              <option value="STUDENT">STUDENT</option>
              <option value="CLUB_ADMIN">CLUB_ADMIN</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </div>

          {targetRole === 'CLUB_ADMIN' && (
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Assigned Club Charter
              </label>
              <select
                value={targetClubId}
                onChange={(e) => setTargetClubId(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs font-medium text-on-surface focus:outline-none focus:border-black"
              >
                <option value="">-- Select a Club Charter --</option>
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.refId})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={() => setShowRoleModal(false)}
              className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-5 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90"
            >
              Save Privileges
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmDialog)}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title || 'Confirm Action'}
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-on-surface-variant leading-relaxed">
            {confirmDialog?.message}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={() => setConfirmDialog(null)}
              className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmDialog?.onConfirm()}
              className="h-9 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90"
            >
              {confirmDialog?.actionLabel || 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      <BottomNav />
    </div>
  );
};

export default SuperAdminDashboard;
