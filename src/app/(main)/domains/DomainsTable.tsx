'use client';
import { DataColumn, DataTable, type DataTableProps, Row } from '@umami/react-zen';
import { DateDistance } from '@/components/common/DateDistance';
import { useMessages } from '@/components/hooks';
import { DomainEditButton } from './DomainEditButton';
import { DomainDeleteButton } from './DomainDeleteButton';
import { DomainVerifyButton } from './DomainVerifyButton';

export function DomainsTable(props: DataTableProps) {
  const { formatMessage, labels } = useMessages();

  return (
    <DataTable {...props}>
      <DataColumn id="name" label={formatMessage(labels.name)}>
        {({ name, isPrimary, verified }: any) => (
          <div>
            {isPrimary && <span title="Primary">⭐ </span>}
            {name}
            {verified ? ' ✓' : ' ⚠'}
          </div>
        )}
      </DataColumn>
      <DataColumn id="description" label={formatMessage(labels.description)}>
        {({ description }: any) => description}
      </DataColumn>
      <DataColumn id="stats" label={formatMessage(labels.links)}>
        {({ _count }: any) => _count?.links || 0}
      </DataColumn>
      <DataColumn id="created" label={formatMessage(labels.created)}>
        {(row: any) => <DateDistance date={new Date(row.createdAt)} />}
      </DataColumn>
      <DataColumn id="action" align="end" width="120px">
        {({ id, name, verified }: any) => (
          <Row>
            {!verified && <DomainVerifyButton domainId={id} />}
            <DomainEditButton domainId={id} />
            <DomainDeleteButton domainId={id} name={name} />
          </Row>
        )}
      </DataColumn>
    </DataTable>
  );
}
