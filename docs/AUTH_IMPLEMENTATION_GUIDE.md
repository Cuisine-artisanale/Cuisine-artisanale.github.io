# Guide d'implémentation de l'authentification Email/Password

## ✅ Modifications effectuées

### 1. Pages créées

- **`/src/app/login/page.tsx`** : Route principale de connexion
- **`/src/pages-legacy/LoginPage/LoginPage.tsx`** : Page de login avec tabs (Connexion/Inscription)
- **`/src/pages-legacy/LoginPage/LoginPage.css`** : Styles de la page de login
- **`/src/app/reset-password/page.tsx`** : Route de réinitialisation de mot de passe
- **`/src/pages-legacy/ResetPasswordPage/ResetPasswordPage.tsx`** : Page de reset password
- **`/src/pages-legacy/ResetPasswordPage/ResetPasswordPage.css`** : Styles de la page de reset
- **`/src/components/EmailVerificationBanner/EmailVerificationBanner.tsx`** : Bannière de vérification email
- **`/src/components/EmailVerificationBanner/EmailVerificationBanner.css`** : Styles de la bannière

### 2. Fichiers modifiés

- **`/src/contexts/AuthContext/AuthContext.tsx`** :
  - ✅ Ajout de `signInWithEmail(email, password)`
  - ✅ Ajout de `signUpWithEmail(email, password, displayName)`
  - ✅ Vérification obligatoire de l'email avant connexion
  - ✅ Envoi automatique de l'email de vérification à l'inscription

- **`/src/components/Navbar/Navbar.tsx`** :
  - ✅ Redirection vers `/login` au lieu du popup Google direct
  - ✅ Gestion du paramètre `redirect` pour revenir à la page précédente

### 3. Fonctionnalités implémentées

#### Inscription par email
1. L'utilisateur remplit le formulaire d'inscription avec :
   - Nom d'affichage
   - Email
   - Mot de passe (min. 6 caractères)
   - Confirmation du mot de passe
   - Acceptation des conditions d'utilisation
2. Le compte est créé dans Firebase Auth
3. Un email de vérification est envoyé automatiquement
4. L'utilisateur est créé dans Firestore avec `role: "user"`
5. L'utilisateur est déconnecté jusqu'à vérification de l'email

#### Connexion par email
1. L'utilisateur entre son email et mot de passe
2. Firebase vérifie les credentials
3. Si l'email n'est pas vérifié, la connexion est refusée avec un message d'erreur
4. Si l'email est vérifié, l'utilisateur est connecté et redirigé

#### Réinitialisation de mot de passe
1. L'utilisateur clique sur "Mot de passe oublié ?"
2. Redirection vers `/reset-password`
3. L'utilisateur entre son email
4. Firebase envoie un email avec un lien de réinitialisation
5. Le lien expire après 1 heure

#### Design avec Tabs
- Tab "Connexion" : Email + Mot de passe + "Se souvenir de moi"
- Tab "Inscription" : Nom + Email + Mot de passe + Confirmation + CGU
- Bouton Google visible dans les deux tabs
- Divider "OU" pour séparer Google et email
- Responsive mobile-friendly

---

## 🔧 Configuration requise dans Firebase Console

### ⚠️ IMPORTANT : Étapes obligatoires à effectuer

#### 1. Activer l'authentification Email/Password

