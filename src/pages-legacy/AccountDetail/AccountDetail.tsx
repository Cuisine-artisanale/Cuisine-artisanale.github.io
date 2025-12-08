"use client";
import React, { useState, useEffect } from 'react';
import './AccountDetail.css';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import PersonalizedRecommendations from '@/components/PersonalizedRecommendations/PersonalizedRecommendations';
import UserStats from '@/components/UserStats/UserStats';
import { doc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { db } from '@firebaseModule';
import { Card } from 'primereact/card';
import { Timeline } from 'primereact/timeline';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Toast } from 'primereact/toast';
import { useRef } from 'react';

interface RecentActivity {
  id: string;
  type: 'recipe' | 'post' | 'like' | 'review';
  title: string;
  date: Date;
  description: string;
}

const AccountDetail: React.FC = () => {
  const { user, displayName, refreshUserData } = useAuth();
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState(displayName || '');
  const toast = useRef<Toast>(null);

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

		if (toast.current) {
		  toast.current.show({
			severity: 'success',
			summary: 'Profil',
			detail: 'Profil mis à jour avec succès',
			life: 4000
		  });
		}
	  } catch (error) {
		console.error('Error updating profile:', error);
		if (toast.current) {
		  toast.current.show({
			severity: 'error',
			summary: 'Profil',
			detail: 'Erreur lors de la mise à jour du profil',
			life: 4000
		  });
		}
	  }
	}

	setEditDialogVisible(false);
  };

  const activityTemplate = (activity: RecentActivity) => {
	const iconClass = activity.type === 'recipe' ? 'pi pi-book' : 'pi pi-comment';
	return (
	  <div className="activity-item">
		<i className={iconClass}></i>
		<div className="activity-content">
		  <strong>{activity.title}</strong>
		  <p>{activity.description}</p>
		  <small>{activity.date.toLocaleDateString()}</small>
		</div>
	  </div>
	);
  };

  if (!user) {
	return (
	  <div className="AccountDetail">
		<h2>Vous n'êtes pas connecté</h2>
	  </div>
	);
  }

  return (
	<div className="AccountDetail">
	  <Toast ref={toast} />

	  <div className="dashboard-header">
		<div className="welcome-section">
		  <h2>Bienvenue, {displayName || user?.email}! 👋</h2>
		  <p>Voici un aperçu de votre profil et de votre activité</p>
		</div>
		<Button
		  icon="pi pi-pencil"
		  label="Éditer le profil"
		  onClick={() => setEditDialogVisible(true)}
		  className="edit-profile-btn"
		/>
	  </div>

	  {user && <UserStats userId={user.uid} isPublicProfile={false} />}

	  {recentActivity.length > 0 && (
		<Card className="activity-card">
		  <h3 className="activity-title">Activité Récente</h3>
		  <Timeline
			value={recentActivity}
			content={(activity) => activityTemplate(activity)}
			opposite={(activity) => (
			  <small className="p-text-secondary">{activity.date.toLocaleDateString('fr-FR')}</small>
			)}
			layout="horizontal"
			align="top"
			className="custom-timeline"
		  />
		</Card>
	  )}

	  <Card className="recommendations-card">
		<h3 className="recommendations-title">Recommandations Personnalisées</h3>
		<PersonalizedRecommendations />
	  </Card>

	  <Dialog
		visible={editDialogVisible}
		onHide={() => setEditDialogVisible(false)}
		header="Éditer le profil"
		modal
		style={{ width: '80vw' }}
		className='dialog-account'
	  >
		<div className="edit-form">
		  <div className="form-group">
			<label htmlFor="displayName">Nom d'affichage</label>
			<InputText
			  id="displayName"
			  value={displayNameInput}
			  onChange={(e) => setDisplayNameInput(e.target.value)}
			  placeholder="Votre nom"
			/>
		  </div>
		  <div className="form-group">
			<label htmlFor="email">Email</label>
			<InputText
			  id="email"
			  value={user?.email || ''}
			  disabled
			  placeholder="Email"
			/>
		  </div>
		  <div className="dialog-buttons">
			<Button
			  label="Annuler"
			  icon="pi pi-times"
			  onClick={() => setEditDialogVisible(false)}
			  className="p-button-secondary"
			/>
			<Button
			  label="Enregistrer"
			  icon="pi pi-check"
			  onClick={handleSaveProfile}
			/>
		  </div>
		</div>
	  </Dialog>
	</div>
  );
};

export default AccountDetail;
