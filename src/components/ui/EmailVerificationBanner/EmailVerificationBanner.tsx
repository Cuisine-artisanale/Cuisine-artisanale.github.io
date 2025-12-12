"use client";
import React, { useState, useRef } from 'react';
import { auth } from '@/lib/config/firebase';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import './EmailVerificationBanner.css';

interface EmailVerificationBannerProps {
  email: string;
}

const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({ email }) => {
  const [isLoading, setIsLoading] = useState(false);
  const toastRef = useRef<Toast>(null);

  const handleResendEmail = async () => {
    if (!auth.currentUser) return;

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
          email: auth.currentUser.email || '',
          displayName: auth.currentUser.displayName || 'Utilisateur',
          uid: auth.currentUser.uid, // Passer l'UID pour vérifier l'existence de l'utilisateur
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erreur lors de l\'envoi de l\'email');
      }

      toastRef.current?.show({
        severity: 'success',
        summary: 'Email envoyé',
        detail: 'Un nouvel email de vérification a été envoyé instantanément.',
        life: 5000
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

  return (
    <>
      <Toast ref={toastRef} />
      <div className="email-verification-banner">
        <div className="banner-content">
          <i className="pi pi-info-circle" />
          <div className="banner-text">
            <strong>Email non vérifié</strong>
            <p>
              Un email de vérification a été envoyé à <strong>{email}</strong>.
              Veuillez vérifier votre boîte mail et vos spams.
            </p>
          </div>
          <Button
            label="Renvoyer l'email"
            icon="pi pi-send"
            className="p-button-sm"
            onClick={handleResendEmail}
            loading={isLoading}
          />
        </div>
      </div>
    </>
  );
};

export default EmailVerificationBanner;
