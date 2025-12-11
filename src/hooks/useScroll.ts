import { useState, useEffect } from 'react';

interface UseScrollOptions {
  threshold?: number;
  onScroll?: (scrollY: number) => void;
}

interface UseScrollReturn {
  scrollY: number;
  isScrolled: boolean;
  direction: 'up' | 'down' | null;
}

/**
 * Hook personnalisé pour gérer le scroll de la fenêtre
 * @param threshold - Seuil pour considérer que la page est scrollée (défaut: 20)
 * @param onScroll - Callback appelé à chaque scroll
 * @returns État du scroll
 */
export function useScroll({
  threshold = 20,
  onScroll
}: UseScrollOptions = {}): UseScrollReturn {
  const [scrollY, setScrollY] = useState<number>(0);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const [lastScrollY, setLastScrollY] = useState<number>(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      setScrollY(currentScrollY);
      setIsScrolled(currentScrollY > threshold);

      // Déterminer la direction du scroll
      if (currentScrollY > lastScrollY) {
        setDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setDirection('up');
      }

      setLastScrollY(currentScrollY);
      onScroll?.(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold, lastScrollY, onScroll]);

  return {
    scrollY,
    isScrolled,
    direction
  };
}

