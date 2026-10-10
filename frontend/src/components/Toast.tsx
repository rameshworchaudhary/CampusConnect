import React, { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto bg-primary text-on-primary p-space-sm rounded-lg shadow-xl flex items-center justify-between z-50 transition-all border border-neutral-800">
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <span className="material-symbols-outlined text-[20px] text-on-primary shrink-0">check_circle</span>
        <span className="font-body-md text-body-md text-on-primary truncate">{message}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-on-primary hover:text-surface-container-high transition-colors p-1"
        aria-label="Close notification"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
};
