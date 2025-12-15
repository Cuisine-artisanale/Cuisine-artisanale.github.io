/**
 * Templates d'email pour Cuisine Artisanale
 *
 * Tous les templates utilisent un design cohérent avec la charte graphique de l'application
 */

export interface WeeklyRecipeData {
	title: string;
	type: string;
	images: string[];
	recipeUrl: string;
	unsubscribeUrl: string;
}

export interface VerificationEmailData {
	displayName: string;
	verificationLink: string;
}

export interface PasswordResetData {
	resetLink: string;
}

export interface RecipeNotificationData {
	recipeTitle: string;
	recipeUrl: string;
}

/**
 * Template de base pour tous les emails
 */
function getBaseTemplate(content: string, title: string): string {
	return `
<!DOCTYPE html>
<html lang="fr">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title}</title>
	<style>
		body {
			font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
			background-color: #f5f5f5;
			margin: 0;
			padding: 20px;
			line-height: 1.6;
		}
		.container {
			max-width: 600px;
			margin: 0 auto;
			background-color: #ffffff;
			border-radius: 12px;
			overflow: hidden;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		}
		.header {
			background: linear-gradient(135deg, #8B4513, #CD853F);
			color: white;
			padding: 30px;
			text-align: center;
		}
		.header h1 {
			margin: 0;
			font-size: 28px;
		}
		.content {
			padding: 40px 30px;
			background-color: #FFF9F5;
			color: #2C1810;
		}
		.content p {
			font-size: 16px;
			line-height: 1.6;
			color: #2C1810;
			margin-bottom: 20px;
		}
		.button {
			display: inline-block;
			background-color: #8B4513;
			color: white;
			padding: 15px 40px;
			text-decoration: none;
			border-radius: 8px;
			font-weight: bold;
			font-size: 16px;
			margin: 20px 0;
			transition: background-color 0.3s;
		}
		.button:hover {
			background-color: #A0522D;
		}
		.footer {
			background-color: #f9f9f9;
			padding: 20px;
			text-align: center;
			font-size: 14px;
			color: #666;
			border-top: 1px solid #E8D5CC;
		}
		.warning {
			background-color: #fff3cd;
			border-left: 4px solid #ffc107;
			padding: 15px;
			margin: 20px 0;
			border-radius: 4px;
		}
		.recipe-image {
			width: 100%;
			max-width: 480px;
			border-radius: 10px;
			border: 1px solid #E8D5CC;
			margin: 20px 0;
		}
		@media only screen and (max-width: 600px) {
			.container {
				width: 100% !important;
				border-radius: 0;
			}
			.content {
				padding: 20px !important;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>${title}</h1>
		</div>
		<div class="content">
			${content}
		</div>
		<div class="footer">
			<p>© ${new Date().getFullYear()} Cuisine Artisanale. Tous droits réservés.</p>
			<p style="font-size: 12px; color: #999; margin-top: 10px;">
				<a href="https://www.Cuisine-artisanale.fr" style="color: #8B4513; text-decoration: none;">
					www.Cuisine-artisanale.fr
				</a>
			</p>
		</div>
	</div>
</body>
</html>
	`.trim();
}

/**
 * Template pour l'email de vérification
 */
export function getVerificationEmailTemplate(data: VerificationEmailData): string {
	const content = `
		<p>Bonjour <strong>${data.displayName || "Utilisateur"}</strong>,</p>
		<p>Merci de vous être inscrit sur <strong>Cuisine Artisanale</strong> !</p>
		<p>Pour finaliser votre inscription, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
		<div style="text-align: center;">
			<a href="${data.verificationLink}" class="button">Vérifier mon email</a>
		</div>
		<div class="warning">
			<p style="margin: 0; font-size: 14px;">
				⚠️ <strong>Important :</strong> Ce lien est valable pendant <strong>1 heure</strong> uniquement.
			</p>
		</div>
		<p style="font-size: 14px; color: #666;">
			Si vous n'avez pas créé de compte, vous pouvez ignorer cet email en toute sécurité.
		</p>
		<p style="font-size: 14px; color: #666;">
			Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
			<a href="${data.verificationLink}" style="color: #8B4513; word-break: break-all;">${data.verificationLink}</a>
		</p>
	`;

	return getBaseTemplate(content, "✉️ Vérification de votre email");
}

/**
 * Template pour l'email de réinitialisation de mot de passe
 */
