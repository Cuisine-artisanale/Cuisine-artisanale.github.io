/**
 * Templates d'email côté client Next.js
 * Version simplifiée des templates pour utilisation dans les API routes
 */

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
				<a href="https://www.aymeric-sabatier.fr/Cuisine-artisanale" style="color: #8B4513; text-decoration: none;">
					www.aymeric-sabatier.fr
				</a>
			</p>
		</div>
	</div>
</body>
</html>
	`.trim();
}

/**
 * Bouton d'email. Styles en ligne : Gmail et Outlook ignorent souvent la feuille de style
 * et affichent alors le texte du lien en bleu, sans fond.
 */
function getButton(href: string, label: string): string {
	return `<a href="${href}" class="button" style="display: inline-block; background-color: #8B4513; color: #ffffff !important; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; margin: 20px 0;"><span style="color: #ffffff;">${label}</span></a>`;
}

/**
 * Template d'email de vérification
 */
export interface VerificationEmailData {
	displayName: string;
	verificationLink: string;
}

export function getVerificationEmailTemplate(data: VerificationEmailData): string {
	const content = `
		<p>Bonjour <strong>${data.displayName || "Utilisateur"}</strong>,</p>
		<p>Merci de vous être inscrit sur <strong>Cuisine Artisanale</strong> !</p>
		<p>Pour finaliser votre inscription, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
		<div style="text-align: center;">
			${getButton(data.verificationLink, 'Vérifier mon email')}
		</div>
		<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
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
			${getButton('https://www.aymeric-sabatier.fr/Cuisine-artisanale', 'Commencer à explorer')}
		</div>
		<p style="font-size: 14px; color: #666;">
			Si vous avez des questions ou des suggestions, n'hésitez pas à nous contacter !
		</p>
	`;

	return getBaseTemplate(content, "👋 Bienvenue sur Cuisine Artisanale");
}


/** Échappe un texte saisi par un utilisateur avant de l'insérer dans un email HTML. */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Template d'email envoyé à l'auteur d'une recette quand l'admin la publie
 */
export interface RecipeApprovedEmailData {
	displayName: string;
	recipeTitle: string;
	recipeUrl: string;
	/** La recette a été retouchée par l'admin avant publication */
	modified: boolean;
	/** Renvoi après un premier email au lien erroné : ajoute un mot d'excuse */
	resent?: boolean;
}

export function getRecipeApprovedEmailTemplate(data: RecipeApprovedEmailData): string {
	const title = escapeHtml(data.recipeTitle);
	const url = escapeHtml(data.recipeUrl);
	const modifiedNote = data.modified
		? `<p>Nous y avons apporté quelques modifications (mise en forme, quantités ou étapes) pour qu'elle soit la plus claire possible pour tous les lecteurs.</p>`
		: '';
	const resentNote = data.resent
		? `<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;"><p style="margin: 0; font-size: 14px;">Toutes nos excuses : le lien de notre précédent email ne fonctionnait pas. Voici le bon lien vers votre recette.</p></div>`
		: '';

	const content = `
		<p>Bonjour <strong>${escapeHtml(data.displayName || 'Utilisateur')}</strong>,</p>
		${resentNote}
		<p>Bonne nouvelle : votre recette <strong>${title}</strong> a été acceptée et est maintenant publiée sur <strong>Cuisine Artisanale</strong> ! 🎉</p>
		${modifiedNote}
		<div style="text-align: center;">
			${getButton(url, 'Voir ma recette')}
		</div>
		<p>Merci pour votre contribution !</p>
		<p style="font-size: 14px; color: #666;">
			Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br>
			<a href="${url}" style="color: #8B4513; word-break: break-all;">${url}</a>
		</p>
	`;

	return getBaseTemplate(content, '✅ Votre recette est publiée');
}
