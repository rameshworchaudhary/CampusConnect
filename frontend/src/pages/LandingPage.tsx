import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { AnnouncementItem, Club, EventItem, LandingCms } from '../types';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const LandingPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [cms, setCms] = useState<LandingCms | null>(null);

  const [clubs, setClubs] = useState<Club[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Selected Club / Event for Details Modal
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<number[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [footerSection, setFooterSection] = useState<'about' | 'contact' | 'privacy' | 'terms' | null>(null);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cmsRes, clubsRes, eventsRes, announcementsRes] = await Promise.all([
        apiClient.get('/cms/public').catch(() => null),
        apiClient.get('/clubs/public').catch(() => null),
        apiClient.get('/events/public').catch(() => null),
        apiClient.get('/announcements/public').catch(() => null),
      ]);

      if (cmsRes && cmsRes.data && cmsRes.data.data) {
        setCms(cmsRes.data.data);
      }
      if (clubsRes && clubsRes.data && clubsRes.data.data) {
        setClubs(clubsRes.data.data);
      }
      if (eventsRes && eventsRes.data && eventsRes.data.data) {
        setEvents(eventsRes.data.data);
      }
      if (announcementsRes && announcementsRes.data && announcementsRes.data.data) {
        setAnnouncements(announcementsRes.data.data);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  const toggleBookmark = (id: number) => {
    setBookmarkedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleJoinClub = async (clubId: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/student/clubs/${clubId}/join`);
      setToastMessage(res.data.message || 'Membership request submitted!');
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

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Club Directory" />

      <main className="flex-1 flex flex-col relative w-full pt-20 pb-8 bg-surface px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col w-full pb-8">
          {/* Hero Section */}
          <section className="flex flex-col gap-space-md py-space-lg">
            <div className="flex flex-col gap-space-xs">
              <h1 className="font-headline-xl-mobile text-headline-xl-mobile text-on-surface tracking-tight font-bold">
                {cms?.heroHeading || 'CampusConnect'}
              </h1>
              <p className="font-body-md text-body-md text-secondary leading-relaxed">
                {cms?.heroDescription || 'Public landing page content is not configured yet.'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-space-sm pt-space-xs">
              <a
                href="#clubs"
                className="h-10 px-space-md bg-primary text-on-primary font-label-lg text-label-lg rounded-DEFAULT flex items-center justify-center gap-space-xs active:bg-neutral-800 transition-colors"
              >
                <span>{cms?.exploreButtonText || 'Explore Clubs'}</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </a>
              <a
                href="#events"
                className="h-10 px-space-md bg-surface-container-lowest text-primary font-label-lg text-label-lg rounded-DEFAULT border border-border-default shadow-sm flex items-center justify-center gap-space-xs hover:bg-surface-container-low transition-colors"
              >
                <span>{cms?.viewEventsButtonText || 'View Events'}</span>
                <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              </a>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-space-sm py-space-md sm:grid-cols-3" aria-label="CampusConnect features">
            {[
              {
                icon: 'groups',
                title: 'Discover communities',
                text: 'Find published campus clubs and learn how to get involved.',
              },
              {
                icon: 'event',
                title: 'Join campus events',
                text: 'Browse event details, open links, and RSVP from one place.',
              },
              {
                icon: 'admin_panel_settings',
                title: 'Manage with clarity',
                text: 'Club and campus administrators manage memberships, events, and announcements by role.',
              },
            ].map((feature) => (
              <article
                key={feature.title}
                className="bg-surface-container-lowest border border-border-default rounded-DEFAULT p-space-md flex flex-col gap-space-xs"
              >
                <span className="material-symbols-outlined text-primary text-[24px]">{feature.icon}</span>
                <h2 className="font-headline-sm text-on-surface font-semibold">{feature.title}</h2>
                <p className="font-body-sm text-secondary leading-relaxed">{feature.text}</p>
              </article>
            ))}
          </section>

          {/* Popular Clubs Section */}
          <section className="flex flex-col gap-space-md pt-space-lg" id="clubs">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                  Directory Preview
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                  Popular Clubs
                </h2>
              </div>
              <a
                href="#clubs"
                className="font-label-md text-label-md text-primary font-semibold flex items-center gap-0.5 hover:underline"
              >
                <span>View All</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </a>
            </div>

            <div className="flex flex-col gap-space-sm">
              {clubs.map((club) => {
                const isBookmarked = bookmarkedIds.includes(club.id);
                return (
                  <article
                    key={club.id}
                    className="flex flex-col bg-surface-container-lowest p-space-md rounded-DEFAULT border border-border-default shadow-sm gap-space-sm"
                  >
                    <div className="flex items-start justify-between gap-space-xs">
                      <div className="flex items-center gap-space-sm min-w-0">
                        <div className="w-10 h-10 rounded-DEFAULT bg-surface-container-high flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-[20px]">
                            {club.category === 'Academic'
                              ? 'terminal'
                              : club.category === 'Humanities'
                              ? 'record_voice_over'
                              : 'precision_manufacturing'}
                          </span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h3 className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">
                            {club.name}
                          </h3>
                          <div className="flex items-center gap-space-xs text-secondary mt-0.5">
                            <span className="px-1.5 py-0.5 bg-surface-container text-on-surface font-label-sm text-label-sm rounded-DEFAULT text-[11px]">
                              {club.category}
                            </span>
                            <span className="text-[10px]">•</span>
                            <span className="font-body-sm text-body-sm tabular-nums">
                              {club.memberCount} Members
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Bookmark ${club.name}`}
                        onClick={() => toggleBookmark(club.id)}
                        className="w-8 h-8 rounded-DEFAULT flex items-center justify-center text-secondary hover:text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isBookmarked ? 'bookmark' : 'bookmark_border'}
                        </span>
                      </button>
                    </div>

                    <p className="font-body-md text-body-md text-secondary line-clamp-2">
                      {club.description}
                    </p>

                    <div className="flex items-center justify-between pt-space-xs">
                      <span className="font-label-sm text-label-sm text-secondary">
                        {club.meetingSchedule || 'Meets Weekly'}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={actionLoading || club.userMembershipStatus === 'PENDING' || club.userMembershipStatus === 'APPROVED'}
                          onClick={() => handleJoinClub(club.id)}
                          className="font-label-sm text-label-sm font-semibold text-primary hover:underline disabled:no-underline disabled:opacity-60"
                        >
                          {club.userMembershipStatus === 'APPROVED'
                            ? 'Member'
                            : club.userMembershipStatus === 'PENDING'
                            ? 'Pending'
                            : club.userMembershipStatus === 'REJECTED'
                            ? 'Reapply'
                            : isAuthenticated
                            ? 'Join Club'
                            : 'Sign in to Join'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedClub(club)}
                          className="font-label-sm text-label-sm font-semibold text-primary flex items-center gap-0.5 hover:underline"
                        >
                          <span>View Details</span>
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Upcoming Events Section */}
          <section className="flex flex-col gap-space-md pt-space-xl" id="events">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary">
                  Campus Calendar
                </span>
                <h2 className="font-headline-md text-headline-md text-on-surface font-bold">
                  Upcoming Events
                </h2>
              </div>
              <a
                href="#events"
                className="font-label-md text-label-md text-primary font-semibold flex items-center gap-0.5 hover:underline"
              >
                <span>Full Calendar</span>
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </a>
            </div>

            <div className="flex flex-col gap-space-sm">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="flex flex-col bg-surface-container-lowest p-space-md rounded-DEFAULT border border-border-default shadow-sm gap-space-sm"
                >
                  <div className="flex items-start justify-between gap-space-sm">
                    <div className="flex flex-col min-w-0">
                      <span className="font-label-sm text-label-sm text-secondary">
                        {event.eventDate}
                      </span>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
                        {event.title}
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 bg-surface-container text-on-surface font-label-sm text-label-sm rounded-DEFAULT shrink-0 text-[11px] font-semibold">
                      {event.badgeLabel || 'Open RSVP'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-secondary">
                    <span className="material-symbols-outlined text-[16px]">location_on</span>
                    <span className="font-body-sm text-body-sm text-secondary">{event.location}</span>
                  </div>

                  <p className="font-body-md text-body-md text-secondary">
                    {event.description}
                  </p>

                  <div className="flex items-center justify-between pt-space-xs">
                    <span className="font-label-sm text-label-sm text-secondary tabular-nums">
                      {event.registeredCount} Registered / {event.capacity} Cap
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedEvent(event)}
                      className="font-label-sm text-label-sm font-semibold text-primary flex items-center gap-0.5 hover:underline"
                    >
                      <span>View Details</span>
                      <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {cms?.aboutText && (
            <section id="about" className="mt-space-xl border border-border-default rounded-DEFAULT bg-surface-container-low p-space-md">
              <span className="font-label-sm text-secondary uppercase tracking-wider">About CampusConnect</span>
              <p className="font-body-md text-on-surface leading-relaxed mt-space-xs">{cms.aboutText}</p>
            </section>
          )}

          {/* Notice Banner */}
          {announcements.length > 0 ? (
            <div className="mt-space-xl p-space-md bg-surface-container border border-border-default rounded-DEFAULT flex items-center gap-space-md">
              <div className="w-9 h-9 rounded-DEFAULT bg-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-primary text-[20px]">campaign</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-md text-label-md text-on-surface font-semibold">
                  {announcements[0].title}
                </span>
                <span className="font-body-sm text-body-sm text-secondary">
                  {announcements[0].content}
                  {announcements[0].clubName ? ` • ${announcements[0].clubName}` : ''}
                </span>
              </div>
            </div>
          ) : (
          <div className="mt-space-xl p-space-md bg-surface-container border border-border-default rounded-DEFAULT flex items-center gap-space-md">
            <div className="w-9 h-9 rounded-DEFAULT bg-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary text-[20px]">campaign</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                {cms?.noticeBannerTitle || 'No announcement configured'}
              </span>
              <span className="font-body-sm text-body-sm text-secondary">
                {cms?.noticeBannerText || 'There are no public announcements to display.'}
              </span>
            </div>
          </div>
          )}

          {/* Footer */}
          <footer className="mt-space-xl pt-space-lg flex flex-col gap-space-md border-t border-border-default">
            <div className="flex flex-wrap items-center gap-space-md">
              <button type="button" onClick={() => setFooterSection(footerSection === 'about' ? null : 'about')} className="font-label-md text-label-md text-secondary hover:text-primary transition-colors">
                About
              </button>
              <button type="button" onClick={() => setFooterSection(footerSection === 'contact' ? null : 'contact')} className="font-label-md text-label-md text-secondary hover:text-primary transition-colors">
                Contact
              </button>
              <button type="button" onClick={() => setFooterSection(footerSection === 'privacy' ? null : 'privacy')} className="font-label-md text-label-md text-secondary hover:text-primary transition-colors">
                Privacy
              </button>
              <button type="button" onClick={() => setFooterSection(footerSection === 'terms' ? null : 'terms')} className="font-label-md text-label-md text-secondary hover:text-primary transition-colors">
                Terms
              </button>
            </div>
            {footerSection && (
              <div className="border border-border-subtle rounded-DEFAULT bg-surface-container-low p-space-sm">
                {footerSection === 'about' && (
                  <div className="flex flex-col gap-3 font-body-sm text-secondary leading-relaxed">
                    <div>
                      <h2 className="font-headline-sm text-on-surface font-semibold">About CampusConnect</h2>
                      <p className="mt-1">
                        {cms?.aboutText || 'CampusConnect is a campus community platform that brings student clubs, events, memberships, and announcements together in one place.'}
                      </p>
                    </div>
                    <div>
                      <h3 className="font-label-md text-on-surface font-semibold">What you can do</h3>
                      <ul className="list-disc pl-5 mt-1 space-y-1">
                        <li>Discover published clubs and learn about their activities.</li>
                        <li>Send membership requests and track their status.</li>
                        <li>Browse campus events, open event links, and RSVP.</li>
                        <li>Receive announcements relevant to campus communities.</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-label-md text-on-surface font-semibold">Built for every campus role</h3>
                      <p className="mt-1">
                        Students get a focused participation experience. Club administrators manage their club, events, announcements, and membership requests. Super administrators manage platform users, clubs, events, and public content.
                      </p>
                    </div>
                  </div>
                )}
                {footerSection === 'contact' && (
                  <div className="flex flex-col gap-3 font-body-sm text-secondary leading-relaxed">
                    <div>
                      <h2 className="font-headline-sm text-on-surface font-semibold">CampusConnect Support</h2>
                      <p className="mt-1">For account access, email verification, club membership, event registration, or platform questions, contact support using the details below.</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-label-md text-on-surface font-semibold">Support email</span>
                      <a href="mailto:24bai71012@cuchd.in" className="text-primary underline break-all">24bai71012@cuchd.in</a>
                      <span>Support ID: 24BAI71012</span>
                    </div>
                    <p>When contacting support, include your registered email address, the page where the issue occurred, and a short description of the problem. Do not send your password.</p>
                  </div>
                )}
                {footerSection === 'privacy' && (
                  <div className="flex flex-col gap-3 font-body-sm text-secondary leading-relaxed">
                    <div>
                      <h2 className="font-headline-sm text-on-surface font-semibold">Privacy information</h2>
                      <p className="mt-1">CampusConnect uses the information you provide to operate your account and deliver campus participation features.</p>
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Account information supports authentication and email verification.</li>
                      <li>Membership and RSVP activity is used to show your participation status.</li>
                      <li>Role permissions limit which administrative features each account can access.</li>
                      <li>Announcements and event information are shown according to their configured audience.</li>
                    </ul>
                    <p>Only share information that is necessary for your campus account. Contact support if you believe your account information or access is incorrect.</p>
                  </div>
                )}
                {footerSection === 'terms' && (
                  <div className="flex flex-col gap-3 font-body-sm text-secondary leading-relaxed">
                    <div>
                      <h2 className="font-headline-sm text-on-surface font-semibold">Platform terms</h2>
                      <p className="mt-1">CampusConnect is intended for genuine campus community participation and administration.</p>
                    </div>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Use accurate information when creating or managing an account.</li>
                      <li>Keep your password private and do not use another person&apos;s account.</li>
                      <li>Register only for events you intend to attend and follow event instructions.</li>
                      <li>Publish respectful, relevant club and event content.</li>
                      <li>Campus administrators may review, update, or remove content and manage access.</li>
                    </ul>
                    <p>For questions about these platform guidelines, contact support before submitting sensitive information.</p>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-col gap-1 whitespace-pre-line">
              <p className="font-body-sm text-body-sm text-secondary">
                {cms?.footerText || 'CampusConnect'}
              </p>
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
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-surface-container text-primary font-label-sm rounded text-[11px] font-semibold">
                {selectedClub.category}
              </span>
              <span className="font-body-sm text-secondary">ID: {selectedClub.refId}</span>
            </div>

            <p className="font-body-md text-on-surface">{selectedClub.description}</p>

            <div className="bg-surface-container-low p-3 rounded-lg flex flex-col gap-1">
              <div className="flex justify-between font-body-sm">
                <span className="text-secondary">Meeting Schedule:</span>
                <span className="font-medium text-primary">{selectedClub.meetingSchedule || 'TBD'}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-secondary">Location:</span>
                <span className="font-medium text-primary">{selectedClub.meetingLocation || 'Campus Hall'}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-secondary">Faculty Advisor:</span>
                <span className="font-medium text-primary">{selectedClub.facultyAdvisor || 'N/A'}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-secondary">Total Members:</span>
                <span className="font-medium text-primary">{selectedClub.memberCount}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setSelectedClub(null)}
                className="h-9 px-4 bg-surface-container text-on-surface font-label-md rounded hover:bg-surface-container-high transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                disabled={
                  actionLoading ||
                  selectedClub.userMembershipStatus === 'PENDING' ||
                  selectedClub.userMembershipStatus === 'APPROVED'
                }
                onClick={() => handleJoinClub(selectedClub.id)}
                className="h-9 px-4 bg-primary text-on-primary font-label-md rounded flex items-center gap-1.5 hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                <span>
                  {selectedClub.userMembershipStatus === 'APPROVED'
                    ? 'Member'
                    : selectedClub.userMembershipStatus === 'PENDING'
                    ? 'Pending Approval'
                    : selectedClub.userMembershipStatus === 'REJECTED'
                    ? 'Reapply'
                    : isAuthenticated
                    ? 'Become a Member'
                    : 'Sign in to Join'}
                </span>
                <span className="material-symbols-outlined text-[16px]">send</span>
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
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-surface-container text-primary font-label-sm rounded text-[11px] font-semibold">
                {selectedEvent.badgeLabel || 'Open RSVP'}
              </span>
              <span className="font-body-sm text-secondary">{selectedEvent.eventDate}</span>
            </div>

            <p className="font-body-md text-on-surface">{selectedEvent.description}</p>

            <div className="bg-surface-container-low p-3 rounded-lg flex flex-col gap-1">
              <div className="flex justify-between font-body-sm">
                <span className="text-secondary">Location:</span>
                <span className="font-medium text-primary">{selectedEvent.location}</span>
              </div>
              <div className="flex justify-between font-body-sm">
                <span className="text-secondary">Capacity:</span>
                <span className="font-medium text-primary">
                  {selectedEvent.registeredCount} / {selectedEvent.capacity} seats filled
                </span>
              </div>
              {selectedEvent.clubName && (
                <div className="flex justify-between font-body-sm">
                  <span className="text-secondary">Host Club:</span>
                  <span className="font-medium text-primary">{selectedEvent.clubName}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="h-9 px-4 bg-surface-container text-on-surface font-label-md rounded hover:bg-surface-container-high transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                disabled={actionLoading || selectedEvent.registeredCount >= selectedEvent.capacity}
                onClick={() => handleRegisterEvent(selectedEvent.id)}
                className="h-9 px-4 bg-primary text-on-primary font-label-md rounded flex items-center gap-1.5 hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                <span>
                  {selectedEvent.registeredCount >= selectedEvent.capacity
                    ? 'Capacity Full'
                    : isAuthenticated
                    ? 'Confirm RSVP'
                    : 'Sign in to RSVP'}
                </span>
                <span className="material-symbols-outlined text-[16px]">event_available</span>
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
