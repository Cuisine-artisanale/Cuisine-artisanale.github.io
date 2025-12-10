"use client";
import React, { useState, useRef } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '@firebaseModule';
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
      await sendEmailVerification(auth.currentUser);
      toastRef.current?.show({
        severity: 'success',
        summary: 'Email envoyé',
        detail: 'Un nouvel email de vérification a été envoyé.',
        life: 5000
      });
    } catch (error: any) {
      console.error('Resend verification email error:', error);
      let errorMessage = 'Une erreur est survenue lors de l\'envoi de l\'email';

      if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Trop de demandes. Veuillez réessayer dans quelques minutes.';
      } else if (error.code === 'auth/user-not-found') {
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
