"use client";
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import UserProfileContent from './UserProfileContent';

export default function ProfilPage() {
  return (
    <Suspense fallback={
      <div className="user-profile-container">
        <div className="user-profile-loading">
          <div className="spinner"></div>
          <p>Chargement du profil...</p>
        </div>
      </div>
    }>
      <UserProfileWrapper />
    </Suspense>
  );
}

function UserProfileWrapper() {
  const searchParams = useSearchParams();
  const userId = searchParams?.get('id');

  return <UserProfileContent userId={userId} />;
}
