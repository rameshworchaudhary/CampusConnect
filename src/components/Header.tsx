import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
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
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

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
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/90 backdrop-blur-xl border-b border-border-default">
      <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Logo & View Subtitle */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[20px]">school</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps text-primary tracking-wider uppercase font-bold text-[11px]">
                CampusConnect
              </span>
              <span className="font-headline-sm text-headline-sm text-on-surface leading-none font-semibold text-sm sm:text-base">
                {subtitle}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-border-default">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-surface-container-high text-primary font-semibold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`
              }
            >
              Discover
            </NavLink>
            <NavLink
              to="/clubs"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-surface-container-high text-primary font-semibold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`
              }
            >
              Clubs
            </NavLink>
            <NavLink
              to="/events"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-surface-container-high text-primary font-semibold'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`
              }
            >
              Events
            </NavLink>
            {isAuthenticated && (
              <NavLink
                to={getDashboardPath()}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-on-primary font-semibold'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                  }`
                }
              >
                {getDashboardLabel()}
              </NavLink>
            )}
          </nav>
        </div>

        {/* Right: Notifications & Profile Avatar */}
        <div className="flex items-center gap-2 sm:gap-3 relative">
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
            className="w-10 h-10 flex items-center justify-center relative rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-surface"></span>
            )}
          </button>

          {isAuthenticated && user ? (
            <div className="relative">
              <button
                type="button"
                aria-label="User profile menu"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2 p-1 rounded-lg hover:bg-surface-container transition-colors focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-label-caps text-label-caps flex items-center justify-center font-bold shadow-sm">
                  {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-primary truncate max-w-[120px]">
                    {user.fullName}
                  </span>
                  <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                    {user.role === 'SUPER_ADMIN' ? 'Admin' : user.role === 'CLUB_ADMIN' ? 'Officer' : 'Student'}
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
                      className="flex items-center gap-2 px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <span className="material-symbols-outlined text-[18px]">space_dashboard</span>
                      {getDashboardLabel()}
                    </Link>

                    <Link
                      to="/clubs"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <span className="material-symbols-outlined text-[18px]">groups</span>
                      Campus Clubs
                    </Link>

                    <Link
                      to="/events"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors"
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
                    className="w-full text-left px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-1">
              <Link
                to="/login"
                className="h-9 px-3.5 rounded-lg bg-surface-container text-primary text-xs sm:text-sm font-semibold flex items-center justify-center hover:bg-surface-container-high transition-colors border border-border-default"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="h-9 px-3.5 rounded-lg bg-primary text-on-primary text-xs sm:text-sm font-semibold flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity"
              >
                Join
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
