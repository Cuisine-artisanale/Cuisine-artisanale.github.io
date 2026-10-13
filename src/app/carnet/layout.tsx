import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Page privée : jamais indexée
export const metadata: Metadata = {
	title: 'Mon carnet',
	robots: { index: false, follow: false },
};

export default function CarnetLayout({ children }: { children: ReactNode }) {
	return children;
}
