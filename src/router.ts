import { useEffect, useState } from 'react';

export function useRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, '') || 'workout').split('/');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string): void {
  location.hash = `#/${path}`;
}

export function back(fallback: string): void {
  if (history.length > 1) history.back();
  else go(fallback);
}