1. Allez sur [Firebase Console](https://console.firebase.google.com/)
2. Sélectionnez votre projet : **recettes-cuisine-a1bf2**
3. Dans le menu de gauche, cliquez sur **"Authentication"**
4. Cliquez sur l'onglet **"Sign-in method"**
5. Dans la liste des providers, trouvez **"Email/Password"**
6. Cliquez sur **"Email/Password"**
7. **Activez** le toggle "Email/Password"
8. (Optionnel) Vous pouvez aussi activer "Email link (passwordless sign-in)" si vous le souhaitez
9. Cliquez sur **"Save"**

#### 2. Configurer les templates d'email (Recommandé)

1. Dans Authentication > Templates
2. Vous pouvez personnaliser les emails envoyés :
   - **Email verification** : Email de vérification de compte
   - **Password reset** : Email de réinitialisation de mot de passe
   - **Email address change** : Email de changement d'adresse

3. Pour chaque template, vous pouvez :
   - Modifier l'objet de l'email
   - Personnaliser le message
   - Changer le nom de l'expéditeur (par défaut : "Firebase")
   - Modifier l'adresse de réponse

#### 3. Configurer le domaine autorisé

1. Dans Authentication > Settings > Authorized domains
2. Vérifiez que votre domaine est autorisé :
   - `localhost` (pour le développement)
   - `aymeric-sabatier.fr` (pour la production)
3. Si nécessaire, ajoutez d'autres domaines

#### 4. Configurer les Firestore Rules (Déjà fait)

Les règles Firestore existantes devraient déjà gérer l'authentification email correctement.

---

## 🎨 Design et UX

### Palette de couleurs utilisée

- **Primary (Orange)** : `#FF6B35` - Boutons principaux, liens, tabs actifs
- **Google Blue** : `#4285F4` - Bouton Google
- **Gradient Background** : `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- **Error** : `#e24c4c` - Messages d'erreur
- **Success** : `#22c55e` - Messages de succès

### Composants PrimeReact utilisés

- `InputText` : Champs email et nom
- `Password` : Champs mot de passe avec toggle mask
- `Button` : Tous les boutons
- `Checkbox` : "Se souvenir de moi" et acceptation des CGU
- `Divider` : Séparateur "OU"
- `Toast` : Messages de succès/erreur

---

## 🧪 Test du flux d'authentification

### Test d'inscription

1. Lancez l'application : `npm run dev`
2. Cliquez sur "Se connecter" dans la navbar
3. Cliquez sur l'onglet "Inscription"
4. Remplissez le formulaire :
   - Nom d'affichage : "Test User"
   - Email : utilisez un email de test
   - Mot de passe : "test123" (min. 6 caractères)
   - Confirmez le mot de passe
   - Acceptez les conditions
5. Cliquez sur "Créer mon compte"
6. ✅ Vous devriez voir un message de succès
7. ✅ Un email devrait être envoyé à l'adresse fournie
8. Vérifiez votre boîte mail et cliquez sur le lien de vérification

### Test de connexion (avant vérification)

1. Allez sur `/login`
2. Entrez l'email et le mot de passe du compte non vérifié
3. ❌ Vous devriez voir une erreur : "Veuillez vérifier votre email"

### Test de connexion (après vérification)

1. Vérifiez l'email en cliquant sur le lien
2. Retournez sur `/login`
3. Entrez vos credentials
4. ✅ Vous devriez être connecté et redirigé vers `/account`

### Test de réinitialisation de mot de passe

1. Sur `/login`, cliquez sur "Mot de passe oublié ?"
2. Entrez votre email
3. Cliquez sur "Envoyer le lien de réinitialisation"
4. ✅ Un email devrait être envoyé
5. Cliquez sur le lien dans l'email
6. Définissez un nouveau mot de passe
7. Retournez sur `/login` et connectez-vous avec le nouveau mot de passe

### Test de Google Sign-In

1. Sur `/login`, cliquez sur "Continuer avec Google"
2. Sélectionnez votre compte Google
3. ✅ Vous devriez être connecté immédiatement (pas de vérification requise)

---

## 🔒 Sécurité

### Mesures implémentées

1. **Vérification obligatoire de l'email** : Les utilisateurs email/password ne peuvent pas se connecter sans vérifier leur email
2. **Validation côté client** : Email valide, mot de passe fort, mots de passe identiques
3. **Validation côté serveur** : Firebase Auth gère la sécurité côté serveur
4. **Firestore Rules** : Seuls les utilisateurs authentifiés peuvent accéder aux données
5. **HTTPS** : Firebase Auth nécessite HTTPS en production

### Gestion des erreurs Firebase

Les codes d'erreur Firebase sont traduits en français :
- `auth/email-already-in-use` → "Cet email est déjà utilisé"
- `auth/user-not-found` → "Aucun compte avec cet email"
- `auth/wrong-password` → "Mot de passe incorrect"
- `auth/invalid-email` → "Email invalide"
- `auth/weak-password` → "Mot de passe trop faible"
- `auth/too-many-requests` → "Trop de tentatives. Réessayez plus tard"

---

## 📱 Responsive Design

Le design est entièrement responsive :

### Desktop (> 768px)
- Formulaire centré avec max-width 480px
- Tabs horizontaux
- Tous les éléments bien espacés

### Mobile (< 768px)
- Formulaire pleine largeur avec padding
- Tabs empilés si nécessaire
- Boutons pleine largeur
- Police réduite pour s'adapter

---

## 🚀 Prochaines étapes recommandées

### Optionnel - Améliorations futures

1. **Page de vérification email personnalisée**
   - Créer une page `/verify-email` pour afficher un message pendant la vérification
   - Utiliser `applyActionCode()` pour vérifier le code manuellement

2. **OAuth supplémentaires**
   - Facebook Login
   - Apple Login
   - GitHub Login

3. **Authentification à deux facteurs**
   - SMS verification
   - Authenticator app

4. **Statistiques d'authentification**
   - Tracker les inscriptions par méthode (Google vs Email)
   - Analyser les taux de vérification d'email

5. **Email de bienvenue**
   - Utiliser Cloud Functions pour envoyer un email de bienvenue après vérification

---

## 🐛 Dépannage

### Erreur : "signInWithEmail is not a function"

**Solution** : Assurez-vous que les imports Firebase sont corrects dans `AuthContext.tsx`.

### Erreur : "Email verification link is invalid"

**Solution** : Le lien de vérification expire. Cliquez sur "Renvoyer l'email" pour obtenir un nouveau lien.

### Les emails ne sont pas reçus

**Vérifications** :
1. Vérifiez la boîte spam
2. Vérifiez que l'authentification Email/Password est activée dans Firebase Console
3. Vérifiez les templates d'email dans Firebase Console
4. Vérifiez que l'email de test est valide

### Erreur : "This operation is sensitive..."

**Solution** : L'utilisateur doit se reconnecter avant de modifier son email ou mot de passe. Utilisez `reauthenticateWithCredential()`.

---

## 📞 Support

Si vous rencontrez des problèmes :
1. Vérifiez la console du navigateur pour les erreurs
2. Vérifiez la Firebase Console > Authentication > Users
3. Vérifiez les logs dans Firebase Console > Functions (si vous utilisez Cloud Functions)

---

## ✅ Checklist finale

- [ ] Activer Email/Password dans Firebase Console
- [ ] Tester l'inscription avec un email de test
- [ ] Vérifier la réception de l'email de vérification
- [ ] Tester la connexion après vérification
- [ ] Tester le reset password
- [ ] Tester Google Sign-In
- [ ] Vérifier que la navbar redirige correctement
- [ ] Vérifier le responsive sur mobile
- [ ] Déployer en production

---

**Implémenté par Claude Code - Cuisine Artisanale**
Date : 2025-12-08
