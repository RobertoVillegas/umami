import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { badRequest, json, serverError, unauthorized } from '@/lib/response';
import { canUpdateDomain, canDeleteDomain, canViewDomain } from '@/permissions';
import { getDomain, updateDomain, deleteDomain } from '@/queries/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { domainId } = await params;

  if (!(await canViewDomain(auth, domainId))) {
    return unauthorized();
  }

  const domain = await getDomain(domainId);

  return json(domain);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const schema = z.object({
    description: z.string().max(500).optional(),
    isPrimary: z.boolean().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { domainId } = await params;

  if (!(await canUpdateDomain(auth, domainId))) {
    return unauthorized();
  }

  try {
    const result = await updateDomain(domainId, body);
    return json(result);
  } catch (e: any) {
    if (e.message.toLowerCase().includes('unique constraint')) {
      return badRequest({ message: 'Domain name already in use.' });
    }
    return serverError(e);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ domainId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { domainId } = await params;

  if (!(await canDeleteDomain(auth, domainId))) {
    return unauthorized();
  }

  await deleteDomain(domainId);

  return json({ success: true });
}
