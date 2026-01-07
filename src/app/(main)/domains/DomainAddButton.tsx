'use client';
import { useMessages } from '@/components/hooks';
import { Plus } from '@/components/icons';
import { DialogButton } from '@/components/input/DialogButton';
import { DomainEditForm } from './DomainEditForm';

export function DomainAddButton({ teamId }: { teamId?: string }) {
  const { formatMessage, labels } = useMessages();

  return (
    <DialogButton
      icon={<Plus />}
      label={formatMessage(labels.addDomain)}
      variant="primary"
      width="600px"
    >
      {({ close }) => <DomainEditForm teamId={teamId} onClose={close} />}
    </DialogButton>
  );
}
