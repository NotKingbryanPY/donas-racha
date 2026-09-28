-- Run this migration before any function that compares app_role to SELLER.
alter type public.app_role add value if not exists 'SELLER';
