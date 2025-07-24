// components/settings/BlockingModal.jsx
"use client";
import BaseModal from './BaseModal';
import BlocksList from '@/components/user/BlocksList';

export default function BlockingModal({ open, onClose }) {
  return (
    <BaseModal open={open} onClose={onClose}>
      <h2 className="text-lg font-bold mb-4">Blocked Users</h2>
      <BlocksList />
    </BaseModal>
  );
} 