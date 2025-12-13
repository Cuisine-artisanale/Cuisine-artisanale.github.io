#!/usr/bin/env node

/**
 * Script pour charger les variables d'environnement depuis .env.local
 * et les définir comme secrets Firebase
 *
 * Usage: node scripts/set-secrets-from-env.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const envPath = path.resolve(__dirname, '../.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ Fichier .env.local introuvable !');
  console.log('💡 Créez un fichier .env.local dans le dossier functions/ avec vos variables.');
  process.exit(1);
}

// Lire le fichier .env.local
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envFile.split('\n').forEach(line => {
  line = line.trim();
  // Ignorer les commentaires et les lignes vides
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      let value = valueParts.join('=').trim();
      // Supprimer les guillemets simples et doubles au début et à la fin
      value = value.replace(/^["']+|["']+$/g, '');
      // Supprimer les retours à la ligne et espaces en fin de ligne
      value = value.replace(/\r\n|\r|\n/g, '').trim();
      envVars[key.trim()] = value;
    }
  }
});

const secrets = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'FRONTEND_URL'];

console.log('📦 Chargement des secrets Firebase depuis .env.local...\n');

secrets.forEach(secretName => {
  if (envVars[secretName]) {
    const value = envVars[secretName];
    console.log(`🔐 Définition du secret: ${secretName}`);
    console.log(`   Valeur: ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}`);

    try {
      // Créer un fichier temporaire avec la valeur pour éviter les problèmes avec echo et les guillemets
      const tmpFile = path.resolve(__dirname, `../.tmp-secret-${secretName}.txt`);
      fs.writeFileSync(tmpFile, value, 'utf8');

      // Utiliser le fichier temporaire pour définir le secret
      // Sur Windows, utiliser type au lieu de cat
      const isWindows = process.platform === 'win32';
      const readCommand = isWindows ? `type "${tmpFile}"` : `cat "${tmpFile}"`;

      execSync(
        `${readCommand} | firebase functions:secrets:set ${secretName}`,
        { stdio: 'inherit', shell: true }
      );

      // Supprimer le fichier temporaire
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }

      console.log(`✅ Secret ${secretName} défini avec succès\n`);
    } catch (error) {
      console.error(`❌ Erreur lors de la définition du secret ${secretName}:`, error.message);
      // Nettoyer le fichier temporaire en cas d'erreur
      const tmpFile = path.resolve(__dirname, `../.tmp-secret-${secretName}.txt`);
      if (fs.existsSync(tmpFile)) {
        fs.unlinkSync(tmpFile);
      }
    }
  } else {
    console.warn(`⚠️  Variable ${secretName} non trouvée dans .env.local\n`);
  }
});

console.log('✅ Terminé ! Vous pouvez maintenant déployer la fonction.');

