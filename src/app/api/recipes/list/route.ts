import { NextRequest, NextResponse } from 'next/server';
import { getShuffledRecipesPage } from '@/lib/server/listings';

/** Au-delà, la page demandée est forcément vide (sécurité contre les valeurs absurdes) */
const MAX_PAGE = 500;

function toInt(value: string | null, max: number): number | null {
	const n = Number(value);
	return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

/**
 * Page de la liste des recettes, en mélange aléatoire pondéré (voir getShuffledRecipesPage).
 * GET ?seed=<graine du mélange>&page=<0, 1, 2…>&type=<Plat…>&position=<code département>
 * La graine vient de la première page (rendue par le serveur) : même graine, même ordre.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url);
	const seed = toInt(searchParams.get('seed'), 2 ** 31);
	const page = toInt(searchParams.get('page') ?? '0', MAX_PAGE);
	if (seed === null || page === null) {
		return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
	}

	try {
		const result = await getShuffledRecipesPage({
			seed,
			page,
			type: (searchParams.get('type') || '').slice(0, 40),
			position: (searchParams.get('position') || '').slice(0, 10),
		});
		return NextResponse.json(result);
	} catch (error) {
		console.error('Liste des recettes indisponible :', error);
		return NextResponse.json({ error: 'Liste indisponible' }, { status: 500 });
	}
}
