'use client';
import { DataColumn, DataTable, type DataTableProps, Row } from '@umami/react-zen';
import { DateDistance } from '@/components/common/DateDistance';
import { useMessages } from '@/components/hooks';
import type { Domain } from '@/lib/types';
import { DomainEditButton } from './DomainEditButton';
import { DomainDeleteButton } from './DomainDeleteButton';
import { DomainVerifyButton } from './DomainVerifyButton';

export interface DomainsTableProps extends DataTableProps {
  data?: Domain[];
}

export function DomainsTable(props: DomainsTableProps) {
  const { formatMessage, labels } = useMessages();

  return (
    <DataTable {...props}>
      <DataColumn id="name" label={formatMessage(labels.name)}>
        {({ name, isPrimary, verified }: Domain) => (
          <div>
            {isPrimary && <span title="Primary">⭐ </span>}
            {name}
            {verified ? ' ✓' : ' ⚠'}
          </div>
        )}
      </DataColumn>
      <DataColumn id="description" label={formatMessage(labels.description)}>
        {({ description }: Domain) => description}
      </DataColumn>
      <DataColumn id="stats" label={formatMessage(labels.links)}>
        {({ _count }: Domain) => _count?.links || 0}
      </DataColumn>
      <DataColumn id="created" label={formatMessage(labels.created)}>
        {(row: Domain) => <DateDistance date={new Date(row.createdAt)} />}
      </DataColumn>
      <DataColumn id="action" align="end" width="120px">
        {({ id, name, verified }: Domain) => (
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
