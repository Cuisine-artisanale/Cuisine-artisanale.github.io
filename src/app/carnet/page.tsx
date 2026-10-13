"use client";
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import RecetteDesc from '@/components/features/RecetteDesc/RecetteDesc';
import { useAuth } from '@/contexts/AuthContext/AuthContext';
import { useToast } from '@/contexts/ToastContext/ToastContext';
import { loadFirestore } from '@/lib/config/firestore-lazy';
import type { Recipe } from '@/types';
import './carnet.css';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; recipe: Recipe };

/** Fiche d'une recette du carnet privé (/carnet?id=…), lue directement par son propriétaire. */
function CarnetRecipe() {
  const id = useSearchParams()?.get('id') || '';
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const uid = user?.uid;
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (!id) {
      router.replace('/account/carnet');
      return;
    }
    if (!uid) return;
    let cancelled = false;

    (async () => {
      try {
        const { db, doc, getDoc } = await loadFirestore();
        const snapshot = await getDoc(doc(db, 'users', uid, 'carnet', id));
        if (cancelled) return;
        if (!snapshot.exists()) {
          setState({ status: 'missing' });
          return;
        }
        const data = snapshot.data();
        setState({
          status: 'ready',
          recipe: {
            id: snapshot.id,
            title: data.title || '',
            type: data.type || '',
            preparationTime: Number(data.preparationTime) || 0,
            cookingTime: Number(data.cookingTime) || 0,
            recipeParts: Array.isArray(data.recipeParts) ? data.recipeParts : [],
            position: data.position || 'none',
            images: Array.isArray(data.images) ? data.images : [],
            video: data.video || undefined,
            servings: typeof data.servings === 'number' ? data.servings : undefined,
            source: data.source,
          },
        });
      } catch (error) {
        console.error('Erreur lors du chargement de la recette du carnet :', error);
        if (!cancelled) setState({ status: 'missing' });
      }
    })();

    return () => { cancelled = true; };
  }, [id, uid, router]);

  const removeFromNotebook = async () => {
    if (!uid) return;
    const { db, doc, deleteDoc } = await loadFirestore();
    await deleteDoc(doc(db, 'users', uid, 'carnet', id));
    showToast({ severity: 'success', summary: 'Retirée', detail: 'Recette retirée de votre carnet' });
    router.push('/account/carnet');
  };

  if (!user) {
    return (
      <div className="carnet-message">
        <p>Connectez-vous pour ouvrir votre carnet.</p>
        <Link href={`/login?redirect=${encodeURIComponent(`/carnet?id=${id}`)}`}>Se connecter</Link>
      </div>
    );
  }

  if (state.status === 'loading') {
    return <div className="carnet-message"><p>Chargement de la recette...</p></div>;
  }

  if (state.status === 'missing') {
    return (
      <div className="carnet-message">
        <p>Cette recette n&apos;est pas dans votre carnet.</p>
        <Link href="/account/carnet">Retour au carnet</Link>
      </div>
    );
  }

  return <RecetteDesc key={state.recipe.id} initialRecipe={state.recipe} notebook={{ onRemove: removeFromNotebook }} />;
}

export default function CarnetRecipePage() {
  return (
    <Suspense fallback={<div className="carnet-message"><p>Chargement de la recette...</p></div>}>
      <CarnetRecipe />
    </Suspense>
  );
}
