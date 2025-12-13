import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recipeId = searchParams.get('id');
    const title = searchParams.get('title') || 'Recette';
    const type = searchParams.get('type') || 'Recette';
    const imageUrl = searchParams.get('image') || '';

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
            backgroundColor: '#FFF9F5',
            backgroundImage: imageUrl
              ? `url(${imageUrl})`
              : 'linear-gradient(135deg, #8B4513 0%, #CD853F 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            position: 'relative',
          }}
        >
          {/* Overlay pour améliorer la lisibilité */}
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

          {/* Contenu */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px',
              zIndex: 1,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: '#FFFFFF',
                marginBottom: 20,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              {type}
            </div>
            <div
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: '#FFFFFF',
                marginBottom: 30,
                lineHeight: 1.2,
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                maxWidth: '900px',
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 500,
                color: '#FFFFFF',
                opacity: 0.9,
                textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
              }}
            >
              Cuisine Artisanale
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
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

