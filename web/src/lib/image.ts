export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('data:')) {
    return trimmed;
  }

  if (trimmed.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  if (trimmed.startsWith('iVBOR')) {
    return `data:image/png;base64,${trimmed}`;
  }
  if (trimmed.startsWith('R0lG')) {
    return `data:image/gif;base64,${trimmed}`;
  }
  if (trimmed.startsWith('UklGR')) {
    return `data:image/webp;base64,${trimmed}`;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  let backendOrigin = '';

  if (apiBase.startsWith('http://') || apiBase.startsWith('https://')) {
    try {
      const parsed = new URL(apiBase);
      backendOrigin = parsed.origin;
    } catch {
      backendOrigin = '';
    }
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${backendOrigin}${cleanPath}`;
}
