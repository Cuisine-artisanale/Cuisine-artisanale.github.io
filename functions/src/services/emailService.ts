/**
 * Service d'email centralisé pour Cuisine Artisanale
 *
 * Ce service unifie tous les envois d'emails de l'application en utilisant Resend.
 * Resend est déjà configuré avec le domaine cuisine-artisanale.fr
 *
 * Types d'emails gérés :
 * - Emails de vérification
 * - Newsletter hebdomadaire
 * - Notifications de recettes
 * - Emails de réinitialisation de mot de passe
 */

import { Resend } from "resend";

// Types pour les emails
export interface EmailOptions {
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
	from?: string;
	replyTo?: string;
}

export interface EmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

class EmailService {
	private resend: Resend;
	private defaultFrom: string;

	constructor(resendApiKey: string, defaultFrom: string) {
		if (!resendApiKey) {
			throw new Error("RESEND_API_KEY est requis pour initialiser le service d'email");
		}

		this.resend = new Resend(resendApiKey);
		this.defaultFrom = defaultFrom;
		console.log("✅ EmailService: Resend initialisé avec succès");
	}

	/**
	 * Envoie un email via Resend
	 */
	async sendEmail(options: EmailOptions): Promise<EmailResult> {
		const from = options.from || this.defaultFrom;
		const recipients = Array.isArray(options.to) ? options.to : [options.to];

		try {
			const emailData: any = {
				from,
				to: recipients,
				subject: options.subject,
				html: options.html,
			};

			if (options.text) {
				emailData.text = options.text;
			}

			if (options.replyTo) {
				emailData.reply_to = options.replyTo;
			}

			const { data, error } = await this.resend.emails.send(emailData);

			if (error) {
				console.error("❌ Erreur Resend:", error);
				return {
					success: false,
					error: error.message || "Erreur Resend inconnue",
				};
			}

			return {
				success: true,
				messageId: data?.id,
			};
		} catch (error: any) {
			console.error("❌ Erreur lors de l'envoi de l'email:", error);
			return {
				success: false,
				error: error.message || "Erreur inconnue lors de l'envoi",
			};
		}
	}

	/**
	 * Vérifie la disponibilité du service
	 */
	isAvailable(): boolean {
		return this.resend !== null;
	}

	/**
	 * Retourne le provider utilisé (toujours "resend")
	 */
	getCurrentProvider(): string {
		return "resend";
	}
}

// Instance singleton du service d'email
let emailServiceInstance: EmailService | null = null;

/**
 * Initialise le service d'email avec Resend
 */
export function initializeEmailService(
	resendApiKey: string,
	defaultFrom: string
): EmailService {
	emailServiceInstance = new EmailService(resendApiKey, defaultFrom);
	return emailServiceInstance;
}

/**
 * Récupère l'instance du service d'email
 */
export function getEmailService(): EmailService {
	if (!emailServiceInstance) {
		throw new Error(
			"EmailService n'est pas initialisé. Appelez initializeEmailService() ou createEmailServiceFromEnv() d'abord."
		);
	}
	return emailServiceInstance;
}

/**
 * Crée une instance du service d'email depuis les variables d'environnement
 * (pour utilisation dans les Cloud Functions)
 */
export function createEmailServiceFromEnv(): EmailService {
	const resendApiKey = process.env.RESEND_API_KEY;
	const defaultFrom =
		process.env.RESEND_FROM_EMAIL ||
		process.env.EMAIL_FROM ||
		"Cuisine Artisanale <onboarding@resend.dev>"; // Adresse par défaut pour les tests (domaine vérifié)

	if (!resendApiKey) {
		throw new Error(
			"RESEND_API_KEY n'est pas définie. Configurez-la dans les secrets Firebase."
		);
	}

	return initializeEmailService(resendApiKey, defaultFrom);
}
