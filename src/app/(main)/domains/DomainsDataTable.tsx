'use client';
import { DataGrid } from '@/components/common/DataGrid';
import { useDomainsQuery, useNavigation } from '@/components/hooks';
import { DomainsTable } from './DomainsTable';

export function DomainsDataTable() {
  const { teamId } = useNavigation();
  const query = useDomainsQuery({ teamId });

  return (
    <DataGrid query={query} allowSearch={true} autoFocus={false} allowPaging={true}>
      {({ data }) => <DomainsTable data={data} />}
    </DataGrid>
  );
}
