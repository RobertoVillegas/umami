'use client';
import { Column } from '@umami/react-zen';
import { DomainsDataTable } from '@/app/(main)/domains/DomainsDataTable';
import { PageBody } from '@/components/common/PageBody';
import { PageHeader } from '@/components/common/PageHeader';
import { Panel } from '@/components/common/Panel';
import { useMessages, useNavigation } from '@/components/hooks';
import { DomainAddButton } from './DomainAddButton';

export function DomainsPage() {
  const { formatMessage, labels } = useMessages();
  const { teamId } = useNavigation();

  return (
    <PageBody>
      <Column gap="6" margin="2">
        <PageHeader title={formatMessage(labels.domains)}>
          <DomainAddButton teamId={teamId} />
        </PageHeader>
        <Panel>
          <DomainsDataTable />
        </Panel>
      </Column>
    </PageBody>
  );
}
