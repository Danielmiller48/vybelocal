begin;

create schema if not exists analytics;

-- Enable RLS by default for safety (tables will add policies)
alter schema analytics owner to postgres;

commit;



