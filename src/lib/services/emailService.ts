/**
 * Service d'email côté client Next.js
 * Utilise Resend pour l'envoi d'emails depuis les API routes
 */

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
	? new Resend(process.env.RESEND_API_KEY)
	: null;

export interface EmailOptions {
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
	from?: string;
}

export interface EmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

/**
 * Envoie un email via Resend
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
	if (!resend) {
		return {
			success: false,
			error: "RESEND_API_KEY n'est pas configurée",
		};
	}

	try {
		const { data, error } = await resend.emails.send({
			from: options.from || process.env.RESEND_FROM_EMAIL || "Cuisine Artisanale <onboarding@resend.dev>",
			to: Array.isArray(options.to) ? options.to : [options.to],
			subject: options.subject,
			html: options.html,
			text: options.text,
		});

		if (error) {
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
		console.error("Erreur lors de l'envoi de l'email:", error);
		return {
			success: false,
			error: error.message || "Erreur inconnue lors de l'envoi",
		};
	}
}

