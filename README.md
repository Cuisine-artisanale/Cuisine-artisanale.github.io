# Cuisine Artisanale 🍳

Une application web moderne pour partager et découvrir des recettes artisanales françaises.

## 🌟 Fonctionnalités

### 🍽️ Recettes
- **Recettes Authentiques** : Partagez et découvrez des recettes traditionnelles françaises
- **Géolocalisation** : Carte interactive avec association des recettes à leur département d'origine
- **Gestion des Ingrédients** : Système complet de gestion des ingrédients avec quantités et unités
- **Export & Impression** : Téléchargez vos recettes en PDF ou imprimez-les directement
- **Médias** : Support pour les images et vidéos dans les recettes
- **Recherche & Filtres** : Recherche avancée et filtres par département, catégorie, etc.
- **Recommandations** : Système de recommandations personnalisées et recettes tendances
- **Avis & Notes** : Système de notation et d'avis sur les recettes
- **Favoris** : Sauvegardez vos recettes préférées

### 👤 Compte Utilisateur
- **Authentification** : Système de connexion avec vérification d'email
- **Profil** : Gestion du profil utilisateur
- **Mes Recettes** : Gestion de vos recettes personnelles
- **Liste de Course** : Créez des listes de course à partir des recettes
- **À Faire** : Suivez vos recettes à essayer

### 📰 Actualités & Posts
- **Posts** : Partagez des actualités et articles culinaires
- **Newsletter** : Abonnez-vous à la newsletter

### 🛡️ Administration
- **Panneau d'Administration** : Interface complète de gestion
- **Modération** : Validation et modération des recettes par les administrateurs
- **Gestion des Utilisateurs** : Administration des comptes utilisateurs
- **Gestion des Ingrédients & Unités** : Administration des données de référence

### ♿ Accessibilité
- **WCAG 2.1 AA** : Conforme aux standards d'accessibilité
- **Navigation Clavier** : Navigation complète au clavier
- **Contraste Optimisé** : Couleurs avec ratios de contraste optimaux
- **Lecteurs d'Écran** : Support complet des technologies d'assistance

### 📱 Progressive Web App (PWA)
- **Installation** : Installation sur appareils mobiles et desktop
- **Mode Hors Ligne** : Fonctionnalités disponibles hors ligne
- **Service Worker** : Mise en cache intelligente

### 🎨 Interface Utilisateur
- **Design Responsive** : Adapté à tous les écrans (mobile, tablette, desktop)
- **Thème Clair/Sombre** : Basculement entre thèmes
- **Skeleton Loaders** : Indicateurs de chargement modernes
- **Animations Fluides** : Animations avec Framer Motion
- **Navigation Intuitive** : Navigation claire et accessible

## 🛠️ Technologies Utilisées

### Frontend
- **Next.js 15** : Framework React avec App Router
- **React 19** : Bibliothèque UI
- **TypeScript** : Typage statique
- **PrimeReact** : Composants UI
- **Framer Motion** : Animations
- **React Leaflet** : Cartes interactives
- **CSS par composant** : une feuille de style à côté de chaque composant
- **React Toastify** : Notifications

### Backend & Services
- **Firebase** :
  - Authentication (connexion, vérification email, réinitialisation mot de passe)
  - Firestore (base de données NoSQL)
  - Storage (stockage de fichiers)
  - Functions (Cloud Functions pour emails et logique serveur)
- **Resend** : Service d'envoi d'emails
- **Vercel** : Hébergement du site Next.js (pages + routes API)

### Outils & Bibliothèques
- **jsPDF** : Génération de PDF
- **html2canvas** : Capture d'écran pour PDF
- **next/og** : Génération d'images Open Graph


## 🌐 Site en Ligne

