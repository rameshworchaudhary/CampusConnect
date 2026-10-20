import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { StorageImage } from '../components/StorageImage';
import { useAuth } from '../context/AuthContext';
import { getPublicClubs } from '../services/clubService';
import { getPublicEvents } from '../services/eventService';
import { STORAGE_BUCKETS } from '../services/storageService';
import { Club, EventItem } from '../types';

const featureCards = [
  {
    title: 'Club Directory',
    description: 'Explore verified student associations, academic chapters, and engineering teams.',
    icon: 'groups',
  },
  {
    title: 'Membership Workflow',
    description: 'Students submit join requests and club officers review them directly.',
    icon: 'assignment_ind',
  },
  {
    title: 'Event Management',
    description: 'Officers publish events with poster artwork and students RSVP with capacity limits.',
    icon: 'calendar_month',
  },
  {
    title: 'Targeted Bulletins',
    description: 'Campus notices and club announcements reach the right students immediately.',
    icon: 'campaign',
  },
  {
    title: 'Role-Based Governance',
    description: 'Dedicated workspaces for students, club administrators, and campus officials.',
    icon: 'admin_panel_settings',
  },
  {
    title: 'Audit & Accountability',
    description: 'Super administrators oversee memberships, charters, roles, and platform activity.',
    icon: 'history',
  },
];

const steps = [
  {
    number: '1.',
    title: 'Create an account',
    description: 'Sign up as a student or submit a club charter registration for official recognition.',
  },
  {
    number: '2.',
    title: 'Administrative review',
    description: 'New clubs and role promotions are reviewed and approved by administrators.',
  },
  {
    number: '3.',
    title: 'Participate and engage',
    description: 'Browse campus clubs, RSVP to events, and track active memberships in real time.',
  },
];

