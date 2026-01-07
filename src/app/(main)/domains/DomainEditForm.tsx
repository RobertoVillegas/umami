'use client';
import {
  Button,
  Column,
  Form,
  FormField,
  FormSubmitButton,
  Icon,
  Label,
  Loading,
  Row,
  TextField,
} from '@umami/react-zen';
import { useEffect, useState } from 'react';
import { useDomainQuery, useMessages } from '@/components/hooks';
import { useUpdateQuery } from '@/components/hooks/queries/useUpdateQuery';
import { RefreshCw } from '@/components/icons';
import { parseDomain, getDNSInstructions } from '@/lib/dns';

export function DomainEditForm({
  domainId,
  teamId,
  onSave,
  onClose,
}: {
  domainId?: string;
  teamId?: string;
  onSave?: () => void;
  onClose?: () => void;
}) {
  const { formatMessage, labels, messages, getErrorMessage } = useMessages();
  const { mutateAsync, error, isPending, touch, toast } = useUpdateQuery(
    domainId ? `/domains/${domainId}` : '/domains',
    {
      id: domainId,
      teamId,
    },
  );
  const { data, isLoading } = useDomainQuery(domainId);

  const handleSubmit = async (data: any) => {
    await mutateAsync(data, {
      onSuccess: async () => {
        toast(formatMessage(messages.saved));
        touch('domains');
        onSave?.();
        onClose?.();
      },
    });
  };

  if (domainId && isLoading) {
    return <Loading placement="absolute" />;
  }

  return (
    <Form onSubmit={handleSubmit} error={getErrorMessage(error)} defaultValues={data}>
      {({ setValue }) => {
        return (
          <>
            <FormField
              label={formatMessage(labels.name)}
              name="name"
              rules={{
                required: formatMessage(labels.required),
                validate: (value: string) => {
                  if (!value) return formatMessage(labels.required);
                  try {
                    parseDomain(value);
                    return true;
                  } catch {
                    return formatMessage(messages.invalidUrl);
                  }
                },
              }}
            >
              <TextField
                autoComplete="off"
                autoFocus={!domainId}
                disabled={!!domainId}
              />
            </FormField>

            <FormField
              label={formatMessage(labels.description)}
              name="description"
            >
              <TextField autoComplete="off" />
            </FormField>

            <FormField
              name="isPrimary"
              type="checkbox"
            >
              <Row alignItems="center" gap>
                <TextField
                  type="checkbox"
                  value={formatMessage(labels.primaryDomain)}
                />
              </Row>
            </FormField>

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
