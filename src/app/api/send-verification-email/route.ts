import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const { email, displayName, verificationUrl } = await request.json();

    // Initialize Resend only when the route is called (not at module level)
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: 'Cuisine Artisanale <onboarding@resend.dev>', // Remplace par ton domaine vérifié
      to: [email],
      subject: 'Vérifiez votre email - Cuisine Artisanale',
      html: `
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
              <h1>✉️ Vérification de votre email</h1>
            </div>
            <div class="content">
              <p>Bonjour <strong>${displayName}</strong>,</p>
              <p>Merci de vous être inscrit sur <strong>Cuisine Artisanale</strong> !</p>
              <p>Pour finaliser votre inscription, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
              <center>
                <a href="${verificationUrl}" class="button">Vérifier mon email</a>
              </center>
              <div class="warning">
                <p style="margin: 0; font-size: 14px;">
                  ⚠️ <strong>Important :</strong> Ce lien est valable pendant <strong>24 heures</strong> uniquement.
                </p>
              </div>
              <p style="font-size: 14px; color: #666;">
                Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
              </p>
            </div>
            <div class="footer">
              <p>© 2025 Cuisine Artisanale. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error sending verification email:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi de l\'email' },
      { status: 500 }
    );
  }
}
