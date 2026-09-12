"use client";

import AddLeadDrawer from "@/components/leads/AddLeadDrawer";

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadAdded: () => void;
  identity?: { id: string; name: string | null; email: string; role: string };
}

export function AddLeadModal({ isOpen, onClose, onLeadAdded, identity }: AddLeadModalProps) {
  const activeIdentity = identity || {
    id: "admin",
    name: "Admin User",
    email: "admin@zappit.ai",
    role: "ADMIN",
  };

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