export const LandingPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [clubs, setClubs] = React.useState<Club[]>([]);
  const [events, setEvents] = React.useState<EventItem[]>([]);
  const [clubsLoading, setClubsLoading] = React.useState(true);
  const [eventsLoading, setEventsLoading] = React.useState(true);
  const [clubsError, setClubsError] = React.useState('');
  const [eventsError, setEventsError] = React.useState('');

  const loadClubs = React.useCallback(async () => {
    setClubsLoading(true);
    setClubsError('');
    try {
      setClubs(await getPublicClubs(user?.id));
    } catch (error) {
      setClubsError(error instanceof Error ? error.message : 'Clubs could not be loaded.');
    } finally {
      setClubsLoading(false);
    }
  }, [user?.id]);

  const loadEvents = React.useCallback(async () => {
    setEventsLoading(true);
    setEventsError('');
    try {
      setEvents(await getPublicEvents(user?.id));
    } catch (error) {
      setEventsError(error instanceof Error ? error.message : 'Events could not be loaded.');
    } finally {
      setEventsLoading(false);
    }
  }, [user?.id]);

  React.useEffect(() => {
    void loadClubs();
    void loadEvents();
  }, [loadClubs, loadEvents]);

  const handlePrimaryAction = () => {
    if (isAuthenticated) {
      const route = user?.role === 'SUPER_ADMIN' ? '/admin' : user?.role === 'CLUB_ADMIN' ? '/club-admin' : '/student';
      navigate(route);
      return;
    }
    navigate('/register');
  };

  return (
    <div className="min-h-screen bg-app font-body-md text-on-surface flex flex-col antialiased">
      <Header subtitle="Campus Life Hub" />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 pb-24 md:pb-16 flex flex-col gap-10 sm:gap-14">
        {/* Hero Section */}
        <section className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12 py-2 sm:py-6">
          <div className="flex-1 flex flex-col gap-4 text-left">
            <div className="inline-flex items-center gap-2 self-start px-3 py-1 rounded-full bg-surface-container border border-border-default text-[11px] font-semibold text-primary uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
              <span>Campus clubs and events</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-on-surface tracking-tight leading-tight">
              Every campus club, one place.
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-on-surface-variant max-w-xl leading-relaxed">
              Discover official student organizations, register for memberships, RSVP to campus events, and manage club operations securely.
            </p>

            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                type="button"
                onClick={handlePrimaryAction}
                className="h-11 px-5 rounded-xl bg-accent text-on-accent text-xs sm:text-sm font-semibold shadow-sm hover:opacity-90 active:scale-95 transition-all"
              >
                {isAuthenticated ? 'Go to Workspace' : 'Join as Student'}
              </button>
              <Link
                to="/clubs"
                className="h-11 px-5 rounded-xl bg-surface-container text-on-surface text-xs sm:text-sm font-semibold border border-border-default hover:bg-surface-container-high transition-colors flex items-center justify-center"
              >
                Explore Clubs Directory
              </Link>
            </div>
          </div>

          <div className="w-full lg:flex-1 max-w-md lg:max-w-none h-60 sm:h-80 rounded-2xl border border-border-default bg-surface-container-low overflow-hidden shadow-sm flex items-center justify-center relative">
            <img
              src="/campus-connect-hero.png"
              alt="CampusConnect illustration showing campus clubs and events"
              className="w-full h-full object-cover"
            />
          </div>
        </section>

        <section aria-labelledby="public-events-heading" className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="font-label-caps text-label-caps text-primary uppercase font-bold text-[11px]">What's happening</span>
              <h2 id="public-events-heading" className="text-lg sm:text-xl md:text-2xl font-bold text-on-surface mt-1">Published events</h2>
            </div>
            <Link to="/events" className="text-sm font-semibold text-primary underline underline-offset-4">All events</Link>
          </div>
          {eventsLoading ? (
            <p role="status" className="rounded-xl border border-border-default bg-surface p-4 text-sm text-on-surface-variant">Loading published events…</p>
          ) : eventsError ? (
            <div role="alert" className="flex flex-col items-start gap-2 rounded-xl border border-border-default bg-surface p-4 text-sm text-on-surface-variant">
              <span>{eventsError}</span>
              <button type="button" onClick={() => void loadEvents()} className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-on-accent">Retry events</button>
            </div>
          ) : events.length === 0 ? (
            <p className="rounded-xl border border-border-default bg-surface p-4 text-sm text-on-surface-variant">There are no published events to show right now. Check back later or browse the event directory.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {events.slice(0, 3).map((event) => (
                <article key={event.id} className="overflow-hidden rounded-xl border border-border-default bg-surface shadow-sm">
                  {event.posterPath && <StorageImage bucket={STORAGE_BUCKETS.eventPosters} path={event.posterPath} alt={`${event.title} poster`} className="h-36 w-full object-cover" />}
                  <div className="flex flex-col gap-2 p-4">
                    <span className="text-xs font-semibold text-on-surface-variant">{event.eventDate || 'Date to be announced'}</span>
                    <h3 className="font-bold text-on-surface">{event.title}</h3>
                    <p className="text-sm text-on-surface-variant">{event.clubName || 'Campus event'} · {event.location || 'Location to be announced'}</p>
                    <Link to="/events" className="mt-1 inline-flex min-h-10 items-center self-start rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent">View event</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="public-clubs-heading" className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <span className="font-label-caps text-label-caps text-primary uppercase font-bold text-[11px]">Find your community</span>
              <h2 id="public-clubs-heading" className="text-lg sm:text-xl md:text-2xl font-bold text-on-surface mt-1">Explore approved clubs</h2>
            </div>
            <Link to="/clubs" className="text-sm font-semibold text-primary underline underline-offset-4">Club directory</Link>
          </div>
          {clubsLoading ? (
            <p role="status" className="rounded-xl border border-border-default bg-surface p-4 text-sm text-on-surface-variant">Loading approved clubs…</p>
          ) : clubsError ? (
            <div role="alert" className="flex flex-col items-start gap-2 rounded-xl border border-border-default bg-surface p-4 text-sm text-on-surface-variant">
              <span>{clubsError}</span>
              <button type="button" onClick={() => void loadClubs()} className="min-h-10 rounded-lg bg-accent px-4 font-semibold text-on-accent">Retry clubs</button>
            </div>
          ) : clubs.length === 0 ? (
            <p className="rounded-xl border border-border-default bg-surface p-4 text-sm text-on-surface-variant">No approved clubs are listed right now. Visit the directory again later.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {clubs.slice(0, 3).map((club) => (
                <article key={club.id} className="flex items-center gap-4 rounded-xl border border-border-default bg-surface p-4 shadow-sm">
                  {club.logoPath ? <StorageImage bucket={STORAGE_BUCKETS.clubLogos} path={club.logoPath} alt={`${club.name} logo`} className="h-14 w-14 shrink-0 rounded-lg object-cover" /> : <span aria-hidden="true" className="material-symbols-outlined flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-hover text-primary">groups</span>}
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-on-surface">{club.name}</h3>
                    <p className="text-sm text-on-surface-variant">{club.category}</p>
                    <Link to="/clubs" className="mt-2 inline-block text-sm font-semibold text-primary underline underline-offset-4">Explore club</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Feature Cards Grid */}
        <section className="bg-surface-container-low p-5 sm:p-8 lg:p-10 rounded-2xl border border-border-default flex flex-col gap-6">
          <div>
            <span className="font-label-caps text-label-caps text-primary uppercase font-bold text-[11px]">
              Platform Capabilities
            </span>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-on-surface mt-1">
              Purpose-built for institutional student life
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="bg-surface-container-lowest p-4 sm:p-5 rounded-xl border border-border-default flex flex-col gap-2 shadow-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary border border-border-default shrink-0">
                  <span className="material-symbols-outlined text-[18px]">{feature.icon}</span>
                </div>
                <h3 className="font-bold text-sm text-on-surface">{feature.title}</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="flex flex-col gap-6">
          <div>
            <span className="font-label-caps text-label-caps text-primary uppercase font-bold text-[11px]">
              Simple Onboarding
            </span>
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-on-surface mt-1">
              How CampusConnect works
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {steps.map((step) => (
              <div key={step.title} className="bg-surface-container-lowest p-5 rounded-xl border border-border-default flex flex-col gap-2">
                <span className="font-bold text-sm text-primary">{step.number} {step.title}</span>
                <p className="text-xs text-on-surface-variant leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-default py-6 px-4 sm:px-6 lg:px-8 bg-surface">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
          <span>CampusConnect — Campus Organization &amp; Event Management</span>
          <div className="flex items-center gap-4">
            <Link to="/clubs" className="hover:text-primary">Clubs</Link>
            <Link to="/events" className="hover:text-primary">Events</Link>
            <Link to="/login" className="hover:text-primary">Sign In</Link>
          </div>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
};

export default LandingPage;
