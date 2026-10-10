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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await apiClient.get('/events/public');
      if (res.data?.data) {
        setEvents(res.data.data);
      }
    } catch {
      // Ignored
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
      setToastMessage(res.data.message || 'Successfully registered!');
      setSelectedEvent(null);
      fetchEvents();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to register.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.location.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Events Schedule" />

      <main className="flex-1 flex flex-col relative w-full pt-20 pb-8 bg-surface px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col w-full gap-space-md py-space-md">
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-secondary uppercase tracking-wider">Campus Calendar</span>
            <h1 className="font-headline-lg text-primary font-bold">Upcoming Campus Events</h1>
            <p className="font-body-md text-secondary">
              Browse workshops, guest speakers, tournaments, and hackathons
            </p>
          </div>

          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by event title, hall, or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surface-container-lowest text-on-surface font-body-md pl-10 pr-3 py-2 rounded-lg placeholder-secondary border border-border-default focus:outline-none focus:border-black"
            />
          </div>

          <div className="flex flex-col gap-space-sm">
            {filteredEvents.map((evt) => (
              <article
                key={evt.id}
                className="bg-surface-container-lowest p-space-md rounded-DEFAULT border border-border-default shadow-sm flex flex-col gap-space-sm"
              >
                <div className="flex items-start justify-between gap-space-sm">
                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-label-sm text-secondary">{evt.eventDate}</span>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface mt-0.5 font-semibold">
                      {evt.title}
                    </h2>
                  </div>
                  <span className="px-2 py-0.5 bg-surface-container text-on-surface font-label-sm text-label-sm rounded-DEFAULT shrink-0 text-[11px] font-semibold border border-border-default">
                    {evt.badgeLabel || 'Open RSVP'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-secondary">
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  <span className="font-body-sm text-body-sm">{evt.location}</span>
                </div>

                <p className="font-body-md text-body-md text-secondary">{evt.description}</p>

                <div className="flex items-center justify-between pt-space-xs border-t border-border-subtle">
                  <span className="font-label-sm text-label-sm text-secondary tabular-nums">
                    {evt.registeredCount} / {evt.capacity} Registered
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(evt)}
                    className="font-label-sm text-label-sm font-semibold text-primary flex items-center gap-0.5 hover:underline"
                  >
                    <span>View Details</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
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
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-surface-container text-primary font-label-sm rounded text-[11px] font-semibold">
                {selectedEvent.badgeLabel || 'Open RSVP'}
              </span>
              <span className="font-body-sm text-secondary">{selectedEvent.eventDate}</span>
            </div>

            <p className="font-body-md text-on-surface">{selectedEvent.description}</p>

            {selectedEvent.eventLink && (
              <a
                href={selectedEvent.eventLink}
                target="_blank"
                rel="noreferrer"
                className="font-label-md text-primary underline break-all"
              >
                Open event link
              </a>
            )}

            <div className="bg-surface-container-low p-3 rounded-lg flex flex-col gap-1 border border-border-subtle">
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
                onClick={() => handleRegister(selectedEvent.id)}
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
