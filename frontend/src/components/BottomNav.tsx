import React from 'react';
import { NavLink } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  return (
    <nav className="relative w-full flex-shrink-0 bg-surface border-t border-border-default shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
      <div className="flex justify-around items-stretch h-16 max-w-lg mx-auto sm:max-w-xl md:max-w-2xl">
        {/* Tab 1: Clubs */}
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-[44px] ${
              isActive
                ? 'text-primary font-semibold border-t-2 border-primary'
                : 'text-secondary hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">groups</span>
          <span className="font-label-sm text-label-sm text-[11px]">Clubs</span>
        </NavLink>

        {/* Tab 2: Events */}
        <NavLink
          to="/events"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-[44px] ${
              isActive
                ? 'text-primary font-semibold border-t-2 border-primary'
                : 'text-secondary hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">calendar_today</span>
          <span className="font-label-sm text-label-sm text-[11px]">Events</span>
        </NavLink>

        {/* Tab 3: Approvals (Club Admin Hub) */}
        <NavLink
          to="/club-admin"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-[44px] ${
              isActive
                ? 'text-primary font-semibold border-t-2 border-primary'
                : 'text-secondary hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">verified</span>
          <span className="font-label-sm text-label-sm text-[11px]">Approvals</span>
        </NavLink>

        {/* Tab 4: Finance / Super Admin Portal */}
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-[44px] ${
              isActive
                ? 'text-primary font-semibold border-t-2 border-primary'
                : 'text-secondary hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">account_balance_wallet</span>
          <span className="font-label-sm text-label-sm text-[11px]">Finance</span>
        </NavLink>

        {/* Tab 5: Portal / Student */}
        <NavLink
          to="/student"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-w-[44px] ${
              isActive
                ? 'text-primary font-semibold border-t-2 border-primary'
                : 'text-secondary hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined text-[22px]">dashboard</span>
          <span className="font-label-sm text-label-sm text-[11px]">Portal</span>
        </NavLink>
      </div>
    </nav>
  );
};
