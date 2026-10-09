import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/config/firebase-admin';
import { sendEmail } from '@/lib/services/emailService';

const FRONTEND_URL =
  process.env.NEXT_PUBLIC_FRONTEND_URL ||
  process.env.FRONTEND_URL ||
  'https://www.cuisine-artisanale.fr';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getResetEmailHtml(resetUrl: string) {
  return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #f5f5f5;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #8B4513, #CD853F);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              padding: 40px 30px;
            }
            .content p {
              font-size: 16px;
              line-height: 1.6;
              color: #333;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              background-color: #8B4513;
              color: white;
              padding: 15px 40px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              font-size: 16px;
              margin: 20px 0;
            }
            .button:hover {
              background-color: #CD853F;
            }
            .footer {
              background-color: #f9f9f9;
              padding: 20px;
              text-align: center;
              font-size: 14px;
              color: #666;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Réinitialisation de mot de passe</h1>
            </div>
            <div class="content">
              <p>Bonjour,</p>
              <p>Vous avez demandé à réinitialiser votre mot de passe sur <strong>Cuisine Artisanale</strong>.</p>
              <p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
              <center>
                <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
              </center>
              <div class="warning">
                <p style="margin: 0; font-size: 14px;">
                  ⚠️ <strong>Important :</strong> Ce lien est valable pendant <strong>1 heure</strong> uniquement.
                </p>
              </div>
              <p style="font-size: 14px; color: #666;">
                Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe ne sera pas modifié.
              </p>
            </div>
            <div class="footer">
              <p>© 2025 Cuisine Artisanale. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `;
}

/**
 * Envoie un email de réinitialisation de mot de passe.
 *
 * Le client n'envoie que l'adresse email : le lien est généré côté serveur
 * par Firebase Admin (code à usage unique, expiration gérée par Firebase),
 * puis pointé vers notre page /reset-password.
 * La réponse est identique que le compte existe ou non (pas d'énumération).
 */
export async function POST(request: NextRequest) {
  let email: unknown;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Requête invalide' }, { status: 400 });
  }

  if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return NextResponse.json({ success: false, error: 'Email invalide' }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const firebaseLink = await getFirebaseAdminAuth().generatePasswordResetLink(normalizedEmail, {
      url: `${FRONTEND_URL}/login`,
    });

    const oobCode = new URL(firebaseLink).searchParams.get('oobCode');
    if (!oobCode) {
      throw new Error('oobCode absent du lien généré');
    }

    const resetUrl = `${FRONTEND_URL}/reset-password?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`;

    const result = await sendEmail({
      to: normalizedEmail,
      subject: 'Réinitialisez votre mot de passe - Cuisine Artisanale',
      html: getResetEmailHtml(resetUrl),
      from: process.env.RESEND_FROM_EMAIL || 'a.sabatier@cuisine-artisanale.fr',
    });

    if (!result.success) {
      console.error('Erreur Resend (reset password):', result.error);
      return NextResponse.json({ success: false, error: "Erreur lors de l'envoi de l'email" }, { status: 500 });
    }
  } catch (error: any) {
    if (error?.code === 'auth/user-not-found' || error?.code === 'auth/email-not-found') {
      // Ne pas révéler si le compte existe
      return NextResponse.json({ success: true });
    }
    console.error('Erreur send-reset-email:', error);
    return NextResponse.json({ success: false, error: "Erreur lors de l'envoi de l'email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
