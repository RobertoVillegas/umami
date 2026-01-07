'use client';
import { useMessages } from '@/components/hooks';
import { RefreshCw } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';
import { DomainVerifyForm } from './DomainVerifyForm';

export function DomainVerifyButton({ domainId }: { domainId: string }) {
  const { formatMessage, labels } = useMessages();

  return (
    <DialogButton
      icon={<RefreshCw />}
      title={formatMessage(labels.verifyDomain)}
      variant="quiet"
      width="600px"
    >
      {({ close }) => <DomainVerifyForm domainId={domainId} onClose={close} />}
    </DialogButton>
  );
}
