import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  subtitle?: string;
  onSearchClick?: () => void;
  onMenuClick?: () => void;
  menuContent?: React.ReactNode;
  menuRef?: React.RefObject<HTMLDivElement | null>;
}

export const Header: React.FC<HeaderProps> = ({
  subtitle = 'Club Directory',
  onSearchClick,
  onMenuClick,
  menuContent,
  menuRef,
}) => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-border-default">
      <div className="h-16 px-gutter flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Brand & View Subtitle */}
        <div className="flex items-center gap-space-sm">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-label={menuContent ? 'Open admin actions' : 'Open navigation menu'}
              aria-haspopup={menuContent ? 'menu' : undefined}
              onClick={onMenuClick}
              className="w-10 h-10 flex items-center justify-center rounded-DEFAULT text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-[24px]">
                {menuContent ? 'more_vert' : 'menu'}
              </span>
            </button>
            {menuContent}
          </div>

          <Link to="/" className="flex items-center gap-2 group">
            {/* Academic Monolith Stylized Cap Logo */}
            <div className="w-8 h-8 rounded-DEFAULT bg-primary flex items-center justify-center text-on-primary">
              <span className="material-symbols-outlined text-[20px]">school</span>
            </div>
            <div className="flex flex-col ml-space-xs">
              <span className="font-headline-sm text-headline-sm text-primary tracking-tight leading-none group-hover:underline">
                CampusConnect
              </span>
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary leading-tight mt-0.5">
                {subtitle}
              </span>
            </div>
          </Link>
        </div>

        {/* Right: Actions & User Avatar */}
        <div className="flex items-center gap-space-xs relative">
          <button
            type="button"
            aria-label="Search clubs and events"
            onClick={onSearchClick}
            className="w-10 h-10 flex items-center justify-center rounded-DEFAULT text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[22px]">search</span>
          </button>

          {isAuthenticated && user ? (
            <div className="relative">
              <button
                type="button"
                aria-label="User profile menu"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="w-9 h-9 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity focus:outline-none"
              >
                <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </button>

              {profileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-56 bg-surface-container-lowest border-2 border-black rounded-lg shadow-lg py-2 z-50 text-left"
                  onMouseLeave={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-border-subtle">
                    <p className="font-label-md text-primary font-semibold truncate">{user.fullName}</p>
                    <p className="font-body-sm text-secondary truncate">{user.email}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-surface-container text-primary font-label-sm rounded uppercase tracking-wider text-[10px] font-semibold">
                      {user.role}
                    </span>
                  </div>

                  {user.role === 'SUPER_ADMIN' && (
                    <Link
                      to="/admin"
                      className="block px-4 py-2 font-body-md text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      Super Admin Portal
                    </Link>
                  )}

                  {user.role === 'CLUB_ADMIN' && (
                    <Link
                      to="/club-admin"
                      className="block px-4 py-2 font-body-md text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      Approvals Hub
                    </Link>
                  )}

                  {user.role === 'STUDENT' && (
                    <Link
                      to="/student"
                      className="block px-4 py-2 font-body-md text-on-surface hover:bg-surface-container transition-colors"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      Student Dashboard
                    </Link>
                  )}

                  <div className="border-t border-border-subtle my-1"></div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      logout();
                      navigate('/');
                    }}
                    className="w-full text-left px-4 py-2 font-body-md text-on-surface hover:bg-surface-container transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="h-8 px-3 bg-surface-container-lowest text-primary border border-border-default rounded font-label-sm flex items-center justify-center hover:bg-surface-container transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="h-8 px-3 bg-primary text-on-primary rounded font-label-sm flex items-center justify-center hover:bg-neutral-800 transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
