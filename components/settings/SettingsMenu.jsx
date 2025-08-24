// components/settings/SettingsMenu.jsx
"use client";
import { useState, useEffect } from 'react';
import { AlignJustify } from 'lucide-react';
import EditProfileModal from './EditProfileModal';
import BlockingModal from './BlockingModal';
import PaymentsModal from './PaymentsModal';
import DeleteAccountModal from './DeleteAccountModal';

export default function SettingsMenu() {
  const [openKey, setOpenKey] = useState(null); // null | 'profile' | 'blocks' | 'payments' | 'delete'
  const close = () => setOpenKey(null);

  // close on ESC global
  useEffect(() => {
    function onKey(e){ if(e.key==='Escape') close(); }
    if(openKey) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openKey]);

  const menuItems = [
    { key:'profile', label:'Edit Profile' },
    { key:'blocks',  label:'Blocked Users' },
    { key:'payments',label:'Payments & Payouts' },
    { key:'delete',  label:'Delete Account', danger:true },
  ];

  return (
    <div className="relative">
      <button className="p-2 rounded hover:bg-gray-100" onClick={() => setOpenKey(openKey ? null : 'menu')}>
        <AlignJustify className="h-5 w-5" />
      </button>

      {openKey==='menu' && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded shadow-lg z-50 text-sm">
          {menuItems.map(i=> (
            <button
              key={i.key}
              onClick={()=>setOpenKey(i.key)}
              className={`block w-full text-left px-4 py-2 hover:bg-gray-100 ${i.danger ? 'text-red-600':''}`}
            >{i.label}</button>
          ))}
        </div>
      )}

      {/* Modals */}
      <EditProfileModal   open={openKey==='profile'}  onClose={close} />
      <BlockingModal      open={openKey==='blocks'}   onClose={close} />
      <PaymentsModal      open={openKey==='payments'} onClose={close} />
      <DeleteAccountModal open={openKey==='delete'}   onClose={close} />
    </div>
  );
} 