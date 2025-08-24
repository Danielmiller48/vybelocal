begin;

-- Clear analytics data in a safe FK order
delete from analytics.event_daily;
delete from analytics.event_live;
delete from analytics.host_monthly;
delete from analytics.host_live;

commit;


