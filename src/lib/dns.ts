import dns from 'dns';
import { promisify } from 'util';

const resolveCname = promisify(dns.resolveCname);

export interface DNSVerificationResult {
  verified: boolean;
  cnameTarget?: string;
  error?: string;
  details?: string;
}

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

export async function verifyDomainDNS(domain: string): Promise<DNSVerificationResult> {
  const instanceHost = getInstanceHostname();

  try {
    const cnameRecords = await resolveCname(domain);

    if (!cnameRecords || cnameRecords.length === 0) {
      return {
        verified: false,
        error: 'No CNAME record found',
        details: `Expected CNAME pointing to ${instanceHost}`,
      };
    }

    const cnameTarget = cnameRecords[0];

    const normalizedTarget = cnameTarget.replace(/\.$/, '');
    const normalizedInstance = instanceHost.replace(/\.$/, '');

    if (normalizedTarget === normalizedInstance) {
      return {
        verified: true,
        cnameTarget: normalizedTarget,
      };
    }

    return {
      verified: false,
      cnameTarget: normalizedTarget,
      error: 'CNAME points to wrong target',
      details: `Found: ${normalizedTarget}, Expected: ${normalizedInstance}`,
    };
  } catch (error: any) {
    if (error.code === 'ENODATA' || error.code === 'ENOTFOUND') {
      return {
        verified: false,
        error: 'Domain not configured',
        details: `No CNAME record found. Please add CNAME record pointing to ${instanceHost}`,
      };
    }

    return {
      verified: false,
      error: 'DNS lookup failed',
      details: error.message,
    };
  }
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
