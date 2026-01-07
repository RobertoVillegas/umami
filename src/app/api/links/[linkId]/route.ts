import { z } from 'zod';
import { parseRequest } from '@/lib/request';
import { badRequest, json, ok, serverError, unauthorized } from '@/lib/response';
import { canDeleteLink, canUpdateLink, canViewLink } from '@/permissions';
import { deleteLink, getDomain, getLink, updateLink } from '@/queries/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { linkId } = await params;

  if (!(await canViewLink(auth, linkId))) {
    return unauthorized();
  }

  const website = await getLink(linkId);

  return json(website);
}

export async function POST(request: Request, { params }: { params: Promise<{ linkId: string }> }) {
  const schema = z.object({
    name: z.string().optional(),
    url: z.string().optional(),
    slug: z.string().min(8).optional(),
    domainId: z.string().uuid().nullable().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { linkId } = await params;
  const { name, url, slug, domainId } = body;

  if (!(await canUpdateLink(auth, linkId))) {
    return unauthorized();
  }

  try {
    if (domainId) {
      const domain = await getDomain(domainId);

      if (!domain) {
        return unauthorized();
      }

      const link = await getLink(linkId);
      const isTeamDomainMatch = link?.teamId
        ? domain.teamId === link.teamId
        : domain.userId === link?.userId;

      if (!auth.user.isAdmin && !isTeamDomainMatch) {
        return unauthorized();
      }
    }

    const updateData: Record<string, unknown> = { name, url, slug };

    if (domainId !== undefined) {
      updateData.domainId = domainId;
    }

    const result = await updateLink(linkId, updateData);

    return Response.json(result);
  } catch (e: any) {
    if (e.message.toLowerCase().includes('unique constraint') && e.message.includes('slug')) {
      return badRequest({ message: 'That slug is already taken.' });
    }

    return serverError(e);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ linkId: string }> },
) {
  const { auth, error } = await parseRequest(request);

  if (error) {
    return error();
  }

  const { linkId } = await params;

  if (!(await canDeleteLink(auth, linkId))) {
    return unauthorized();
  }

  await deleteLink(linkId);

  return ok();
}
