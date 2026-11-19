CREATE TABLE app.dsa_notices(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 listing_id uuid NOT NULL REFERENCES app.listings(id),
 listing_url text NOT NULL CHECK(length(trim(listing_url)) BETWEEN 8 AND 2048),
 element text NOT NULL CHECK(element IN('photos','description','price_details','virtual_tour','seller_info','whole_listing')),
 reason text NOT NULL CHECK(reason IN('fraud','misleading_info','ip_infringement','personal_data','hate_threats','csam','other_illegal','terms_breach')),
 explanation text NOT NULL CHECK(length(trim(explanation))>=30),
 notifier_name text,
 notifier_email text,
 good_faith boolean NOT NULL DEFAULT true CHECK(good_faith),
 status text NOT NULL DEFAULT 'received' CHECK(status IN('received','under_review','decided','closed')),
 decision text CHECK(decision IS NULL OR decision IN('no_action','content_removed','access_disabled','listing_suspended','account_suspended')),
 decision_facts text,
 decision_ground_type text CHECK(decision_ground_type IS NULL OR decision_ground_type IN('legal','contractual')),
 decision_ground text,
 decision_end_at timestamptz,
 automated boolean NOT NULL DEFAULT false,
 escalate_art18 boolean NOT NULL DEFAULT false,
 notifier_email_rendered text,
 owner_statement_rendered text,
 decided_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT dsa_notice_notifier_identity CHECK(
  reason='csam' OR (
   notifier_name IS NOT NULL AND length(trim(notifier_name)) BETWEEN 1 AND 160
   AND notifier_email IS NOT NULL AND length(trim(notifier_email)) BETWEEN 3 AND 254
  )
 )
);
CREATE INDEX dsa_notices_status_created_idx ON app.dsa_notices(status,created_at DESC);
CREATE INDEX dsa_notices_reason_created_idx ON app.dsa_notices(reason,created_at DESC);
ALTER TABLE app.dsa_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app.dsa_notices FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.submit_dsa_notice(
 p_listing_id uuid,
 p_listing_url text,
 p_element text,
 p_reason text,
 p_explanation text,
 p_notifier_name text,
 p_notifier_email text,
 p_good_faith boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n app.dsa_notices; nn text; ne text;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF NOT EXISTS(SELECT 1 FROM app.listings WHERE id=p_listing_id) THEN RAISE EXCEPTION 'Listing not found'; END IF;
 IF p_good_faith IS DISTINCT FROM true THEN RAISE EXCEPTION 'Good faith confirmation required'; END IF;
 nn:=NULLIF(trim(coalesce(p_notifier_name,'')),''); ne:=NULLIF(trim(coalesce(p_notifier_email,'')),'');
 IF p_reason='csam' THEN nn:=NULL; ne:=NULL; END IF;
 INSERT INTO app.dsa_notices(listing_id,listing_url,element,reason,explanation,notifier_name,notifier_email,good_faith)
 VALUES(p_listing_id,trim(p_listing_url),p_element,p_reason,trim(p_explanation),nn,ne,p_good_faith)
 RETURNING * INTO n;
 RETURN jsonb_build_object('id',n.id,'listing_url',n.listing_url,'created_at',n.created_at);
END $$;

CREATE FUNCTION public.list_dsa_notices(p_status text,p_section text,p_limit integer) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE lim integer;
BEGIN
 PERFORM app.require_staff();
 lim:=LEAST(GREATEST(coalesce(p_limit,50),1),200);
 RETURN coalesce((
  SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at DESC,s.id)
  FROM (
   SELECT n.id,n.listing_id,n.listing_url,n.element,n.reason,n.status,n.decision,n.escalate_art18,n.decided_at,n.created_at
   FROM app.dsa_notices n
   WHERE (p_status IS NULL OR btrim(p_status)='' OR n.status=p_status)
    AND CASE btrim(coalesce(p_section,''))
     WHEN '' THEN true
     WHEN 'all' THEN true
     WHEN 'art16' THEN n.reason<>'terms_breach'
     WHEN 'terms_breach' THEN n.reason='terms_breach'
     ELSE false
    END
   ORDER BY n.created_at DESC,n.id
   LIMIT lim
  ) s
 ),'[]'::jsonb);
END $$;

CREATE FUNCTION public.get_dsa_notice(p_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM app.require_staff();
 RETURN (SELECT to_jsonb(n) FROM app.dsa_notices n WHERE id=p_id);
END $$;

CREATE FUNCTION public.update_dsa_notice(
 p_id uuid,
 p_status text,
 p_decision text,
 p_decision_facts text,
 p_decision_ground_type text,
 p_decision_ground text,
 p_decision_end_at timestamptz,
 p_automated boolean,
 p_escalate_art18 boolean,
 p_notifier_email_rendered text,
 p_owner_statement_rendered text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cur app.dsa_notices; next_status text; next_decision text; next_facts text; next_ground_type text; next_ground text;
BEGIN
 PERFORM app.require_staff();
 SELECT * INTO cur FROM app.dsa_notices WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Notice not found'; END IF;
 next_status:=coalesce(NULLIF(btrim(p_status),''),cur.status);
 IF next_status NOT IN('received','under_review','decided','closed') THEN RAISE EXCEPTION 'Invalid status'; END IF;
 next_decision:=coalesce(p_decision,cur.decision);
 next_facts:=coalesce(NULLIF(btrim(p_decision_facts),''),cur.decision_facts);
 next_ground_type:=coalesce(p_decision_ground_type,cur.decision_ground_type);
 next_ground:=coalesce(NULLIF(btrim(p_decision_ground),''),cur.decision_ground);
 IF next_status IN('decided','closed') THEN
  IF next_decision IS NULL THEN RAISE EXCEPTION 'Decision required'; END IF;
  IF next_facts IS NULL OR length(trim(next_facts))<10 THEN RAISE EXCEPTION 'Decision facts required'; END IF;
  IF next_ground_type IS NULL THEN RAISE EXCEPTION 'Decision ground type required'; END IF;
  IF next_ground IS NULL OR length(trim(next_ground))<3 THEN RAISE EXCEPTION 'Decision ground required'; END IF;
 END IF;
 UPDATE app.dsa_notices SET
  status=next_status,
  decision=next_decision,
  decision_facts=next_facts,
  decision_ground_type=next_ground_type,
  decision_ground=next_ground,
  decision_end_at=coalesce(p_decision_end_at,decision_end_at),
  automated=coalesce(p_automated,automated),
  escalate_art18=coalesce(p_escalate_art18,escalate_art18),
  notifier_email_rendered=coalesce(p_notifier_email_rendered,notifier_email_rendered),
  owner_statement_rendered=coalesce(p_owner_statement_rendered,owner_statement_rendered),
  decided_at=CASE WHEN next_status IN('decided','closed') AND decided_at IS NULL THEN clock_timestamp() ELSE decided_at END
 WHERE id=p_id
 RETURNING * INTO cur;
 RETURN to_jsonb(cur);
END $$;

REVOKE ALL ON FUNCTION public.submit_dsa_notice(uuid,text,text,text,text,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_dsa_notice(uuid,text,text,text,text,text,text,boolean) TO service_role;
REVOKE ALL ON FUNCTION public.list_dsa_notices(text,text,integer),public.get_dsa_notice(uuid),public.update_dsa_notice(uuid,text,text,text,text,text,timestamptz,boolean,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.list_dsa_notices(text,text,integer),public.get_dsa_notice(uuid),public.update_dsa_notice(uuid,text,text,text,text,text,timestamptz,boolean,boolean,text,text) TO authenticated;
