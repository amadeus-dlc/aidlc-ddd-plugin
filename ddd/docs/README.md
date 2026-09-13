# DDD plugin documentation

English | [Japanese](README.ja.md)

Choose the documentation for your role.

| Audience | Start here | Contents |
|---|---|---|
| Users applying the plugin to an application project | [User documentation](users/README.md) | Installation guide, artifact declarations, domain packaging, and sensor behavior and limits |
| Developers changing or verifying this plugin | [Developer documentation](developers/README.md) | Plugin design, decisions, compatibility, tests, evidence, and remaining work |

For a feature overview, see the [plugin README](../README.md).

## Documentation conventions

Each document has an English `.md` edition and a Japanese `.ja.md` edition with matching content. Keep user-facing contracts under `users/`, and plugin design and verification records under `developers/`. Store machine-readable verification evidence under `developers/evidence/`.

Knowledge, sensors, stages, and contributions are English-only runtime instructions. Records under `aidlc/` remain Japanese.
