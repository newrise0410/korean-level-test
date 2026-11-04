import { useEffect, useState } from 'react';

export function go(path: string) {
  location.hash = path;
  window.scrollTo(0, 0);
}

export function useRoute(): string[] {
  const get = () => (location.hash.slice(1) || '/').split('/').filter(Boolean);
  const [parts, setParts] = useState(get);
  useEffect(() => {
    const f = () => setParts(get());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return parts;
}
