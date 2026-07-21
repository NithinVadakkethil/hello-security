export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const backendOrigin = apiBase.replace('/api/v1', '');
  return `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
}
