# Donas Racha / Donas Control

Latest scope, chosen by the user on 2026-10-13: rebuild Android Donas Control
for daily purchases, sales, seller consumption, stock and durable daily closing.
Supabase remains the shared authority; preserve the independent website and
existing business records/Room data. Do not automatically restore legacy mobile
auth, push, provisioning, accounting upload or cron workflows. Read
docs/DONAS_CONTROL_2_AUDITORIA.md and docs/knowledge/AI_CONTEXT.md.
The 2026-10-12 web retirement and earlier Firebase transition are historical.
Every functional change must update docs/knowledge in the same delivery; run
the knowledge report/generate/check/review workflow after reviewing actual code.

For Firebase tasks, always locate and read the appropriate Firebase agent skills
before implementing changes. Use firebase-basics for CLI/project/app configuration,
firebase-auth-basics for identity, firebase-firestore for database setup and queries,
and firestore-rules-creation / firebase-security-rules-auditor for rules.

The user chose a gradual transition on 2026-10-08: Firebase Authentication and
Firestore for Android, while Supabase remains the shared authority for orders,
inventory, catalog and loyalty. Do not introduce independent writable copies of
those business records. Preserve Room, the persistent outbox and existing data.

Firebase project: donascontrol-1f5df. Android app ID supplied by the user:
1:476925718096:android:09f47532b8e643b406ab55. Verify its registered package before
using its SDK configuration. Official package: com.bryan.donas.control.

Email/password and Google Sign-in identify users; neither grants ADMIN/SELLER
automatically. Bind authorized identities on the server. Keep private server keys
out of APKs, frontend files, logs and Git.
Never print Firebase login:list --json or credential stores. Verify access with
sanitized projects:list metadata; SDK configuration is public but OAuth login
tokens and service-account keys are private.

Supabase preflight supplied on 2026-10-08 identified missing migrations and a
missing catalog timestamp trigger. Read docs/ACTIVACION_2026-10-08.md before any
production SQL. Existing rows and physical stock must be preserved; never reseed
the existing flavor catalog or fabricate stock to resolve reservation shortages.
