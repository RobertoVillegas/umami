import 'server-only';
import dns from 'dns';
import { promisify } from 'util';
import { getInstanceHostname } from './dns';

const resolveCname = promisify(dns.resolveCname);

export interface DNSVerificationResult {
  verified: boolean;
  cnameTarget?: string;
  error?: string;
  details?: string;
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
