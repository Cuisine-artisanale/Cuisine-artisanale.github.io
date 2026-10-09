import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Pages profil (?id=…) : utiles aux visiteurs mais pas à l'index Google
export const metadata: Metadata = {
	title: 'Profil',
	robots: { index: false, follow: true },
};

export default function ProfilLayout({ children }: { children: ReactNode }) {
	return children;
}
