import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  headerActions?: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children, className, size = 'md', headerActions }: ModalProps) {
  React.useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl'
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="modal-wrapper" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cn(
              "relative z-10 bg-white w-full rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200",
              sizeClasses[size] || sizeClasses.md,
              className
            )}
          >
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">{title}</h3>
              <div className="flex items-center gap-2">
                {headerActions}
                <button 
                  onClick={onClose} 
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
