-- Durable, bounded notification delivery. Lease tokens are available only to the
-- trusted service worker, never to normal user or anonymous API sessions.
ALTER TABLE app.notification_outbox
 ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 ADD COLUMN lease_until timestamptz,
 ADD COLUMN lease_token uuid,
 ADD COLUMN last_error text CHECK(last_error IS NULL OR last_error='delivery_failed');
CREATE INDEX notification_outbox_due ON app.notification_outbox(next_attempt_at,id) WHERE delivered_at IS NULL AND attempts<5;
CREATE FUNCTION public.claim_notifications(p_limit integer) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 WITH due AS MATERIALIZED (
  SELECT n.id FROM app.notification_outbox n JOIN auth.users u ON u.id=n.user_id
  WHERE n.delivered_at IS NULL AND n.attempts<5 AND n.next_attempt_at<=clock_timestamp()
   AND (n.lease_until IS NULL OR n.lease_until<=clock_timestamp()) AND u.email IS NOT NULL AND u.email<>''
  ORDER BY n.next_attempt_at,n.id
  LIMIT least(greatest(coalesce(p_limit,0),0),50)
  FOR UPDATE OF n SKIP LOCKED
 ), claimed AS (
  UPDATE app.notification_outbox n SET attempts=n.attempts+1,lease_until=clock_timestamp()+interval '2 minutes',lease_token=gen_random_uuid()
  FROM due WHERE n.id=due.id RETURNING n.id,n.user_id,n.event,n.entity_id,n.lease_token
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'email',u.email,'event',c.event,'entity_id',c.entity_id,'lease_token',c.lease_token) ORDER BY c.id),'[]'::jsonb)
 FROM claimed c JOIN auth.users u ON u.id=c.user_id
$$;
CREATE FUNCTION public.finish_notification(p_id bigint,p_lease_token uuid,p_delivered boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE matched bigint;
BEGIN
 IF p_delivered IS NULL THEN RAISE EXCEPTION 'Delivery result required'; END IF;
 UPDATE app.notification_outbox SET
  delivered_at=CASE WHEN p_delivered THEN clock_timestamp() ELSE NULL END,
  next_attempt_at=CASE WHEN p_delivered THEN next_attempt_at ELSE clock_timestamp()+make_interval(secs=>least(3600.0,30.0*power(2.0,greatest(attempts-1,0)))) END,
  lease_until=NULL,lease_token=NULL,last_error=CASE WHEN p_delivered THEN NULL ELSE 'delivery_failed' END
 WHERE id=p_id AND lease_token=p_lease_token AND lease_until>clock_timestamp() AND delivered_at IS NULL
 RETURNING id INTO matched;
 RETURN matched IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_notifications(integer),public.finish_notification(bigint,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notifications(integer),public.finish_notification(bigint,uuid,boolean),public.close_expired_auctions() TO service_role;
