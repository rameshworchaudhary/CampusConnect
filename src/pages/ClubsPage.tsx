import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { Modal } from '../components/Modal';
import { Toast } from '../components/Toast';
import { ImageUploader } from '../components/ImageUploader';
import { Club } from '../types';
import { getPublicClubs, registerClub } from '../services/clubService';
import { requestMembership } from '../services/membershipService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { STORAGE_BUCKETS } from '../services/storageService';
import { StorageImage } from '../components/StorageImage';

export const ClubsPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Club Registration Modal state
  const [showRegisterClubModal, setShowRegisterClubModal] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [newClubCategory, setNewClubCategory] = useState('Academic');
  const [newClubDescription, setNewClubDescription] = useState('');
  const [newClubSchedule, setNewClubSchedule] = useState('');
  const [newClubLocation, setNewClubLocation] = useState('');
  const [newClubAdvisor, setNewClubAdvisor] = useState('');
  const [newClubContactEmail, setNewClubContactEmail] = useState('');
  const [newClubContactPhone, setNewClubContactPhone] = useState('');
  const [newClubLogoUrl, setNewClubLogoUrl] = useState('');
  const [registeringClub, setRegisteringClub] = useState(false);
  const [registerError, setRegisterError] = useState('');

  useEffect(() => {
    fetchClubs();
  }, [user]);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const data = await getPublicClubs(user?.id);
      setClubs(data);
    } catch (err: any) {
      console.warn('Could not load clubs:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinClub = async (clubId: string) => {
    if (!isAuthenticated || !user) {
      navigate('/login');
      return;
    }
    try {
      setActionLoading(true);
      await requestMembership(clubId, user.id, { email: user.email, role: user.role });
      setToastMessage('Membership request submitted successfully. Pending club officer review.');
      setSelectedClub(null);
      await fetchClubs();
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to submit membership request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterClubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    if (!newClubName.trim() || !newClubDescription.trim() || !newClubContactEmail.trim()) {
      setRegisterError('Please fill in all required fields.');
      return;
    }

    try {
      setRegisteringClub(true);
      await registerClub(
        {
          name: newClubName.trim(),
          category: newClubCategory,
          description: newClubDescription.trim(),
          meetingSchedule: newClubSchedule.trim() || undefined,
          meetingLocation: newClubLocation.trim() || undefined,
          facultyAdvisor: newClubAdvisor.trim() || undefined,
          contactEmail: newClubContactEmail.trim(),
          contactPhone: newClubContactPhone.trim() || undefined,
          logoUrl: newClubLogoUrl || undefined,
        },
        user ? { email: user.email, role: user.role } : undefined
      );

      setToastMessage('Club registration submitted! Pending administrative review and approval.');
      setShowRegisterClubModal(false);
      // Reset form
      setNewClubName('');
      setNewClubDescription('');
      setNewClubSchedule('');
      setNewClubLocation('');
      setNewClubAdvisor('');
      setNewClubContactEmail('');
      setNewClubContactPhone('');
      setNewClubLogoUrl('');
      await fetchClubs();
    } catch (err: any) {
      setRegisterError(err.message || 'Failed to submit club registration.');
    } finally {
      setRegisteringClub(false);
    }
  };

  const categories = ['All', 'Academic', 'Engineering', 'Tech', 'Humanities', 'Creative', 'Sports'];

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
    if (cat.includes('sport') || cat.includes('athle')) return 'fitness_center';
    return 'school';
  };

  return (
    <div className="bg-app font-body-md text-on-surface antialiased flex flex-col min-h-screen">
      <Header subtitle="Clubs Directory" />

      <main className="flex-1 w-full pt-20 pb-24 md:pb-12 bg-app px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* Header Banner */}
          <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-border-default shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="font-label-caps text-label-caps text-primary uppercase font-bold text-[11px]">
                Curated Directory
              </span>
              <h1 className="text-3xl sm:text-4xl font-semibold text-on-surface tracking-tight leading-tight">
                Student Organizations &amp; Clubs
              </h1>
              <p className="text-xs sm:text-sm text-on-surface-variant max-w-2xl">
                Find recognized campus societies, academic associations, and competitive teams.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!isAuthenticated) {
                  navigate('/login');
                  return;
                }
                setShowRegisterClubModal(true);
              }}
              className="h-10 px-4 rounded-xl bg-accent text-on-accent text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity self-start sm:self-auto shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              <span>Register a Club</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder="Search by club name, category, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-11 pr-4 bg-surface-container-lowest text-on-surface text-sm rounded-xl border border-border-default shadow-sm focus:outline-none focus:border-black transition-colors"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`h-8 px-3.5 rounded-lg text-xs whitespace-nowrap transition-colors border ${
                  selectedCategory === cat
                    ? 'bg-accent text-on-accent border-accent font-semibold shadow-sm'
                    : 'bg-surface-container text-on-surface-variant border-border-default hover:text-on-surface'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Club Cards Grid */}
          {loading ? (
            <div className="py-16 text-center text-on-surface-variant text-sm">
              Loading organizations directory...
            </div>
          ) : loadError ? (
            <div role="alert" className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm border border-border-default flex flex-col items-center text-center gap-3">
              <p className="text-sm text-on-surface-variant">Could not load clubs.</p>
              <button type="button" onClick={() => void fetchClubs()} className="h-10 px-4 rounded-xl bg-accent text-on-accent text-sm font-semibold hover:opacity-90">Retry</button>
            </div>
          ) : filteredClubs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {filteredClubs.map((club) => (
                <div
                  key={club.id}
                  className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-border-default flex flex-col justify-between gap-4"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {club.logoUrl ? (
                          <div className="w-12 h-12 rounded-xl border border-border-default overflow-hidden bg-surface-container shrink-0">
                            <StorageImage bucket={STORAGE_BUCKETS.clubLogos} path={club.logoPath} alt={club.name} className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0 border border-border-default">
                            <span className="material-symbols-outlined text-[24px]">
                              {getClubIcon(club.category)}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <h2 className="font-semibold text-sm sm:text-base text-on-surface truncate">
                            {club.name}
                          </h2>
                          <p className="text-xs text-on-surface-variant mt-0.5 truncate">
                            {club.meetingLocation || club.category}
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-surface-container text-primary border border-border-default shrink-0">
                        {club.category}
                      </span>
                    </div>

                    <p className="text-xs text-on-surface-variant line-clamp-3 leading-relaxed">
                      {club.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border-default">
                    <div className="flex items-center gap-1.5 text-on-surface-variant text-xs">
                      <span className="material-symbols-outlined text-[16px]">groups</span>
                      <span className="tabular-nums font-medium">
                        {club.memberCount} {club.memberCount === 1 ? 'member' : 'members'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedClub(club)}
                        className="h-8 px-3 rounded-lg bg-surface-container text-on-surface text-xs font-semibold hover:bg-surface-container-high transition-colors border border-border-default"
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
                        className="h-8 px-3.5 rounded-lg bg-accent text-on-accent text-xs font-semibold flex items-center gap-1 shadow-sm active:scale-95 transition-transform disabled:opacity-50"
                      >
                        <span>
                          {club.userMembershipStatus === 'APPROVED'
                            ? 'Member'
                            : club.userMembershipStatus === 'PENDING'
                            ? 'Pending'
                            : 'Join'}
                        </span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl p-12 shadow-sm border border-border-default flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">groups</span>
              </div>
              <h2 className="font-semibold text-base text-on-surface">
                No clubs registered yet
              </h2>
              <p className="text-xs text-on-surface-variant max-w-sm">
                {search || selectedCategory !== 'All'
                  ? 'No approved clubs match your search query.'
                  : 'Be the first to register a recognized student organization on campus.'}
              </p>
              {(!search && selectedCategory === 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) navigate('/login');
                    else setShowRegisterClubModal(true);
                  }}
                  className="mt-2 h-9 px-4 rounded-xl bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90"
                >
                  Register a Club
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Club Details Modal */}
      <Modal
        isOpen={Boolean(selectedClub)}
        onClose={() => setSelectedClub(null)}
        title={selectedClub?.name || 'Club Profile'}
      >
        {selectedClub && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded text-[10px] uppercase font-bold bg-surface-container text-primary border border-border-default">
                {selectedClub.category}
              </span>
              <span className="text-xs text-on-surface-variant tabular-nums font-medium">
                Charter ID: {selectedClub.refId}
              </span>
            </div>

            {selectedClub.logoUrl && (
              <div className="w-20 h-20 rounded-xl overflow-hidden border border-border-default mx-auto bg-surface-container">
                <StorageImage bucket={STORAGE_BUCKETS.clubLogos} path={selectedClub.logoPath} alt={selectedClub.name} className="w-full h-full object-contain" />
              </div>
            )}

            <p className="text-xs sm:text-sm text-on-surface leading-relaxed">
              {selectedClub.description}
            </p>

            <div className="bg-surface-container-low p-3.5 rounded-xl flex flex-col gap-2 border border-border-default text-xs">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Meeting Schedule:</span>
                <span className="font-medium text-on-surface">{selectedClub.meetingSchedule || 'Weekly'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Location:</span>
                <span className="font-medium text-on-surface">{selectedClub.meetingLocation || 'Campus Hub'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Faculty Advisor:</span>
                <span className="font-medium text-on-surface">{selectedClub.facultyAdvisor || 'Unassigned'}</span>
              </div>
              {selectedClub.contactEmail && (
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Contact Email:</span>
                  <span className="font-medium text-on-surface">{selectedClub.contactEmail}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-border-default">
                <span className="text-on-surface-variant">Active Members:</span>
                <span className="font-semibold text-primary tabular-nums">{selectedClub.memberCount}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
              <button
                type="button"
                onClick={() => setSelectedClub(null)}
                className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold border border-border-default"
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
                className="h-9 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
              >
                <span>
                  {selectedClub.userMembershipStatus === 'APPROVED'
                    ? 'Active Member'
                    : selectedClub.userMembershipStatus === 'PENDING'
                    ? 'Application Pending'
                    : isAuthenticated
                    ? 'Apply to Join'
                    : 'Sign in to Apply'}
                </span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Club Registration Modal */}
      <Modal
        isOpen={showRegisterClubModal}
        onClose={() => setShowRegisterClubModal(false)}
        title="Register New Student Club"
      >
        <form onSubmit={handleRegisterClubSubmit} className="flex flex-col gap-3">
          {registerError && (
            <div className="p-3 bg-surface-container border border-border-default rounded-xl text-xs text-on-surface">
              {registerError}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
              Club Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Robotics & Automation Club"
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
                value={newClubCategory}
                onChange={(e) => setNewClubCategory(e.target.value)}
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
                Contact Email *
              </label>
              <input
                type="email"
                required
                placeholder="club@univ.edu"
                value={newClubContactEmail}
                onChange={(e) => setNewClubContactEmail(e.target.value)}
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
              placeholder="State the organization's charter and student focus..."
              value={newClubDescription}
              onChange={(e) => setNewClubDescription(e.target.value)}
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
                placeholder="Tuesdays • 5:00 PM"
                value={newClubSchedule}
                onChange={(e) => setNewClubSchedule(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs text-on-surface focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Meeting Location
              </label>
              <input
                type="text"
                placeholder="Engineering Hall 204"
                value={newClubLocation}
                onChange={(e) => setNewClubLocation(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs text-on-surface focus:outline-none focus:border-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Faculty Advisor
              </label>
              <input
                type="text"
                placeholder="Dr. Eleanor Vance"
                value={newClubAdvisor}
                onChange={(e) => setNewClubAdvisor(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs text-on-surface focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase font-bold text-[11px]">
                Contact Phone
              </label>
              <input
                type="tel"
                placeholder="(555) 019-2831"
                value={newClubContactPhone}
                onChange={(e) => setNewClubContactPhone(e.target.value)}
                className="h-10 px-3 bg-surface-container-lowest border border-border-default rounded-lg text-xs text-on-surface focus:outline-none focus:border-black"
              />
            </div>
          </div>

          {/* Logo Upload Component */}
          <ImageUploader
            bucket={STORAGE_BUCKETS.clubLogos}
            folderId={user?.id}
            label="Club Emblem / Logo"
            currentImageUrl={newClubLogoUrl}
            onImageUploaded={(_url, path) => setNewClubLogoUrl(path)}
            onImageRemoved={() => setNewClubLogoUrl('')}
            helperText="JPG, PNG, WebP (max 5 MB)"
            aspectRatio="square"
          />

          <div className="p-3 bg-surface-container rounded-xl border border-border-default text-xs text-on-surface-variant mt-1">
            <span className="font-semibold block text-primary mb-0.5">Approval Policy</span>
            New registrations require approval from the Super Admin before appearing in the public campus directory.
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <button
              type="button"
              onClick={() => setShowRegisterClubModal(false)}
              className="h-9 px-4 rounded-lg bg-surface-container text-on-surface text-xs font-semibold border border-border-default"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={registeringClub}
              className="h-9 px-4 rounded-lg bg-accent text-on-accent text-xs font-semibold shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {registeringClub ? 'Submitting Application...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </Modal>

      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />
      <BottomNav />
    </div>
  );
};

export default ClubsPage;
