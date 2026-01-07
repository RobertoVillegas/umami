'use client';
import {
  Button,
  Column,
  FormField,
  Icon,
  Label,
  Loading,
  Row,
  TextField,
} from '@umami/react-zen';
import { useEffect, useState } from 'react';
import { useDomainQuery, useMessages, useApi } from '@/components/hooks';
import { RefreshCw } from '@/components/icons';
import { getInstanceHostname, parseDomain, getDNSInstructions } from '@/lib/dns';
import type { ApiError, DomainVerifyResult } from '@/lib/types';

export function DomainVerifyForm({
  domainId,
  onSave,
  onClose,
}: {
  domainId?: string;
  onSave?: () => void;
  onClose?: () => void;
}) {
  const { formatMessage, labels, messages, getErrorMessage } = useMessages();
  const { data, isLoading, refetch } = useDomainQuery(domainId);
  const { post } = useApi();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<DomainVerifyResult | null>(null);

  const dnsInstructions = data ? getDNSInstructions(data.name) : null;
  const instanceHost = getInstanceHostname();

  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const result = (await post(`/domains/${domainId}/verify`)) as DomainVerifyResult;
      setVerifyResult(result);

      if (result.verified) {
        refetch();
      }
    } catch (error: unknown) {
      const message = getErrorMessage(error as ApiError) || formatMessage(messages.error);
      setVerifyResult({ verified: false, error: message });
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (data?.verified) {
      setVerifyResult({ verified: true });
    }
  }, [data]);

  if (isLoading) {
    return <Loading placement="absolute" />;
  }

  return (
    <Column gap="4">
      {dnsInstructions && (
        <Column gap="2">
          <Label>{formatMessage(labels.dnsInstructions)}</Label>
          <Label>{formatMessage(labels.dnsDescription)}</Label>

          <Column>
            <Row gap="4">
              <Column style={{ flex: 1 }}>
                <TextField
                  label={formatMessage(labels.dnsType)}
                  value={dnsInstructions.type}
                  isReadOnly
                  allowCopy
                />
              </Column>
              <Column style={{ flex: 1 }}>
                <TextField
                  label={formatMessage(labels.dnsName)}
                  value={dnsInstructions.name}
                  isReadOnly
                  allowCopy
                />
              </Column>
            </Row>
            <TextField
              label={formatMessage(labels.dnsValue)}
              value={dnsInstructions.value}
              isReadOnly
              allowCopy
            />
            <TextField
              label="TTL"
              value={dnsInstructions.ttl.toString()}
              isReadOnly
            />
          </Column>

          <Label>{formatMessage(labels.dnsPropagation)}</Label>
        </Column>
      )}

      {verifyResult && (
        <Column gap="2">
          {verifyResult.verified ? (
            <Label style={{ color: 'green' }}>
              {formatMessage(messages.domainVerified)}
            </Label>
          ) : (
            <>
              <Label style={{ color: 'red' }}>
                {formatMessage(messages.domainVerificationFailed)}
              </Label>
              {verifyResult.error && (
                <Label>{verifyResult.error}</Label>
              )}
              {verifyResult.details && (
                <Label>{verifyResult.details}</Label>
              )}
            </>
          )}
        </Column>
      )}

      <Row justifyContent="flex-end" gap="3">
        {onClose && (
          <Button onPress={onClose}>
            {formatMessage(labels.cancel)}
          </Button>
        )}
        <Button
          variant="primary"
          onPress={handleVerify}
          isDisabled={isVerifying || verifyResult?.verified}
        >
          {isVerifying ? (
            <Icon>
              <RefreshCw style={{ animation: 'spin 1s linear infinite' }} />
            </Icon>
          ) : (
            formatMessage(labels.verifyDomain)
          )}
        </Button>
      </Row>
    </Column>
  );
}
