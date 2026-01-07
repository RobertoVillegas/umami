import { z } from 'zod';
import { uuid } from '@/lib/crypto';
import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { pagingParams, searchParams } from '@/lib/schema';
import { canCreateDomain } from '@/permissions';
import { createDomain, getUserDomains } from '@/queries/prisma';

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
  const domains = await getUserDomains(auth.user.id, filters);

  return json(domains);
}

export async function POST(request: Request) {
  const schema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(500).optional(),
    teamId: z.string().nullable().optional(),
    isPrimary: z.boolean().optional(),
    id: z.uuid().nullable().optional(),
  });

  const { auth, body, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { id, name, description, teamId, isPrimary } = body;

  if (!(await canCreateDomain(auth, teamId))) {
    return unauthorized();
  }

  const data: any = {
    id: id ?? uuid(),
    name,
    description,
    isPrimary: isPrimary ?? false,
    teamId,
  };

  if (!teamId) {
    data.userId = auth.user.id;
  }

  const result = await createDomain(data);

  return json(result);
}
