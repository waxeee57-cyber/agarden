-- 21_drop_bank_account — cash on site only: no bank details exist anywhere.
-- The column (added in 09, retired in 20) and any value in it are removed.
alter table listings drop column if exists bank_account;
