-- 20250802_notifications_auto_expire.sql
-- prevent insertion of already expired notifications

create or replace function notif_skip_if_expired()
returns trigger language plpgsql as $$
begin
  if NEW.expires_at is not null and NEW.expires_at < now() then
    return null; -- skip insert
  end if;
  return NEW;
end;
$$;

create trigger notif_before_insert
before insert on notifications
for each row execute function notif_skip_if_expired(); 