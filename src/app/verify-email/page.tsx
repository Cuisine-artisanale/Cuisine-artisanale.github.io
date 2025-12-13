"use client";
import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { auth } from '@/lib/config/firebase';
import { applyActionCode } from 'firebase/auth';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import './verify-email.css';
import { useAuth } from '@/contexts/AuthContext/AuthContext';


function VerifyEmailContent() {
const { logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toastRef = useRef<Toast>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    // Vérifier si un code Firebase (oobCode) est présent dans l'URL
    const oobCode = searchParams.get('oobCode');
    const mode = searchParams.get('mode');

    // Si un code Firebase est présent, vérifier automatiquement
    if (oobCode && mode === 'verifyEmail') {
      handleFirebaseVerification(oobCode);
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

  const handleFirebaseVerification = async (oobCode: string) => {
    setIsVerifying(true);
    setError('');

    try {
      // Appliquer le code de vérification Firebase
      await applyActionCode(auth, oobCode);

      // Rafraîchir l'utilisateur Firebase pour mettre à jour emailVerified
      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.reload();
        setEmail(currentUser.email || '');
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
    } catch (error: any) {
      console.error('Error verifying email:', error);
      let errorMessage = 'Une erreur est survenue lors de la vérification. Veuillez réessayer.';

      if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'Le lien de vérification est invalide ou a expiré. Veuillez demander un nouvel email.';
      } else if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Le lien de vérification a expiré. Veuillez demander un nouvel email.';
      }

      setError(errorMessage);
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
      // Utiliser la Cloud Function avec Resend (rapide et fiable)
      const cloudFunctionUrl = 'https://us-central1-recettes-cuisine-a1bf2.cloudfunctions.net/sendVerificationEmailFast';
      const response = await fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: currentUser.email || '',
          displayName: currentUser.displayName || 'Utilisateur',
          uid: currentUser.uid, // Passer l'UID pour vérifier l'existence de l'utilisateur
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'envoi de l\'email');
      }

      toastRef.current?.show({
        severity: 'success',
        summary: 'Email envoyé',
        detail: 'Un nouvel email de vérification a été envoyé instantanément. Vérifiez votre boîte mail.',
        life: 6000
      });
    } catch (error: any) {
      console.error('Resend verification email error:', error);
      let errorMessage = 'Une erreur est survenue lors de l\'envoi de l\'email';

      if (error.message?.includes('Trop de demandes') || error.message?.includes('too-many-requests')) {
        errorMessage = 'Trop de demandes. Veuillez réessayer dans quelques minutes.';
      } else if (error.message?.includes('Utilisateur non trouvé') || error.message?.includes('user-not-found')) {
        errorMessage = 'Utilisateur non trouvé. Veuillez vous reconnecter.';
      }

      toastRef.current?.show({
        severity: 'error',
        summary: 'Erreur',
        detail: errorMessage,
        life: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
	logout();
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
              className="p-button logout-button"
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
