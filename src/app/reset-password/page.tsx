"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Password } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { verifyPasswordResetToken } from '@/lib/services/email.service';
import './reset-password.css';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const tokenParam = searchParams.get('token');

    if (!tokenParam) {
      setError('Token manquant. Veuillez utiliser le lien de réinitialisation envoyé par email.');
      setIsVerifying(false);
      return;
    }

    setToken(tokenParam);
    verifyToken(tokenParam);
  }, [searchParams]);

  const verifyToken = async (tokenValue: string) => {
    try {
      const userEmail = await verifyPasswordResetToken(tokenValue);

      if (!userEmail) {
        setError('Le lien de réinitialisation est invalide ou a expiré. Veuillez demander un nouveau lien.');
        setIsValid(false);
      } else {
        setEmail(userEmail);
        setIsValid(true);
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      setError('Une erreur est survenue lors de la vérification du lien.');
      setIsValid(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword) {
      setError('Le mot de passe est requis');
      return;
    }

    if (!validatePassword(newPassword)) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    try {
      setIsLoading(true);

      // Appeler l'API pour réinitialiser le mot de passe
      const response = await fetch('/api/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          newPassword,
        }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la réinitialisation');
      }

      setSuccess(true);
      showToast({
        severity: 'success',
        summary: 'Mot de passe réinitialisé',
        detail: 'Votre mot de passe a été réinitialisé avec succès.',
        life: 5000
      });

      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: any) {
      console.error('Reset password error:', error);
      setError('Une erreur est survenue lors de la réinitialisation');
      showToast({
        severity: 'error',
        summary: 'Erreur',
        detail: 'Une erreur est survenue',
        life: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  // Vérification en cours
  if (isVerifying) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-card">
            <div className="reset-password-header">
              <i className="pi pi-spin pi-spinner" />
              <h1>Vérification...</h1>
              <p>Veuillez patienter</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Token invalide
  if (!isValid) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-card">
            <div className="reset-password-header">
              <i className="pi pi-times-circle" style={{ color: 'var(--red-500)' }} />
              <h1>Lien invalide</h1>
              <p className="error-message">{error}</p>
            </div>
            <button
              className="back-button"
              onClick={() => router.push('/reset-password/request')}
            >
              <i className="pi pi-arrow-left"></i>
              Demander un nouveau lien
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Succès
  if (success) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-card">
            <div className="success-message">
              <i className="pi pi-check-circle" />
              <h2>Mot de passe réinitialisé !</h2>
              <p>
                Votre mot de passe a été réinitialisé avec succès.
              </p>
              <p className="info-text">
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </p>
              <button
                className="back-button"
                onClick={handleBackToLogin}
              >
                <i className="pi pi-sign-in"></i>
                Se connecter
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Formulaire de réinitialisation
  return (
    <div className="reset-password-page">
      <div className="reset-password-container">
        <div className="reset-password-card">
          <div className="reset-password-header">
            <i className="pi pi-lock" />
            <h1>Nouveau mot de passe</h1>
            <p>
              Créez un nouveau mot de passe pour <strong>{email}</strong>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="reset-password-form">
            <div className="form-field">
              <label htmlFor="newPassword">
                <i className="pi pi-lock" /> Nouveau mot de passe
              </label>
              <Password
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                toggleMask
                className={error && !newPassword ? 'input-invalid' : ''}
              />
            </div>

            <div className="form-field">
              <label htmlFor="confirmPassword">
                <i className="pi pi-lock" /> Confirmer le mot de passe
              </label>
              <Password
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Retapez votre mot de passe"
                toggleMask
                className={error && newPassword !== confirmPassword ? 'input-invalid' : ''}
              />
            </div>

            {error && <small className="error-message">{error}</small>}

            <button
              type="submit"
              className="submit-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <i className="pi pi-spin pi-spinner"></i>
                  <span>Réinitialisation...</span>
                </>
              ) : (
                'Réinitialiser le mot de passe'
              )}
            </button>

            <button
              type="button"
              className="back-link-button"
              onClick={handleBackToLogin}
            >
              <i className="pi pi-arrow-left"></i>
              Retour à la connexion
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
