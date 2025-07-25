"use client";
import { useState, useEffect } from "react";
// Stripe removed – penalty payments run through simulated endpoint
import toast from "react-hot-toast";

export default function CancelEventModal({ open, onClose, eventId }) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // {refundTotalCents, penaltyCents, firstCancel}
  const [reason,  setReason]  = useState("");

  useEffect(() => {
    if (!open) return;
    // Fetch preview totals
    (async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/cancel`, {
          method: "GET",
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        setPreview(json);
      } catch (err) {
        console.error(err);
        toast.error(err.message);
        onClose();
      }
    })();
  }, [open, eventId]);

  if (!open) return null;
  if (!preview) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md text-center">
          Loading…
        </div>
      </div>
    );
  }

  const isFree = preview.refundTotalCents === 0;
  const paidEvent = preview.isPaidEvent;
  const refundTotal = (preview.refundTotalCents / 100).toFixed(2);
  const penaltyCents = preview.penaltyCents;
  const CC_RATE = 0.029;
  const CC_FIXED = 30; // cents
  // Amount that needs to be charged so that net covers penaltyCents
  const totalChargeCents = preview.willChargeHost
    ? Math.ceil((penaltyCents + CC_FIXED) / (1 - CC_RATE))
    : 0;
  const extraFeeCents = preview.willChargeHost ? totalChargeCents - penaltyCents : 0;
  const penalty = (penaltyCents / 100).toFixed(2);
  const extraFee = (extraFeeCents / 100).toFixed(2);
  const totalCharge = (totalChargeCents / 100).toFixed(2);

  let header;
  if (!paidEvent) {
    header = 'Cancel this event?';
  } else {
    header = preview.willChargeHost
      ? `Cancel this event, refund $${refundTotal} to your guests, and pay $${totalCharge}?`
      : `Cancel this event and refund $${refundTotal} to your guests?`;
  }

  let body;

  if (!paidEvent) {
    // ─────────────── FREE EVENT CANCELLATIONS ───────────────
    if (preview.strikeNum >= 3) {
      /* THIRD strike – 60-day suspension */
      body = `This was your third cancellation—and at VybeLocal, three strikes means it’s time to pause.\n\nWe built this platform to support people who follow through. Flaky hosting breaks trust for guests, damages the local ecosystem, and hurts everyone who shows up.\n\nBecause of this:\n\n- Your ability to host new events is suspended for **60 days**  \n- You’ll still be able to RSVP to events, but hosting is locked\n\nIf you believe this was a mistake or want to appeal, reach out to **support@vybelocal.com**\n\nWe still believe in second chances—but accountability always comes first here.\n\nThanks for respecting the platform.`;

    } else if (preview.strikeNum === 2) {
      /* SECOND strike – 14-day lock */
      const unlockDate = (() => {
        const days = preview.lockDays || 14;
        const dt   = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
        return dt.toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
      })();

      body = `This is your second event cancellation.\n\nWe understand that sometimes life happens—but too many cancellations (even for free events) make it harder for guests to trust the platform and show up again.\n\nAs part of VybeLocal’s trust-first model:\n\n- Your hosting privileges are now paused for **14 days**  \n- You’ll be able to post events again on **${unlockDate}**  \n- Your past events and history remain visible\n\nWe’re not here to punish—we’re here to protect the people who commit. Let this window serve as a reset. When you come back, you’ll be in a better spot to build real traction.\n\nThanks for understanding.`;

    } else {
      /* FIRST strike – warning */
      body = `Canceling an event—paid or free—affects guest trust.\n\nVybeLocal is built around showing up, and we track all cancellations to protect the community experience. Even free events matter. Too many cancellations can result in a temporary suspension from hosting.\n\nHere’s how our cancellation system works:\n\n1️⃣ Your first cancellation is a free pass—we get it.  \n2️⃣ After your second, hosting will be paused for 2 weeks.  \n3️⃣ A third cancellation leads to a 2-month suspension and a reactivation fee.\n\nIf you’re canceling due to weather or an emergency, be honest—we’ll review same-day cancellations before applying a strike.\n\nAre you sure you want to cancel this event?`;
    }

  } else {
    // ─────────────── PAID EVENT CANCELLATIONS (existing logic) ───────────────
    if(preview.strikeNum>=3){
      body = `If you cancel this event, hosting will be suspended for 2 months.\nVybeLocal is built on trust—and after 3 canceled events, that trust takes a hit.\nYou’ll need to wait 2 months  and cover the Stripe fees for your canceled event before you can host again.`;
    } else if(preview.strikeNum===2){
      body = `We’ll issue refunds and notify your guests right away.\nSince this isn’t your first cancellation after RSVPs, you’ll be charged $${penalty} to cover the original Stripe refund fees **plus** an additional $${extraFee} processing fee (Stripe’s 2.9% + 30¢) when paying that amount, for a total of $${totalCharge}.\nIn addition, your hosting privileges are paused for two weeks.`;
    } else {
      body = `We’ll handle the refunds and let your guests know the event’s off.\nYou’re covered — no platform penalty this time.\n\nBut heads up:\nCanceling future events after guests RSVP will pass refund costs back to you — in this case, that would’ve been $${penalty} in Stripe fees.`;
    }
  }

  async function confirm() {
    setLoading(true);
    try {
      // 1️⃣ If penalty payment required, handle card charge first
      if (paidEvent && preview.willChargeHost) {
        const payRes = await fetch(`/api/events/${eventId}/penalty-intent`, { method: 'POST' });
        const payJson = await payRes.json();
        if (!payRes.ok || payJson.status !== 'succeeded') {
          throw new Error(payJson.error || 'Penalty payment failed');
        }
      }

      // 2️⃣ Proceed with actual cancellation
      const res = await fetch(`/api/events/${eventId}/cancel`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason_text: reason || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast.success(
        `Event canceled and $${(json.refundTotalCents/100).toFixed(2)} refunded${json.penaltyCents>0?` • $${(json.penaltyCents/100).toFixed(2)} fee covered`:""}.`
      );
      onClose(true); // indicate success
    } catch (err) {
      toast.error(err.message);
      onClose(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-lg font-bold">{header}</h2>
        <p className="whitespace-pre-wrap text-sm text-gray-700">{body}</p>

        {/* Short-notice (<24h) cancellation helper */}
        {preview.shortNotice && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-800">Life happens. If this was out of your control, let us know.</p>
            <textarea
              className="w-full p-2 border rounded text-sm"
              rows={3}
              placeholder="Optional: share what happened (guests won’t see this)"
              value={reason}
              onChange={e=>setReason(e.target.value)}
              maxLength={300}
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <button
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
            onClick={() => onClose(false)}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
            onClick={confirm}
            disabled={loading}
          >
            {loading ? "Processing…" : (
                isFree ? 'Yes, cancel' : (paidEvent && preview.willChargeHost ? `Pay $${totalCharge} & cancel` : 'Got it')
              )}
          </button>
        </div>
      </div>
    </div>
  );
} 