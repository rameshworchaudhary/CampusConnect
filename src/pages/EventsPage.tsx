import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { EventItem } from '../types';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const EventsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/events/public');
      if (res.data?.data) {
        setEvents(res.data.data);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (eventId: number) => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    try {
      setActionLoading(true);
      const res = await apiClient.post(`/student/events/${eventId}/register`);
      setToastMessage(res.data.message || 'Successfully registered for event!');
      setSelectedEvent(null);
      fetchEvents();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to register.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredEvents = events.filter((e) => {
    return (
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.location.toLowerCase().includes(search.toLowerCase()) ||
      (e.clubName && e.clubName.toLowerCase().includes(search.toLowerCase()))
    );
  });

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Campus Events" />

      <main className="flex-1 w-full pt-20 pb-24 md:pb-12 bg-surface px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Section Header */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-border-default shadow-sm flex flex-col gap-2">
            <span className="font-label-caps text-label-caps text-primary uppercase text-[11px] font-bold">
              Campus Calendar
            </span>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
              Upcoming Events &amp; Assemblies
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed max-w-3xl">
              RSVP for academic workshops, technical competitions, debates, and departmental symposiums.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by event title, location, or host organization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-11 pr-4 bg-surface-container-lowest text-on-surface text-sm rounded-xl border border-border-default shadow-sm focus:outline-none focus:border-black transition-all"
            />
          </div>

          {/* Event Cards */}
          {loading ? (
            <div className="py-16 text-center text-on-surface-variant text-sm">
              Loading calendar schedule...
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEvents.map((evt) => {
                const percent = Math.min(100, Math.round((evt.registeredCount / (evt.capacity || 1)) * 100));
                return (
                  <div
                    key={evt.id}
                    className="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm border border-outline-variant/30 flex flex-col gap-space-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-space-xs">
                        <span className="material-symbols-outlined text-primary text-[20px]">
                          calendar_month
                        </span>
                        <span className="font-label-md text-label-md text-primary font-tabular-num font-semibold">
                          {evt.eventDate}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-label-caps text-label-caps">
                        {evt.badgeLabel || 'Open RSVP'}
                      </span>
                    </div>

                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                        {evt.title}
                      </h2>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                        {evt.location}
                      </p>
                    </div>

                    <p className="font-body-md text-body-md text-on-surface leading-snug">
                      {evt.description}
                    </p>

                    <div className="flex flex-col gap-1.5 pt-space-xs">
                      <div className="flex justify-between font-label-sm text-label-sm">
                        <span className="text-on-surface-variant">Capacity Status</span>
                        <span className="font-tabular-num text-on-surface font-label-sm font-semibold">
                          {evt.registeredCount} / {evt.capacity} Registered
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
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {evt.clubName ? `Organized by ${evt.clubName}` : 'Campus-wide Platform Event'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(evt)}
                          className="h-9 px-space-md rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm flex items-center gap-1 active:scale-95 transition-transform"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading || evt.registeredCount >= evt.capacity}
                          onClick={() => handleRegister(evt.id)}
                          className="h-9 px-space-md rounded-xl bg-primary text-on-primary font-label-sm text-label-sm flex items-center gap-1 shadow-sm active:scale-95 transition-transform disabled:opacity-60"
                        >
                          <span>{evt.isUserRegistered ? 'Registered' : 'RSVP Seat'}</span>
                          <span className="material-symbols-outlined text-[16px]">bookmark_add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col items-center text-center gap-space-sm mt-space-sm">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[26px]">event_busy</span>
              </div>
              <h2 className="font-headline-sm text-on-surface font-semibold">
                No Upcoming Events Scheduled
              </h2>
              <p className="font-body-sm text-on-surface-variant max-w-sm">
                {search
                  ? 'No events match your current search criteria.'
                  : 'Check back soon for academic symposia, competitions, and student activities.'}
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Details Modal */}
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
              <span className="font-label-md text-primary font-tabular-num font-semibold">
                {selectedEvent.eventDate}
              </span>
            </div>

            <p className="font-body-md text-on-surface leading-relaxed">
              {selectedEvent.description}
            </p>

            {selectedEvent.eventLink && (
              <a
                href={selectedEvent.eventLink}
                target="_blank"
                rel="noreferrer"
                className="font-label-md text-primary underline break-all flex items-center gap-1"
              >
                <span>External Link / Meeting Portal</span>
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </a>
            )}

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
                  <span className="text-on-surface-variant">Host Organization:</span>
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
                onClick={() => handleRegister(selectedEvent.id)}
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
