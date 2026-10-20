import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

/** Photos de recettes : Firebase Storage uniquement (comme images.remotePatterns dans next.config.ts). */
function isAllowedImage(src: string): boolean {
	try {
		const { protocol, hostname } = new URL(src);
		return protocol === 'https:' && hostname === 'firebasestorage.googleapis.com';
	} catch {
		return false;
	}
}

/**
 * Photo de fond prête à être dessinée : les photos du site sont en WebP, format que
 * le moteur de rendu (satori) ne lit pas. On la fait donc convertir en JPEG par
 * l'optimiseur d'images de Next, puis on l'intègre en data URI.
 * Renvoie '' en cas d'échec : l'image est alors générée sur fond uni.
 */
async function loadBackground(src: string, origin: string): Promise<string> {
	try {
		const response = await fetch(`${origin}/_next/image?url=${encodeURIComponent(src)}&w=1080&q=75`, {
			headers: { Accept: 'image/jpeg' },
		});
		const contentType = response.headers.get('content-type') || '';
		if (!response.ok || !['image/jpeg', 'image/png'].includes(contentType)) return '';

		const bytes = new Uint8Array(await response.arrayBuffer());
		let binary = '';
		for (let i = 0; i < bytes.length; i += 0x8000) {
			binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
		}
		return `data:${contentType};base64,${btoa(binary)}`;
	} catch {
		return '';
	}
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams, origin } = new URL(request.url);
		// Textes bornés, et image de fond uniquement depuis le stockage du site :
		// la route ne doit pas servir à charger ou habiller une image quelconque.
		const title = (searchParams.get('title') || 'Recette').slice(0, 120);
		const type = (searchParams.get('type') || 'Recette').slice(0, 40);
		const requestedImage = searchParams.get('image') || '';
		const imageUrl = isAllowedImage(requestedImage) ? await loadBackground(requestedImage, origin) : '';
		// format=pin : image verticale 2:3 pour Pinterest (1000 × 1500) au lieu du format Open Graph
		const isPin = searchParams.get('format') === 'pin';
		const width = isPin ? 1000 : 1200;
		const height = isPin ? 1500 : 630;
		// Épingle : photo en haut (recadrage modéré d'une photo au format paysage), texte sur un bandeau clair en dessous
		const photoHeight = isPin ? 960 : height;
		const textColor = isPin ? '#3B1F0B' : '#FFFFFF';
		const accentColor = isPin ? '#8B4513' : '#FFFFFF';
		const textShadow = isPin ? 'none' : '2px 2px 4px rgba(0,0,0,0.5)';

		return new ImageResponse(
			(
				<div
					style={{
						height: '100%',
						width: '100%',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: isPin ? 'flex-end' : 'center',
						backgroundColor: '#8B4513',
						backgroundImage: 'linear-gradient(135deg, #8B4513 0%, #CD853F 100%)',
						position: 'relative',
					}}
				>
					{imageUrl && (
						// eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
						<img
							src={imageUrl}
							width={width}
							height={photoHeight}
							style={{ position: 'absolute', top: 0, left: 0, objectFit: 'cover' }}
						/>
					)}

					{/* Open Graph : voile sombre pour la lisibilité du texte posé sur la photo */}
					{!isPin && (
						<div
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								right: 0,
								bottom: 0,
								backgroundColor: 'rgba(0, 0, 0, 0.4)',
							}}
						/>
					)}

					{/* Contenu */}
					<div
						style={{
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							justifyContent: 'center',
							padding: isPin ? '0 70px' : '60px',
							...(isPin && { width: '100%', height: height - photoHeight, backgroundColor: '#FFF9F5' }),
							zIndex: 1,
							textAlign: 'center',
						}}
					>
						<div
							style={{
								fontSize: isPin ? 36 : 24,
								fontWeight: 600,
								color: accentColor,
								marginBottom: 20,
								textTransform: 'uppercase',
								letterSpacing: 2,
							}}
						>
							{type}
						</div>
						<div
							style={{
								fontSize: isPin ? 88 : 64,
								fontWeight: 800,
								color: textColor,
								marginBottom: 30,
								lineHeight: 1.2,
								textShadow,
								maxWidth: '900px',
							}}
						>
							{title}
						</div>
						<div
							style={{
								fontSize: isPin ? 40 : 32,
								fontWeight: 500,
								color: accentColor,
								opacity: 0.9,
								textShadow: isPin ? 'none' : '1px 1px 2px rgba(0,0,0,0.5)',
							}}
						>
							Cuisine Artisanale
						</div>
					</div>
				</div>
			),
			{
				width,
				height,
			}
		);
	} catch (error) {
		console.error('Error generating OG image:', error);
		// Retourner une image par défaut en cas d'erreur
		return new ImageResponse(
			(
				<div
					style={{
						height: '100%',
						width: '100%',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: '#8B4513',
						color: '#FFFFFF',
						fontSize: 48,
						fontWeight: 800,
					}}
				>
					Cuisine Artisanale
				</div>
			),
			{
				width: 1200,
				height: 630,
			}
		);
	}
}

