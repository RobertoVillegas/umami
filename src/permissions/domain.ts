import { hasPermission } from '@/lib/auth';
import { PERMISSIONS } from '@/lib/constants';
import type { Auth } from '@/lib/types';
import { getDomain, getTeamUser } from '@/queries/prisma';

export async function canViewDomain({ user }: Auth, domainId: string) {
  if (user?.isAdmin) {
    return true;
  }

  const domain = await getDomain(domainId);

  if (!domain) {
    return false;
  }

  if (domain.userId) {
    return user.id === domain.userId;
  }

  if (domain.teamId) {
    const teamUser = await getTeamUser(domain.teamId, user.id);
    return !!teamUser;
  }

  return false;
}

export async function canUpdateDomain({ user }: Auth, domainId: string) {
  if (user.isAdmin) {
    return true;
  }

  const domain = await getDomain(domainId);

  if (!domain) {
    return false;
  }

  if (domain.userId) {
    return user.id === domain.userId;
  }

  if (domain.teamId) {
    const teamUser = await getTeamUser(domain.teamId, user.id);
    return teamUser && hasPermission(teamUser.role, PERMISSIONS.websiteUpdate);
  }

  return false;
}

export async function canDeleteDomain({ user }: Auth, domainId: string) {
  if (user.isAdmin) {
    return true;
  }

  const domain = await getDomain(domainId);

  if (!domain) {
    return false;
  }

  if (domain.userId) {
    return user.id === domain.userId;
  }

  if (domain.teamId) {
    const teamUser = await getTeamUser(domain.teamId, user.id);
    return teamUser && hasPermission(teamUser.role, PERMISSIONS.websiteDelete);
  }

  return false;
}

export async function canCreateTeamDomain({ user }: Auth, teamId: string) {
  if (user.isAdmin) {
    return true;
  }

  const teamUser = await getTeamUser(teamId, user.id);
  return teamUser && hasPermission(teamUser.role, PERMISSIONS.websiteCreate);
}

export async function canCreateDomain({ user }: Auth, teamId?: string) {
  if (user.isAdmin) {
    return true;
  }

  if (teamId) {
    return canCreateTeamDomain({ user }, teamId);
  }

  return true;
}
