/** Lien de vidéo TikTok accepté par l'import (mêmes domaines que la vérification serveur) */
export function isValidTikTokUrl(url: string) {
	return /^(https?:\/\/)?(www\.)?(tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com)\/.+$/i.test(url);
}

/**
 * Premier lien TikTok trouvé dans un texte : le partage depuis l'app TikTok envoie souvent
 * une phrase du type « Regarde cette vidéo ! https://vm.tiktok.com/… ».
 */
export function extractTikTokUrl(text: string): string | null {
	const match = text.match(/(?:https?:\/\/)?(?:www\.|vm\.|vt\.)?tiktok\.com\/[^\s"'<>]+/i);
	if (!match) return null;
	// Ponctuation collée au lien en fin de phrase
	const url = match[0].replace(/[).,;!?»]+$/, '');
	return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
