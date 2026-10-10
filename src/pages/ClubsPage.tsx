import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { Club } from '../types';
import { apiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const ClubsPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchClubs();
  }, [user]);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/clubs/public');
      if (res.data?.data) {
        setClubs(res.data.data);
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
      setToastMessage(res.data.message || 'Membership request submitted!');
      setSelectedClub(null);
      fetchClubs();
    } catch (err: any) {
      setToastMessage(err.response?.data?.message || 'Failed to submit membership request.');
    } finally {
      setActionLoading(false);
    }
  };

  const categories = ['All', 'Academic', 'Engineering', 'Tech', 'Humanities', 'Creative'];

  const filteredClubs = clubs.filter((c) => {
    const matchesSearch =
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase());
    const matchesCat =
      selectedCategory === 'All' ||
      c.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCat;
  });

  const getClubIcon = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('eng') || cat.includes('robot') || cat.includes('tech')) return 'smart_toy';
    if (cat.includes('human') || cat.includes('debate') || cat.includes('law')) return 'gavel';
    if (cat.includes('art') || cat.includes('design') || cat.includes('creative')) return 'palette';
    return 'terminal';
  };

  return (
    <div className="bg-surface font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Clubs Directory" />

      <main className="flex-1 w-full pt-20 pb-24 md:pb-12 bg-surface px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Section Header */}
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-caps text-label-caps text-primary uppercase">
              Curated Directory
            </span>
            <h1 className="font-headline-lg-mobile md:text-headline-lg text-on-surface tracking-tight font-bold">
              Student Organizations &amp; Clubs
            </h1>
            <p className="font-body-md text-on-surface-variant leading-relaxed">
              Find official societies, chartered student associations, and engineering teams across all academic departments.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by club name, department, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-11 pr-4 bg-surface-container-lowest text-on-surface font-body-md rounded-xl border border-outline-variant/40 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`h-8 px-3.5 rounded-full font-label-sm text-label-sm whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-primary text-on-primary font-semibold shadow-sm'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Club Cards Grid */}
          {loading ? (
            <div className="p-space-xl text-center text-on-surface-variant font-body-md">
              Loading organizations directory...
            </div>
          ) : filteredClubs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredClubs.map((club) => (
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
                          <h2 className="font-headline-sm text-headline-sm text-on-surface truncate font-semibold">
                            {club.name}
                          </h2>
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedClub(club)}
                        className="h-9 px-space-md rounded-xl bg-surface-container text-on-surface font-label-sm text-label-sm flex items-center gap-1 active:scale-95 transition-transform"
                      >
                        Details
                      </button>
                      <button
                        type="button"
                        disabled={
                          actionLoading ||
                          club.userMembershipStatus === 'APPROVED' ||
                          club.userMembershipStatus === 'PENDING'
                        }
                        onClick={() => handleJoinClub(club.id)}
                        className="h-9 px-space-md rounded-xl bg-primary text-on-primary font-label-sm text-label-sm flex items-center gap-1 shadow-sm active:scale-95 transition-transform disabled:opacity-60"
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
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl p-space-xl shadow-sm border border-outline-variant/30 flex flex-col items-center text-center gap-space-sm mt-space-sm">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[26px]">groups</span>
              </div>
              <h3 className="font-headline-sm text-on-surface font-semibold">
                No Student Clubs Found
              </h3>
              <p className="font-body-sm text-on-surface-variant max-w-sm">
                {search || selectedCategory !== 'All'
                  ? 'No registered clubs match your current search criteria.'
                  : 'Certified student societies will appear in this directory once registered and approved by the Office of Student Affairs.'}
              </p>
            </div>
          )}
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
                <span className="text-on-surface-variant">Official Roster:</span>
                <span className="font-medium text-primary font-tabular-num">{selectedClub.memberCount} Approved Members</span>
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
                    ? 'Active Member'
                    : selectedClub.userMembershipStatus === 'PENDING'
                    ? 'Application Pending'
                    : isAuthenticated
                    ? 'Submit Membership Request'
                    : 'Sign in to Apply'}
                </span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
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
