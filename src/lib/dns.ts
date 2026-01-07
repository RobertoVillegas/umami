export interface DNSInstructions {
  type: 'CNAME' | 'A';
  name: string;
  value: string;
  ttl: number;
}

export function getInstanceHostname(): string {
  const envHost = process.env.NEXT_PUBLIC_UMAMI_HOST || process.env.UMAMI_HOST;
  if (envHost) {
    return envHost;
  }

  const linksUrl = process.env.NEXT_PUBLIC_LINKS_URL || process.env.LINKS_URL;
  if (linksUrl) {
    try {
      const url = new URL(linksUrl);
      return url.hostname;
    } catch (e) {
      console.warn('Could not parse LINKS_URL, using localhost');
      return 'localhost';
    }
  }

  const browserHost = globalThis?.location?.hostname;
  if (browserHost) {
    return browserHost;
  }

  console.warn('UMAMI_HOST not configured, using localhost for DNS verification');
  return 'localhost';
}

export function parseDomain(domain: string): { subdomain: string | null; root: string } {
  const parts = domain.split('.');

  if (parts.length < 2) {
    throw new Error('Invalid domain format');
  }

  if (parts.length === 2) {
    return { subdomain: null, root: domain };
  }

  const subdomain = parts[0];
  const root = parts.slice(1).join('.');

  return { subdomain, root };
}

export function getDNSInstructions(domain: string): DNSInstructions {
  const { subdomain } = parseDomain(domain);
  const instanceHost = getInstanceHostname();

  return {
    type: 'CNAME',
    name: subdomain || '@',
    value: instanceHost,
    ttl: 86400,
  };
}

export function isValidDomain(domain: string): boolean {
  const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i;
  return domainRegex.test(domain);
}
