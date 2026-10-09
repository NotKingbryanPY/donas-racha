# Donas Racha / Donas Control

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