L'application est disponible en ligne à l'adresse : **[cuisine-artisanale.fr](https://cuisine-artisanale.fr)**

Vous pouvez y découvrir toutes les recettes, créer un compte, partager vos propres recettes et profiter de toutes les fonctionnalités de l'application.

## 📁 Structure du Projet

```
src/
├── app/                    # Pages et routes (Next.js App Router)
│   ├── api/               # Routes API Next.js
│   ├── account/           # Pages de compte utilisateur
│   ├── admin-panel/       # Pages d'administration
│   ├── recettes/          # Pages de recettes
│   ├── map/               # Page carte interactive
│   └── layout.tsx         # Layout racine
│
├── components/            # Composants React réutilisables
│   ├── ui/               # Composants UI de base
│   ├── features/         # Composants liés aux fonctionnalités
│   └── layout/           # Composants de mise en page
│
├── lib/                   # Bibliothèques et utilitaires
│   ├── config/           # Configurations (Firebase, etc.)
│   ├── services/         # Services métier
│   └── utils/            # Fonctions utilitaires
│
├── hooks/                 # Custom React hooks
│   ├── useRecipeLikes.ts
│   ├── useRecipeReviews.ts
│   ├── useScroll.ts
│   └── useConfirmDialog.ts
│
├── contexts/              # Contextes React
│   ├── AuthContext/      # Contexte d'authentification
│   ├── ThemeContext/     # Contexte de thème
│   └── ToastContext/     # Contexte de notifications
│
├── types/                 # Types TypeScript
│   ├── recipe.types.ts
│   ├── post.types.ts
│   ├── user.types.ts
│   └── ...
│
├── styles/                # Styles globaux
│   ├── theme.css
│   ├── accessibility.css
│   └── mobile.css
│
└── assets/                # Assets statiques
    └── departements*.json

functions/                 # Firebase Cloud Functions
├── src/
│   ├── index.ts          # Point d'entrée
│   ├── recipes.ts        # Fonctions liées aux recettes
│   ├── ingredients.ts    # Fonctions liées aux ingrédients
│   └── services/
│       └── emailService.ts
└── package.json

```

## 🔑 Fonctionnalités Principales

### Gestion des Recettes
- Création de recettes avec étapes détaillées
- Gestion des ingrédients avec quantités et unités
- Support pour les images et vidéos
- Association avec les départements français
- Export PDF et impression
- Système de likes et favoris
- Avis et notes

### Carte Interactive
- Visualisation des recettes sur une carte de France
- Filtrage par département
- Clustering des marqueurs
- Navigation vers les recettes

### Système de Modération
- Validation des recettes par les administrateurs
- Gestion de la visibilité des recettes
- Système de signalement

### Interface Utilisateur
- Design responsive
- Thème clair/sombre
- Navigation intuitive
- Filtres et recherche
- Skeleton loaders pour une meilleure UX
- Animations fluides

## 🧪 Tests & Qualité

```bash
npm run dev        # serveur de développement
npm run typecheck  # vérification TypeScript
npm run lint       # ESLint (config Next.js)
npm run build      # build de production (échoue en cas d'erreur TS ou ESLint)
```

## 🚢 Déploiement

- **Site (Next.js)** : déployé sur **Vercel**, à chaque push sur la branche de production.
- **Firebase** : Firestore, Auth, Storage et Cloud Functions restent sur Firebase.
  - Règles Firestore : `firebase deploy --only firestore:rules`
  - Cloud Functions : `cd functions && npm run deploy`

### Variables d'environnement (Vercel)

| Variable | Rôle |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON du compte de service Firebase Admin (routes API) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Envoi des emails |
| `NEXT_PUBLIC_FRONTEND_URL` | URL publique du site (liens dans les emails) |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` | Connexion TikTok (OAuth) |
| `TIKTOK_OAUTH_STATE_SECRET`, `TIKTOK_TOKEN_ENCRYPTION_KEY` | Signature de l'état OAuth et chiffrement des jetons |
| `AI_ENABLED`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `OPENAI_API_KEY`, `OPENAI_MODEL` | Enrichissement IA de l'import TikTok |

En local, ces variables vont dans `.env.local` (non versionné). La clé Admin peut aussi être placée dans `src/firebase/serviceAccountKey.json` (ignoré par git).


## 🔒 Sécurité

- Authentification Firebase, vérification d'email et réinitialisation de mot de passe via des liens Firebase générés côté serveur
- Règles Firestore : écriture limitée à l'auteur ou à un admin, rôle utilisateur non modifiable par l'utilisateur lui-même
- Routes API sensibles authentifiées par ID token Firebase
- Newsletter gérée uniquement côté serveur (Firebase Admin)

## 🌐 Accessibilité

L'application respecte les standards WCAG 2.1 Level AA :
- ✅ Contraste des couleurs optimisé (ratio 4.5:1 minimum)
- ✅ Navigation au clavier complète
- ✅ Support des lecteurs d'écran
- ✅ Textes alternatifs sur toutes les images
- ✅ Skip-to-main pour la navigation
- ✅ Respect des préférences utilisateur (mouvement réduit, contraste élevé)

## 📱 Progressive Web App

L'application est installable en tant que PWA :
- Service Worker pour le mode hors ligne
- Manifest pour l'installation
- Mise en cache intelligente
- Support mobile et desktop

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche pour votre fonctionnalité (`git checkout -b feature/AmazingFeature`)
3. Commiter vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Pousser vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

### Guidelines
- Suivre les conventions de code existantes
- Ajouter des tests si possible
- Documenter les nouvelles fonctionnalités
- Respecter les standards d'accessibilité

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## 👥 Auteurs

- **Sabatier Aymeric** - Développeur Principal

## 🙏 Remerciements

- **PrimeReact** pour les composants UI
- **Firebase** pour l'infrastructure backend
- **Next.js** pour le framework React
- **React Leaflet** pour les cartes interactives
- La communauté open source

## 📞 Support

Pour toute question ou problème :
- Ouvrir une issue sur GitHub
- Consulter la documentation dans `docs/`

---

Made with ❤️ in France 🇫🇷
