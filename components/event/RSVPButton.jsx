"use client";

import { useState, useEffect, useTransition } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/utils/supabase/client";
import toast from "react-hot-toast";
import PaymentModal from "@/components/payments/PaymentModal";
import { calcFees } from "@/lib/fees";

const supabase = createSupabaseBrowser();

export default function RSVPButton({
  eventId,
  price = null,
  initialJoined = null,
  initialPaid = false,
  initialRsvpCount = null,
  capacity: capacityProp = null,
  onCountChange = null,
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [joined, setJoined] = useState(initialJoined ?? false);
  const [paid, setPaid]     = useState(initialPaid  ?? false);
  const [busy, startBusy]   = useTransition();
  const [bridged, setBridged] = useState(false);
  const [rsvpCount, setRsvpCount] = useState(initialRsvpCount ?? 0);

  // keep local count in sync if parent provides a newer value
  useEffect(() => {
    if (initialRsvpCount !== null && initialRsvpCount !== undefined) {
      setRsvpCount(initialRsvpCount);
    }
  }, [initialRsvpCount]);
  const [capacity, setCapacity] = useState(capacityProp);
  const [showPayModal, setShowPayModal] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    const sync = async () => {
      const at = session?.supabase?.access_token || session?.supabaseAccessToken;
      const rt = session?.supabase?.refresh_token || session?.supabaseRefreshToken;

      if (at && rt) {
        await supabase.auth
          .setSession({ access_token: at, refresh_token: rt })
          .catch(() => {});
      }
      setBridged(true);
    };

    sync();
  }, [status, session]);

  useEffect(() => {
    if (initialJoined !== null) return;
    async function fetchJoined() {
      if (status !== "authenticated") return;
      console.log("RSVPButton: Fetching user RSVP status for event:", eventId, "user:", session.user.id);
      const { data, error } = await supabase
        .from("rsvps")
        .select("user_id, paid")
        .eq("event_id", eventId)
        .eq("user_id", session.user.id);
      
      if (error) {
        console.error("RSVPButton: Error fetching user RSVP status:", error);
      } else {
        console.log("RSVPButton: User RSVP status fetched:", data);
        if (data?.length) {
          setJoined(true);
          setPaid(Boolean(data[0].paid));
        }
      }
    }
    fetchJoined();
  }, [status, session, eventId]);

  useEffect(() => {
    if (initialRsvpCount !== null && capacityProp !== null) { setCapacity(capacityProp); return; }
    async function fetchEventData() {
      if (!bridged) return;
      
      console.log("RSVPButton: Fetching event data for:", eventId);
      
      // Fetch event capacity
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("rsvp_capacity")
        .eq("id", eventId)
        .single();
      
      if (eventError) {
        console.error("RSVPButton: Error fetching event capacity:", eventError);
      } else {
        console.log("RSVPButton: Event capacity fetched:", event?.rsvp_capacity);
        setCapacity(event?.rsvp_capacity || null);
      }

      // Fetch RSVP count
      const { count, error: countError } = await supabase
        .from("rsvps")
        .select("event_id", { count: "exact" })
        .eq("event_id", eventId);
      
      if (countError) {
        console.error("RSVPButton: Error fetching RSVP count:", countError);
      } else {
        console.log("RSVPButton: RSVP count fetched:", count);
        setRsvpCount(count ?? 0);
      }
      if (typeof onCountChange === 'function') onCountChange(count ?? 0);
    }
    fetchEventData();
  }, [bridged, eventId]);

  function toggleRsvp(e) {
    // Prevent navigation when nested inside a <Link>
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!bridged) return;
    if (status !== "authenticated") {
      router.push("/login");
      return;
    }

    // Check capacity before allowing RSVP
    if (!joined && capacity && rsvpCount >= capacity) {
      toast.error("This event is at maximum capacity.");
      return;
    }

    startBusy(async () => {
      const row = { event_id: eventId, user_id: session.user.id };
      let error;

      if (!joined) {
        if (isPaidEvent) {
          // Paid event – open checkout modal first; insert RSVP after payment success
          setShowPayModal(true);
          toast("Complete payment to secure your spot.");
        } else {
          ({ error } = await supabase
            .from("rsvps")
            .insert(row, { ignoreDuplicates: true }));
          if (!error) {
            setJoined(true);
            const newCount = rsvpCount + 1;
            setRsvpCount(newCount);
            if (typeof onCountChange === 'function') onCountChange(newCount);
            toast.success("RSVP confirmed! 🎉");
          }
        }
      } else {
        if (!confirm("Are you sure you want to cancel your RSVP?")) return;
        ({ error } = await supabase.from("rsvps").delete().match(row));
        if (!error) {
          setJoined(false);
          const newCount = rsvpCount - 1;
          setRsvpCount(newCount);
          if (typeof onCountChange === 'function') onCountChange(newCount);
          setPaid(false);
          toast("RSVP cancelled.");
        }
      }

      if (error) {
        toast.error("Something went wrong.");
        console.error(error.message);
      }
    });
  }

  // Normalise price so that strings like "0" or "" don’t slip through.
  const priceCents = Number(price) || 0;
  const isPaidEvent = priceCents > 0;

  const totalWithFees = isPaidEvent ? calcFees(priceCents).total : 0;

  return (
    <>
    <button
      onClick={toggleRsvp}
      disabled={busy || !bridged || (!joined && capacity && rsvpCount >= capacity) || (joined && isPaidEvent && paid)}
      className={`mt-4 w-full rounded-lg py-2 text-white transition ${
        joined
          ? paid
            ? "bg-green-600 cursor-default"
            : "bg-yellow-600 hover:bg-yellow-700"
          : "bg-indigo-600 hover:bg-indigo-700"
      } ${(!joined && capacity && rsvpCount >= capacity) ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {busy 
        ? "…" 
        : joined
          ? (isPaidEvent
              ? (paid ? "✓ Paid" : "Pay now")
              : "Cancel RSVP")
          : (!joined && capacity && rsvpCount >= capacity)
            ? "Max capacity reached"
            : isPaidEvent
              ? capacity
                ? `Pay $${(totalWithFees/100).toFixed(2)} (${Math.max(0, capacity - rsvpCount)} left)`
                : `Pay $${(totalWithFees/100).toFixed(2)}`
              : capacity 
                ? `RSVP (${Math.max(0, capacity - rsvpCount)} left)`
                : "RSVP"
      }
    </button>

    {/* Payment Modal */}
    <PaymentModal
      open={showPayModal}
      eventId={eventId}
      amount={priceCents}
      onClose={() => setShowPayModal(false)}
      onSuccess={async () => {
        // Insert RSVP row now that payment succeeded
        const row = { event_id: eventId, user_id: session.user.id, paid: true };
        const { error } = await supabase
          .from('rsvps')
          .insert(row, { ignoreDuplicates: true });
        if (!error) {
          setJoined(true);
          const newCount = rsvpCount + 1;
          setRsvpCount(newCount);
          if (typeof onCountChange === 'function') onCountChange(newCount);
          setPaid(true);
        }
        setShowPayModal(false);
      }}
    />
    </>
  );
}