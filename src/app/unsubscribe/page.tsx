"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import './unsubscribe.css';

type Status = "loading" | "success" | "error";

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const email = searchParams.get("email");

    if (!email) {
      setStatus("error");
      return;
    }

    // Appel à la fonction Cloud HTTPS
    fetch(`https://us-central1-recettes-cuisine-a1bf2.cloudfunctions.net/unsubscribe?email=${encodeURIComponent(email)}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setStatus("success");
        else setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [searchParams]);

  return (
    <div className="unsubscribe-page">
      <div className="unsubscribe-container">
        <div className="unsubscribe-card">
          {status === "loading" && (
            <div className="loading status-content">
              <i className="pi pi-spin pi-spinner" style={{ fontSize: '3rem' }} />
              <h1>🍪 Traitement en cours...</h1>
              <p>Veuillez patienter pendant que nous vous désabonnons.</p>
            </div>
          )}

          {status === "success" && (
            <div className="success status-content">
              <i className="pi pi-check-circle" style={{ fontSize: '3rem', color: 'var(--success-500)' }} />
              <h1>Désabonnement réussi 🎉</h1>
              <p>
                Vous avez été désabonné(e) de la newsletter <strong>Cuisine Artisanale</strong>.
              </p>
              <a
                href="https://www.aymeric-sabatier.fr/Cuisine-artisanale"
                className="unsubscribe-button"
              >
                Revenir sur le site
              </a>
            </div>
          )}

          {status === "error" && (
            <div className="error status-content">
              <i className="pi pi-times-circle" style={{ fontSize: '3rem', color: 'var(--danger-500)' }} />
              <h1>Oups 😢</h1>
              <p>
                Impossible de vous désabonner. Le lien semble invalide ou a expiré.
              </p>
              <a
                href="https://www.aymeric-sabatier.fr/contact"
                className="unsubscribe-button"
              >
                Contacter le support
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Unsubscribe() {
  return (
    <Suspense fallback={
      <div className="unsubscribe-page">
        <div className="unsubscribe-container">
          <div className="unsubscribe-card">
            <div className="loading status-content">
              <i className="pi pi-spin pi-spinner" style={{ fontSize: '3rem' }} />
              <h1>🍪 Chargement...</h1>
              <p>Veuillez patienter.</p>
            </div>
          </div>
        </div>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}

