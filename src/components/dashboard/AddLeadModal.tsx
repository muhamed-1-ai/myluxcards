"use client";

import AddLeadDrawer from "@/components/leads/AddLeadDrawer";

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadAdded: () => void;
  identity?: { id: string; name: string | null; email: string; role: string };
}

export function AddLeadModal({ isOpen, onClose, onLeadAdded, identity }: AddLeadModalProps) {
  const isValidUuid = (val?: string) => Boolean(val && typeof val === "string" && /^[0-9a-f-]{36}$/i.test(val));
  const activeIdentity = (identity && isValidUuid(identity.id)) ? identity : undefined;

  return (
    <AddLeadDrawer
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={() => {
        onLeadAdded();
        onClose();
      }}
      identity={activeIdentity}
    />
  );
}
