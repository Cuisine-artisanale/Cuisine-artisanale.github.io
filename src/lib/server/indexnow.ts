import { SITE_URL } from '@/lib/server/recipes';

/**
 * IndexNow : signale aux moteurs qui le prennent en charge (Bing, Yandex, Seznam, Naver…) que des
 * pages ont changé, pour qu'ils les explorent sans attendre. Bing alimente aussi la recherche de
 * ChatGPT et de Copilot. Google n'utilise pas IndexNow : il relit le sitemap de lui-même.
 *
 * La clé n'est pas secrète : elle prouve que le site autorise ces signalements, et doit être
 * servie telle quelle par public/{clé}.txt.
 */
const INDEXNOW_KEY = '74b38efe13d645ed9bd0ae250f2e6274';

/** Signale des chemins du site ("/recettes/aligot"…). Sans effet hors production ; erreurs seulement journalisées. */
export async function notifyIndexNow(paths: string[]): Promise<void> {
  if (process.env.VERCEL_ENV !== 'production' || paths.length === 0) return;

  const { host } = new URL(SITE_URL);
  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: [...new Set(paths)].slice(0, 100).map((path) => `${SITE_URL}${path}`),
      }),
    });
    // 200 / 202 : reçu ; 422 / 403 : URL ou clé refusée
    if (!response.ok) console.error(`IndexNow a refusé le signalement (${response.status})`);
  } catch (error) {
    console.error('IndexNow injoignable :', error);
  }
}
