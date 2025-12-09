"use client";
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@firebaseModule';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import './ResetPasswordPage.css';

const ResetPasswordPage: React.FC = () => {
  const router = useRouter();
  const toastRef = useRef<Toast>(null);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('L\'email est requis');
      return;
    }

    if (!validateEmail(email)) {
      setError('Email invalide');
      return;
    }

    try {
      setIsLoading(true);
      // Utiliser EmailJS au lieu de Firebase
      const { sendPasswordResetEmailCustom } = await import('@/services/emailService');
      await sendPasswordResetEmailCustom(email);
      setEmailSent(true);
      toastRef.current?.show({
        severity: 'success',
        summary: 'Email envoyé',
        detail: 'Un email de réinitialisation a été envoyé instantanément à votre adresse.',
        life: 5000
      });
    } catch (error: any) {
      console.error('Reset password error:', error);
      let errorMessage = 'Une erreur est survenue lors de l\'envoi de l\'email';

      setError(errorMessage);
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

  const handleBackToLogin = () => {
    router.push('/login');
  };

  return (
    <div className="reset-password-page">
      <Toast ref={toastRef} />
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="reset-password-header">
            <i className="pi pi-lock" />
            <h1>Réinitialiser le mot de passe</h1>
            {!emailSent && (
              <p>
                Entrez votre adresse email et nous vous enverrons un lien pour
                réinitialiser votre mot de passe.
              </p>
            )}
          </div>

          {emailSent ? (
            <div className="success-message">
              <i className="pi pi-check-circle" />
              <h2>Email envoyé !</h2>
              <p>
                Nous avons envoyé un email à <strong>{email}</strong> avec un
                lien pour réinitialiser votre mot de passe.
              </p>
              <p className="info-text">
                Vérifiez votre boîte de réception et vos spams. Le lien expire
                dans 1 heure.
              </p>
              <Button
                label="Retour à la connexion"
                icon="pi pi-arrow-left"
                className="back-button"
                onClick={handleBackToLogin}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="reset-password-form">
              <div className="form-field">
                <label htmlFor="email">
                  <i className="pi pi-envelope" /> Adresse email
                </label>
                <InputText
                  id="email"
                  type="email"
                  placeholder="exemple@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={error ? 'p-invalid' : ''}
                  autoComplete="email"
                  autoFocus
                />
                {error && <small className="p-error">{error}</small>}
              </div>

              <Button
                type="submit"
                label="Envoyer le lien de réinitialisation"
                className="submit-button"
                disabled={isLoading}
                loading={isLoading}
              />

              <div className="form-footer">
                <Button
                  label="Retour à la connexion"
                  icon="pi pi-arrow-left"
                  className="p-button-text"
                  onClick={handleBackToLogin}
                  type="button"
                />
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
