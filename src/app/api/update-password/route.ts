import { NextRequest, NextResponse } from 'next/server';

// Note: Cette API route ne fait que valider la requête
// Le vrai changement de mot de passe doit être fait côté client avec Firebase Auth
// car Firebase nécessite que l'utilisateur soit authentifié pour changer son mot de passe

export async function POST(request: NextRequest) {
  try {
    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    // L'utilisateur devra se connecter avec son nouvel email et mot de passe
    // Le changement sera effectué via Firebase Auth côté client
    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error('Error updating password:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du mot de passe' },
      { status: 500 }
    );
  }
}
