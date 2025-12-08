# 📱 MOBILE & PWA - GUIDE COMPLET

Ce document résume toutes les optimisations mobiles et PWA appliquées au projet **Cuisine Artisanale**.

---

## ✅ CE QUI A ÉTÉ FAIT

### 🎨 **OPTIMISATIONS CSS MOBILE**

#### **1. Fichier Global `src/styles/mobile.css`**
Un fichier CSS global a été créé avec toutes les optimisations mobiles :
- ✅ Touch targets minimum 44px × 44px (standard Apple/Google)
- ✅ Font-size minimum 16px pour éviter le zoom iOS
- ✅ Séparation desktop/mobile avec `@media (hover: hover)`
- ✅ Active states pour feedback tactile
- ✅ Bottom sheets pour dialogs/filtres
- ✅ Support iPhone notch (safe area)
- ✅ GPU acceleration pour animations fluides
- ✅ Pull-to-refresh désactivé

#### **2. Fichiers CSS Optimisés**

**Navbar.css :**
- Theme toggle: 32px → **44px** (touch-friendly)
- Auto-hide désactivé sur mobile (frustrant)
- Navbar sticky toujours visible

**BurgerMenu.css :**
- Burger button: 30px × 25px → **44px × 44px**
- Animation de transformation améliorée

**AddRecetteForm.css :**
- Step numbers: 28px → **36px**
- Tous les boutons: min-height **48px**
- Textarea: min-height **120px**, font-size **16px**
- Inputs: min-height **48px**, font-size **16px**

**Filtre.css :**
- Bottom sheet style pour mobile
- Checkboxes: **24px × 24px**
- Boutons: min-height **48px**
- Handle de drag visuel

**dialog.css :**
- Bottom sheet style avec animation slideUp
- Boutons: min-height **48px**
- Close button: **44px × 44px**
- Support safe area iPhone

**theme.css :**
- ✅ Déjà optimisé : font-size **16px** (évite zoom iOS)
- Input heights correctes

---

### 📦 **PWA (PROGRESSIVE WEB APP)**

#### **1. manifest.json** (`public/manifest.json`)
```json
{
  "name": "Cuisine Artisanale",
  "short_name": "Cuisine Artisanale",
  "start_url": "//",
  "display": "standalone",
  "theme_color": "#8B4513",
  "background_color": "#FFF9F5"
}
```

Inclut :
- ✅ Métadonnées de l'app
- ✅ Icônes (192x192, 512x512, Apple touch icon)
- ✅ Shortcuts (Recettes, Carte, Compte)
- ✅ Screenshots (pour App Store)

#### **2. Service Worker** (`public/sw.js`)
Stratégie : **Network First, fallback sur Cache**
- ✅ Cache des assets statiques
- ✅ Fonctionnement offline basique
- ✅ Mise à jour automatique
- ✅ Suppression des anciens caches

#### **3. Enregistrement SW** (`src/utils/register-sw.ts`)
- ✅ Enregistrement automatique en production
- ✅ Détection des mises à jour
- ✅ Notification utilisateur (optionnel)
- ✅ Fonction de désinstallation (debug)

#### **4. PWA Provider** (`src/components/PWAProvider/PWAProvider.tsx`)
- ✅ Composant client pour initialiser la PWA
- ✅ Gestion événement `beforeinstallprompt`
- ✅ Détection installation

#### **5. Meta Tags PWA** (`src/app/layout.tsx`)
```tsx
manifest: '/Cuisine-artisanale/manifest.json',
appleWebApp: { capable: true, statusBarStyle: 'default' },
themeColor: '#8B4513',
viewport: { viewportFit: 'cover' }
```

---

## 🚧 CE QU'IL RESTE À FAIRE

### **1. CRÉER LES ICÔNES PWA** ⚠️ IMPORTANT

Vous devez créer les icônes suivantes dans le dossier `public/` :

**Icônes requises :**
- `icon-192.png` (192 × 192px)
- `icon-512.png` (512 × 512px)
- `apple-touch-icon.png` (180 × 180px)
- `favicon.ico` (16 × 16px, 32 × 32px)

**Outils recommandés :**
1. **Canva** (gratuit) : https://www.canva.com
2. **Figma** (gratuit)
3. **RealFaviconGenerator** : https://realfavicongenerator.net/

**Instructions :**
```bash
# 1. Créer une image carrée de votre logo (512x512px minimum)
# 2. Utiliser un générateur en ligne pour créer toutes les tailles
# 3. Placer les fichiers dans public/
```

**Design recommandé :**
- Fond : `#8B4513` (couleur primaire du thème)
- Logo/Icône centré
- Marges de sécurité : 10% (éviter découpage)

### **2. CRÉER LES SCREENSHOTS** (Optionnel mais recommandé)

Pour affichage dans les stores d'apps :

**Screenshots requis :**
- `screenshot-mobile.png` (750 × 1334px) - Vue mobile
- `screenshot-wide.png` (1280 × 720px) - Vue desktop

**Comment créer :**
1. Ouvrir votre app en mode responsive (DevTools)
2. Prendre des screenshots des pages principales
3. Les placer dans `public/`

### **3. TESTER LA PWA**

