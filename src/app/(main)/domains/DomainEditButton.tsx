'use client';
import { useMessages } from '@/components/hooks';
import { Pencil } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';
import { DomainEditForm } from './DomainEditForm';

export function DomainEditButton({ domainId }: { domainId: string }) {
  const { formatMessage, labels } = useMessages();

  return (
    <DialogButton
      icon={<Pencil />}
      title={formatMessage(labels.edit)}
      variant="quiet"
      width="600px"
    >
      {({ close }) => <DomainEditForm domainId={domainId} onClose={close} />}
    </DialogButton>
  );
}
