import { useConfig } from '@/components/hooks/useConfig';
import { LINKS_URL, PIXELS_URL } from '@/lib/constants';

export function useSlug(type: 'link' | 'pixel') {
  const { linksUrl, pixelsUrl } = useConfig();

  const hostUrl = type === 'link' ? linksUrl || LINKS_URL : pixelsUrl || PIXELS_URL;

  const getSlugUrl = (slug: string, domain?: string | null) => {
    const baseUrl = hostUrl.replace(/\/$/, '');

    if (!domain) {
      return `${baseUrl}/${slug}`;
    }

    try {
      const url = new URL(baseUrl);
      url.hostname = domain;
      return `${url.toString().replace(/\/$/, '')}/${slug}`;
    } catch {
      return `${baseUrl}/${slug}`;
    }
  };

  return { getSlugUrl, hostUrl };
}
