import { keepPreviousData } from '@tanstack/react-query';
import type { Domain, ReactQueryOptions } from '@/lib/types';
import { useApi } from '../useApi';
import { useModified } from '../useModified';

export function useDomainQuery(domainId: string, options?: ReactQueryOptions) {
  const { get, useQuery } = useApi();
  const { modified } = useModified(`domain:${domainId}`);

  return useQuery<Domain>({
    queryKey: ['domain', { domainId, modified }],
    queryFn: () => get(`/domains/${domainId}`),
    enabled: !!domainId,
    placeholderData: keepPreviousData,
    ...options,
  });
}
