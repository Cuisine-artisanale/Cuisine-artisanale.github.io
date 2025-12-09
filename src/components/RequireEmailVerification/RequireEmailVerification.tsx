"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext/AuthContext';

interface RequireEmailVerificationProps {
  children: React.ReactNode;
}

/**
 * Component to protect routes that require email verification
 * Redirects to /verify-email if user is authenticated but email not verified
 */
const RequireEmailVerification: React.FC<RequireEmailVerificationProps> = ({ children }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // No user, redirect to login
      router.push('/login');
      return;
    }

    // Check if email/password user (not Google)
    const isEmailPasswordUser = user.providerData[0]?.providerId === 'password';

    // If email/password user and email not verified, redirect to verify-email
    if (isEmailPasswordUser && !user.emailVerified) {
      router.push('/verify-email');
    }
  }, [user, loading, router]);

  // Show nothing while loading
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}>
        <i className="pi pi-spin pi-spinner" style={{ fontSize: '2rem' }} />
      </div>
    );
  }

  // If no user or email not verified (and is email/password user), don't render children
  if (!user) {
    return null;
  }

  const isEmailPasswordUser = user.providerData[0]?.providerId === 'password';
  if (isEmailPasswordUser && !user.emailVerified) {
    return null;
  }

  // User is authenticated and email is verified (or is Google user)
  return <>{children}</>;
};

export default RequireEmailVerification;
