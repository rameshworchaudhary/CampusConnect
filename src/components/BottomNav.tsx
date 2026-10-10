import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const BottomNav: React.FC = () => {
  const { user, isAuthenticated } = useAuth();

  const getDashboardPath = () => {
    if (!isAuthenticated || !user) return '/login';
    if (user.role === 'SUPER_ADMIN') return '/admin';
    if (user.role === 'CLUB_ADMIN') return '/club-admin';
    return '/student';
  };

  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-surface/90 backdrop-blur-xl border-t border-border-default md:hidden">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {/* Tab 1: Discover */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors ${
              isActive
                ? 'text-primary font-label-md font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">explore</span>
          <span className="font-label-sm text-label-sm tracking-tight">Discover</span>
        </NavLink>

        {/* Tab 2: Clubs */}
        <NavLink
          to="/clubs"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors ${
              isActive
                ? 'text-primary font-label-md font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">groups</span>
          <span className="font-label-sm text-label-sm tracking-tight">Clubs</span>
        </NavLink>

        {/* Tab 3: Events */}
        <NavLink
          to="/events"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors ${
              isActive
                ? 'text-primary font-label-md font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">calendar_today</span>
          <span className="font-label-sm text-label-sm tracking-tight">Events</span>
        </NavLink>

        {/* Tab 4: Dashboard */}
        <NavLink
          to={getDashboardPath()}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors ${
              isActive
                ? 'text-primary font-label-md font-semibold'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">space_dashboard</span>
          <span className="font-label-sm text-label-sm tracking-tight">Dashboard</span>
        </NavLink>
      </div>
    </nav>
  );
};
