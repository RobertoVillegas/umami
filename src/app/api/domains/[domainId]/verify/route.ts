import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { canUpdateDomain } from '@/permissions';
import { getDomain, updateDomainVerification } from '@/queries/prisma';
import { verifyDomainDNS } from '@/lib/dns.server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { domainId } = await params;

  if (!(await canUpdateDomain(auth, domainId))) {
    return unauthorized();
  }

  const domain = await getDomain(domainId);
  const result = await verifyDomainDNS(domain.name);

  await updateDomainVerification(domainId, result.verified);

  return json({
    verified: result.verified,
    cnameTarget: result.cnameTarget,
    error: result.error,
    details: result.details,
  });
}