export function getPasswordResetEmailTemplate(data: PasswordResetData): string {
	const content = `
		<p>Bonjour,</p>
		<p>Vous avez demandé à réinitialiser votre mot de passe sur <strong>Cuisine Artisanale</strong>.</p>
		<p>Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
		<div style="text-align: center;">
			<a href="${data.resetLink}" class="button">Réinitialiser mon mot de passe</a>
		</div>
		<div class="warning">
			<p style="margin: 0; font-size: 14px;">
				⚠️ <strong>Important :</strong> Ce lien est valable pendant <strong>1 heure</strong> uniquement.
			</p>
		</div>
		<p style="font-size: 14px; color: #666;">
			Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe ne sera pas modifié.
		</p>
		<p style="font-size: 14px; color: #666;">
			Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
			<a href="${data.resetLink}" style="color: #8B4513; word-break: break-all;">${data.resetLink}</a>
		</p>
	`;

	return getBaseTemplate(content, "🔒 Réinitialisation de mot de passe");
}

/**
 * Template pour la newsletter hebdomadaire (recette de la semaine)
 */
export function getWeeklyRecipeEmailTemplate(data: WeeklyRecipeData): string {
	const content = `
		<h2 style="text-align: center; color: #8B4513; margin-top: 0;">🍪 ${data.title}</h2>
		<p style="text-align: center; font-size: 16px; color: #7D4F50;">Bonjour gourmand(e) !</p>
		<p style="font-size: 15px; line-height: 1.6; color: #2C1810;">
			Découvrez notre nouvelle recette ${data.type.toLowerCase()} de la semaine : simple, savoureuse et parfaite pour vos repas du dimanche 😋
		</p>
		<div style="text-align: center; margin: 25px 0;">
			<img src="${data.images[0]}" alt="${data.title}" class="recipe-image" />
		</div>
		<div style="text-align: center;">
			<a href="${data.recipeUrl}" class="button">👉 Voir la recette complète</a>
		</div>
		<hr style="margin: 30px 0; border: none; border-top: 1px solid #E8D5CC;">
		<p style="font-size: 14px; color: #7D4F50; text-align: center;">
			Vous recevez cet email car vous êtes inscrit(e) à la newsletter de
			<a href="https://www.Cuisine-artisanale.fr" style="color: #8B4513; text-decoration: none; font-weight: bold;">
				Cuisine Artisanale
			</a> 🍰
		</p>
		<p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
			<a href="${data.unsubscribeUrl}" style="color: #A0522D; text-decoration: none;">
				Se désabonner
			</a>
		</p>
	`;

	return getBaseTemplate(content, "🍰 Votre recette de la semaine");
}

/**
 * Template pour les notifications de nouvelles recettes
 */
export function getRecipeNotificationEmailTemplate(data: RecipeNotificationData): string {
	const content = `
		<p>Bonjour,</p>
		<p>Une nouvelle recette a été ajoutée sur <strong>Cuisine Artisanale</strong> :</p>
		<h2 style="color: #8B4513; margin: 20px 0;">${data.recipeTitle}</h2>
		<div style="text-align: center;">
			<a href="${data.recipeUrl}" class="button">Découvrir la recette</a>
		</div>
		<p style="font-size: 14px; color: #666;">
			Bon appétit ! 🍽️
		</p>
	`;

	return getBaseTemplate(content, "🍪 Nouvelle recette disponible");
}

/**
 * Template d'email de bienvenue
 */
export function getWelcomeEmailTemplate(displayName: string): string {
	const content = `
		<p>Bonjour <strong>${displayName}</strong>,</p>
		<p>Bienvenue sur <strong>Cuisine Artisanale</strong> ! 🎉</p>
		<p>Nous sommes ravis de vous compter parmi nos membres. Vous pouvez maintenant :</p>
		<ul style="font-size: 15px; line-height: 1.8; color: #2C1810;">
			<li>📖 Découvrir des centaines de recettes authentiques</li>
			<li>⭐ Sauvegarder vos recettes favorites</li>
			<li>📧 Recevoir la recette de la semaine chaque dimanche</li>
			<li>🗺️ Explorer la carte des recettes par région</li>
		</ul>
		<div style="text-align: center; margin: 30px 0;">
			<a href="https://www.Cuisine-artisanale.fr" class="button">Commencer à explorer</a>
		</div>
		<p style="font-size: 14px; color: #666;">
			Si vous avez des questions ou des suggestions, n'hésitez pas à nous contacter !
		</p>
	`;

	return getBaseTemplate(content, "👋 Bienvenue sur Cuisine Artisanale");
}

/**
 * Template personnalisé (pour usage général)
 */
export function getCustomEmailTemplate(
	title: string,
	content: string,
	buttonText?: string,
	buttonUrl?: string
): string {
	let emailContent = content;

	if (buttonText && buttonUrl) {
		emailContent += `
			<div style="text-align: center; margin: 30px 0;">
				<a href="${buttonUrl}" class="button">${buttonText}</a>
			</div>
		`;
	}

	return getBaseTemplate(emailContent, title);
}

