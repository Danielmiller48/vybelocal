-- Add revenue/fee columns to analytics tables; keep paid_count for compatibility
begin;

-- event_live
alter table analytics.event_live
  add column if not exists price_cents_snapshot bigint not null default 0,
  add column if not exists gross_revenue_cents bigint not null default 0,
  add column if not exists platform_fee_cents bigint not null default 0,
  add column if not exists processor_fee_cents bigint not null default 0,
  add column if not exists net_to_host_cents bigint not null default 0;

-- event_daily (optional granularity; keeps daily revenue estimates if we ever need them)
alter table analytics.event_daily
  add column if not exists gross_revenue_cents bigint not null default 0,
  add column if not exists platform_fee_cents bigint not null default 0,
  add column if not exists processor_fee_cents bigint not null default 0,
  add column if not exists net_to_host_cents bigint not null default 0;

-- host_monthly rollups
alter table analytics.host_monthly
  add column if not exists gross_revenue_cents bigint not null default 0,
  add column if not exists platform_fee_cents bigint not null default 0,
  add column if not exists processor_fee_cents bigint not null default 0,
  add column if not exists net_to_host_cents bigint not null default 0;

commit;

