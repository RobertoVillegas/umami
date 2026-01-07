import {
  Button,
  Column,
  Form,
  FormField,
  FormSubmitButton,
  Icon,
  Label,
  ListItem,
  Loading,
  Row,
  Select,
  Text,
  TextField,
} from '@umami/react-zen';
import { useEffect, useState } from 'react';
import { useLinkQuery, useMessages, useSlug, useUserDomainsQuery } from '@/components/hooks';
import { Empty } from '@/components/common/Empty';
import { useUpdateQuery } from '@/components/hooks/queries/useUpdateQuery';
import { RefreshCw } from '@/components/icons';
import { getRandomChars } from '@/lib/generate';
import type { LinkFormData } from '@/lib/types';
import { isValidUrl, extractHostname } from '@/lib/url';

const generateId = () => getRandomChars(9);

export function LinkEditForm({
  linkId,
  teamId,
  onSave,
  onClose,
}: {
  linkId?: string;
  teamId?: string;
  onSave?: () => void;
  onClose?: () => void;
}) {
  const { formatMessage, labels, messages, getErrorMessage } = useMessages();
  const { mutateAsync, error, isPending, touch, toast } = useUpdateQuery(
    linkId ? `/links/${linkId}` : '/links',
    {
      id: linkId,
      teamId,
    },
  );
  const { getSlugUrl, hostUrl } = useSlug('link');
  const { data, isLoading } = useLinkQuery(linkId);
  const activeTeamId = teamId ?? data?.teamId ?? undefined;
  const [domainSearch, setDomainSearch] = useState('');
  const [slug, setSlug] = useState(generateId());
  const [selectedDomainId, setSelectedDomainId] = useState<string>('default');
  const { data: domainResult, isLoading: isDomainsLoading } = useUserDomainsQuery(
    { teamId: activeTeamId },
    { search: domainSearch, page: 1, pageSize: 50 },
  );
  const domains = domainResult?.data || [];

  // Extract default domain from hostUrl
  const defaultDomainName = extractHostname(hostUrl);
  const domainOptions = [
    { id: 'default', name: `${defaultDomainName} (${formatMessage(labels.default)})` },
    ...domains.map(domain => ({ id: domain.id, name: domain.name })),
  ];

  const handleSubmit = async (data: LinkFormData) => {
    await mutateAsync(data, {
      onSuccess: async () => {
        toast(formatMessage(messages.saved));
        touch('links');
        onSave?.();
        onClose?.();
      },
    });
  };

  const handleSlug = () => {
    const slug = generateId();

    setSlug(slug);

    return slug;
  };

  const checkUrl = (url: string) => {
    if (!isValidUrl(url)) {
      return formatMessage(labels.invalidUrl);
    }
    return true;
  };

  useEffect(() => {
    if (data) {
      setSlug(data.slug);
    }
  }, [data]);

  useEffect(() => {
    if (data?.domainId) {
      setSelectedDomainId(data.domainId);
    } else {
      setSelectedDomainId('default');
    }
  }, [data?.domainId]);

  const handleDomainChange = (
    value: string,
    setValue: (name: string, value: unknown, options?: { shouldDirty?: boolean }) => void,
  ) => {
    setSelectedDomainId(value);
    setValue('domainId', value === 'default' ? null : value, { shouldDirty: true });
  };

  const selectedDomain =
    selectedDomainId !== 'default'
      ? domains.find(domain => domain.id === selectedDomainId) ?? data?.domain
      : null;
  const selectedDomainName = selectedDomain?.name || `${defaultDomainName} (${formatMessage(labels.default)})`;
  const slugUrl = getSlugUrl(slug, selectedDomain?.name);

  if (linkId && isLoading) {
    return <Loading placement="absolute" />;
  }

  return (
    <Form
      onSubmit={handleSubmit}
      error={getErrorMessage(error)}
      defaultValues={{ slug, domainId: data?.domainId ?? null, ...data }}
    >
      {({ setValue }) => {
        return (
          <>
            <FormField
              label={formatMessage(labels.name)}
              name="name"
              rules={{ required: formatMessage(labels.required) }}
            >
              <TextField autoComplete="off" autoFocus />
            </FormField>

            <FormField
              label={formatMessage(labels.destinationUrl)}
              name="url"
              rules={{ required: formatMessage(labels.required), validate: checkUrl }}
            >
              <TextField placeholder="https://example.com" autoComplete="off" />
            </FormField>

            <FormField
              name="slug"
              rules={{
                required: formatMessage(labels.required),
              }}
              style={{ display: 'none' }}
            >
              <input type="hidden" />
            </FormField>

            <FormField label={formatMessage(labels.domain)} name="domainId">
              <Select
                items={domainOptions}
                value={selectedDomainId}
                isLoading={isDomainsLoading}
                allowSearch={true}
                searchValue={domainSearch}
                onSearch={setDomainSearch}
                onOpenChange={() => setDomainSearch('')}
                onChange={value => handleDomainChange(value, setValue)}
                renderValue={() => (
                  <Row maxWidth="240px">
                    <Text truncate>{selectedDomainName}</Text>
                  </Row>
                )}
                listProps={{
                  renderEmptyState: () => <Empty message={formatMessage(messages.noResultsFound)} />,
                  style: { maxHeight: '400px' },
                }}
              >
                {({ id, name }: { id: string; name: string }) => (
                  <ListItem key={id}>{name}</ListItem>
                )}
              </Select>
            </FormField>

            <Column>
              <Label>{formatMessage(labels.link)}</Label>
              <Row alignItems="center" gap>
                <TextField
                  value={slugUrl}
                  autoComplete="off"
                  isReadOnly
                  allowCopy
                  style={{ width: '100%' }}
                />
                <Button
                  variant="quiet"
                  onPress={() => setValue('slug', handleSlug(), { shouldDirty: true })}
                >
                  <Icon>
                    <RefreshCw />
                  </Icon>
                </Button>
              </Row>
            </Column>

            <Row justifyContent="flex-end" paddingTop="3" gap="3">
              {onClose && (
                <Button isDisabled={isPending} onPress={onClose}>
                  {formatMessage(labels.cancel)}
                </Button>
              )}
              <FormSubmitButton>{formatMessage(labels.save)}</FormSubmitButton>
            </Row>
          </>
        );
      }}
    </Form>
  );
}
