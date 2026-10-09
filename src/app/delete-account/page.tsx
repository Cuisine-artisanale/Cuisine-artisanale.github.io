"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/config/firebase-app';
import { signOut } from 'firebase/auth';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import './delete-account.css';

export default function DeleteAccount() {
  const router = useRouter();
  const toastRef = useRef<Toast>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setEmail(currentUser.email || '');
  }, [router]);

  const handleDeleteAccount = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.push('/login');
      return;
    }

    if (confirmText !== 'SUPPRIMER') {
      toastRef.current?.show({
        severity: 'warn',
        summary: 'Confirmation requise',
        detail: 'Veuillez taper "SUPPRIMER" pour confirmer',
        life: 3000
      });
      return;
    }

    try {
      setIsLoading(true);

      // Suppression côté serveur : données personnelles puis compte (voir /api/account/delete)
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        throw Object.assign(new Error(result.error || 'Suppression impossible'), { code: result.code });
      }

      // Le compte n'existe plus : on ferme la session locale
      await signOut(auth).catch(() => undefined);

      toastRef.current?.show({
        severity: 'success',
        summary: 'Compte supprimé',
        detail: 'Votre compte a été supprimé avec succès',
        life: 3000
      });

      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error: any) {
      console.error('Delete account error:', error);
      let errorMessage = 'Une erreur est survenue';

      if (error.code === 'requires-recent-login') {
        errorMessage = 'Pour supprimer votre compte, vous devez vous reconnecter récemment. Déconnectez-vous et reconnectez-vous avant de réessayer.';
      }

      toastRef.current?.show({
        severity: 'error',
        summary: 'Erreur',
        detail: errorMessage,
        life: 6000
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="delete-account-page">
      <Toast ref={toastRef} />
      <div className="delete-account-container">
        <div className="delete-account-card">
          <div className="delete-account-header">
            <i className="pi pi-exclamation-triangle" />
            <h1>Supprimer le compte</h1>
            <p className="warning-text">
              ⚠️ Cette action est <strong>irréversible</strong>
            </p>
          </div>

          <div className="delete-account-info">
            <p>Vous êtes sur le point de supprimer le compte :</p>
            <p className="email-display">{email}</p>
            <p className="info-text">
              Cette action supprimera :
            </p>
            <ul>
              <li>Votre compte et vos informations personnelles</li>
              <li>Vos favoris, avis et liste de courses</li>
              <li>Vos demandes de recettes en attente et votre connexion TikTok</li>
            </ul>
            <p className="info-text">
              Vos recettes et posts déjà publiés restent en ligne, sans votre nom.
            </p>
          </div>

          <div className="delete-account-form">
            <div className="form-field">
              <label htmlFor="confirm">
                Pour confirmer, tapez <strong>SUPPRIMER</strong> en majuscules :
              </label>
              <InputText
                id="confirm"
                placeholder="SUPPRIMER"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="delete-account-actions">
              <Button
                label="Annuler"
                icon="pi pi-times"
                className="p-button-outlined cancel-button"
                onClick={() => router.push('/account')}
              />
              <Button
                label="Supprimer définitivement"
                icon="pi pi-trash"
                className="delete-button"
                onClick={handleDeleteAccount}
                loading={isLoading}
                disabled={confirmText !== 'SUPPRIMER'}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
