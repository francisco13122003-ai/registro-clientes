-- Internal transaction functions used by triggers and internal flows.
-- They must not be executable directly via RPC by client roles.

REVOKE EXECUTE ON FUNCTION public.claim_transaction_tx_code(text, timestamp with time zone, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transaction_code_prefix(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transactions_generate_tx_code_if_missing() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_transactions_cleanup_related_before_delete_fn() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_transactions_resync_counter_after_delete_fn() FROM PUBLIC, anon, authenticated;
