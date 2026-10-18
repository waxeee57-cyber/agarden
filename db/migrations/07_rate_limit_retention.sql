-- ============================================================
-- 07_rate_limit_retention — rate_limits keys contain IP addresses (personal
-- data). The privacy notice promises at most 24 hours of retention, so the
-- counter now prunes itself: roughly 1 in 50 calls deletes rows whose window
-- started more than 24 hours ago. No cron needed.
-- ============================================================

create or replace function rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
as $$
declare
  v_hits int;
begin
  if random() < 0.02 then
    delete from rate_limits where window_start < now() - interval '24 hours';
  end if;

  insert into rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when r.window_start < now() - make_interval(secs => p_window_seconds) then 1 else r.hits + 1 end,
        window_start = case when r.window_start < now() - make_interval(secs => p_window_seconds) then now() else r.window_start end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

-- one-off cleanup of anything already older than the promise
delete from rate_limits where window_start < now() - interval '24 hours';
