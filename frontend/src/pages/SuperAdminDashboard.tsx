import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
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
  const [categoryFilter, setCategoryFilter] = useState('All');
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

  const handleDeleteUser = async (targetUser: User) => {
    if (!window.confirm(`Delete ${targetUser.fullName}'s account? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/admin/users/${targetUser.id}`);
      setToastMessage(`User ${targetUser.fullName} deleted.`);
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  const handleDeleteClub = async (club: Club) => {
    if (!window.confirm(`Delete ${club.name} and its related events and memberships?`)) return;
    try {
      await apiClient.delete(`/admin/clubs/${club.id}`);
      setToastMessage(`Club ${club.name} deleted.`);
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to delete club.');
    }
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

  const handleDeleteAnnouncement = async (announcement: AnnouncementItem) => {
    if (!window.confirm(`Delete "${announcement.title}"?`)) return;
    try {
      await apiClient.delete(`/admin/announcements/${announcement.id}`);
      setToastMessage('Announcement deleted.');
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to delete announcement.');
    }
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

  const handleDeleteEvent = async (event: EventItem) => {
    if (!window.confirm(`Delete "${event.title}" and its registrations?`)) return;
    try {
      await apiClient.delete(`/admin/events/${event.id}`);
      setToastMessage('Event deleted.');
      fetchPlatformData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to delete event.');
    }
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

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header
        subtitle="Super Admin Portal"
        onMenuClick={() => setShowOperationsMenu((open) => !open)}
        menuRef={operationsMenuRef}
        menuContent={
          showOperationsMenu ? (
            <div
              role="menu"
              className="absolute left-0 top-11 z-50 w-64 rounded-lg border border-border-default bg-surface-container-lowest p-1 shadow-xl"
            >
              <button type="button" role="menuitem" onClick={() => { setShowUsersModal(true); setShowOperationsMenu(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-surface-container-high text-sm">Manage Users</button>
              <button type="button" role="menuitem" onClick={() => { setShowRoleModal(true); setShowOperationsMenu(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-surface-container-high text-sm">Manage Roles</button>
              <div className="my-1 border-t border-border-subtle" />
              <button type="button" role="menuitem" onClick={() => { document.getElementById('clubs-overview')?.scrollIntoView({ behavior: 'smooth' }); setShowOperationsMenu(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-surface-container-high text-sm">Manage Clubs</button>
              <button type="button" role="menuitem" onClick={() => { setShowCreateClubModal(true); setShowOperationsMenu(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-surface-container-high text-sm">Add Club</button>
              <button type="button" role="menuitem" onClick={() => { setShowEventManager(true); setShowOperationsMenu(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-surface-container-high text-sm">Manage Events</button>
              <button type="button" role="menuitem" onClick={() => { setShowCreateEventModal(true); setShowOperationsMenu(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-surface-container-high text-sm">Add Event</button>
              <button type="button" role="menuitem" onClick={() => { setShowAnnouncementManager(true); setShowOperationsMenu(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-surface-container-high text-sm">Manage Announcements</button>
              <button type="button" role="menuitem" onClick={() => { setShowAnnouncementModal(true); setShowOperationsMenu(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-surface-container-high text-sm">Add Announcement</button>
              <button type="button" role="menuitem" onClick={() => { setShowCmsModal(true); setShowOperationsMenu(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-surface-container-high text-sm">Landing Page CMS</button>
              <button type="button" role="menuitem" onClick={() => { setShowAuditModal(true); setShowOperationsMenu(false); }} className="w-full text-left px-3 py-2 rounded hover:bg-surface-container-high text-sm">Audit Logs</button>
            </div>
          ) : null
        }
      />

      <main className="flex-1 w-full pt-20 pb-8 bg-surface px-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl pb-8">

          {/* Header Section */}
          <section className="flex flex-col mb-space-lg">
            <h1 className="font-headline-xl-mobile text-headline-xl-mobile text-primary tracking-tight font-bold">
              Platform Management
            </h1>
          </section>

          {/* Platform Metrics: 4 Monochrome Counter Cards */}
          <section className="grid grid-cols-1 gap-space-sm mb-space-lg sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-surface-container-lowest p-space-md rounded-lg border border-border-default flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-sm text-label-sm text-secondary uppercase">Registered Users</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">badge</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.totalUsers.toLocaleString() : '—'}
                </span>
                <span className="font-label-sm text-label-sm text-secondary">from database</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-lg border border-border-default flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-sm text-label-sm text-secondary uppercase">Registered Clubs</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">account_tree</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.totalClubs.toLocaleString() : '—'}
                </span>
                <span className="font-label-sm text-label-sm text-secondary">all records</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-lg border border-border-default flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-sm text-label-sm text-secondary uppercase">Published Events</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">event_available</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.publishedEvents.toLocaleString() : '—'}
                </span>
                <span className="font-label-sm text-label-sm text-secondary">published</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-lg border border-border-default flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-label-sm text-label-sm text-secondary uppercase">Total Registrations</span>
                <span className="material-symbols-outlined text-secondary text-[18px]">how_to_reg</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold tabular-nums">
                  {statsLoading ? '...' : stats ? stats.totalRegistrations.toLocaleString() : '—'}
                </span>
                <span className="font-label-sm text-label-sm text-secondary">registered</span>
              </div>
            </div>
          </section>

          {statsError && (
            <div className="mb-space-lg flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-container p-4 text-sm">
              <p className="text-secondary">{statsError}</p>
              <button type="button" onClick={fetchPlatformData} className="rounded bg-primary px-3 py-2 font-semibold text-on-primary">
                Retry
              </button>
            </div>
          )}
          {dataError && dataError !== statsError && (
            <div className="mb-space-lg rounded-lg border border-border-default bg-surface-container p-4 text-sm text-secondary">
              {dataError}
            </div>
          )}

          {/* Registered Clubs Overview & Status */}
          <section id="clubs-overview" className="mb-space-lg">
            <div className="flex items-center justify-between mb-space-sm">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Registered Clubs Overview & Status
                </h2>
                <p className="font-body-sm text-body-sm text-secondary">
                  Directory verification & governance ledger
                </p>
              </div>
              <span className="bg-surface-container-highest text-primary font-label-sm text-label-sm px-2 py-0.5 rounded-sm border border-border-default font-semibold tabular-nums">
                {clubs.length} TOTAL
              </span>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex flex-col gap-space-xs mb-space-sm">
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Filter clubs by title, identifier, or lead..."
                  value={searchClub}
                  onChange={(e) => setSearchClub(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface font-body-md text-body-md pl-10 pr-3 py-2 rounded-lg placeholder-secondary border border-border-default focus:outline-none focus:border-black transition-colors"
                />
              </div>

              <div className="flex items-center justify-between gap-space-xs">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                  {['All', 'Academic', 'Humanities', 'Engineering'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`font-label-sm text-label-sm px-2.5 py-1 rounded-sm border transition-colors ${
                        categoryFilter === cat
                          ? 'bg-primary text-on-primary border-black'
                          : 'bg-surface-container-high text-secondary border-border-subtle hover:text-primary'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <span className="font-label-sm text-label-sm text-secondary whitespace-nowrap">
                  Sort: ID ASC
                </span>
              </div>
            </div>

            {/* Club Cards Stack */}
            <div className="flex flex-col gap-space-xs">
              {filteredClubs.map((clubItem) => {
                const isUnassigned = !clubItem.assignedAdminId;
                return (
                  <article
                    key={clubItem.id}
                    className="bg-surface-container-lowest p-space-md rounded-lg border border-border-default flex flex-col gap-space-xs shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-space-xs">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-headline-sm text-headline-sm text-primary truncate font-bold">
                            {clubItem.name}
                          </span>
                          <span className="bg-surface-container-high text-primary font-label-sm text-label-sm px-1.5 py-0.5 rounded-sm uppercase tracking-wider text-[10px] font-semibold">
                            {clubItem.category}
                          </span>
                        </div>
                        <span className="font-body-sm text-body-sm text-secondary mt-0.5">
                          Ref ID: {clubItem.refId} • Established 2018
                        </span>
                      </div>
                      <span
                        className={`font-label-sm text-label-sm px-2 py-0.5 rounded-sm uppercase tracking-wider whitespace-nowrap text-[10px] font-semibold border ${
                          isUnassigned
                            ? 'bg-primary text-on-primary border-black'
                            : 'bg-surface-container-highest text-primary border-border-default'
                        }`}
                      >
                        {isUnassigned ? 'Pending Assignment' : 'Active / Published'}
                      </span>
                    </div>

                    <div className="bg-surface-container-low p-space-sm rounded-lg grid grid-cols-2 gap-2 mt-1 border border-border-subtle">
                      <div className="flex flex-col min-w-0">
                        <span className="font-label-sm text-label-sm text-secondary uppercase text-[10px]">
                          Assigned Administrator
                        </span>
                        <div className="flex items-center gap-1 mt-0.5 truncate">
                          <span className="material-symbols-outlined text-secondary text-[16px]">
                            {isUnassigned ? 'warning' : 'account_circle'}
                          </span>
                          <span
                            className={`font-body-md text-body-md truncate ${
                              isUnassigned
                                ? 'text-secondary italic'
                                : 'text-primary font-medium'
                            }`}
                          >
                            {isUnassigned ? 'Unassigned' : clubItem.assignedAdminName}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="font-label-sm text-label-sm text-secondary uppercase text-[10px]">
                          Roster Members
                        </span>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-secondary text-[16px]">groups</span>
                          <span className="font-body-md text-body-md text-primary font-medium tabular-nums">
                            {clubItem.memberCount} active
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-label-sm text-label-sm text-secondary">
                        {isUnassigned ? 'No administrator assigned' : 'Administrator assigned'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetClubId(clubItem.id);
                          const formEl = document.getElementById('role-quick-action');
                          formEl?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="bg-primary text-on-primary font-label-md text-label-md px-3 py-1.5 rounded-sm flex items-center gap-1 hover:bg-neutral-800 transition-colors font-medium text-xs"
                      >
                        <span>{isUnassigned ? 'Assign Admin' : 'Manage'}</span>
                        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClub(clubItem)}
                        className="font-label-sm text-label-sm text-secondary hover:text-primary underline"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Role Management Quick Action Form */}
          <Modal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} title="Manage Roles" maxWidth="max-w-xl">
          <section className="mb-space-lg">
            <div className="bg-surface-container-lowest p-space-md rounded-lg border border-border-default shadow-sm">
              <div className="flex items-center justify-between mb-space-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[20px]">security</span>
                  <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                    Role Management Quick Action
                  </h2>
                </div>
                <span className="font-label-sm text-label-sm text-secondary uppercase font-semibold">
                  Update access
                </span>
              </div>

              <p className="font-body-sm text-body-sm text-secondary mb-space-md">
                Elevate privileges and link club-level governance scopes directly across Active Directory.
              </p>

              <form onSubmit={handleRoleSubmit} className="flex flex-col gap-space-sm">
                {/* Target Identity Lookup */}
                <div className="flex flex-col gap-1">
                  <label className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                    User Identity Lookup
                  </label>
                  <div className="bg-surface-container-low px-3 py-2 rounded-lg border border-border-subtle flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-primary text-[18px]">person</span>
                      <select
                        aria-label="Target User"
                        value={selectedUserForRole?.id || ''}
                        onChange={(e) => {
                          const u = users.find((usr) => usr.id === Number(e.target.value));
                          setSelectedUserForRole(u || null);
                        }}
                        className="bg-transparent font-body-md text-primary font-medium focus:outline-none"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.fullName} ({u.studentId || u.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="bg-surface-container-high text-primary font-label-sm text-label-sm px-2 py-0.5 rounded-sm border border-border-default text-[10px] font-semibold">
                      {selectedUserForRole?.isVerified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </div>

                {/* Role Elevation Transition */}
                <div className="grid grid-cols-2 gap-space-xs">
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                      Current Role
                    </label>
                    <div className="bg-surface-container-low px-3 py-2 rounded-lg border border-border-subtle flex items-center gap-1.5 h-10">
                      <span className="material-symbols-outlined text-secondary text-[16px]">school</span>
                      <span className="font-body-md text-body-md text-secondary font-medium">
                        {selectedUserForRole?.role || 'STUDENT'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
                      Target Privilege Role
                    </label>
                    <div className="relative">
                      <select
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value as any)}
                        className="w-full h-10 bg-surface-container-high text-on-surface font-body-md text-body-md px-3 rounded-lg appearance-none focus:outline-none font-medium border border-border-default"
                      >
                        <option value="CLUB_ADMIN">CLUB_ADMIN</option>
                        <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                        <option value="STUDENT">STUDENT</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none text-[18px]">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assigned Club Jurisdiction */}
                {targetRole === 'CLUB_ADMIN' && (
                  <div className="flex flex-col gap-1">
                    <label className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
                      Assigned Club Jurisdiction
                    </label>
                    <div className="relative">
                      <select
                        value={targetClubId}
                        onChange={(e) => setTargetClubId(Number(e.target.value))}
                        className="w-full h-10 bg-surface-container-high text-on-surface font-body-md text-body-md px-3 rounded-lg appearance-none focus:outline-none font-medium border border-border-default"
                      >
                        {clubs.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.refId})
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none text-[18px]">
                        unfold_more
                      </span>
                    </div>
                  </div>
                )}

                {/* Confirmation Note */}
                <div className="bg-surface-container-high p-space-xs rounded-lg flex items-start gap-2 border border-border-subtle">
                  <span className="material-symbols-outlined text-secondary text-[16px] mt-0.5">info</span>
                  <span className="font-body-sm text-body-sm text-secondary leading-tight">
                    Privilege grant will trigger an immutable audit log write and save persistently to MySQL.
                  </span>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-space-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (users.length > 0) setSelectedUserForRole(users[0]);
                    }}
                    className="bg-surface-container-high text-on-surface font-label-md text-label-md px-4 py-2 rounded-sm hover:bg-surface-container-highest transition-colors font-medium border border-border-default"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded-sm flex items-center gap-1.5 hover:bg-neutral-800 transition-colors font-semibold"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Save Role Change</span>
                  </button>
                </div>
              </form>
            </div>
          </section>
          </Modal>

          {/* Audit Log Excerpt */}
          <section className="mb-space-lg">
            <div className="flex items-center justify-between mb-space-sm">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
                  Audit Log Excerpt
                </h2>
                <p className="font-body-sm text-body-sm text-secondary">
                  Immutable administrative trail
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(true)}
                className="font-label-sm text-label-sm text-primary underline"
              >
                View Full Log
              </button>
            </div>

            <div className="bg-surface-container-lowest rounded-lg border border-border-default p-space-md shadow-sm flex flex-col gap-space-sm">
              {auditLogs.slice(0, 3).map((log, idx) => (
                <React.Fragment key={log.id}>
                  {idx > 0 && <div className="w-full h-px bg-surface-container-high"></div>}
                  <div className="flex items-start gap-space-xs">
                    <div className="w-7 h-7 rounded-sm bg-primary text-on-primary flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-[16px]">
                        {log.actionType.includes('ROLE') ? 'badge' : 'event'}
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-label-sm text-label-sm text-primary font-semibold truncate">
                          {log.actionType}
                        </span>
                        <span className="font-label-sm text-label-sm text-secondary whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="font-body-md text-body-md text-primary mt-0.5 leading-snug">
                        {log.details}
                      </p>
                      <span className="font-body-sm text-body-sm text-secondary mt-1">
                        Hash: {log.shaHash} • IP: {log.ipAddress}
                      </span>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </section>
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

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
    </div>
  );
};
