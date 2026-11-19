# Staff MFA integration check

`tests/e2e/staff-mfa.spec.ts` runs only with `E2E_BACKEND=1` against the disposable local Supabase stack. It creates its own confirmed user, promotes only that UUID through parameterized local SQL, and deletes the account afterward. It never changes a shared owner account or hosted project.

Run the documented local setup first (`docs/local-development.md`), including migrations and `npm run local:env`. Set `DATABASE_URL` to the isolated local PostgreSQL connection on port 15432 without printing it. Then run:

```sh
npm run test:e2e:backend -- tests/e2e/staff-mfa.spec.ts
```

The application URL, Auth URL, and database URL must all use exact loopback hostnames. The database must use the documented test port. Target checks run before account creation or SQL; missing or hosted targets fail instead of silently skipping. Existing backend CI supplies these settings for its disposable stack.

`supabase/config.toml` explicitly enables local TOTP enrollment and verification; Supabase CLI defaults disable both. This changes the disposable local stack configuration only. The application assigns a unique friendly name to each enrollment because Auth rejects duplicate names, which otherwise prevents adding a backup factor. Existing staff AAL2 and final-factor protections remain enforced.

The test exercises real application HTTP endpoints using browser-context cookies and checks the privileged founder outbox page. It covers TOTP enrollment, AAL2 access, a fresh AAL1 login that cannot access the page or remove a verified factor, an invalid authenticator code, a subsequent valid challenge, backup-factor enrollment and primary-factor removal, and refusal to remove the final staff factor. The TOTP seed exists only in test-process memory. Trace, screenshot, and video capture are disabled for the entire spec; assertions never compare seed values or dump enrollment bodies.

This verifies the server round trip and browser session, not every account-security UI interaction, lost-device recovery by support, or hosted-provider settings. Staff must retain a verified factor. The disposable account is removed through local admin Auth solely as test cleanup; that is not a user recovery feature.

TOTP generation has public RFC 6238 vector tests. The suite waits for one new 30-second time step before challenging a previously used factor, so a successful prior enrollment code is not replayed. Desktop and mobile runs have separate random users and factors.
