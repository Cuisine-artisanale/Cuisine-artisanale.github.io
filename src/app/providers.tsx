'use client';

import { ReactNode } from 'react';
import { PrimeReactProvider } from 'primereact/api';
import { ThemeProvider } from '@/contexts/ThemeContext/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext/ToastContext';

import "primereact/resources/themes/lara-light-indigo/theme.css";
import 'primereact/resources/primereact.min.css';

type ProvidersProps = {
	children: ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
	return (
		<PrimeReactProvider>
			<ThemeProvider>
				<AuthProvider>
					<ToastProvider>
						{children}
					</ToastProvider>
				</AuthProvider>
			</ThemeProvider>
		</PrimeReactProvider>
	);
}


