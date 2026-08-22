import { Config } from '../config';

export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const apiBase = Config.API_URL;
  const backendOrigin = apiBase.replace('/api/v1', '');
  return `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
}