#### **Test sur Desktop (Chrome/Edge) :**
```bash
# 1. Build de production
npm run build

# 2. Servir localement
npm run start

# 3. Ouvrir Chrome DevTools
# - Onglet "Application" > "Manifest"
# - Vérifier que manifest.json se charge
# - Tester l'installation (icône dans la barre d'adresse)
```

#### **Test sur iOS Safari :**
1. Déployer sur GitHub Pages
2. Ouvrir Safari sur iPhone
3. Partager > "Sur l'écran d'accueil"
4. Vérifier :
   - Icône correcte
   - Splash screen
   - Pas de barre Safari

#### **Test sur Android Chrome :**
1. Déployer sur GitHub Pages
2. Ouvrir Chrome sur Android
3. Menu > "Installer l'application"
4. Vérifier :
   - Icône correcte
   - Mode standalone
   - Fonctionnement offline

### **4. AUDITS & OPTIMISATIONS**

**Lighthouse Audit :**
```bash
# Dans Chrome DevTools
# 1. Onglet "Lighthouse"
# 2. Sélectionner "Progressive Web App"
# 3. Run audit
# 4. Viser 90+ score
```

**Checklist PWA :**
- [ ] Manifest valide
- [ ] Service Worker enregistré
- [ ] Icônes toutes tailles
- [ ] HTTPS (GitHub Pages ✅)
- [ ] Responsive design
- [ ] Offline fallback
- [ ] Splash screen (iOS)

---

## 📝 MODIFICATIONS FUTURES POSSIBLES

### **Si vous voulez des fonctionnalités natives (Capacitor) :**

**Installation Capacitor :**
```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Cuisine Artisanale" "com.cuisineartisanale.app"
npm install @capacitor/android @capacitor/ios
```

**Plugins utiles :**
- `@capacitor/camera` - Prendre des photos de recettes
- `@capacitor/push-notifications` - Notifications push
- `@capacitor/geolocation` - Géolocalisation pour carte
- `@capacitor/storage` - Stockage local avancé

### **Si bottom sheets ne s'appliquent pas automatiquement :**

Ajouter la classe `mobile-sheet` aux composants :

```tsx
// Exemple pour Filtre
<div className={`Filtre ${isMobile ? 'mobile-sheet' : ''}`}>

// Exemple pour Dialog
<Dialog className="mobile-bottom-sheet">
```

---

## 🎯 RÉSULTAT FINAL

Une fois les icônes créées et les tests effectués, vous aurez :

✅ **Application mobile-friendly**
- Touch targets optimisés (44px min)
- Inputs tactiles (16px min font-size)
- Navbar sticky sans auto-hide
- Bottom sheets pour filtres/dialogs

✅ **PWA installable**
- Bouton "Installer" dans le navigateur
- Icône sur l'écran d'accueil
- Mode standalone (pas de barre de navigation)
- Splash screen au lancement

✅ **Fonctionnement offline basique**
- Cache des pages visitées
- Fallback en cas de perte réseau

✅ **Performances optimisées**
- GPU acceleration
- Lazy loading
- Service Worker cache

---

## 🐛 DEBUG

### **Service Worker ne s'enregistre pas :**
```javascript
// Dans la console navigateur
navigator.serviceWorker.getRegistrations()
  .then(regs => console.log(regs));

// Vérifier les erreurs
navigator.serviceWorker.register('/Cuisine-artisanale/sw.js')
  .then(() => console.log('OK'))
  .catch(err => console.error(err));
```

### **Manifest ne se charge pas :**
```bash
# Vérifier l'URL dans DevTools > Application > Manifest
# Doit être : https://[username].github.io/Cuisine-artisanale/manifest.json
```

### **Icônes ne s'affichent pas :**
```bash
# Vérifier que les fichiers existent
ls public/icon-*.png

# Vérifier les chemins dans manifest.json
# Doivent être : /Cuisine-artisanale/icon-192.png
```

### **Désinstaller complètement la PWA :**
```javascript
// Console navigateur
import { unregisterServiceWorker } from '@/utils/register-sw';
unregisterServiceWorker();
```

---

## 📚 RESSOURCES

**Documentation PWA :**
- MDN Web Docs : https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
- Google PWA Guide : https://web.dev/progressive-web-apps/
- Apple PWA Support : https://developer.apple.com/documentation/webkit/

**Outils de test :**
- Lighthouse : Chrome DevTools
- PWA Builder : https://www.pwabuilder.com/
- Manifest Validator : https://manifest-validator.appspot.com/

**Générateurs :**
- Icônes : https://realfavicongenerator.net/
- Screenshots : Chrome DevTools > Device Mode
- Manifest : https://www.simicart.com/manifest-generator.html/

---

## ✨ CONCLUSION

Vous avez maintenant une **application web optimisée pour mobile** avec toutes les bases PWA en place !

**Prochaines étapes :**
1. ✅ Créer les icônes (30 min)
2. ✅ Build & deploy
3. ✅ Tester sur mobile
4. ✅ Run Lighthouse audit
5. ✅ Itérer selon feedback

**Questions ?** Consultez ce document ou la documentation officielle PWA.

---

**Date de création :** 16 novembre 2025
**Version :** 1.0
**Auteur :** Claude Code - Assistant IA
