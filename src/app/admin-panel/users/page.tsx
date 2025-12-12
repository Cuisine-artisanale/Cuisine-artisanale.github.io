"use client";
import React, { useEffect, useState } from 'react';
import './users-admin.css';
import { collection, deleteDoc, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { toastMessages } from '@/lib/utils/toast';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { ConfirmDialog } from '@/components/ui';
import { useConfirmDialog } from '@/hooks';

interface User {
  userId: string;
  email: string;
  role: string;
  createdAt?: Date;
  lastLogin?: Date;
  displayName?: string;
  photoURL?: string;
}

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalFilter, setGlobalFilter] = useState<string>('');
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const { showToast } = useToast();
  const { confirm, visible, dialogState, handleAccept, handleReject } = useConfirmDialog();

  const roles = [
    { label: 'Utilisateur', value: 'user' },
    { label: 'Administrateur', value: 'admin' }
  ];

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          userId: doc.id,
          email: data.email,
          role: data.role,
          createdAt: data.createdAt?.toDate(),
          lastLogin: data.lastLogin?.toDate(),
          displayName: data.displayName,
          photoURL: data.photoURL
        } as User;
      });
      setUsers(usersList);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      showToast({
        severity: 'error',
        summary: toastMessages.error.default,
        detail: 'Impossible de charger les utilisateurs'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const confirmDelete = (userId: string, email: string) => {
    confirm({
      message: `Êtes-vous sûr de vouloir supprimer l'utilisateur ${email} ?`,
      header: 'Confirmation de suppression',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Oui',
      rejectLabel: 'Non',
      onAccept: () => deleteUser(userId)
    });
  };

  const deleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      showToast({
        severity: 'success',
        summary: toastMessages.success.default,
        detail: toastMessages.success.delete
      });
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      showToast({
        severity: 'error',
        summary: toastMessages.error.default,
        detail: toastMessages.error.delete
      });
    }
  };

  const startEdit = (user: User, field: string) => {
    setEditingCell({ id: user.userId, field });
    setEditValue(user[field as keyof User]?.toString() || '');
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEdit = async (user: User) => {
    if (!editingCell) return;

    try {
      await updateDoc(doc(db, 'users', user.userId), {
        [editingCell.field]: editValue,
        updatedAt: new Date()
      });

      showToast({
        severity: 'success',
        summary: toastMessages.success.default,
        detail: toastMessages.success.update
      });

      setEditingCell(null);
      setEditValue('');
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      showToast({
        severity: 'error',
        summary: toastMessages.error.default,
        detail: toastMessages.error.update
      });
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return '-';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(globalFilter.toLowerCase()) ||
    user.displayName?.toLowerCase().includes(globalFilter.toLowerCase()) ||
    user.role.toLowerCase().includes(globalFilter.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Chargement des utilisateurs...</p>
      </div>
    );
  }

  return (
    <div className="users-container">
      {dialogState && (
        <ConfirmDialog
          visible={visible}
          message={dialogState.message}
          header={dialogState.header}
          icon={dialogState.icon}
          acceptLabel={dialogState.acceptLabel}
          rejectLabel={dialogState.rejectLabel}
          onAccept={handleAccept}
          onReject={handleReject}
        />
      )}

      <div className="table-header">
        <h2>Gestion des Utilisateurs</h2>
        <div className="input-icon-left">
          <i className="pi pi-search" />
          <input
            type="search"
            placeholder="Rechercher..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="table-container">
        {filteredUsers.length === 0 ? (
          <div className="empty-message">Aucun utilisateur trouvé</div>
        ) : (
          <table className="user-table">
            <thead>
              <tr>
                <th>Avatar</th>
                <th>Nom</th>
                <th>Email</th>
                <th>Rôle</th>
                <th>Créé le</th>
                <th>Dernière connexion</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.userId}>
                  <td>
                    <div className="user-avatar">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || 'User'} />
                      ) : (
                        <div className="user-avatar-placeholder">
                          <i className="pi pi-user" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{user.displayName || '-'}</td>
                  <td>
                    {editingCell?.id === user.userId && editingCell.field === 'email' ? (
                      <div className="cell-edit">
                        <input
                          type="email"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(user);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                          className="cell-input"
                        />
                        <div className="cell-actions">
                          <button onClick={() => saveEdit(user)} className="btn-save" title="Enregistrer">
                            <i className="pi pi-check"></i>
                          </button>
                          <button onClick={cancelEdit} className="btn-cancel" title="Annuler">
                            <i className="pi pi-times"></i>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="editable-cell"
                        onClick={() => startEdit(user, 'email')}
                        title="Cliquer pour éditer"
                      >
                        {user.email}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingCell?.id === user.userId && editingCell.field === 'role' ? (
                      <div className="cell-edit">
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(user);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                          className="cell-input"
                        >
                          {roles.map(role => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                        <div className="cell-actions">
                          <button onClick={() => saveEdit(user)} className="btn-save" title="Enregistrer">
                            <i className="pi pi-check"></i>
                          </button>
                          <button onClick={cancelEdit} className="btn-cancel" title="Annuler">
                            <i className="pi pi-times"></i>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span
                        className="editable-cell role-badge"
                        onClick={() => startEdit(user, 'role')}
                        title="Cliquer pour éditer"
                      >
                        {roles.find(r => r.value === user.role)?.label || user.role}
                      </span>
                    )}
                  </td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>{formatDate(user.lastLogin)}</td>
                  <td>
                    <button
                      className="btn-action btn-danger"
                      onClick={() => confirmDelete(user.userId, user.email)}
                      title="Supprimer"
                    >
                      <i className="pi pi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
