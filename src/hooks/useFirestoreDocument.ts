import { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/config/firebase';

interface UseFirestoreDocumentOptions<T> {
  collection: string;
  documentId: string;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

interface UseFirestoreDocumentReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook personnalisé pour récupérer et écouter un document Firestore
 * @param collection - Nom de la collection
 * @param documentId - ID du document
 * @param enabled - Activer/désactiver la requête (défaut: true)
 * @param onError - Callback en cas d'erreur
 * @returns Données, état de chargement et fonction de refetch
 */
export function useFirestoreDocument<T extends DocumentData = DocumentData>({
  collection: collectionName,
  documentId,
  enabled = true,
  onError
}: UseFirestoreDocumentOptions<T>): UseFirestoreDocumentReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    if (!enabled || !documentId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setData({ id: docSnap.id, ...docSnap.data() } as T);
      } else {
        setData(null);
      }
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      console.error(`Erreur lors de la récupération du document ${documentId}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  // Écouter les changements en temps réel
  useEffect(() => {
    if (!enabled || !documentId) {
      setIsLoading(false);
      return;
    }

    const docRef = doc(db, collectionName, documentId);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setData({ id: docSnap.id, ...docSnap.data() } as T);
        } else {
          setData(null);
        }
        setIsLoading(false);
        setError(null);
      },
      (err) => {
        const error = err as Error;
        setError(error);
        setIsLoading(false);
        onError?.(error);
        console.error(`Erreur lors de l'écoute du document ${documentId}:`, error);
      }
    );

    return () => unsubscribe();
  }, [collectionName, documentId, enabled, onError]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData
  };
}

