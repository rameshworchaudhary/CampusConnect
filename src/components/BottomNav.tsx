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

  const getDashboardLabel = () => {
    if (!isAuthenticated) return 'Sign In';
    if (user?.role === 'SUPER_ADMIN') return 'Admin';
    if (user?.role === 'CLUB_ADMIN') return 'Portal';
    return 'Workspace';
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 pb-safe bg-surface/95 backdrop-blur-xl border-t border-border-default md:hidden transition-all">
      <div className="flex items-center justify-around h-16 px-1 max-w-md mx-auto">
        {/* Tab 1: Home / Discover */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full min-h-[44px] gap-1 transition-colors select-none ${
              isActive
                ? 'bg-accent text-on-accent font-semibold rounded-lg mx-1 my-1'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <span className="material-symbols-outlined text-[20px]">explore</span>
          <span className="text-[11px] font-medium leading-none">Discover</span>
        </NavLink>

        {/* Tab 2: Clubs */}
        <NavLink
          to="/clubs"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full min-h-[44px] gap-1 transition-colors select-none ${
              isActive
                ? 'bg-accent text-on-accent font-semibold rounded-lg mx-1 my-1'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <span className="material-symbols-outlined text-[20px]">groups</span>
          <span className="text-[11px] font-medium leading-none">Clubs</span>
        </NavLink>

        {/* Tab 3: Events */}
        <NavLink
          to="/events"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full min-h-[44px] gap-1 transition-colors select-none ${
              isActive
                ? 'bg-accent text-on-accent font-semibold rounded-lg mx-1 my-1'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <span className="material-symbols-outlined text-[20px]">calendar_today</span>
          <span className="text-[11px] font-medium leading-none">Events</span>
        </NavLink>

        {/* Tab 4: Workspace / Account */}
        <NavLink
          to={getDashboardPath()}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 h-full min-h-[44px] gap-1 transition-colors select-none ${
              isActive
                ? 'bg-accent text-on-accent font-semibold rounded-lg mx-1 my-1'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          <span className="material-symbols-outlined text-[20px]">
            {isAuthenticated ? 'space_dashboard' : 'account_circle'}
          </span>
          <span className="text-[11px] font-medium leading-none">{getDashboardLabel()}</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNav;
