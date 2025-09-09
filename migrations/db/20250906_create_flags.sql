-- Create flags table and supporting indexes
begin;

create table if not exists public.flags (
  id uuid not null default gen_random_uuid(),
  target_type text null,
  target_id uuid not null,
  reporter_id uuid null,
  reason_code text null,
  severity integer null default 1,
  created_at timestamptz null default now(),
  details jsonb null,
  user_id uuid null,
  status varchar(16) not null default 'pending',
  source varchar(10) not null default 'ai',
  constraint flags_pkey primary key (id),
  constraint flags_reporter_id_fkey foreign key (reporter_id) references auth.users (id),
  constraint flags_source_check check ((source)::text = any ((array['ai'::varchar,'user'::varchar])::text[])),
  constraint flags_target_type_check check (target_type = any (array['event'::text,'user'::text]))
);

create index if not exists idx_flags_source on public.flags using btree (source);

create index if not exists idx_flags_user_open on public.flags using btree (target_id)
where ((target_type = 'user'::text) and ((status)::text <> 'resolved'::text));

create index if not exists flags_target_idx on public.flags using btree (target_type, target_id);

commit;




