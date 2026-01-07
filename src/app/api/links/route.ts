import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { pagingParams, searchParams } from '@/lib/schema';
import { canCreateTeamWebsite, canCreateWebsite } from '@/permissions';
import { createLink, getDomain, getUserLinks } from '@/queries/prisma';

export async function GET(request: Request) {
  const schema = z.object({
    ...pagingParams,
    ...searchParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const filters = await getQueryFilters(query);

  const links = await getUserLinks(auth.user.id, filters);

  return json(links);
}

export async function POST(request: Request) {
  const schema = z.object({
    name: z.string().max(100),
    url: z.string().max(500),
    slug: z.string().max(100),
    domainId: z.string().uuid().nullable().optional(),
    teamId: z.string().nullable().optional(),
    id: z.uuid().nullable().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { id, name, url, slug, teamId, domainId } = body;

  if ((teamId && !(await canCreateTeamWebsite(auth, teamId))) || !(await canCreateWebsite(auth))) {
    return unauthorized();
  }

  if (domainId) {
    const domain = await getDomain(domainId);

    if (!domain) {
      return unauthorized();
    }

    const isTeamDomainMatch = teamId ? domain.teamId === teamId : domain.userId === auth.user.id;

    if (!auth.user.isAdmin && !isTeamDomainMatch) {
      return unauthorized();
    }
  }

  const data: any = {
    id: id ?? uuid(),
    name,
    url,
    slug,
    teamId,
    ...(domainId !== undefined ? { domainId } : {}),
  };

  if (!teamId) {
    data.userId = auth.user.id;
  }

  const result = await createLink(data);

  return json(result);
}
