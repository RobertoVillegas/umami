export interface DNSInstructions {
  type: 'CNAME' | 'A';
  name: string;
  value: string;
  ttl: number;
}

export function getInstanceHostname(): string {
  if (process.env.UMAMI_HOST) {
    return process.env.UMAMI_HOST;
  }

  if (process.env.LINKS_URL) {
    try {
      const url = new URL(process.env.LINKS_URL);
      return url.hostname;
    } catch (e) {
      console.warn('Could not parse LINKS_URL, using localhost');
      return 'localhost';
    }
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
