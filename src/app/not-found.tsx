import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
	title: 'Page non trouvée | Cuisine Artisanale',
	description: 'La page que vous recherchez n\'existe pas.',
};

export default function NotFound() {
	return (
		<div style={{ padding: '2rem', textAlign: 'center', minHeight: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
			<h1>404 - Page non trouvée</h1>
			<p>La page que vous recherchez n'existe pas.</p>
			<Link href="/" style={{ marginTop: '1rem', color: 'var(--primary-color)', textDecoration: 'underline' }}>
				Retour à l'accueil
			</Link>
		</div>
	);
}

