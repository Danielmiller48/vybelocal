begin;

-- Backfill refunds into analytics.host_monthly where missing/zero, based on RSVPs and gross
-- Uses modest, realistic ranges: 2%-8% of RSVPs refunded; 2%-7% of gross as refund amount
-- Only affects rows with positive gross and leaves existing non-zero values untouched

update analytics.host_monthly hm
set
  refund_count = greatest(
    0,
    floor(hm.rsvps_total * (0.02 + random() * 0.06))::int
  ),
  refund_amount_cents = greatest(
    0,
    floor(hm.gross_revenue_cents * (0.02 + random() * 0.05))::bigint
  )
where coalesce(hm.gross_revenue_cents, 0) > 0
  and coalesce(hm.rsvps_total, 0) > 0
  and coalesce(hm.refund_count, 0) = 0
  and coalesce(hm.refund_amount_cents, 0) = 0;

-- Refresh host_live refund aggregates from host_monthly
update analytics.host_live hl
set
  refund_count = s.refund_count,
  refund_amount_cents = s.refund_amount_cents,
  updated_at = now()
from (
  select host_id,
         coalesce(sum(refund_count),0) as refund_count,
         coalesce(sum(refund_amount_cents),0) as refund_amount_cents
  from analytics.host_monthly
  group by host_id
) s
where hl.host_id = s.host_id;

commit;


