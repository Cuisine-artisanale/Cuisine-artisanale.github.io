"use client";
import React, { Suspense } from 'react';
import LoginPage from '@/pages-legacy/LoginPage/LoginPage';

export default function Login() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <LoginPage />
    </Suspense>
  );
}
