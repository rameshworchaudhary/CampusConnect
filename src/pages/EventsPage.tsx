import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { EventItem } from '../types';
import { getPublicEvents, registerForEvent } from '../services/eventService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const EventsPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await getPublicEvents(user?.id);
      setEvents(data);
    } catch (err: any) {
      console.warn('Could not load events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (eventId: string) => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }
    try {
      setActionLoading(true);
      await registerForEvent(eventId, user.id, { email: user.email, role: user.role });
      setToastMessage('Successfully registered for event!');
      setSelectedEvent(null);
      await fetchEvents();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to register.');
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
          {/* Header Banner */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-border-default shadow-sm flex flex-col gap-2">
            <span className="font-label-caps text-label-caps text-primary uppercase text-[11px] font-bold">
              Campus Calendar
            </span>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
              Upcoming Events &amp; Assemblies
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant max-w-3xl">
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
              className="w-full h-11 pl-11 pr-4 bg-surface-container-lowest text-on-surface text-sm rounded-xl border border-border-default shadow-sm focus:outline-none focus:border-black transition-colors"
            />
          </div>

          {/* Event Cards */}
          {loading ? (
            <div className="py-16 text-center text-on-surface-variant text-sm">
              Loading calendar schedule...
            </div>
          ) : filteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredEvents.map((evt) => {
                const percent = Math.min(100, Math.round((evt.registeredCount / (evt.capacity || 1)) * 100));
                return (
                  <div
                    key={evt.id}
                    className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-border-default flex flex-col justify-between gap-4"
                  >
                    <div className="flex flex-col gap-3">
                      {/* Event Poster if available */}
                      {evt.posterUrl && (
                        <div className="w-full h-36 rounded-xl overflow-hidden border border-border-default bg-surface-container mb-1">
                          <img
                            src={evt.posterUrl}
                            alt={evt.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                          <span>{evt.eventDate}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-surface-container text-primary border border-border-default">
                          {evt.badgeLabel || 'Open RSVP'}
                        </span>
                      </div>

                      <div>
                        <h2 className="font-semibold text-base text-on-surface">
                          {evt.title}
                        </h2>
                        <p className="text-xs text-on-surface-variant mt-0.5 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          <span>{evt.location}</span>
                        </p>
                      </div>

                      {evt.description && (
                        <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                          {evt.description}
                        </p>
                      )}

                      <div className="flex flex-col gap-1 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-on-surface-variant">Capacity Status</span>
                          <span className="tabular-nums font-medium text-on-surface">
                            {evt.registeredCount} / {evt.capacity} Registered
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 flex items-center justify-between border-t border-border-default">
                      <span className="text-xs text-on-surface-variant truncate max-w-[140px]">
                        {evt.clubName ? `By ${evt.clubName}` : 'Campus Event'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(evt)}
                          className="h-8 px-3 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading || evt.registeredCount >= evt.capacity || evt.isUserRegistered}
                          onClick={() => handleRegister(evt.id)}
                          className="h-8 px-3.5 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                        >
                          <span>{evt.isUserRegistered ? 'Registered' : 'RSVP'}</span>
                          <span className="material-symbols-outlined text-[14px]">bookmark_add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl p-12 shadow-sm border border-border-default flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">event_busy</span>
              </div>
              <h2 className="font-semibold text-base text-on-surface">
                No events available
              </h2>
              <p className="text-xs text-on-surface-variant max-w-sm">
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
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.title || 'Event Details'}
      >
        {selectedEvent && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-bold bg-surface-container text-primary border border-border-default">
                {selectedEvent.badgeLabel || 'Open RSVP'}
              </span>
              <span className="text-xs text-primary font-semibold tabular-nums">
                {selectedEvent.eventDate}
              </span>
            </div>

            {selectedEvent.posterUrl && (
              <div className="w-full h-44 rounded-xl overflow-hidden border border-border-default bg-surface-container">
                <img
                  src={selectedEvent.posterUrl}
                  alt={selectedEvent.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <p className="text-xs sm:text-sm text-on-surface leading-relaxed">
              {selectedEvent.description}
            </p>

            {selectedEvent.eventLink && (
              <a
                href={selectedEvent.eventLink}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline break-all flex items-center gap-1 font-semibold"
              >
                <span>External Meeting Portal</span>
                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              </a>
            )}

            <div className="bg-surface-container-low p-3.5 rounded-xl flex flex-col gap-2 border border-border-default text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Location:</span>
                <span className="font-medium text-on-surface">{selectedEvent.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Capacity:</span>
                <span className="font-medium text-on-surface tabular-nums">
                  {selectedEvent.registeredCount} / {selectedEvent.capacity} Seats Filled
                </span>
              </div>
              {selectedEvent.clubName && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Host Organization:</span>
                  <span className="font-medium text-primary">{selectedEvent.clubName}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold border border-border-default"
              >
                Close
              </button>
              <button
                type="button"
                disabled={actionLoading || selectedEvent.registeredCount >= selectedEvent.capacity || selectedEvent.isUserRegistered}
                onClick={() => handleRegister(selectedEvent.id)}
                className="h-9 px-4 rounded-lg bg-primary text-on-primary text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              >
                <span>
                  {selectedEvent.isUserRegistered
                    ? 'Registered'
                    : selectedEvent.registeredCount >= selectedEvent.capacity
                    ? 'Full Capacity'
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

export default EventsPage;
