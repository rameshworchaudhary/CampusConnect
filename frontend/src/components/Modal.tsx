import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 40% Opacity #111111 Backdrop Wash (No Blur) */}
      <div
        className="fixed inset-0 bg-[#111111]/40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Card: Pure #FFFFFF with 2px solid #000000 Border */}
      <div
        className={`relative w-full ${maxWidth} bg-surface-container-lowest border-2 border-primary rounded-lg shadow-2xl p-space-md z-10 flex flex-col gap-space-sm max-h-[90vh] overflow-y-auto`}
      >
        <div className="flex items-center justify-between pb-space-xs border-b border-border-subtle">
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-secondary hover:text-primary hover:bg-surface-container transition-colors"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="py-2">{children}</div>
      </div>
    </div>
  );
};
