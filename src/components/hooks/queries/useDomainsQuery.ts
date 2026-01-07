import type { Domain, ReactQueryOptions } from '@/lib/types';
import { useApi } from '../useApi';
import { useModified } from '../useModified';
import { usePagedQuery } from '../usePagedQuery';

export function useDomainsQuery({ teamId }: { teamId?: string }, options?: ReactQueryOptions) {
  const { modified } = useModified('domains');
  const { get } = useApi();

  return usePagedQuery<Domain[]>({
    queryKey: ['domains', { teamId, modified }],
    queryFn: pageParams => {
      return get(teamId ? `/teams/${teamId}/domains` : '/domains', pageParams);
    },
    ...options,
  });
}
