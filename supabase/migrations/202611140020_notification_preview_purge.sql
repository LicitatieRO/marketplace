-- Purge notification preview rows older than 30 days; schedule daily when pg_cron is available.

CREATE OR REPLACE FUNCTION public.purge_notification_previews_older_than_30_days()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH deleted AS (
    DELETE FROM app.notification_previews
    WHERE created_at < clock_timestamp() - interval '30 days'
    RETURNING id
  )
  SELECT count(*)::bigint FROM deleted;
$$;

REVOKE ALL ON FUNCTION public.purge_notification_previews_older_than_30_days() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_notification_previews_older_than_30_days() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
      IF EXISTS (SELECT 1 FROM pg_catalog.pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule(j.jobid)
        FROM cron.job AS j
        WHERE j.jobname = 'marketplace-purge-notification-previews';
        PERFORM cron.schedule(
          'marketplace-purge-notification-previews',
          '0 3 * * *',
          'SELECT public.purge_notification_previews_older_than_30_days()'
        );
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Enable pg_cron and schedule purge_notification_previews_older_than_30_days(): %', SQLERRM;
    END;
  END IF;
END $$;