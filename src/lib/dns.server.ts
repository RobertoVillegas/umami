import 'server-only';
import dns from 'dns';
import { promisify } from 'util';
import { getInstanceHostname } from './dns';
const PUBLIC_DNS_SERVERS = ['1.1.1.1', '8.8.8.8', '9.9.9.9'];
const DNS_TIMEOUT_MS = 2500;
const NOT_FOUND_CODES = new Set(['ENODATA', 'ENOTFOUND', 'NXDOMAIN']);

export interface DNSVerificationResult {
  verified: boolean;
  cnameTarget?: string;
  error?: string;
  expected?: string;
  found?: string;
}

function normalizeHostname(hostname: string) {
  return hostname.trim().replace(/\.$/, '').toLowerCase();
}

function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: string }).code;
    return code ? String(code) : undefined;
  }
  return undefined;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(message) as Error & { code?: string };
      error.code = 'ETIMEOUT';
      reject(error);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function resolveCnameForServer(domain: string, server: string) {
  const resolver = new dns.Resolver();
  resolver.setServers([server]);
  const resolve = promisify(resolver.resolveCname.bind(resolver));
  return withTimeout(resolve(domain), DNS_TIMEOUT_MS, `DNS lookup timed out via ${server}`);
}

async function resolveCnamePublic(domain: string) {
  const codes: string[] = [];

  for (const server of PUBLIC_DNS_SERVERS) {
    try {
      const records = await resolveCnameForServer(domain, server);
      if (records.length > 0) {
        return { records, codes };
      }
      codes.push('ENODATA');
    } catch (error: unknown) {
      const code = getErrorCode(error);
      codes.push(code || 'UNKNOWN');
    }
  }

  return { records: [] as string[], codes };
}

export async function verifyDomainDNS(
  domain: string,
  fallbackHost?: string,
): Promise<DNSVerificationResult> {
  const instanceHost = getInstanceHostname(fallbackHost);
  const normalizedInstance = normalizeHostname(instanceHost);

  try {
    const { records: cnameRecords, codes } = await resolveCnamePublic(domain);

    if (!cnameRecords || cnameRecords.length === 0) {
      const hasOnlyNotFound = codes.length > 0 && codes.every(code => NOT_FOUND_CODES.has(code));
      const hasTimeout = codes.some(code => code === 'ETIMEOUT');

      if (!codes.length || hasOnlyNotFound) {
        return {
          verified: false,
          error: 'domain-not-configured',
          expected: instanceHost,
        };
      }

      return {
        verified: false,
        error: hasTimeout ? 'dns-lookup-timeout' : 'dns-lookup-failed',
      };
    }

    const normalizedTargets = cnameRecords.map(normalizeHostname);
    const matchedTarget = normalizedTargets.find(target => target === normalizedInstance);

    if (matchedTarget) {
      return {
        verified: true,
        cnameTarget: matchedTarget,
      };
    }

    const cnameTarget = normalizedTargets[0];
    return {
      verified: false,
      cnameTarget,
      error: 'domain-cname-mismatch',
      expected: normalizedInstance,
      found: normalizedTargets.join(', '),
    };
  } catch (error: unknown) {
    const code = getErrorCode(error);
    if (code && NOT_FOUND_CODES.has(code)) {
      return {
        verified: false,
        error: 'domain-not-configured',
        expected: instanceHost,
      };
    }

    return {
      verified: false,
      error: code === 'ETIMEOUT' ? 'dns-lookup-timeout' : 'dns-lookup-failed',
    };
  }
}
