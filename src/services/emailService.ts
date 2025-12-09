import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

/**
 * Génère un token de vérification unique
 */
const generateVerificationToken = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Envoie un email de vérification via Resend
 * @param email - Email de l'utilisateur
 * @param displayName - Nom d'affichage de l'utilisateur
 * @param userId - ID Firebase de l'utilisateur
 */
export const sendVerificationEmail = async (
  email: string,
  displayName: string,
  userId: string
): Promise<void> => {
  try {
    const db = getFirestore();
    const token = generateVerificationToken();
    const verificationUrl = `${window.location.origin}/verify-email?token=${token}`;

    // Sauvegarder le token dans Firestore avec expiration (24h)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await setDoc(doc(db, "verificationTokens", token), {
      userId,
      email,
      expiresAt,
      createdAt: new Date(),
      used: false,
    });

    // Note: L'envoi d'email nécessite un serveur backend.
    // Pour GitHub Pages (site statique), utilisez EmailJS ou un service tiers côté client.
    console.log("📧 Lien de vérification (à utiliser en développement):", verificationUrl);
    console.log("⚠️ L'envoi d'email automatique n'est pas disponible sur GitHub Pages");

    // TODO: Implémenter EmailJS pour l'envoi d'emails depuis le client
    // Exemple: emailjs.send('service_id', 'template_id', { email, displayName, verificationUrl })
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email de vérification:", error);
    throw new Error("Erreur lors de l'envoi de l'email de vérification");
  }
};

/**
 * Vérifie un token de vérification d'email
 * @param token - Token de vérification
 * @returns userId si le token est valide, null sinon
 */
export const verifyEmailToken = async (token: string): Promise<string | null> => {
  try {
    const db = getFirestore();
    const tokenDoc = await getDoc(doc(db, "verificationTokens", token));

    if (!tokenDoc.exists()) {
      console.log("Token introuvable");
      return null;
    }

    const data = tokenDoc.data();

    // Vérifier si le token est déjà utilisé
    if (data.used) {
      console.log("Token déjà utilisé");
      return null;
    }

    // Vérifier l'expiration
    const expiresAt = data.expiresAt.toDate();
    if (expiresAt < new Date()) {
      console.log("Token expiré");
      return null;
    }

    // Marquer le token comme utilisé
    await setDoc(doc(db, "verificationTokens", token), { ...data, used: true });

    return data.userId;
  } catch (error) {
    console.error("Erreur lors de la vérification du token:", error);
    return null;
  }
};

/**
 * Envoie un email de réinitialisation de mot de passe via Resend
 * @param email - Email de l'utilisateur
 */
export const sendPasswordResetEmailCustom = async (email: string): Promise<void> => {
  try {
    const db = getFirestore();
    const token = generateVerificationToken();
    const resetUrl = `${window.location.origin}/reset-password?token=${token}`;

    // Sauvegarder le token dans Firestore avec expiration (1h)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await setDoc(doc(db, "passwordResetTokens", token), {
      email,
      expiresAt,
      createdAt: new Date(),
      used: false,
    });

    // Note: L'envoi d'email nécessite un serveur backend.
    // Pour GitHub Pages (site statique), utilisez EmailJS ou un service tiers côté client.
    console.log("📧 Lien de réinitialisation (à utiliser en développement):", resetUrl);
    console.log("⚠️ L'envoi d'email automatique n'est pas disponible sur GitHub Pages");

    // TODO: Implémenter EmailJS pour l'envoi d'emails depuis le client
    // Exemple: emailjs.send('service_id', 'template_id', { email, resetUrl })
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email de réinitialisation:", error);
    throw new Error("Erreur lors de l'envoi de l'email de réinitialisation");
  }
};

/**
 * Vérifie un token de réinitialisation de mot de passe
 * @param token - Token de réinitialisation
 * @returns email si le token est valide, null sinon
 */
export const verifyPasswordResetToken = async (token: string): Promise<string | null> => {
  try {
    const db = getFirestore();
    const tokenDoc = await getDoc(doc(db, "passwordResetTokens", token));

    if (!tokenDoc.exists()) {
      console.log("Token introuvable");
      return null;
    }

    const data = tokenDoc.data();

    // Vérifier si le token est déjà utilisé
    if (data.used) {
      console.log("Token déjà utilisé");
      return null;
    }

    // Vérifier l'expiration
    const expiresAt = data.expiresAt.toDate();
    if (expiresAt < new Date()) {
      console.log("Token expiré");
      return null;
    }

    // Marquer le token comme utilisé
    await setDoc(doc(db, "passwordResetTokens", token), { ...data, used: true });

    return data.email;
  } catch (error) {
    console.error("Erreur lors de la vérification du token:", error);
    return null;
  }
};
