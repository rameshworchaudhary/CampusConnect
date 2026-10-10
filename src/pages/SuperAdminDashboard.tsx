import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { AnnouncementItem, User, Club, AuditLogItem, PlatformStats, EventItem } from '../types';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const SuperAdminDashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [dataError, setDataError] = useState<string | null>(null);

  const [searchClub, setSearchClub] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'overview' | 'clubs' | 'users' | 'events' | 'announcements' | 'roles' | 'audit' | 'cms'>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active subsystem modal
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showCmsModal, setShowCmsModal] = useState(false);
  const [showCreateClubModal, setShowCreateClubModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAnnouncementManager, setShowAnnouncementManager] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showEventManager, setShowEventManager] = useState(false);
  const [showOperationsMenu, setShowOperationsMenu] = useState(false);
  const operationsMenuRef = useRef<HTMLDivElement>(null);

  // Generic in-app confirmation modal state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Role Management Quick Action Form State
  const [selectedUserForRole, setSelectedUserForRole] = useState<User | null>(null);
  const [targetRole, setTargetRole] = useState<'CLUB_ADMIN' | 'SUPER_ADMIN' | 'STUDENT'>('CLUB_ADMIN');
  const [targetClubId, setTargetClubId] = useState<number | ''>('');

  // New club creation form
  const [newClubName, setNewClubName] = useState('');
  const [newClubCat, setNewClubCat] = useState('Academic');
  const [newClubDesc, setNewClubDesc] = useState('');
  const [newClubSchedule, setNewClubSchedule] = useState('');
  const [newClubLocation, setNewClubLocation] = useState('');

  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventLink, setNewEventLink] = useState('');
  const [newEventCapacity, setNewEventCapacity] = useState('100');
  const [newEventClubId, setNewEventClubId] = useState<number | ''>('');
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
  const [newAnnouncementContent, setNewAnnouncementContent] = useState('');
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);

  // CMS edit form state
  const [cmsSiteName, setCmsSiteName] = useState('');
  const [cmsHeading, setCmsHeading] = useState('');
  const [cmsDesc, setCmsDesc] = useState('');
  const [cmsBannerTitle, setCmsBannerTitle] = useState('');
  const [cmsBannerText, setCmsBannerText] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (user?.role !== 'SUPER_ADMIN') {
      navigate('/');
      return;
    }
    fetchPlatformData();
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (operationsMenuRef.current && !operationsMenuRef.current.contains(event.target as Node)) {
        setShowOperationsMenu(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowOperationsMenu(false);
    };
    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const fetchPlatformData = async () => {
    setStatsLoading(true);
    setStatsError(null);
    setDataError(null);
    try {
      const [statsRes, clubsRes, usersRes, auditRes, cmsRes, announcementsRes, eventsRes] = await Promise.all([
        apiClient.get('/stats/platform'),
        apiClient.get('/admin/clubs'),
        apiClient.get('/admin/users'),
        apiClient.get('/admin/audit-logs'),
        apiClient.get('/cms/public'),
        apiClient.get('/admin/announcements'),
        apiClient.get('/admin/events'),
      ]);

      if (statsRes.data?.data) {
        setStats(statsRes.data.data);
      } else {
        throw new Error('The platform statistics response was empty.');
      }
      if (clubsRes.data?.data) {
        setClubs(clubsRes.data.data);
        if (clubsRes.data.data.length > 0) {
          setTargetClubId(clubsRes.data.data[0].id);
        }
      }
      if (usersRes.data?.data) {
        setUsers(usersRes.data.data);
        // Default target user for the Role Quick Action (Michael Torres or first student)
        setSelectedUserForRole(usersRes.data.data[0] || null);
      }
      if (auditRes.data?.data) setAuditLogs(auditRes.data.data);
      if (announcementsRes.data?.data) setAnnouncements(announcementsRes.data.data);
      if (eventsRes.data?.data) setEvents(eventsRes.data.data);
      if (cmsRes.data?.data) {
        const c = cmsRes.data.data;
        setCmsSiteName(c.siteName);
        setCmsHeading(c.heroHeading);
        setCmsDesc(c.heroDescription);
        setCmsBannerTitle(c.noticeBannerTitle);
        setCmsBannerText(c.noticeBannerText);
      }
    } catch (error: any) {
      setStatsError(error.response?.data?.message || 'Platform statistics could not be loaded.');
      setDataError(error.response?.data?.message || 'Some administrator data could not be loaded.');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleDeleteUser = (targetUser: User) => {
    setConfirmDialog({
      title: 'Confirm User Deletion',
      message: `Are you sure you want to delete ${targetUser.fullName}'s account? This action cannot be undone.`,
      actionLabel: 'Delete User',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/admin/users/${targetUser.id}`);
          setToastMessage(`User ${targetUser.fullName} deleted.`);
          setConfirmDialog(null);
          fetchPlatformData();
        } catch (err: any) {
          setToastMessage(err.response?.data?.message || 'Failed to delete user.');
        }
      },
    });
  };

  const handleDeleteClub = (club: Club) => {
    setConfirmDialog({
      title: 'Confirm Club Deletion',
      message: `Are you sure you want to delete ${club.name} and all associated records?`,
      actionLabel: 'Delete Club',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/admin/clubs/${club.id}`);
          setToastMessage(`Club ${club.name} deleted.`);
          setConfirmDialog(null);
          fetchPlatformData();
        } catch (err: any) {
          setToastMessage(err.response?.data?.message || 'Failed to delete club.');
        }
      },
    });
  };

  const handleAnnouncementStatus = async (announcement: AnnouncementItem) => {
    try {
      await apiClient.patch(`/admin/announcements/${announcement.id}/status`, { active: !announcement.isActive });
      setToastMessage(`Announcement ${announcement.isActive ? 'deactivated' : 'activated'}.`);
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to update announcement status.');
    }
  };

  const handleDeleteAnnouncement = (announcement: AnnouncementItem) => {
    setConfirmDialog({
      title: 'Confirm Announcement Deletion',
      message: `Are you sure you want to delete "${announcement.title}"?`,
      actionLabel: 'Delete Announcement',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/admin/announcements/${announcement.id}`);
          setToastMessage('Announcement deleted.');
          setConfirmDialog(null);
          fetchPlatformData();
        } catch (err: any) {
          setToastMessage(err.response?.data?.message || 'Failed to delete announcement.');
        }
      },
    });
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForRole) return;
    try {
      await apiClient.put(`/admin/users/${selectedUserForRole.id}/role`, {
        role: targetRole,
        assignedClubId: targetRole === 'CLUB_ADMIN' ? targetClubId : null,
      });
      const selectedClubName =
        clubs.find((c) => c.id === targetClubId)?.name || 'selected club';
      setToastMessage(
        `Updated ${selectedUserForRole.studentId || selectedUserForRole.fullName} to ${targetRole} for ${selectedClubName}`
      );
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to update role.');
    }
  };

  const handleToggleUserStatus = async (targetUser: User) => {
    try {
      await apiClient.put(`/admin/users/${targetUser.id}/status`, {
        active: !targetUser.isActive,
      });
      setToastMessage(
        `User ${targetUser.fullName} ${targetUser.isActive ? 'deactivated' : 'activated'}.`
      );
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to toggle account status.');
    }
  };

  const handleCreateClub = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/clubs', {
        name: newClubName,
        category: newClubCat,
        description: newClubDesc,
        meetingSchedule: newClubSchedule,
        meetingLocation: newClubLocation,
        published: true,
      });
      setToastMessage('New club successfully created and published.');
      setShowCreateClubModal(false);
      setNewClubName('');
      setNewClubDesc('');
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to create club.');
    }
  };

  const handleSaveCms = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.put('/admin/cms', {
        siteName: cmsSiteName,
        heroHeading: cmsHeading,
        heroDescription: cmsDesc,
        noticeBannerTitle: cmsBannerTitle,
        noticeBannerText: cmsBannerText,
      });
      setToastMessage('Landing page CMS successfully updated and persisted.');
      setShowCmsModal(false);
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to update CMS.');
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/events', {
        title: newEventTitle,
        description: newEventDescription,
        eventDate: newEventDate,
        location: newEventLocation,
        eventLink: newEventLink,
        capacity: Number(newEventCapacity),
        clubId: newEventClubId || null,
        published: true,
        platformEvent: !newEventClubId,
      });
      setToastMessage('Event created and published successfully.');
      setShowCreateEventModal(false);
      setNewEventTitle('');
      setNewEventDescription('');
      setNewEventDate('');
      setNewEventLocation('');
      setNewEventLink('');
      setNewEventCapacity('100');
      setNewEventClubId('');
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to create event.');
    }
  };

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/admin/announcements', {
        title: newAnnouncementTitle,
        content: newAnnouncementContent,
        postedByName: user?.fullName,
      });
      setToastMessage('Announcement published successfully.');
      setShowAnnouncementModal(false);
      setNewAnnouncementTitle('');
      setNewAnnouncementContent('');
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to publish announcement.');
    }
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement) return;
    try {
      await apiClient.put(`/admin/announcements/${editingAnnouncement.id}`, {
        title: newAnnouncementTitle,
        content: newAnnouncementContent,
        postedByName: editingAnnouncement.postedByName,
      });
      setToastMessage('Announcement updated successfully.');
      setEditingAnnouncement(null);
      setNewAnnouncementTitle('');
      setNewAnnouncementContent('');
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to update announcement.');
    }
  };

  const handleEventStatus = async (event: EventItem) => {
    try {
      await apiClient.put(`/admin/events/${event.id}`, {
        title: event.title,
        description: event.description,
        eventDate: event.eventDate,
        location: event.location,
        eventLink: event.eventLink,
        capacity: event.capacity,
        clubId: event.clubId || null,
        published: !event.isPublished,
        platformEvent: event.isPlatformEvent,
        badgeLabel: event.badgeLabel,
      });
      setToastMessage(`Event ${event.isPublished ? 'unpublished' : 'published'}.`);
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to update event status.');
    }
  };

  const handleDeleteEvent = (event: EventItem) => {
    setConfirmDialog({
      title: 'Confirm Event Deletion',
      message: `Are you sure you want to delete "${event.title}" and its registrations?`,
      actionLabel: 'Delete Event',
      onConfirm: async () => {
        try {
          await apiClient.delete(`/admin/events/${event.id}`);
          setToastMessage('Event deleted.');
          setConfirmDialog(null);
          fetchPlatformData();
        } catch (err: any) {
          setToastMessage(err.response?.data?.message || 'Failed to delete event.');
        }
      },
    });
  };

  const filteredClubs = clubs.filter((c) => {
    const matchesCategory = categoryFilter === 'All' || c.category === categoryFilter;
    const matchesSearch =
      !searchClub ||
      c.name.toLowerCase().includes(searchClub.toLowerCase()) ||
      c.refId?.toLowerCase().includes(searchClub.toLowerCase()) ||
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

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Super Admin Portal" />

      <main className="flex-1 w-full pt-20 pb-24 md:pb-12 bg-surface px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl flex flex-col gap-6">

          {/* Header Section with Title & Fast Action Buttons */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-border-default shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary font-bold text-[11px]">
                  System Active Directory
                </span>
                <span className="inline-flex items-center gap-1 text-xs bg-surface-container text-primary font-semibold px-2 py-0.5 rounded-full border border-border-default">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
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

            {/* Quick action buttons on banner */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setShowCreateClubModal(true)}
                className="h-10 px-3.5 bg-primary text-on-primary text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 hover:opacity-90 shadow-sm transition-opacity"
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

          {/* Platform Metrics: 4 Monochrome Counter Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('users')}
              className="bg-surface-container-lowest p-4 rounded-xl border border-border-default flex flex-col justify-between shadow-sm min-h-[5.5rem] text-left hover:border-black transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-secondary uppercase tracking-wider">Registered Users</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">badge</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.totalUsers.toLocaleString() : '0'}
                </span>
                <span className="text-xs text-secondary">Accounts</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('clubs')}
              className="bg-surface-container-lowest p-4 rounded-xl border border-border-default flex flex-col justify-between shadow-sm min-h-[5.5rem] text-left hover:border-black transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-secondary uppercase tracking-wider">Registered Clubs</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">account_tree</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.totalClubs.toLocaleString() : '0'}
                </span>
                <span className="text-xs text-secondary">Charters</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className="bg-surface-container-lowest p-4 rounded-xl border border-border-default flex flex-col justify-between shadow-sm min-h-[5.5rem] text-left hover:border-black transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-secondary uppercase tracking-wider">Published Events</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">event_available</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.publishedEvents.toLocaleString() : '0'}
                </span>
                <span className="text-xs text-secondary">Active</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className="bg-surface-container-lowest p-4 rounded-xl border border-border-default flex flex-col justify-between shadow-sm min-h-[5.5rem] text-left hover:border-black transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] sm:text-[11px] font-bold text-secondary uppercase tracking-wider">Total Registrations</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">how_to_reg</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl sm:text-3xl text-primary font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.totalRegistrations.toLocaleString() : '0'}
                </span>
                <span className="text-xs text-secondary">RSVPs</span>
              </div>
            </button>
          </div>

          {statsError && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-container p-4 text-sm">
              <p className="text-secondary">{statsError}</p>
              <button type="button" onClick={fetchPlatformData} className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-on-primary text-xs">
                Retry
              </button>
            </div>
          )}
          {dataError && dataError !== statsError && (
            <div className="rounded-xl border border-border-default bg-surface-container p-4 text-sm text-secondary">
              {dataError}
            </div>
          )}

          {/* Responsive Navigation Tab Bar */}
          <div className="border-b border-border-default flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'overview', label: 'Overview & Status', icon: 'space_dashboard' },
              { id: 'clubs', label: `Clubs (${clubs.length})`, icon: 'account_tree' },
              { id: 'users', label: `Users (${users.length})`, icon: 'group' },
              { id: 'events', label: `Events (${events.length})`, icon: 'event' },
              { id: 'announcements', label: `Announcements (${announcements.length})`, icon: 'campaign' },
              { id: 'roles', label: 'Role Governance', icon: 'security' },
              { id: 'audit', label: `Audit Trail (${auditLogs.length})`, icon: 'history' },
              { id: 'cms', label: 'Landing CMS', icon: 'web' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-on-primary font-semibold shadow-sm'
                    : 'text-secondary hover:text-primary hover:bg-surface-container'
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
              {/* Left Column (8 cols): Clubs & Events Overview */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {/* Registered Clubs Overview */}
                <section className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border-default">
                    <div>
                      <h2 className="text-base sm:text-lg text-primary font-bold">
                        Institutional Clubs Ledger
                      </h2>
                      <p className="text-xs text-secondary">
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

                  <div className="flex flex-col gap-3">
                    {clubs.slice(0, 4).map((clubItem) => {
                      const isUnassigned = !clubItem.assignedAdminId;
                      return (
                        <div
                          key={clubItem.id}
                          className="bg-surface-container-low p-4 rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm sm:text-base text-primary truncate">
                                {clubItem.name}
                              </span>
                              <span className="bg-surface-container text-primary text-[10px] uppercase font-semibold px-2 py-0.5 rounded border border-border-default">
                                {clubItem.category}
                              </span>
                            </div>
                            <span className="text-xs text-secondary mt-0.5">
                              Charter: {clubItem.refId} • Officer: {isUnassigned ? 'Unassigned' : clubItem.assignedAdminName} • {clubItem.memberCount} members
                            </span>
                          </div>

                          <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setTargetClubId(clubItem.id);
                                setActiveTab('roles');
                              }}
                              className="h-8 px-3 rounded-lg bg-surface-container text-xs font-medium text-primary hover:bg-surface-container-high transition-colors border border-border-default"
                            >
                              {isUnassigned ? 'Assign Admin' : 'Change Officer'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteClub(clubItem)}
                              className="h-8 px-2.5 rounded-lg text-xs text-secondary hover:text-primary transition-colors underline"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Published Platform Events */}
                <section className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border-default">
                    <div>
                      <h2 className="text-base sm:text-lg text-primary font-bold">
                        Platform &amp; Club Events
                      </h2>
                      <p className="text-xs text-secondary">
                        Active student registrations &amp; campus scheduling
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

                  <div className="flex flex-col gap-3">
                    {events.slice(0, 4).map((event) => (
                      <div
                        key={event.id}
                        className="bg-surface-container-low p-4 rounded-xl border border-border-default flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm sm:text-base text-primary truncate">
                              {event.title}
                            </span>
                            <span className="bg-surface-container text-primary text-[10px] uppercase font-semibold px-2 py-0.5 rounded border border-border-default">
                              {event.isPublished ? 'Published' : 'Draft'}
                            </span>
                          </div>
                          <span className="text-xs text-secondary mt-0.5">
                            {event.eventDate} • {event.location} • {event.registeredCount}/{event.capacity} registered
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEventStatus(event)}
                            className="h-8 px-3 rounded-lg bg-surface-container text-xs font-medium text-primary hover:bg-surface-container-high transition-colors border border-border-default"
                          >
                            {event.isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEvent(event)}
                            className="h-8 px-2.5 rounded-lg text-xs text-secondary hover:text-primary transition-colors underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Right Column (4 cols): Action Center & Audit Trail */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                {/* Governance Quick Action Center */}
                <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center gap-2 pb-3 border-b border-border-default">
                    <span className="material-symbols-outlined text-[20px] text-primary">admin_panel_settings</span>
                    <h2 className="text-base text-primary font-semibold">
                      Administrative Actions
                    </h2>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateClubModal(true)}
                      className="w-full h-9 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      <span>Register New Club</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCreateEventModal(true)}
                      className="w-full h-9 rounded-lg bg-surface-container text-primary text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">event</span>
                      <span>Create Platform Event</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAnnouncementModal(true)}
                      className="w-full h-9 rounded-lg bg-surface-container text-primary text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">campaign</span>
                      <span>Broadcast Campus Notice</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('roles')}
                      className="w-full h-9 rounded-lg bg-surface-container text-primary text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">security</span>
                      <span>Manage User Roles</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('cms')}
                      className="w-full h-9 rounded-lg bg-surface-container text-primary text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit_note</span>
                      <span>Edit Landing Page CMS</span>
                    </button>
                  </div>
                </div>

                {/* Audit Trail Excerpt */}
                <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 shadow-sm flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-3 border-b border-border-default">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-primary">history</span>
                      <h2 className="text-base text-primary font-semibold">
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

                  <div className="flex flex-col gap-3">
                    {auditLogs.slice(0, 4).map((log) => (
                      <div key={log.id} className="text-xs p-3 rounded-xl bg-surface-container-low border border-border-default flex flex-col gap-1">
                        <div className="flex justify-between items-center text-primary font-semibold">
                          <span className="truncate">{log.actionType}</span>
                          <span className="text-[11px] text-secondary whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-on-surface line-clamp-2 leading-relaxed">
                          {log.details}
                        </p>
                        <span className="text-[10px] text-secondary mt-0.5 truncate">
                          {log.actorEmail} • IP: {log.ipAddress}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLUBS DIRECTORY */}
          {activeTab === 'clubs' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-default">
                <div>
                  <h2 className="text-lg text-primary font-bold">Campus Clubs Directory</h2>
                  <p className="text-xs text-secondary">All recognized student organizations</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateClubModal(true)}
                  className="h-9 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 self-start sm:self-auto shadow-sm"
                >
                  + Add New Club
                </button>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search clubs by name, ref ID, or officer..."
                    value={searchClub}
                    onChange={(e) => setSearchClub(e.target.value)}
                    className="w-full bg-surface-container-low text-on-surface text-sm pl-10 pr-3 py-2 rounded-xl border border-border-default focus:outline-none focus:border-black"
                  />
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {['All', 'Academic', 'Humanities', 'Engineering', 'Sports', 'Arts'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors whitespace-nowrap ${
                        categoryFilter === cat
                          ? 'bg-primary text-on-primary border-primary font-semibold'
                          : 'bg-surface-container text-secondary border-border-default hover:text-primary'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Responsive Clubs Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                {filteredClubs.length === 0 ? (
                  <div className="col-span-full py-12 text-center text-secondary">
                    No clubs match the search criteria.
                  </div>
                ) : (
                  filteredClubs.map((clubItem) => {
                    const isUnassigned = !clubItem.assignedAdminId;
                    return (
                      <div
                        key={clubItem.id}
                        className="p-4 rounded-xl border border-border-default bg-surface-container-low flex flex-col justify-between gap-3"
                      >
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-base text-primary truncate">
                              {clubItem.name}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-surface-container text-primary border border-border-default shrink-0">
                              {clubItem.category}
                            </span>
                          </div>
                          <span className="text-xs text-secondary">
                            Charter: <span className="font-semibold text-primary">{clubItem.refId}</span> • {clubItem.memberCount} Members
                          </span>
                          <span className="text-xs text-secondary">
                            Officer: <span className="font-semibold text-primary">{isUnassigned ? 'Unassigned' : clubItem.assignedAdminName}</span>
                          </span>
                          {clubItem.description && (
                            <p className="text-xs text-secondary line-clamp-2 mt-1">
                              {clubItem.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border-default text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetClubId(clubItem.id);
                              setActiveTab('roles');
                            }}
                            className="font-semibold text-primary hover:underline"
                          >
                            {isUnassigned ? 'Assign Officer →' : 'Reassign Officer →'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteClub(clubItem)}
                            className="text-secondary hover:text-primary underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: USER ACCOUNTS */}
          {activeTab === 'users' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-default">
                <div>
                  <h2 className="text-lg text-primary font-bold">User Accounts Directory</h2>
                  <p className="text-xs text-secondary">{users.length} Registered institutional accounts</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchUser}
                    onChange={(e) => setSearchUser(e.target.value)}
                    className="w-full bg-surface-container-low text-on-surface text-xs pl-9 pr-3 py-1.5 rounded-lg border border-border-default focus:outline-none focus:border-black"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {filteredUsers.length === 0 ? (
                  <div className="py-12 text-center text-secondary">
                    No users match the search query.
                  </div>
                ) : (
                  filteredUsers.map((u) => (
                    <div
                      key={u.id}
                      className="p-4 bg-surface-container-low border border-border-default rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary font-bold text-xs shrink-0 border border-border-default">
                          {u.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-primary truncate">{u.fullName}</span>
                            <span className="px-1.5 py-0.5 bg-surface-container text-[10px] font-bold rounded uppercase border border-border-default">
                              {u.role}
                            </span>
                            <span className="text-[10px] text-secondary">
                              {u.isVerified ? '✓ Verified' : 'Unverified'}
                            </span>
                          </div>
                          <span className="text-xs text-secondary truncate mt-0.5">{u.email} • ID: {u.studentId || 'N/A'} • Dept: {u.department || 'N/A'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserForRole(u);
                            setActiveTab('roles');
                          }}
                          className="px-3 py-1.5 text-xs rounded-lg border border-border-default bg-surface-container text-primary font-medium hover:bg-surface-container-high transition-colors"
                        >
                          Change Role
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleUserStatus(u)}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            u.isActive
                              ? 'bg-surface-container text-primary border-border-default hover:bg-neutral-300'
                              : 'bg-primary text-on-primary border-primary'
                          }`}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {u.role !== 'SUPER_ADMIN' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="px-3 py-1.5 text-xs rounded-lg text-secondary hover:text-primary underline"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: CAMPUS EVENTS */}
          {activeTab === 'events' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-default">
                <div>
                  <h2 className="text-lg text-primary font-bold">Campus Events Management</h2>
                  <p className="text-xs text-secondary">Institutional &amp; club event calendar records</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateEventModal(true)}
                  className="h-9 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 self-start sm:self-auto shadow-sm"
                >
                  + Create Event
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {events.length === 0 ? (
                  <div className="py-12 text-center text-secondary">No platform events created yet.</div>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="p-4 rounded-xl border border-border-default bg-surface-container-low flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm sm:text-base text-primary truncate">
                            {event.title}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-border-default bg-surface-container">
                            {event.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <span className="text-xs text-secondary mt-0.5">
                          {event.eventDate} · {event.location} · {event.registeredCount}/{event.capacity} RSVPs
                        </span>
                        {event.description && (
                          <p className="text-xs text-secondary line-clamp-1 mt-1">{event.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-default shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEventStatus(event)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-border-default bg-surface-container text-primary font-medium hover:bg-surface-container-high transition-colors"
                        >
                          {event.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(event)}
                          className="px-2.5 py-1.5 text-xs text-secondary hover:text-primary underline"
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

          {/* TAB 5: ANNOUNCEMENTS */}
          {activeTab === 'announcements' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border-default">
                <div>
                  <h2 className="text-lg text-primary font-bold">Announcements &amp; Bulletins</h2>
                  <p className="text-xs text-secondary">Broadcast institutional updates across campus</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnnouncementModal(true)}
                  className="h-9 px-4 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 self-start sm:self-auto shadow-sm"
                >
                  + Post Announcement
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {announcements.length === 0 ? (
                  <div className="py-12 text-center text-secondary">No announcements posted.</div>
                ) : (
                  announcements.map((ann) => (
                    <div
                      key={ann.id}
                      className="p-4 rounded-xl border border-border-default bg-surface-container-low flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm sm:text-base text-primary truncate">{ann.title}</span>
                          <span className="text-xs text-secondary">
                            Posted by {ann.postedByName} {ann.clubName ? `• ${ann.clubName}` : '• Institutional Notice'}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-border-default bg-surface-container shrink-0">
                          {ann.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface leading-relaxed mt-1">{ann.content}</p>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default text-xs">
                        <button
                          type="button"
                          onClick={() => handleAnnouncementStatus(ann)}
                          className="font-medium text-primary hover:underline"
                        >
                          {ann.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAnnouncement(ann);
                            setNewAnnouncementTitle(ann.title);
                            setNewAnnouncementContent(ann.content);
                          }}
                          className="font-medium text-primary hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(ann)}
                          className="text-secondary hover:text-primary underline"
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
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4 max-w-2xl mx-auto w-full">
              <div className="flex items-center gap-2 pb-3 border-b border-border-default">
                <span className="material-symbols-outlined text-primary text-[22px]">security</span>
                <div>
                  <h2 className="text-lg text-primary font-bold">Role Management &amp; Access Control</h2>
                  <p className="text-xs text-secondary">Elevate user privileges and link club leadership scopes</p>
                </div>
              </div>

              <form onSubmit={handleRoleSubmit} className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase tracking-wider font-bold text-secondary">
                    Select User Identity
                  </label>
                  <select
                    aria-label="Target User"
                    value={selectedUserForRole?.id || ''}
                    onChange={(e) => {
                      const u = users.find((usr) => usr.id === Number(e.target.value));
                      setSelectedUserForRole(u || null);
                    }}
                    className="h-10 px-3 rounded-lg bg-surface-container-low border border-border-default text-sm text-primary font-medium focus:outline-none focus:border-black"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.email}) - Current: {u.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-secondary">
                      Current Role
                    </label>
                    <div className="h-10 px-3 rounded-lg bg-surface-container flex items-center text-sm font-medium text-secondary border border-border-default">
                      {selectedUserForRole?.role || 'STUDENT'}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-primary">
                      Target Privilege Role
                    </label>
                    <select
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value as any)}
                      className="h-10 px-3 rounded-lg bg-surface-container-low border border-border-default text-sm text-primary font-medium focus:outline-none focus:border-black"
                    >
                      <option value="CLUB_ADMIN">CLUB_ADMIN (Club Officer)</option>
                      <option value="SUPER_ADMIN">SUPER_ADMIN (Institutional Admin)</option>
                      <option value="STUDENT">STUDENT (Standard User)</option>
                    </select>
                  </div>
                </div>

                {targetRole === 'CLUB_ADMIN' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs uppercase tracking-wider font-bold text-primary">
                      Assigned Club Charter Jurisdiction
                    </label>
                    <select
                      value={targetClubId}
                      onChange={(e) => setTargetClubId(Number(e.target.value))}
                      className="h-10 px-3 rounded-lg bg-surface-container-low border border-border-default text-sm text-primary font-medium focus:outline-none focus:border-black"
                    >
                      {clubs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.refId})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="p-3 bg-surface-container-low rounded-lg border border-border-default text-xs text-secondary flex items-start gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">info</span>
                  <span>Privilege changes are logged permanently in the institutional audit ledger.</span>
                </div>

                <button
                  type="submit"
                  className="h-10 bg-primary text-on-primary rounded-xl font-semibold text-xs sm:text-sm hover:opacity-90 shadow-sm transition-opacity"
                >
                  Save Role &amp; Privileges
                </button>
              </form>
            </div>
          )}

          {/* TAB 7: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-border-default">
                <div>
                  <h2 className="text-lg text-primary font-bold">Immutable Audit Ledger</h2>
                  <p className="text-xs text-secondary">{auditLogs.length} Total recorded system events</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {auditLogs.length === 0 ? (
                  <div className="py-12 text-center text-secondary">No audit logs recorded.</div>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-surface-container-low border border-border-default rounded-xl flex flex-col gap-1 text-xs"
                    >
                      <div className="flex justify-between items-center font-semibold text-primary">
                        <span className="font-mono">{log.actionType}</span>
                        <span className="text-secondary text-[11px]">{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-on-surface leading-relaxed">{log.details}</p>
                      <div className="flex flex-wrap justify-between text-secondary pt-1 border-t border-border-default/60 text-[11px] gap-2">
                        <span>Actor: {log.actorEmail} ({log.actorRole})</span>
                        <span>IP: {log.ipAddress}</span>
                        <span className="font-mono text-[10px]">Hash: {log.shaHash}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 8: LANDING CMS */}
          {activeTab === 'cms' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-border-default p-5 sm:p-6 shadow-sm flex flex-col gap-4 max-w-2xl mx-auto w-full">
              <div className="flex items-center gap-2 pb-3 border-b border-border-default">
                <span className="material-symbols-outlined text-primary text-[22px]">web</span>
                <div>
                  <h2 className="text-lg text-primary font-bold">Landing Page Content Management</h2>
                  <p className="text-xs text-secondary">Update site branding, hero headlines, and public bulletins</p>
                </div>
              </div>

              <form onSubmit={handleSaveCms} className="flex flex-col gap-4 mt-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase tracking-wider font-bold text-secondary">Site Brand Name</label>
                  <input
                    type="text"
                    required
                    value={cmsSiteName}
                    onChange={(e) => setCmsSiteName(e.target.value)}
                    className="h-10 px-3 bg-surface-container-low border border-border-default rounded-lg text-sm text-on-surface focus:outline-none focus:border-black"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase tracking-wider font-bold text-secondary">Hero Headline</label>
                  <input
                    type="text"
                    required
                    value={cmsHeading}
                    onChange={(e) => setCmsHeading(e.target.value)}
                    className="h-10 px-3 bg-surface-container-low border border-border-default rounded-lg text-sm text-on-surface focus:outline-none focus:border-black"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase tracking-wider font-bold text-secondary">Hero Description</label>
                  <textarea
                    rows={3}
                    required
                    value={cmsDesc}
                    onChange={(e) => setCmsDesc(e.target.value)}
                    className="p-3 bg-surface-container-low border border-border-default rounded-lg text-sm text-on-surface focus:outline-none focus:border-black"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase tracking-wider font-bold text-secondary">Notice Banner Title</label>
                  <input
                    type="text"
                    value={cmsBannerTitle}
                    onChange={(e) => setCmsBannerTitle(e.target.value)}
                    className="h-10 px-3 bg-surface-container-low border border-border-default rounded-lg text-sm text-on-surface focus:outline-none focus:border-black"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs uppercase tracking-wider font-bold text-secondary">Notice Banner Content</label>
                  <textarea
                    rows={2}
                    value={cmsBannerText}
                    onChange={(e) => setCmsBannerText(e.target.value)}
                    className="p-3 bg-surface-container-low border border-border-default rounded-lg text-sm text-on-surface focus:outline-none focus:border-black"
                  />
                </div>

                <button
                  type="submit"
                  className="h-10 bg-primary text-on-primary rounded-xl font-semibold text-xs sm:text-sm hover:opacity-90 shadow-sm transition-opacity"
                >
                  Save &amp; Publish Landing Page CMS
                </button>
              </form>
            </div>
          )}

        </div>
      </main>

      {/* User Management Modal */}
      <Modal
        isOpen={showUsersModal}
        onClose={() => setShowUsersModal(false)}
        title="User Management Ledger"
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          <div className="flex justify-between items-center text-xs text-secondary border-b pb-2">
            <span>{users.length} Registered Accounts</span>
            <span>Active / Deactivate Control</span>
          </div>
          {users.map((u) => (
            <div
              key={u.id}
              className="p-3 bg-surface-container-low border border-border-default rounded flex items-center justify-between gap-2"
            >
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-primary truncate">{u.fullName}</span>
                <span className="text-xs text-secondary truncate">{u.email}</span>
                <div className="flex items-center gap-1 mt-1">
                  <span className="px-1.5 py-0.2 bg-surface-container text-xs font-semibold rounded uppercase">
                    {u.role}
                  </span>
                  <span className="text-xs text-secondary">• {u.studentId || 'ID: STU'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleUserStatus(u)}
                  className={`px-3 py-1 text-xs rounded border ${
                    u.isActive
                      ? 'bg-surface-container-highest text-primary border-border-default hover:bg-neutral-300'
                      : 'bg-primary text-on-primary border-black'
                  }`}
                >
                  {u.isActive ? 'Deactivate' : 'Activate'}
                </button>
                {u.role !== 'SUPER_ADMIN' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteUser(u)}
                    className="px-3 py-1 text-xs rounded border border-black bg-primary text-on-primary"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Landing Page CMS Modal */}
      <Modal
        isOpen={showCmsModal}
        onClose={() => setShowCmsModal(false)}
        title="Landing Page CMS Editor"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveCms} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Site Brand Name</label>
            <input
              type="text"
              required
              value={cmsSiteName}
              onChange={(e) => setCmsSiteName(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Hero Heading</label>
            <input
              type="text"
              required
              value={cmsHeading}
              onChange={(e) => setCmsHeading(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Hero Description</label>
            <textarea
              rows={2}
              required
              value={cmsDesc}
              onChange={(e) => setCmsDesc(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Notice Banner Title</label>
            <input
              type="text"
              value={cmsBannerTitle}
              onChange={(e) => setCmsBannerTitle(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Notice Banner Content</label>
            <textarea
              rows={2}
              value={cmsBannerText}
              onChange={(e) => setCmsBannerText(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setShowCmsModal(false)}
              className="h-9 px-4 bg-surface-container text-on-surface font-label-md rounded hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 bg-primary text-on-primary font-label-md rounded hover:bg-neutral-800 transition-colors"
            >
              Save & Publish CMS
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Event Modal */}
      <Modal
        isOpen={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        title="Create Platform Event"
      >
        <form onSubmit={handleCreateEvent} className="flex flex-col gap-3">
          <input
            required
            value={newEventTitle}
            onChange={(e) => setNewEventTitle(e.target.value)}
            placeholder="Event title"
            className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
          />
          <textarea
            required
            rows={3}
            value={newEventDescription}
            onChange={(e) => setNewEventDescription(e.target.value)}
            placeholder="Description"
            className="p-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              required
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              placeholder="Date and time"
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
            />
            <input
              required
              value={newEventLocation}
              onChange={(e) => setNewEventLocation(e.target.value)}
              placeholder="Location"
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
            />
          </div>
          <input
            type="url"
            value={newEventLink}
            onChange={(e) => setNewEventLink(e.target.value)}
            placeholder="Event link (optional), e.g. https://meet.example.com/event"
            className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              required
              min="1"
              type="number"
              value={newEventCapacity}
              onChange={(e) => setNewEventCapacity(e.target.value)}
              placeholder="Capacity"
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
            />
            <select
              value={newEventClubId}
              onChange={(e) => setNewEventClubId(e.target.value ? Number(e.target.value) : '')}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
            >
              <option value="">Platform event</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>{club.name}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="h-10 bg-primary text-on-primary rounded font-semibold">
            Create Event
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={showEventManager}
        onClose={() => setShowEventManager(false)}
        title="Manage Events"
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          <div className="text-xs text-secondary border-b border-border-subtle pb-2">
            {events.length} events
          </div>
          {events.length === 0 && <p className="text-sm text-secondary">No events found.</p>}
          {events.map((event) => (
            <div key={event.id} className="rounded border border-border-default bg-surface-container-low p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-primary truncate">{event.title}</p>
                <p className="text-sm text-secondary truncate">{event.eventDate} · {event.location}</p>
                <span className="text-xs text-secondary">
                  {event.isPublished ? 'Published' : 'Unpublished'} · {event.registeredCount}/{event.capacity} registered
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => handleEventStatus(event)} className="text-xs underline">
                  {event.isPublished ? 'Unpublish' : 'Publish'}
                </button>
                <button type="button" onClick={() => handleDeleteEvent(event)} className="text-xs text-primary underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Announcement Management Modal */}
      <Modal
        isOpen={showAnnouncementManager}
        onClose={() => setShowAnnouncementManager(false)}
        title="Announcement Management"
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border-subtle pb-2">
            <span className="text-xs text-secondary">{announcements.length} announcements</span>
            <button
              type="button"
              onClick={() => { setShowAnnouncementManager(false); setShowAnnouncementModal(true); }}
              className="h-8 px-3 rounded bg-primary text-on-primary text-xs font-semibold"
            >
              Add Announcement
            </button>
          </div>
          {announcements.length === 0 && <p className="text-sm text-secondary">No announcements found.</p>}
          {announcements.map((announcement) => (
            <div key={announcement.id} className="rounded border border-border-default bg-surface-container-low p-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-primary truncate">{announcement.title}</p>
                <p className="text-sm text-secondary line-clamp-2">{announcement.content}</p>
                <span className="text-xs text-secondary">{announcement.isActive ? 'Active' : 'Inactive'}{announcement.clubName ? ` • ${announcement.clubName}` : ' • Global'}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => handleAnnouncementStatus(announcement)} className="text-xs underline">
                  {announcement.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAnnouncement(announcement);
                    setNewAnnouncementTitle(announcement.title);
                    setNewAnnouncementContent(announcement.content);
                    setShowAnnouncementManager(false);
                  }}
                  className="text-xs underline"
                >
                  Edit
                </button>
                <button type="button" onClick={() => handleDeleteAnnouncement(announcement)} className="text-xs text-primary underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Announcement Modal */}
      <Modal
        isOpen={showAnnouncementModal}
        onClose={() => setShowAnnouncementModal(false)}
        title="Publish Announcement"
      >
        <form onSubmit={handleCreateAnnouncement} className="flex flex-col gap-3">
          <input
            required
            value={newAnnouncementTitle}
            onChange={(e) => setNewAnnouncementTitle(e.target.value)}
            placeholder="Announcement title"
            className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
          />
          <textarea
            required
            rows={5}
            value={newAnnouncementContent}
            onChange={(e) => setNewAnnouncementContent(e.target.value)}
            placeholder="Write the announcement for students and club admins"
            className="p-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
          />
          <button type="submit" className="h-10 bg-primary text-on-primary rounded font-semibold">
            Publish Announcement
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={!!editingAnnouncement}
        onClose={() => setEditingAnnouncement(null)}
        title="Edit Announcement"
      >
        <form onSubmit={handleSaveAnnouncement} className="flex flex-col gap-3">
          <input
            required
            value={newAnnouncementTitle}
            onChange={(e) => setNewAnnouncementTitle(e.target.value)}
            placeholder="Announcement title"
            className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
          />
          <textarea
            required
            rows={5}
            value={newAnnouncementContent}
            onChange={(e) => setNewAnnouncementContent(e.target.value)}
            placeholder="Announcement content"
            className="p-3 bg-surface-container-lowest border border-border-default rounded font-body-md"
          />
          <button type="submit" className="h-10 bg-primary text-on-primary rounded font-semibold">
            Save Announcement
          </button>
        </form>
      </Modal>

      {/* Create Club Modal */}
      <Modal
        isOpen={showCreateClubModal}
        onClose={() => setShowCreateClubModal(false)}
        title="Register New College Club"
      >
        <form onSubmit={handleCreateClub} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Club Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Artificial Intelligence Research Society"
              value={newClubName}
              onChange={(e) => setNewClubName(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Category</label>
            <select
              value={newClubCat}
              onChange={(e) => setNewClubCat(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            >
              <option value="Academic">Academic</option>
              <option value="Engineering">Engineering</option>
              <option value="Humanities">Humanities</option>
              <option value="Sports">Sports</option>
              <option value="Arts">Arts</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Meeting Schedule</label>
            <input
              type="text"
              placeholder="e.g. Meets Tuesdays 5 PM"
              value={newClubSchedule}
              onChange={(e) => setNewClubSchedule(e.target.value)}
              className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-label-sm text-secondary uppercase">Description</label>
            <textarea
              rows={3}
              value={newClubDesc}
              onChange={(e) => setNewClubDesc(e.target.value)}
              className="p-3 bg-surface-container-lowest border border-border-default rounded font-body-md focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setShowCreateClubModal(false)}
              className="h-9 px-4 bg-surface-container text-on-surface font-label-md rounded hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 bg-primary text-on-primary font-label-md rounded hover:bg-neutral-800 transition-colors"
            >
              Create Club
            </button>
          </div>
        </form>
      </Modal>

      {/* Full Audit Logs Modal */}
      <Modal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        title="Full Platform Audit Log"
        maxWidth="max-w-xl"
      >
        <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto">
          {auditLogs.map((log) => (
            <div
              key={log.id}
              className="p-3 bg-surface-container-low border border-border-default rounded flex flex-col gap-1 text-xs"
            >
              <div className="flex justify-between font-semibold text-primary">
                <span>{log.actionType}</span>
                <span className="text-secondary">{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-on-surface">{log.details}</p>
              <div className="flex justify-between text-secondary pt-1 border-t border-border-subtle">
                <span>Actor: {log.actorEmail} ({log.actorRole})</span>
                <span>IP: {log.ipAddress}</span>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Confirmation Dialog Modal */}
      <Modal
        isOpen={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title || 'Confirm Action'}
      >
        <div className="flex flex-col gap-4">
          <p className="font-body-md text-on-surface-variant">
            {confirmDialog?.message}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              onClick={() => setConfirmDialog(null)}
              className="h-10 px-4 rounded-xl bg-surface-container text-on-surface font-label-sm font-semibold hover:bg-surface-container-high transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => confirmDialog?.onConfirm()}
              className="h-10 px-5 rounded-xl bg-primary text-on-primary font-label-sm font-semibold shadow-sm hover:opacity-95 transition-opacity"
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
