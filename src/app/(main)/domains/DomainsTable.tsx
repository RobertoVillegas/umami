'use client';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable, Row } from '@umami/react-zen';
import { DateDistance } from '@/components/common/DateDistance';
import { useMessages } from '@/components/hooks';
import { DomainEditButton } from './DomainEditButton';
import { DomainDeleteButton } from './DomainDeleteButton';
import { DomainVerifyButton } from './DomainVerifyButton';

export function DomainsTable({ data = [] }: { data: any[] }) {
  const { formatMessage, labels } = useMessages();

  const columns: ColumnDef<any>[] = [
    {
      id: 'name',
      header: formatMessage(labels.name),
      cell: ({ row }) => {
        const { name, isPrimary, verified } = row.original;
        return (
          <div>
            {isPrimary && <span title="Primary">⭐ </span>}
            {name}
            {verified ? ' ✓' : ' ⚠'}
          </div>
        );
      },
    },
    {
      id: 'description',
      header: formatMessage(labels.description),
      accessorKey: 'description',
    },
    {
      id: 'stats',
      header: formatMessage(labels.links),
      cell: ({ row }) => {
        const { _count } = row.original;
        return _count?.links || 0;
      },
    },
    {
      id: 'created',
      header: formatMessage(labels.created),
      cell: ({ row }) => {
        return <DateDistance date={new Date(row.original.createdAt)} />;
      },
    },
    {
      id: 'action',
      header: formatMessage(labels.actions),
      cell: ({ row }) => {
        const { id, name, verified } = row.original;
        return (
          <Row>
            {!verified && <DomainVerifyButton domainId={id} />}
            <DomainEditButton domainId={id} />
            <DomainDeleteButton domainId={id} name={name} />
          </Row>
        );
      },
    },
  ];

  return <DataTable columns={columns} data={data} />;
}
