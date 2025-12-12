"use client";
import React, { useState, useEffect } from 'react';
import './account-detail.css';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { PersonalizedRecommendations, UserStats } from '@/components/features';
import { doc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { RequireEmailVerification } from '@/components/ui';

interface RecentActivity {
  id: string;
  type: 'recipe' | 'post' | 'like' | 'review';
  title: string;
  date: Date;
  description: string;
}

export default function AccountDetailPage() {
  const { user, displayName, refreshUserData } = useAuth();
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(displayName || '');
  const { showToast } = useToast();

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
          <h3 className="recommendations-title">Recommandations Personnalisées</h3>
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
