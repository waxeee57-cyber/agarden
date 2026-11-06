-- 18_no_outbound_mail — the website no longer sends e-mail itself (no SMTP,
-- no API, no third party). Guest messages are written by the owner from the
-- admin, in their own mail app. The delivery log of the removed sender goes.
drop table if exists email_log;
