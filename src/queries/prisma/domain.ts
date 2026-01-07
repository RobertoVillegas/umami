import type { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/prisma';
import type { QueryFilters } from '@/lib/types';

export async function findDomain(criteria: Prisma.DomainFindUniqueArgs) {
  return prisma.client.domain.findUnique(criteria);
}

export async function getDomain(domainId: string) {
  return findDomain({
    where: { id: domainId },
  });
}

export async function getDomainByName(name: string) {
  return findDomain({
    where: { name },
  });
}

export async function getDomains(
  criteria: Prisma.DomainFindManyArgs,
  filters: QueryFilters = {},
) {
  const { search } = filters;
  const { getSearchParameters, pagedQuery } = prisma;

  const where: Prisma.DomainWhereInput = {
    ...criteria.where,
    deletedAt: null,
    ...getSearchParameters(search, [
      { name: 'contains' },
      { description: 'contains' },
    ]),
  };

  return pagedQuery('domain', { ...criteria, where }, filters);
}

export async function getUserDomains(userId: string, filters?: QueryFilters) {
  return getDomains(
    {
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    },
    filters,
  );
}

export async function getTeamDomains(teamId: string, filters?: QueryFilters) {
  return getDomains(
    {
      where: { teamId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    },
    filters,
  );
}

export async function getUserPrimaryDomain(userId: string) {
  return prisma.client.domain.findFirst({
    where: {
      userId,
      isPrimary: true,
      verified: true,
      deletedAt: null,
    },
  });
}

export async function getTeamPrimaryDomain(teamId: string) {
  return prisma.client.domain.findFirst({
    where: {
      teamId,
      isPrimary: true,
      verified: true,
      deletedAt: null,
    },
  });
}

export async function createDomain(data: Prisma.DomainUncheckedCreateInput) {
  return prisma.client.domain.create({ data });
}

export async function updateDomain(
  domainId: string,
  data: Prisma.DomainUpdateInput,
) {
  return prisma.client.domain.update({
    where: { id: domainId },
    data,
  });
}

export async function deleteDomain(domainId: string) {
  return prisma.client.domain.update({
    where: { id: domainId },
    data: { deletedAt: new Date() },
  });
}

export async function unsetUserPrimaryDomains(userId: string) {
  return prisma.client.domain.updateMany({
    where: { userId, isPrimary: true },
    data: { isPrimary: false },
  });
}

export async function unsetTeamPrimaryDomains(teamId: string) {
  return prisma.client.domain.updateMany({
    where: { teamId, isPrimary: true },
    data: { isPrimary: false },
  });
}

export async function updateDomainVerification(
  domainId: string,
  verified: boolean,
) {
  const data: Prisma.DomainUpdateInput = {
    verified,
    lastCheckedAt: new Date(),
  };

  if (verified) {
    data.verifiedAt = new Date();
  }

  return prisma.client.domain.update({
    where: { id: domainId },
    data,
  });
}

export async function getDomainStats(domainId: string) {
  const [totalLinks, totalPixels] = await Promise.all([
    prisma.client.link.count({
      where: { domainId, deletedAt: null },
    }),
    prisma.client.pixel.count({
      where: { domainId, deletedAt: null },
    }),
  ]);

  return {
    totalLinks,
    totalPixels,
    totalClicks: 0,
  };
}
