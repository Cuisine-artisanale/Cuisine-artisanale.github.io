import React, { createContext, useContext, useRef } from 'react';
import { Toast } from 'primereact/toast';
import { showToast } from '@/lib/utils/toast';

interface ToastContextType {
  showToast: (options: {
	severity: 'success' | 'info' | 'warn' | 'error';
	summary: string;
	detail: string;
	life?: number;
  }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useRef<Toast>(null);

  const showGlobalToast = (options: {
	severity: 'success' | 'info' | 'warn' | 'error';
	summary: string;
	detail: string;
	life?: number;
  }) => {
	showToast(toast, options);
  };

  return (
	<ToastContext.Provider value={{ showToast: showGlobalToast }}>
	  {children}
	  <Toast ref={toast} />
	</ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
	throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};