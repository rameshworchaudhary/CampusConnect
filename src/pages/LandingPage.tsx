import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { AnnouncementItem, Club, EventItem, LandingCms, PlatformStats } from '../types';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const LandingPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [cms, setCms] = useState<LandingCms | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState<'students' | 'officers' | 'admin'>('students');

  // Selected Club / Event for Details Modal
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [footerSection, setFooterSection] = useState<'about' | 'contact' | 'privacy' | 'terms' | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cmsRes, clubsRes, eventsRes, announcementsRes, statsRes] = await Promise.all([
        apiClient.get('/cms/public').catch(() => null),
        apiClient.get('/clubs/public').catch(() => null),
        apiClient.get('/events/public').catch(() => null),
        apiClient.get('/announcements/public').catch(() => null),
        apiClient.get('/stats/platform').catch(() => null),
      ]);

      if (cmsRes?.data?.data) {
        setCms(cmsRes.data.data);
      }
      if (clubsRes?.data?.data) {
        setClubs(clubsRes.data.data);
      }
      if (eventsRes?.data?.data) {
        setEvents(eventsRes.data.data);
      }
      if (announcementsRes?.data?.data) {
        setAnnouncements(announcementsRes.data.data);
      }
      if (statsRes?.data?.data) {
        setStats(statsRes.data.data);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClub = async (clubId: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/student/clubs/${clubId}/join`);
      setToastMessage(res.data.message || 'Membership application submitted!');
      setSelectedClub(null);
      fetchData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to submit membership request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterEvent = async (eventId: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/student/events/${eventId}/register`);
      setToastMessage(res.data.message || 'Successfully registered for event!');
      setSelectedEvent(null);
      fetchData();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to register for event.');
    } finally {
      setActionLoading(false);
    }
  };

  const getClubIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('eng') || cat.includes('robot') || cat.includes('tech')) return 'smart_toy';
    if (cat.includes('human') || cat.includes('debate') || cat.includes('law')) return 'gavel';
    if (cat.includes('art') || cat.includes('design') || cat.includes('creative')) return 'palette';
    return 'terminal';
  };

  const activeAnnouncement = announcements.length > 0 ? announcements[0] : null;

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Discover" unreadCount={announcements.filter(a => !a.isRead).length} />

      <main className="flex flex-col relative w-full pt-20 pb-24 md:pb-12 bg-surface min-h-screen max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col w-full">
          {/* Announcement Banner */}
          {!announcementDismissed && activeAnnouncement && (
            <section className="px-gutter-sm pt-space-xs pb-space-xs">
              <div className="bg-surface-container-high rounded-xl p-space-sm shadow-sm flex items-center justify-between gap-space-sm">
                <div className="flex items-center gap-space-xs min-w-0">
                  <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse shrink-0"></span>
                  <span className="font-label-caps text-label-caps text-primary uppercase shrink-0 font-bold">
                    Announcement
                  </span>
                  <p className="font-body-sm text-body-sm text-on-surface truncate">
                    {activeAnnouncement.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAnnouncementDismissed(true)}
                  className="shrink-0 font-label-sm text-label-sm text-primary flex items-center gap-0.5 hover:underline"
                >
                  Dismiss
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </section>
          )}

          {/* Hero Section */}
          <section className="px-gutter-sm pt-space-md pb-space-lg flex flex-col gap-space-md">
            <div className="flex flex-col gap-space-xs">
              <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full bg-surface-container text-primary font-label-caps text-label-caps uppercase tracking-wider font-semibold">
                <span className="material-symbols-outlined text-[14px]">school</span>
                Student Life Central
              </div>
              <h1 className="font-headline-lg-mobile md:text-headline-lg text-headline-lg-mobile text-on-surface tracking-tight font-bold">
                Empower Your <span className="text-primary">Campus Journey</span>
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {cms?.heroDescription ||
                  'Explore student organizations & live events. Connect, participate, and build leadership credentials all in one modern collegiate portal.'}
              </p>
            </div>

            {/* CTA Stack */}
            <div className="flex flex-col gap-space-xs sm:flex-row">
              <a
                className="h-11 px-space-md rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-space-xs shadow-md transition-transform active:scale-[0.98]"
                href="#featured-clubs"
              >
                <span>Browse Clubs</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </a>
              <Link
                className="h-11 px-space-md rounded-xl bg-surface-container text-on-surface font-label-md text-label-md flex items-center justify-center gap-space-xs transition-colors hover:bg-surface-container-high"
                to={isAuthenticated ? (user?.role === 'SUPER_ADMIN' ? '/admin' : user?.role === 'CLUB_ADMIN' ? '/club-admin' : '/student') : '/register'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isAuthenticated ? 'space_dashboard' : 'person_add'}
                </span>
                <span>{isAuthenticated ? 'Go to Dashboard' : 'Join CampusConnect'}</span>
              </Link>
            </div>

            {/* Visual Accent Card */}
            <div className="relative rounded-2xl overflow-hidden bg-surface-container shadow-sm p-space-md mt-space-xs">
              <div className="relative z-10 flex flex-col gap-space-xs">
                <div className="flex items-center justify-between">
                  <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider font-semibold">
                    Campus Activity Pulse
                  </span>
                  <span className="inline-flex items-center gap-1 font-label-sm text-label-sm text-tertiary font-semibold">
                    <span className="material-symbols-outlined text-[14px]">sensors</span> Active Term
                  </span>
                </div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Fall Semester Orientation Week
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  {stats && stats.totalStudents > 0
                    ? `${stats.totalStudents} verified students enrolled across campus engineering, arts, and advocacy organizations.`
                    : 'Official university registration portal open for verified academic clubs, faculty advisors, and student members.'}
                </p>
              </div>
              <div className="mt-space-sm flex items-center -space-x-2">
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container font-label-caps text-label-caps flex items-center justify-center shadow-sm font-semibold">
                  +{stats?.totalStudents ?? (user ? 1 : 0)}
                </div>
              </div>
            </div>
          </section>

          {/* Live Platform Metrics */}
          <section className="px-gutter-sm py-space-sm">
            <div className="grid grid-cols-3 gap-space-xs bg-surface-container-lowest p-space-sm rounded-2xl shadow-sm border border-outline-variant/30">
              <div className="flex flex-col items-center text-center p-space-xs">
                <span className="font-display-lg text-headline-lg-mobile text-primary font-tabular-num font-bold">
                  {stats?.totalClubs ?? clubs.length}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Clubs</span>
              </div>
              <div className="flex flex-col items-center text-center p-space-xs bg-surface-container-low rounded-xl">
                <span className="font-display-lg text-headline-lg-mobile text-on-surface font-tabular-num font-bold">
                  {stats?.totalStudents ?? 0}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Active Peers</span>
              </div>
              <div className="flex flex-col items-center text-center p-space-xs">
                <span className="font-display-lg text-headline-lg-mobile text-tertiary font-tabular-num font-bold">
                  {stats?.publishedEvents ?? events.length}
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">Events</span>
              </div>
            </div>
          </section>

          {/* Featured Clubs Section */}
          <section className="px-gutter-sm pt-space-lg pb-space-sm flex flex-col gap-space-md" id="featured-clubs">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-caps text-label-caps text-primary uppercase font-bold">
                  Curated Discovery
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
                  Featured Clubs
                </h2>
              </div>
              <Link
                className="font-label-sm text-label-sm text-primary flex items-center gap-0.5 hover:underline font-semibold"
                to="/clubs"
              >
                <span>View All ({clubs.length})</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </Link>
            </div>

            {/* Clubs Grid */}
            {loading ? (
              <div className="p-space-lg text-center font-body-sm text-on-surface-variant">
                Loading organizations...
              </div>
            ) : clubs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clubs.slice(0, 3).map((club, idx) => (
                  <div
                    key={club.id}
                    className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm"
                  >
                    <div className="flex items-start justify-between gap-space-sm">
                      <div className="flex items-center gap-space-sm min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
                          <span className="material-symbols-outlined text-[26px]">
                            {getClubIcon(club.category)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <h3 className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">
                              {club.name}
                            </h3>
                            <span
                              className="material-symbols-outlined text-primary text-[18px] shrink-0"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              verified
                            </span>
                          </div>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">
                            {club.meetingLocation || club.category}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-caps text-label-caps">
                        {club.category}
                      </span>
                    </div>

                    <p className="font-body-md text-body-md text-on-surface leading-snug">
                      {club.description}
                    </p>

                    <div className="flex items-center justify-between pt-space-xs">
                      <div className="flex items-center gap-1.5 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[18px]">group</span>
                        <span className="font-tabular-num text-tabular-num font-label-sm text-label-sm">
                          {club.memberCount} members
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedClub(club)}
                        className={`h-9 px-space-md rounded-xl font-label-sm text-label-sm flex items-center gap-1 transition-transform active:scale-95 ${
                          idx === 0
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'bg-surface-container text-on-surface'
                        }`}
                      >
                        <span>
                          {club.userMembershipStatus === 'APPROVED'
                            ? 'Member'
                            : club.userMembershipStatus === 'PENDING'
                            ? 'Pending'
                            : 'View & Join'}
                        </span>
                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col items-center text-center gap-space-sm">
                <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[26px]">groups</span>
                </div>
                <h3 className="font-headline-sm text-on-surface font-semibold">
                  No Student Clubs Published Yet
                </h3>
                <p className="font-body-sm text-on-surface-variant max-w-sm">
                  Certified student societies will appear in this directory once registered and approved by the Office of Student Affairs.
                </p>
                {user?.role === 'SUPER_ADMIN' && (
                  <Link
                    to="/admin"
                    className="mt-1 h-9 px-4 rounded-xl bg-primary text-on-primary font-label-sm flex items-center gap-1"
                  >
                    Create First Club in Admin Portal
                  </Link>
                )}
              </div>
            )}
          </section>

          {/* Upcoming Events Section */}
          <section className="px-gutter-sm pt-space-lg pb-space-sm flex flex-col gap-space-md" id="upcoming-events">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-label-caps text-label-caps text-tertiary uppercase font-bold">
                  Campus Life
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
                  Upcoming Events
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-surface-container-high text-primary font-label-sm text-label-sm font-semibold">
                {events.length} Scheduled
              </span>
            </div>

            {loading ? (
              <div className="p-space-lg text-center font-body-sm text-on-surface-variant">
                Loading events schedule...
              </div>
            ) : events.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.slice(0, 3).map((event, idx) => {
                  const percent = Math.min(100, Math.round((event.registeredCount / (event.capacity || 1)) * 100));
                  return (
                    <div
                      key={event.id}
                      className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-space-xs">
                          <span className="material-symbols-outlined text-primary text-[20px]">
                            calendar_month
                          </span>
                          <span className="font-label-md text-label-md text-primary font-tabular-num font-semibold">
                            {event.eventDate}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-caps text-label-caps">
                          {event.badgeLabel || 'Free Entry'}
                        </span>
                      </div>

                      <div>
                        <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                          {event.title}
                        </h3>
                        <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                          {event.location}
                        </p>
                      </div>

                      <div className="flex flex-col gap-1.5 pt-space-xs">
                        <div className="flex justify-between font-label-sm text-label-sm">
                          <span className="text-on-surface-variant">Capacity Status</span>
                          <span className="font-tabular-num text-on-surface font-label-sm font-semibold">
                            {event.registeredCount} / {event.capacity} Registered
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>

                      <div className="pt-space-xs flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-body-sm text-body-sm text-on-surface-variant">
                            {event.clubName ? `Organized by ${event.clubName}` : 'Campus-wide Event'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(event)}
                          className={`h-9 px-space-md rounded-xl font-label-sm text-label-sm flex items-center gap-1 transition-transform active:scale-95 ${
                            idx === 0
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'bg-surface-container text-on-surface'
                          }`}
                        >
                          <span>{event.isUserRegistered ? 'Registered' : 'RSVP Seat'}</span>
                          <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col items-center text-center gap-space-sm">
                <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-[26px]">event_busy</span>
                </div>
                <h3 className="font-headline-sm text-on-surface font-semibold">
                  No Upcoming Events Scheduled
                </h3>
                <p className="font-body-sm text-on-surface-variant max-w-sm">
                  Check back soon for academic symposia, competitions, and student activities.
                </p>
              </div>
            )}
          </section>

          {/* How It Works Section */}
          <section className="px-gutter-sm pt-space-lg pb-space-sm flex flex-col gap-space-md" id="how-it-works">
            <div>
              <span className="font-label-caps text-label-caps text-primary uppercase font-bold">
                Simple Workflow
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
                How CampusConnect Works
              </h2>
            </div>
            <div className="flex flex-col gap-space-sm">
              <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex gap-space-md items-start">
                <div className="w-10 h-10 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center shrink-0 font-bold">
                  1
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Discover Organizations
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                    Filter certified student societies by academic focus, creative arts, athletic clubs, or advocacy. Read mission statements and meeting times.
                  </p>
                </div>
              </div>

              <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex gap-space-md items-start">
                <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary font-headline-sm text-headline-sm flex items-center justify-center shrink-0 font-bold">
                  2
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Submit Membership Request
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                    One-click student ID sign-in allows instant application without redundant paper forms or external spreadsheets.
                  </p>
                </div>
              </div>

              <div className="p-space-md rounded-2xl bg-surface-container-lowest shadow-sm border border-outline-variant/30 flex gap-space-md items-start">
                <div className="w-10 h-10 rounded-xl bg-surface-container-high text-primary font-headline-sm text-headline-sm flex items-center justify-center shrink-0 font-bold">
                  3
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Attend Events &amp; Lead
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                    RSVP for campus symposiums, track attendance credits on your co-curricular transcript, and step into officer leadership roles.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Role Information Tabs */}
          <section className="px-gutter-sm pt-space-lg pb-space-lg flex flex-col gap-space-md">
            <div>
              <span className="font-label-caps text-label-caps text-primary uppercase font-bold">
                Tailored Experiences
              </span>
              <h2 className="font-headline-md text-headline-md text-on-surface font-semibold">
                Built for the Entire Campus
              </h2>
            </div>

            {/* Role Switcher */}
            <div className="flex p-1 bg-surface-container rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setActiveRoleTab('students')}
                className={`flex-1 py-2 px-2 rounded-lg font-label-sm text-label-sm transition-all ${
                  activeRoleTab === 'students'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Students
              </button>
              <button
                type="button"
                onClick={() => setActiveRoleTab('officers')}
                className={`flex-1 py-2 px-2 rounded-lg font-label-sm text-label-sm transition-all ${
                  activeRoleTab === 'officers'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Club Officers
              </button>
              <button
                type="button"
                onClick={() => setActiveRoleTab('admin')}
                className={`flex-1 py-2 px-2 rounded-lg font-label-sm text-label-sm transition-all ${
                  activeRoleTab === 'admin'
                    ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Administration
              </button>
            </div>

            {/* Role Content Panels */}
            {activeRoleTab === 'students' && (
              <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm animate-in fade-in duration-150">
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-xl bg-surface-container text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">school</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      For Students
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Find your tribe &amp; elevate campus life
                    </p>
                  </div>
                </div>
                <ul className="flex flex-col gap-2 pt-space-xs text-on-surface font-body-md text-body-md">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    Single sign-on with university institutional credentials
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    Personalized event schedule with automated calendar sync
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    Verified Co-Curricular Transcript ready for graduation
                  </li>
                </ul>
              </div>
            )}

            {activeRoleTab === 'officers' && (
              <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm animate-in fade-in duration-150">
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-xl bg-surface-container text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">badge</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      For Club Officers
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Streamline operations without friction
                    </p>
                  </div>
                </div>
                <ul className="flex flex-col gap-2 pt-space-xs text-on-surface font-body-md text-body-md">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    Automated member roster management &amp; application approvals
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    Event publishing with capacity controls and RSVP tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    Club-wide announcements with broadcast alerts
                  </li>
                </ul>
              </div>
            )}

            {activeRoleTab === 'admin' && (
              <div className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm animate-in fade-in duration-150">
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-xl bg-surface-container text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">account_balance</span>
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                      For University Administration
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Governance, security &amp; compliance
                    </p>
                  </div>
                </div>
                <ul className="flex flex-col gap-2 pt-space-xs text-on-surface font-body-md text-body-md">
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    Campus-wide safety &amp; risk-management oversight
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    Auditable club charter workflows &amp; constitution records
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[18px]">check_circle</span>
                    Aggregated engagement analytics for accreditation reviews
                  </li>
                </ul>
              </div>
            )}
          </section>

          {/* Footer Section */}
          <footer className="mt-space-md bg-surface-container-low px-gutter-sm pt-space-lg pb-space-lg flex flex-col gap-space-md border-t border-outline-variant/30">
            <div className="flex flex-col gap-space-xs">
              <div className="flex items-center gap-space-xs">
                <div className="w-7 h-7 rounded-lg bg-primary text-on-primary flex items-center justify-center font-bold text-sm shadow-sm">
                  C
                </div>
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  CampusConnect
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                The official student organization and experiential learning management platform of the University Union.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-space-md pt-space-xs sm:grid-cols-3">
              <div className="flex flex-col gap-2">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                  Platform
                </span>
                <Link className="font-body-sm text-body-sm text-on-surface hover:text-primary" to="/clubs">
                  Organizations Directory
                </Link>
                <Link className="font-body-sm text-body-sm text-on-surface hover:text-primary" to="/events">
                  Academic Calendar
                </Link>
                <Link className="font-body-sm text-body-sm text-on-surface hover:text-primary" to="/login">
                  Officer Sign In
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                  Administration
                </span>
                <Link className="font-body-sm text-body-sm text-on-surface hover:text-primary" to="/admin">
                  Super Admin Portal
                </Link>
                <Link className="font-body-sm text-body-sm text-on-surface hover:text-primary" to="/club-admin">
                  Club Approvals Hub
                </Link>
                <Link className="font-body-sm text-body-sm text-on-surface hover:text-primary" to="/student">
                  Student Portal
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold">
                  Information
                </span>
                {[
                  ['about', 'About CampusConnect'],
                  ['contact', 'Contact Support'],
                  ['privacy', 'Privacy'],
                  ['terms', 'Terms'],
                ].map(([section, label]) => (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setFooterSection(footerSection === section ? null : section as typeof footerSection)}
                    className="text-left font-body-sm text-body-sm text-on-surface hover:text-primary"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {footerSection && (
              <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-space-md font-body-sm text-on-surface-variant leading-relaxed" aria-live="polite">
                {footerSection === 'about' && (
                  <>
                    <h2 className="font-headline-sm text-on-surface font-semibold">About CampusConnect</h2>
                    <p className="mt-1">
                      {cms?.aboutText || 'CampusConnect brings student organizations, campus events, memberships, and announcements together in one place.'}
                    </p>
                  </>
                )}
                {footerSection === 'contact' && (
                  <>
                    <h2 className="font-headline-sm text-on-surface font-semibold">Contact Support</h2>
                    <p className="mt-1">For account, membership, event, or platform questions, email <a className="text-primary underline" href="mailto:24bai71012@cuchd.in">24bai71012@cuchd.in</a>.</p>
                  </>
                )}
                {footerSection === 'privacy' && (
                  <>
                    <h2 className="font-headline-sm text-on-surface font-semibold">Privacy</h2>
                    <p className="mt-1">CampusConnect uses account, membership, and event information only to provide authentication and campus participation features. Keep your password private and share only information necessary for your campus account.</p>
                  </>
                )}
                {footerSection === 'terms' && (
                  <>
                    <h2 className="font-headline-sm text-on-surface font-semibold">Terms of Use</h2>
                    <p className="mt-1">Use accurate account information, respect campus communities, and register only for events you intend to attend. Campus administrators may manage content and access to keep the platform useful and safe.</p>
                  </>
                )}
              </section>
            )}

            <div className="pt-space-md flex flex-col sm:flex-row items-center justify-between gap-space-xs text-center sm:text-left border-t border-outline-variant/20">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                © 2026 CampusConnect System. All collegiate rights reserved.
              </span>
            </div>
          </footer>
        </div>
      </main>

      {/* Club Details Modal */}
      <Modal
        isOpen={!!selectedClub}
        onClose={() => setSelectedClub(null)}
        title={selectedClub?.name || 'Club Details'}
      >
        {selectedClub && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-caps text-label-caps">
                {selectedClub.category}
              </span>
              <span className="font-label-sm text-on-surface-variant font-tabular-num">
                Ref: {selectedClub.refId}
              </span>
            </div>

            <p className="font-body-md text-on-surface leading-relaxed">
              {selectedClub.description}
            </p>

            <div className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-2 border border-outline-variant/30">
              <div className="flex justify-between font-body-sm">
                <span className="text-on-surface-variant">Meeting Schedule:</span>
                <span className="font-medium text-on-surface">{selectedClub.meetingSchedule || 'Weekly'}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-on-surface-variant">Location:</span>
                <span className="font-medium text-on-surface">{selectedClub.meetingLocation || 'Campus Hub'}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-on-surface-variant">Faculty Advisor:</span>
                <span className="font-medium text-on-surface">{selectedClub.facultyAdvisor || 'N/A'}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-on-surface-variant">Total Members:</span>
                <span className="font-medium text-primary font-tabular-num">{selectedClub.memberCount} Approved</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setSelectedClub(null)}
                className="h-10 px-4 rounded-xl bg-surface-container text-on-surface font-label-sm"
              >
                Close
              </button>
              <button
                type="button"
                disabled={
                  actionLoading ||
                  selectedClub.userMembershipStatus === 'APPROVED' ||
                  selectedClub.userMembershipStatus === 'PENDING'
                }
                onClick={() => handleJoinClub(selectedClub.id)}
                className="h-10 px-5 rounded-xl bg-primary text-on-primary font-label-sm flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-60"
              >
                <span>
                  {selectedClub.userMembershipStatus === 'APPROVED'
                    ? 'Member'
                    : selectedClub.userMembershipStatus === 'PENDING'
                    ? 'Pending Approval'
                    : isAuthenticated
                    ? 'Join Organization'
                    : 'Sign in to Join'}
                </span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Event Details Modal */}
      <Modal
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title || 'Event Details'}
      >
        {selectedEvent && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-caps text-label-caps">
                {selectedEvent.badgeLabel || 'Open RSVP'}
              </span>
              <span className="font-label-sm text-primary font-tabular-num font-semibold">
                {selectedEvent.eventDate}
              </span>
            </div>

            <p className="font-body-md text-on-surface leading-relaxed">
              {selectedEvent.description}
            </p>

            <div className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-2 border border-outline-variant/30">
              <div className="flex justify-between font-body-sm">
                <span className="text-on-surface-variant">Location:</span>
                <span className="font-medium text-on-surface">{selectedEvent.location}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-on-surface-variant">Capacity:</span>
                <span className="font-medium text-on-surface font-tabular-num">
                  {selectedEvent.registeredCount} / {selectedEvent.capacity} Seats Filled
                </span>
              </div>
              {selectedEvent.clubName && (
                <div className="flex justify-between font-body-sm">
                  <span className="text-on-surface-variant">Host Club:</span>
                  <span className="font-medium text-primary">{selectedEvent.clubName}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/20">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="h-10 px-4 rounded-xl bg-surface-container text-on-surface font-label-sm"
              >
                Close
              </button>
              <button
                type="button"
                disabled={actionLoading || selectedEvent.registeredCount >= selectedEvent.capacity}
                onClick={() => handleRegisterEvent(selectedEvent.id)}
                className="h-10 px-5 rounded-xl bg-primary text-on-primary font-label-sm flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-60"
              >
                <span>
                  {selectedEvent.registeredCount >= selectedEvent.capacity
                    ? 'Capacity Full'
                    : selectedEvent.isUserRegistered
                    ? 'Registered'
                    : isAuthenticated
                    ? 'Confirm RSVP'
                    : 'Sign in to RSVP'}
                </span>
                <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      <BottomNav />
    </div>
  );
};
