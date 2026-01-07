import type { Domain, ReactQueryOptions } from '@/lib/types';
import { useApi } from '../useApi';
import { useModified } from '../useModified';
import { usePagedQuery } from '../usePagedQuery';

export function useUserDomainsQuery(
  { teamId }: { teamId?: string },
  params?: Record<string, string | number | boolean | null | undefined>,
  options?: ReactQueryOptions,
) {
  const { get } = useApi();
  const { modified } = useModified('domains');

  return usePagedQuery<Domain[]>({
    queryKey: ['domains', { teamId, modified, ...params }],
    queryFn: pageParams => {
      return get(teamId ? `/teams/${teamId}/domains` : '/domains', {
        ...pageParams,
        ...params,
      });
    },
    ...options,
  });
}
