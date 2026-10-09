/**
 * Initialise / met à jour le catalogue d'unités dans Firestore (collection "units").
 *
 *   npm run seed:units
 *
 * - Écrit les unités standard de src/constants/default-units.json (ids fixes : g, kg, ml, cas…).
 * - Les anciennes unités (créées avant la refonte) qui correspondent à une unité standard
 *   (même nom ou abréviation, ex. "gr" → g) sont marquées comme doublons : isActive=false, replacedBy.
 * - Les autres anciennes unités sont conservées et complétées (type "other", pluriel = nom).
 * Peut être relancé sans risque.
 *
 * Identifiants : variable FIREBASE_SERVICE_ACCOUNT_KEY (JSON) ou src/firebase/serviceAccountKey.json.
 */
import fs from 'fs';
import path from 'path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  const file = path.join(process.cwd(), 'src', 'firebase', 'serviceAccountKey.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  throw new Error('Aucun identifiant Firebase Admin (FIREBASE_SERVICE_ACCOUNT_KEY ou src/firebase/serviceAccountKey.json)');
}

const normalize = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s.'’]/g, '');

const serviceAccount = loadServiceAccount();
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const defaults = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'constants', 'default-units.json'), 'utf8'));
const defaultIds = new Set(defaults.map((u) => u.id));
const keyToDefault = new Map();
for (const u of defaults) {
  for (const k of [u.id, u.name, u.plural, u.abbreviation, ...u.aliases]) {
    const key = normalize(k);
    if (key && !keyToDefault.has(key)) keyToDefault.set(key, u.id);
  }
}

const batch = db.batch();
for (const unit of defaults) {
  const { id, ...data } = unit;
  batch.set(db.collection('units').doc(id), { ...data, isActive: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

const existing = await db.collection('units').get();
let merged = 0;
let completed = 0;
for (const doc of existing.docs) {
  if (defaultIds.has(doc.id)) continue;
  const data = doc.data();
  const match = keyToDefault.get(normalize(data.abbreviation)) || keyToDefault.get(normalize(data.name));
  if (match) {
    batch.update(doc.ref, { isActive: false, replacedBy: match });
    merged++;
  } else {
    batch.update(doc.ref, {
      type: data.type || 'other',
      plural: data.plural || data.name || data.abbreviation || '',
      aliases: Array.isArray(data.aliases) ? data.aliases : [],
      useAbbreviation: typeof data.useAbbreviation === 'boolean' ? data.useAbbreviation : Boolean(data.abbreviation),
    });
    completed++;
  }
}

await batch.commit();
console.log(`✅ ${defaults.length} unités standard écrites, ${merged} ancienne(s) fusionnée(s), ${completed} ancienne(s) complétée(s).`);
