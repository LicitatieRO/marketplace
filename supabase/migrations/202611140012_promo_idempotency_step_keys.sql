-- Promo checkout reuses one client idempotency key across prepare + complete; derive per-step keys
-- so app.idempotency rows do not collide on (actor_id, key) with different operations.
CREATE OR REPLACE FUNCTION public.prepare_property_promo(
  p_property_id uuid,
  p_owner_id uuid,
  p_idempotency_key uuid,
  p_mode text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  p app.properties;
  r jsonb;
  payload jsonb;
  promo app.property_promos;
  existing app.property_promos;
  step_key uuid;
  step_digest text;
BEGIN
 step_digest:=md5(p_idempotency_key::text || ':prepare');
 step_key:=(
   substr(step_digest, 1, 8) || '-' || substr(step_digest, 9, 4) || '-' || substr(step_digest, 13, 4) || '-'
   || substr(step_digest, 17, 4) || '-' || substr(step_digest, 21, 12)
 )::uuid;
 IF p_mode NOT IN ('stripe_test','mock') THEN RAISE EXCEPTION 'Invalid promotion mode'; END IF;
 SELECT * INTO p FROM app.properties WHERE id=p_property_id FOR UPDATE;
 IF NOT FOUND OR p.owner_id<>p_owner_id THEN RAISE EXCEPTION 'Owner required'; END IF;
 PERFORM app.sweep_property_promos(p_property_id);
 payload:=jsonb_build_object('property',p_property_id,'mode',p_mode);
 r:=app.replay(p_owner_id,step_key,'promo_prepare',payload);
 IF r IS NOT NULL THEN RETURN r; END IF;
 SELECT * INTO existing FROM app.property_promos
 WHERE property_id=p.id AND status='pending' AND expires_at>clock_timestamp()
 ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN
  r:=jsonb_build_object('id',existing.id,'property_id',existing.property_id,'status',existing.status,'mode',existing.mode,'amount_minor',existing.amount_minor,'stripe_session_id',existing.stripe_session_id,'reused',true);
  PERFORM app.remember(p_owner_id,step_key,'promo_prepare',payload,r);
  RETURN r;
 END IF;
 IF EXISTS(SELECT 1 FROM app.property_promos WHERE property_id=p.id AND status='active' AND expires_at>clock_timestamp()) THEN
  RAISE EXCEPTION 'Promotion already active for this property';
 END IF;
 INSERT INTO app.property_promos(property_id,owner_id,amount_minor,status,mode,expires_at)
 VALUES(p.id,p_owner_id,1000,'pending',p_mode,clock_timestamp()+interval '35 minutes') RETURNING * INTO promo;
 r:=jsonb_build_object('id',promo.id,'property_id',promo.property_id,'status',promo.status,'mode',promo.mode,'amount_minor',promo.amount_minor,'reused',false);
 PERFORM app.remember(p_owner_id,step_key,'promo_prepare',payload,r);
 RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.complete_mock_property_promo(p_promo_id uuid,p_owner_id uuid,p_idempotency_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  promo app.property_promos;
  r jsonb;
  payload jsonb;
  ledger_id uuid;
  mock_event text;
  step_key uuid;
  step_digest text;
BEGIN
 step_digest:=md5(p_idempotency_key::text || ':complete');
 step_key:=(
   substr(step_digest, 1, 8) || '-' || substr(step_digest, 9, 4) || '-' || substr(step_digest, 13, 4) || '-'
   || substr(step_digest, 17, 4) || '-' || substr(step_digest, 21, 12)
 )::uuid;
 SELECT * INTO promo FROM app.property_promos WHERE id=p_promo_id FOR UPDATE;
 IF NOT FOUND OR promo.owner_id<>p_owner_id THEN RAISE EXCEPTION 'Owner required'; END IF;
 IF promo.mode<>'mock' THEN RAISE EXCEPTION 'Mock checkout only'; END IF;
 payload:=jsonb_build_object('promo',p_promo_id);
 r:=app.replay(p_owner_id,step_key,'promo_mock',payload);
 IF r IS NOT NULL THEN RETURN r; END IF;
 IF promo.status<>'pending' THEN RAISE EXCEPTION 'Promotion is not pending'; END IF;
 mock_event:='mock_'||p_promo_id::text;
 IF EXISTS(SELECT 1 FROM app.stripe_events WHERE event_id=mock_event AND processed_at IS NOT NULL) THEN
  r:=(SELECT to_jsonb(pp) FROM app.property_promos pp WHERE id=p_promo_id);
  PERFORM app.remember(p_owner_id,step_key,'promo_mock',payload,r);
  RETURN r;
 END IF;
 INSERT INTO app.stripe_events(event_id,type,payload_digest,livemode,rejected,processed_at)
 VALUES(mock_event,'mock.checkout.completed',md5(p_promo_id::text),false,false,clock_timestamp());
 UPDATE app.property_promos SET status='active',starts_at=clock_timestamp(),ends_at=clock_timestamp()+interval '7 days',expires_at=clock_timestamp()+interval '7 days',
  stripe_session_id='mock_session_'||p_promo_id::text
 WHERE id=p_promo_id RETURNING * INTO promo;
 INSERT INTO app.ledger_entries(account,amount_minor,currency,direction,purpose,stripe_event_id,promo_id,mode,idempotency_key)
 VALUES('platform:promo_simulated',0,'EUR','credit','property_promo',mock_event,promo.id,'mock',p_idempotency_key::text)
 RETURNING id INTO ledger_id;
 r:=to_jsonb(promo)||jsonb_build_object('ledger_id',ledger_id,'real_amount_minor',0,'label','POC / Simulare');
 PERFORM app.remember(p_owner_id,step_key,'promo_mock',payload,r);
 PERFORM app.audit('promo.mock_completed',promo.id,jsonb_build_object('property_id',promo.property_id));
 RETURN r;
END $$;

REVOKE EXECUTE ON FUNCTION public.prepare_property_promo(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_property_promo(uuid,uuid,uuid,text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.complete_mock_property_promo(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mock_property_promo(uuid,uuid,uuid) TO service_role;