import React, { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  subtitle?: string;
  unreadCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  subtitle = 'Discover',
  unreadCount = 0,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu whenever location changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileDropdownOpen(false);
  }, [location.pathname]);

  const getDashboardPath = () => {
    if (!isAuthenticated || !user) return '/login';
    if (user.role === 'SUPER_ADMIN') return '/admin';
    if (user.role === 'CLUB_ADMIN') return '/club-admin';
    return '/student';
  };

  const getDashboardLabel = () => {
    if (user?.role === 'SUPER_ADMIN') return 'Super Admin';
    if (user?.role === 'CLUB_ADMIN') return 'Club Portal';
    return 'Dashboard';
  };

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/95 backdrop-blur-xl border-b border-border-default">
      <div className="h-16 px-3 sm:px-6 lg:px-8 flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Mobile Menu Trigger + Logo & View Subtitle */}
        <div className="flex items-center gap-2 sm:gap-4 md:gap-6 min-w-0">
          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileMenuOpen ? 'campusconnect-mobile-menu' : undefined}
            className="w-10 h-10 flex lg:hidden items-center justify-center rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>

          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-on-accent shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[18px] sm:text-[20px]">school</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-label-caps text-primary tracking-wider uppercase font-bold text-[10px] sm:text-[11px] truncate">
                CampusConnect
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface leading-none font-semibold text-xs sm:text-sm truncate">
                {subtitle}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1 pl-3 sm:pl-4 border-l border-border-default">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-accent text-on-accent font-semibold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`
              }
            >
              Discover
            </NavLink>
            <NavLink
              to="/clubs"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-accent text-on-accent font-semibold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`
              }
            >
              Clubs
            </NavLink>
            <NavLink
              to="/events"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-accent text-on-accent font-semibold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`
              }
            >
              Events
            </NavLink>
            <NavLink
              to="/#public-bulletins"
              className={() =>
                `px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${
                  location.pathname === '/' && location.hash === '#public-bulletins'
                    ? 'bg-accent text-on-accent font-semibold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`
              }
            >
              Bulletins
            </NavLink>
            {isAuthenticated && (
              <NavLink
                to={getDashboardPath()}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs lg:text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-accent text-on-accent font-semibold'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                  }`
                }
              >
                {getDashboardLabel()}
              </NavLink>
            )}
          </nav>
        </div>

        {/* Right: Notifications, Quick Actions & Profile Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-3 relative shrink-0">
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => {
              if (isAuthenticated) {
                navigate(getDashboardPath());
              } else {
                navigate('/login');
              }
            }}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center relative rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent ring-2 ring-surface"></span>
            )}
          </button>

          {isAuthenticated && user ? (
            <div className="relative">
              <button
                type="button"
                aria-label="User profile menu"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-xl hover:bg-surface-container transition-colors focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-accent text-on-accent font-label-caps text-label-caps flex items-center justify-center font-bold shadow-sm text-xs">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-primary truncate max-w-[120px]">
                    {user.fullName}
                  </span>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                    {user.role === 'SUPER_ADMIN' ? 'Super Admin' : user.role === 'CLUB_ADMIN' ? 'Officer' : 'Student'}
                  </span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant hidden lg:block">
                  expand_more
                </span>
              </button>

              {profileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-surface-container-lowest border border-border-default rounded-xl shadow-xl py-2 z-50 text-left animate-in fade-in zoom-in-95 duration-100"
                  onMouseLeave={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-4 py-3 border-b border-border-default">
                    <p className="font-semibold text-primary text-sm truncate">{user.fullName}</p>
                    <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-surface-container text-primary font-label-caps text-label-caps rounded uppercase tracking-wider font-semibold text-[10px]">
                      {user.role}
                    </span>
                  </div>

                  <div className="py-1">
                    <Link
                      to={getDashboardPath()}
                      className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
                      {getDashboardLabel()}
                    </Link>

                    <Link
                      to="/clubs"
                      className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <span className="material-symbols-outlined text-[18px]">groups</span>
                      Campus Clubs
                    </Link>

                    <Link
                      to="/events"
                      className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                      Campus Calendar
                    </Link>
                  </div>

                  <div className="border-t border-border-default my-1"></div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      logout();
                      navigate('/');
                    }}
                    className="w-full text-left px-4 py-2 text-xs sm:text-sm text-on-surface hover:bg-surface-container transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Link
                to="/login"
                className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg bg-surface-container text-primary text-xs font-semibold flex items-center justify-center hover:bg-surface-container-high transition-colors border border-border-default"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-lg bg-accent text-on-accent text-xs font-semibold flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity"
              >
                Join
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer / Slide-Down Menu */}
      {mobileMenuOpen && (
        <div id="campusconnect-mobile-menu" className="lg:hidden border-t border-border-default bg-surface/98 backdrop-blur-xl px-4 py-4 flex flex-col gap-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <nav aria-label="Mobile navigation" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Link
              to="/"
              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-medium border text-center transition-colors ${
                location.pathname === '/'
                  ? 'bg-accent text-on-accent border-accent font-semibold'
                  : 'bg-surface-container-low text-on-surface border-border-default hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] mb-0.5">explore</span>
              Discover
            </Link>

            <Link
              to="/clubs"
              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-medium border text-center transition-colors ${
                location.pathname === '/clubs'
                  ? 'bg-accent text-on-accent border-accent font-semibold'
                  : 'bg-surface-container-low text-on-surface border-border-default hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] mb-0.5">groups</span>
              Clubs
            </Link>

            <Link
              to="/events"
              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-medium border text-center transition-colors ${
                location.pathname === '/events'
                  ? 'bg-accent text-on-accent border-accent font-semibold'
                  : 'bg-surface-container-low text-on-surface border-border-default hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-[20px] mb-0.5">calendar_today</span>
              Events
            </Link>

            <Link
              to="/#public-bulletins"
              className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-xs font-medium border text-center transition-colors ${
                location.pathname === '/' && location.hash === '#public-bulletins'
                  ? 'bg-accent text-on-accent border-accent font-semibold'
                  : 'bg-surface-container-low text-on-surface border-border-default hover:bg-surface-container'
              }`}
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="material-symbols-outlined text-[20px] mb-0.5">campaign</span>
              Bulletins
            </Link>
          </nav>

          {isAuthenticated && user ? (
            <div className="pt-2 border-t border-border-default flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-primary truncate max-w-[200px]">
                    {user.fullName}
                  </span>
                  <span className="text-[10px] text-on-surface-variant truncate">
                    {user.email}
                  </span>
                </div>
                <span className="px-2 py-0.5 bg-surface-container text-primary font-label-caps text-label-caps rounded uppercase font-semibold text-[10px]">
                  {user.role}
                </span>
              </div>

              <Link
                to={getDashboardPath()}
                className="h-10 px-3 rounded-xl bg-accent text-on-accent text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
                <span>Open {getDashboardLabel()}</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="h-9 px-3 rounded-xl bg-surface-container text-on-surface text-xs font-semibold flex items-center justify-center gap-1.5 border border-border-default hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-border-default grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="h-10 rounded-xl bg-surface-container text-primary text-xs font-semibold flex items-center justify-center border border-border-default hover:bg-surface-container-high transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="h-10 rounded-xl bg-accent text-on-accent text-xs font-semibold flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
