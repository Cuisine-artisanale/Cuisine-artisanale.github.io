# Configuration du domaine personnalisé pour les emails Firebase

## 🎯 Objectif

Changer les liens dans les emails de vérification de :
- ❌ `https://recettes-cuisine-a1bf2.firebaseapp.com/__/auth/action`
- ✅ `https://www.aymeric-sabatier.fr/__/auth/action`

Cela permet d'éviter que les emails soient filtrés comme spam.

---

## 📋 Étapes de configuration

### 1. Activer le domaine personnalisé dans Firebase

1. **Allez sur Firebase Console** : https://console.firebase.google.com/
2. **Sélectionnez votre projet** : `recettes-cuisine-a1bf2`
3. **Menu gauche → Authentication**
4. **Onglet "Templates"**
5. **En haut de la page, cliquez sur l'icône ⚙️ (paramètres)**
6. **Section "Customize action URL"**
7. **Entrez votre URL** : `https://www.aymeric-sabatier.fr`
8. **Cliquez sur "Save"**

### 2. Ajouter le domaine aux domaines autorisés

1. Toujours dans Authentication
2. **Onglet "Settings"**
3. **Section "Authorized domains"**
4. **Cliquez sur "Add domain"**
5. **Ajoutez** : `aymeric-sabatier.fr` et `www.aymeric-sabatier.fr`
6. **Sauvegardez**

### 3. Déployer votre application sur le domaine

Assurez-vous que votre application Next.js est bien déployée sur `www.aymeric-sabatier.fr`.

Les liens de vérification d'email redirigeront maintenant vers votre domaine personnalisé.

---

## 🧪 Test après configuration

1. **Supprimez le compte de test** dans Firebase Console
2. **Créez un nouveau compte** avec `a.sabatier@cuisine-artisanale.fr`
3. **Vérifiez l'email reçu** :
   - Le lien devrait maintenant pointer vers `www.aymeric-sabatier.fr`
   - Moins de chances d'être filtré comme spam

---

## 🔧 Configuration SMTP personnalisée (Optionnel)

Si le problème persiste, vous pouvez utiliser un service d'emailing professionnel :

### Option A : SendGrid (Recommandé)

1. **Créez un compte SendGrid** : https://sendgrid.com/
2. **Plan gratuit** : 100 emails/jour
3. **Obtenez une clé API**
4. **Configurez dans Firebase** via Cloud Functions

### Option B : Mailgun

1. **Créez un compte Mailgun** : https://www.mailgun.com/
2. **Plan gratuit** : 5,000 emails/mois
3. **Configurez votre domaine**

### Option C : SMTP de votre hébergeur

Si vous avez un serveur email avec votre hébergement web :
1. Obtenez les identifiants SMTP
2. Configurez via Cloud Functions

---

## 📧 Exemple de Cloud Function pour SMTP personnalisé

Si vous souhaitez utiliser un SMTP personnalisé, voici un exemple de Cloud Function :

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

// Configure SMTP transport
const transporter = nodemailer.createTransport({
  host: 'smtp.votreserveur.com',
  port: 587,
  secure: false,
  auth: {
    user: 'noreply@cuisine-artisanale.fr',
    pass: 'votre_mot_de_passe'
  }
});

// Listen for new users
export const sendVerificationEmail = functions.auth.user().onCreate(async (user) => {
  if (!user.email) return;

  // Generate verification link
  const link = await admin.auth().generateEmailVerificationLink(user.email);

  // Send email
  await transporter.sendMail({
    from: '"Cuisine Artisanale" <noreply@cuisine-artisanale.fr>',
    to: user.email,
    subject: 'Vérifiez votre adresse email',
    html: `
      <h1>Bienvenue sur Cuisine Artisanale !</h1>
      <p>Merci de vous être inscrit. Veuillez vérifier votre adresse email en cliquant sur le lien ci-dessous :</p>
      <a href="${link}">Vérifier mon email</a>
      <p>Ce lien expire dans 1 heure.</p>
    `
  });
});
```

---

## 🔍 Vérification des emails filtrés

### Vérifier si Firebase envoie bien l'email

Dans Firebase Console → Authentication → Users :
- Si l'utilisateur apparaît avec "Email not verified", l'email a été envoyé
- Firebase ne sait pas si l'email a été reçu ou filtré

### Vérifier les logs d'envoi

Malheureusement, Firebase ne fournit pas de logs détaillés sur la délivrabilité des emails dans le plan gratuit.

---

## ✅ Recommandation

**Pour l'instant** :
1. Configurez le domaine personnalisé (étapes 1 et 2 ci-dessus)
2. Testez avec un email Gmail pour confirmer que ça fonctionne
3. Si le problème persiste avec `@cuisine-artisanale.fr`, contactez votre admin email pour :
   - Whitelister les emails de Firebase
   - Ou configurer un SMTP personnalisé

---

**Documentation officielle** :
- [Firebase Email Templates](https://firebase.google.com/docs/auth/custom-email-handler)
- [Customize Action URLs](https://firebase.google.com/docs/auth/web/passing-state-in-email-actions)

