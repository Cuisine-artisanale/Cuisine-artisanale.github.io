"use client";
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@firebaseModule';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { verifyEmailToken } from '@/services/emailService';
import './verify-email.css';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toastRef = useRef<Toast>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    // Si un token est présent dans l'URL, vérifier automatiquement
    if (token) {
      handleTokenVerification(token);
    } else {
      // Sinon, vérifier si l'utilisateur est connecté
      const currentUser = auth.currentUser;
      if (!currentUser) {
        router.push('/login');
        return;
      }
      setEmail(currentUser.email || '');

      // Si déjà vérifié, rediriger
      if (currentUser.emailVerified) {
        router.push('/account');
      }
    }
  }, [searchParams, router]);

  const handleTokenVerification = async (token: string) => {
    setIsVerifying(true);
    setError('');

    try {
      const userId = await verifyEmailToken(token);

      if (!userId) {
        setError('Le lien de vérification est invalide ou a expiré. Veuillez demander un nouvel email.');
        return;
      }

      // Rafraîchir l'utilisateur Firebase pour mettre à jour emailVerified
      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.reload();
      }

      setVerified(true);
      toastRef.current?.show({
        severity: 'success',
        summary: 'Email vérifié !',
        detail: 'Votre email a été vérifié avec succès. Redirection...',
        life: 3000
      });

      setTimeout(() => {
        router.push('/account');
      }, 2000);
    } catch (error) {
      console.error('Error verifying token:', error);
      setError('Une erreur est survenue lors de la vérification. Veuillez réessayer.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendEmail = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.push('/login');
      return;
    }

    try {
      setIsLoading(true);
      const { sendVerificationEmail } = await import('@/services/emailService');
      await sendVerificationEmail(
        currentUser.email || '',
        currentUser.displayName || 'Utilisateur',
        currentUser.uid
      );

      toastRef.current?.show({
        severity: 'success',
        summary: 'Email envoyé',
        detail: 'Un nouvel email de vérification a été envoyé instantanément. Vérifiez votre boîte mail.',
        life: 6000
      });
    } catch (error: any) {
      console.error('Resend verification email error:', error);
      toastRef.current?.show({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Une erreur est survenue lors de l\'envoi de l\'email',
        life: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    router.push('/login');
  };

  // Si en train de vérifier le token
  if (isVerifying) {
    return (
      <div className="verify-email-page">
        <Toast ref={toastRef} />
        <div className="verify-email-container">
          <div className="verify-email-card">
            <div className="verify-email-header">
              <i className="pi pi-spin pi-spinner" style={{ fontSize: '3rem' }} />
              <h1>Vérification en cours...</h1>
              <p>Veuillez patienter pendant que nous vérifions votre email.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si vérifié avec succès
  if (verified) {
    return (
      <div className="verify-email-page">
        <Toast ref={toastRef} />
        <div className="verify-email-container">
          <div className="verify-email-card">
            <div className="verify-email-header success">
              <i className="pi pi-check-circle" style={{ fontSize: '3rem', color: 'var(--success-500)' }} />
              <h1>Email vérifié !</h1>
              <p>Votre email a été vérifié avec succès. Redirection...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si erreur de vérification
  if (error) {
    return (
      <div className="verify-email-page">
        <Toast ref={toastRef} />
        <div className="verify-email-container">
          <div className="verify-email-card">
            <div className="verify-email-header error">
              <i className="pi pi-times-circle" style={{ fontSize: '3rem', color: 'var(--danger-500)' }} />
              <h1>Erreur de vérification</h1>
              <p className="error-message">{error}</p>
            </div>

            <div className="verify-email-actions">
              <Button
                label="Renvoyer un email de vérification"
                icon="pi pi-send"
                className="resend-button"
                onClick={handleResendEmail}
                loading={isLoading}
              />

              <Button
                label="Retour à la connexion"
                icon="pi pi-arrow-left"
                className="p-button-text"
                onClick={handleLogout}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Page par défaut (en attente de vérification)
  return (
    <div className="verify-email-page">
      <Toast ref={toastRef} />
      <div className="verify-email-container">
        <div className="verify-email-card">
          <div className="verify-email-header">
            <i className="pi pi-envelope" />
            <h1>Vérifiez votre email</h1>
            <p>
              Un email de vérification a été envoyé à <strong>{email}</strong>
            </p>
          </div>

          <div className="verify-email-instructions">
            <h3>Comment vérifier votre email :</h3>
            <ol>
              <li>Ouvrez votre boîte mail</li>
              <li>Cherchez l'email de <strong>Cuisine Artisanale</strong> (vérifiez aussi vos spams)</li>
              <li>Cliquez sur le bouton "Vérifier mon email" dans l'email</li>
              <li>Vous serez automatiquement redirigé</li>
            </ol>
          </div>

          <div className="verify-email-actions">
            <Button
              label="Renvoyer l'email"
              icon="pi pi-send"
              className="resend-button"
              onClick={handleResendEmail}
              loading={isLoading}
            />

            <Button
              label="Se déconnecter"
              icon="pi pi-sign-out"
              className="p-button-text logout-button"
              onClick={handleLogout}
            />
          </div>

          <div className="verify-email-help">
            <p className="help-text">
              <i className="pi pi-info-circle" /> L'email devrait arriver en quelques secondes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmail() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
