"use client";
import React, { useState, useEffect } from 'react';
import './account-detail.css';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { PersonalizedRecommendations, UserStats } from '@/components/features';
import { doc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/config/firebase';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { RequireEmailVerification } from '@/components/ui';

interface RecentActivity {
  id: string;
  type: 'recipe' | 'post' | 'like' | 'review';
  title: string;
  date: Date;
  description: string;
}

interface TikTokUiState {
  connected: boolean;
  displayName?: string;
  lastSyncAt?: string;
  lastImportedCount?: number;
}

interface TikTokCollectionOption {
  id: string;
  name: string;
  count?: number;
}

export default function AccountDetailPage() {
  const { user, displayName, refreshUserData } = useAuth();
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(displayName || '');
  const [tiktokState, setTiktokState] = useState<TikTokUiState | null>(null);
  const [tiktokLoading, setTiktokLoading] = useState(false);
  const [tiktokMessage, setTiktokMessage] = useState<string | null>(null);
  const [tiktokCollections, setTiktokCollections] = useState<TikTokCollectionOption[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('all');
  const { showToast } = useToast();
  const collectionOptions: TikTokCollectionOption[] = React.useMemo(() => {
    const fallback: TikTokCollectionOption = { id: 'all', name: 'Toutes mes vidéos' };
    const normalized = (Array.isArray(tiktokCollections) ? tiktokCollections : [])
      .filter((collection) => collection && typeof collection.id === 'string' && collection.id.trim())
      .map((collection) => ({
        id: collection.id.trim(),
        name:
          typeof collection.name === 'string' && collection.name.trim()
            ? collection.name.trim()
            : 'Collection TikTok',
        count: collection.count,
      }));

    const dedupMap = new Map<string, TikTokCollectionOption>();
    dedupMap.set(fallback.id, fallback);
    normalized.forEach((item) => dedupMap.set(item.id, item));

    return Array.from(dedupMap.values());
  }, [tiktokCollections]);

  useEffect(() => {
    if (user) {
      fetchRecentActivity();
    }
  }, [user]);

  useEffect(() => {
    if (displayName) {
      setDisplayNameInput(displayName);
    }
  }, [displayName]);

  useEffect(() => {
    if (!user?.uid) return;
    fetchTikTokState(user.uid);
  }, [user?.uid]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tiktok = params.get('tiktok');
    const message = params.get('message');

    if (tiktok === 'connected') {
      setTiktokMessage('Compte TikTok connecté avec succès.');
    } else if (tiktok === 'error') {
      setTiktokMessage(message || 'La connexion TikTok a échoué.');
    }
  }, []);

  const fetchRecentActivity = async () => {
    if (!user) return;

    try {
      const recipesCollection = collection(db, 'recipes');
      const postsCollection = collection(db, 'posts');

      const activities: RecentActivity[] = [];

      const recipesQuery = query(
        recipesCollection,
        where('createdBy', '==', user.uid)
      );
      const recipesSnapshot = await getDocs(recipesQuery);
      recipesSnapshot.docs.slice(0, 3).forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: 'recipe',
          title: data.title,
          date: data.createdAt?.toDate() || new Date(),
          description: `Recette créée - ${data.type}`
        });
      });

      const postsQuery = query(
        postsCollection,
        where('userId', '==', user.uid)
      );
      const postsSnapshot = await getDocs(postsQuery);
      postsSnapshot.docs.slice(0, 2).forEach(doc => {
        const data = doc.data();
        activities.push({
          id: doc.id,
          type: 'post',
          title: data.title,
          date: data.createdAt?.toDate() || new Date(),
          description: 'Publication créée'
        });
      });

      activities.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentActivity(activities.slice(0, 5));
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { displayName: displayNameInput });

        // Rafraîchir les données utilisateur dans le contexte
        await refreshUserData();

        showToast({
          severity: 'success',
          summary: 'Profil',
          detail: 'Profil mis à jour avec succès',
          life: 4000
        });
      } catch (error) {
        console.error('Error updating profile:', error);
        showToast({
          severity: 'error',
          summary: 'Profil',
          detail: 'Erreur lors de la mise à jour du profil',
          life: 4000
        });
      }
    }

    setEditDialogVisible(false);
  };

  const fetchTikTokState = async (uid: string) => {
    try {
      const idToken = await getFirebaseToken();
      const response = await fetch('/api/tiktok/status', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Impossible de récupérer le statut TikTok.');
      }

      setTiktokState({
        connected: Boolean(data.connected),
        displayName: data.displayName || undefined,
        lastSyncAt: data.lastSyncAt || undefined,
        lastImportedCount: typeof data.lastImportedCount === 'number' ? data.lastImportedCount : undefined,
      });

      if (data.connected) {
        await fetchTikTokCollections();
      } else {
        setTiktokCollections([]);
        setSelectedCollectionId('all');
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l’état TikTok:', error);
      setTiktokState({ connected: false });
      setTiktokCollections([]);
      setSelectedCollectionId('all');
    }
  };

  const getFirebaseToken = async () => {
    if (!auth.currentUser) {
      throw new Error('Vous devez être connecté pour utiliser TikTok.');
    }
    return auth.currentUser.getIdToken();
  };

  const handleConnectTikTok = async () => {
    try {
      setTiktokLoading(true);
      setTiktokMessage(null);
      const idToken = await getFirebaseToken();
      const response = await fetch('/api/tiktok/connect/start?returnTo=%2Faccount', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await response.json();
      if (!response.ok || !data?.authUrl) {
        throw new Error(data?.error || 'Impossible de démarrer la connexion TikTok.');
      }

      window.location.href = data.authUrl;
    } catch (error: any) {
      setTiktokMessage(error?.message || 'Erreur lors de la connexion TikTok.');
      setTiktokLoading(false);
    }
  };

  const handleImportTikTok = async () => {
    try {
      setTiktokLoading(true);
      setTiktokMessage(null);
      const idToken = await getFirebaseToken();
      const response = await fetch('/api/tiktok/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ maxCount: 20, collectionId: selectedCollectionId }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "L'import TikTok a échoué.");
      }

      setTiktokMessage(
        `Import terminé: ${data.importedCount} nouvelle(s) recette(s), ${data.skippedCount} déjà importée(s).`,
      );

      if (user?.uid) {
        await fetchTikTokState(user.uid);
      }
    } catch (error: any) {
      setTiktokMessage(error?.message || "Erreur lors de l'import TikTok.");
    } finally {
      setTiktokLoading(false);
    }
  };

  const fetchTikTokCollections = async () => {
    try {
      const idToken = await getFirebaseToken();
      const response = await fetch('/api/tiktok/collections', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Impossible de charger les collections TikTok.');
      }

      const collections: TikTokCollectionOption[] = Array.isArray(data.collections) ? data.collections : [];
      setTiktokCollections(collections);
      const ids = new Set(['all', ...collections.map((c) => c.id)]);
      if (!ids.has(selectedCollectionId)) {
        setSelectedCollectionId('all');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des collections TikTok:', error);
      setTiktokCollections([{ id: 'all', name: 'Toutes mes vidéos' }]);
      setSelectedCollectionId('all');
    }
  };

  if (!user) {
    return (
      <div className="AccountDetail">
        <h2>Vous n'êtes pas connecté</h2>
      </div>
    );
  }

  return (
    <RequireEmailVerification>
      <div className="AccountDetail">
        <div className="dashboard-header">
          <div className="welcome-section">
            <h2>Bienvenue, {displayName || user?.email}! 👋</h2>
            <p>Voici un aperçu de votre profil et de votre activité</p>
          </div>
          <button
            className="edit-profile-btn"
            onClick={() => setEditDialogVisible(true)}
          >
            <i className="pi pi-pencil"></i>
            Éditer le profil
          </button>
        </div>

        {user && <UserStats userId={user.uid} isPublicProfile={false} />}

        <div className="tiktok-card">
          <div className="tiktok-card-header">
            <h3>Intégration TikTok (MVP)</h3>
            <p>Connecte ton compte puis importe tes vidéos vers la modération `recipesRequest`.</p>
          </div>

          <div className="tiktok-status">
            <span className={`status-dot ${tiktokState?.connected ? 'connected' : 'disconnected'}`}></span>
            <span>
              {tiktokState?.connected
                ? `Connecté${tiktokState.displayName ? ` (${tiktokState.displayName})` : ''}`
                : 'Non connecté'}
            </span>
          </div>

          {tiktokState?.lastSyncAt && (
            <p className="tiktok-meta">
              Dernier import: {new Date(tiktokState.lastSyncAt).toLocaleString('fr-FR')}
              {typeof tiktokState.lastImportedCount === 'number' ? ` - ${tiktokState.lastImportedCount} importée(s)` : ''}
            </p>
          )}

          {tiktokState?.connected && (
            <div className="tiktok-collection-row">
              <label htmlFor="tiktok-collection-select">Collection à importer</label>
              <select
                id="tiktok-collection-select"
                value={selectedCollectionId}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                disabled={tiktokLoading}
                className="tiktok-collection-select"
              >
                {collectionOptions.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                    {typeof collection.count === 'number' ? ` (${collection.count})` : ''}
                  </option>
                ))}
              </select>
              {collectionOptions.length <= 1 && (
                <p className="tiktok-help-text">
                  Aucune collection spécifique detectee pour le moment, import sur "Toutes mes videos".
                </p>
              )}
            </div>
          )}

          <div className="tiktok-actions">
            {!tiktokState?.connected ? (
              <button
                type="button"
                className="tiktok-btn primary"
                onClick={handleConnectTikTok}
                disabled={tiktokLoading}
              >
                {tiktokLoading ? 'Connexion...' : 'Connecter TikTok'}
              </button>
            ) : (
              <button
                type="button"
                className="tiktok-btn primary"
                onClick={handleImportTikTok}
                disabled={tiktokLoading}
              >
                {tiktokLoading ? 'Import en cours...' : 'Importer maintenant'}
              </button>
            )}
          </div>

          {tiktokMessage && <p className="tiktok-message">{tiktokMessage}</p>}
        </div>

        {recentActivity.length > 0 && (
          <div className="activity-card">
            <h3 className="activity-title">Activité Récente</h3>
            <div className="activity-timeline">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-date">
                    <small>{activity.date.toLocaleDateString('fr-FR')}</small>
                  </div>
                  <div className="activity-content-wrapper">
                    <i className={activity.type === 'recipe' ? 'pi pi-book' : 'pi pi-comment'}></i>
                    <div className="activity-content">
                      <strong>{activity.title}</strong>
                      <p>{activity.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="recommendations-card">
          <PersonalizedRecommendations />
        </div>

        {editDialogVisible && (
          <div className="dialog-overlay" onClick={() => setEditDialogVisible(false)}>
            <div className="dialog-account" onClick={(e) => e.stopPropagation()}>
              <div className="dialog-header">
                <h3>Éditer le profil</h3>
                <button
                  className="dialog-close"
                  onClick={() => setEditDialogVisible(false)}
                  aria-label="Fermer"
                >
                  <i className="pi pi-times"></i>
                </button>
              </div>
              <div className="dialog-content">
                <div className="edit-form">
                  <div className="form-group">
                    <label htmlFor="displayName">Nom d'affichage</label>
                    <input
                      id="displayName"
                      type="text"
                      value={displayNameInput}
                      onChange={(e) => setDisplayNameInput(e.target.value)}
                      placeholder="Votre nom"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      placeholder="Email"
                    />
                  </div>
                  <div className="dialog-buttons">
                    <button
                      className="btn-secondary"
                      onClick={() => setEditDialogVisible(false)}
                    >
                      <i className="pi pi-times"></i>
                      Annuler
                    </button>
                    <button
                      className="btn-primary"
                      onClick={handleSaveProfile}
                    >
                      <i className="pi pi-check"></i>
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </RequireEmailVerification>
  );
}
