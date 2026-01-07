import { z } from 'zod';
import { getQueryFilters, parseRequest } from '@/lib/request';
import { json, unauthorized } from '@/lib/response';
import { pagingParams, searchParams } from '@/lib/schema';
import { canViewTeam } from '@/permissions';
import { getTeamDomains } from '@/queries/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const schema = z.object({
    ...pagingParams,
    ...searchParams,
  });

  const { auth, query, error } = await parseRequest(request, schema);

  if (error) {
    return error();
  }

  const { teamId } = await params;

  if (!(await canViewTeam(auth, teamId))) {
    return unauthorized();
  }

  const filters = await getQueryFilters(query);
  const domains = await getTeamDomains(teamId, filters);

  return json(domains);
}
