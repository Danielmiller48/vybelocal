// components/payments/PaymentModal.jsx
// -----------------------------------------------------------------------------
// A generic modal wrapper around <PaymentForm/>. Shows Stripe Elements checkout
// embedded inside a Headless-style dialog overlay. Close icon and ESC click both
// call onClose().
//
// Props
//   • open       – boolean; controls visibility
//   • eventId    – UUID of the event the user is paying for
//   • amount     – price in cents (integer)
//   • onClose    – function called when user clicks × or backdrop
//   • onSuccess  – optional callback after successful payment (fires before close)
// -----------------------------------------------------------------------------

"use client";

import { useCallback } from "react";
import { X } from "lucide-react";
import { toast } from "react-hot-toast";
import PaymentForm from "./PaymentForm";

export default function PaymentModal({
  open,
  eventId,
  amount,
  onClose,
  onSuccess,
}) {
  // Early exit → render nothing when not open
  if (!open) return null;

  const handleSuccess = useCallback(() => {
    toast.success("Payment successful – you're in!");
    onSuccess?.();
    onClose?.();
  }, [onClose, onSuccess]);

  const handleBackdrop = (e) => {
    // Prevent closing when clicking inside the dialog box
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e)=>{e.stopPropagation(); handleBackdrop(e);}}
    >
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          aria-label="Close"
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          onClick={onClose}
        >
          <X size={20} />
        </button>

        <h2 className="text-lg font-semibold mb-4 text-center">Complete your payment</h2>

        <PaymentForm
          eventId={eventId}
          amount={amount}
          onSuccess={handleSuccess}
          onError={(err) => toast.error(err.message || "Payment error")}
        />
      </div>
    </div>
  );
} 