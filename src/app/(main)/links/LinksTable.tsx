import { DataColumn, DataTable, type DataTableProps, Row } from '@umami/react-zen';
import Link from 'next/link';
import { DateDistance } from '@/components/common/DateDistance';
import { ExternalLink } from '@/components/common/ExternalLink';
import { useMessages, useNavigation, useSlug } from '@/components/hooks';
import type { LinkItem } from '@/lib/types';
import { LinkDeleteButton } from './LinkDeleteButton';
import { LinkEditButton } from './LinkEditButton';

export function LinksTable(props: DataTableProps) {
  const { formatMessage, labels } = useMessages();
  const { websiteId, renderUrl } = useNavigation();
  const { getSlugUrl } = useSlug('link');

  return (
    <DataTable {...props}>
      <DataColumn id="name" label={formatMessage(labels.name)}>
        {({ id, name }: LinkItem) => {
          return <Link href={renderUrl(`/links/${id}`)}>{name}</Link>;
        }}
      </DataColumn>
      <DataColumn id="slug" label={formatMessage(labels.link)}>
        {({ slug, domain }: LinkItem) => {
          const url = getSlugUrl(slug, domain?.name);
          return (
            <ExternalLink href={url} prefetch={false}>
              {url}
            </ExternalLink>
          );
        }}
      </DataColumn>
      <DataColumn id="url" label={formatMessage(labels.destinationUrl)}>
        {({ url }: LinkItem) => {
          return <ExternalLink href={url}>{url}</ExternalLink>;
        }}
      </DataColumn>
      <DataColumn id="created" label={formatMessage(labels.created)} width="200px">
        {(row: LinkItem) => (row.createdAt ? <DateDistance date={new Date(row.createdAt)} /> : null)}
      </DataColumn>
      <DataColumn id="action" align="end" width="100px">
        {({ id, name }: LinkItem) => {
          return (
            <Row>
              <LinkEditButton linkId={id} />
              <LinkDeleteButton linkId={id} websiteId={websiteId} name={name} />
            </Row>
          );
        }}
      </DataColumn>
    </DataTable>
  );
}
