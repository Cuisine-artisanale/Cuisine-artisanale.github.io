import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let initialized = false;

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY contient un JSON invalide');
  }
}

function getServiceAccountFromFile() {
  const serviceAccountPath = path.join(process.cwd(), 'src', 'firebase', 'serviceAccountKey.json');
  if (!fs.existsSync(serviceAccountPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(serviceAccountPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Le fichier src/firebase/serviceAccountKey.json est invalide');
  }
}

export function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    initialized = true;
    return getApp();
  }

  const serviceAccount = getServiceAccountFromEnv() || getServiceAccountFromFile();

  if (serviceAccount) {
    initialized = true;
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error('Configuration Firebase Admin manquante (FIREBASE_SERVICE_ACCOUNT_KEY ou FIREBASE_PROJECT_ID)');
  }

  initialized = true;
  return initializeApp({ projectId });
}

export function getFirebaseAdminAuth() {
  const app = getFirebaseAdminApp();
  return getAuth(app);
}

export function getFirebaseAdminDb() {
  const app = getFirebaseAdminApp();
  return getFirestore(app);
}

export function isFirebaseAdminInitialized() {
  return initialized || getApps().length > 0;
}

