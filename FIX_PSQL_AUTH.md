# Rješavanje Peer Authentication greške

## Problem
`Peer authentication failed for user "postgres"` - PostgreSQL zahtijeva autentifikaciju preko sistema.

## Rješenje

### Opcija 1: Koristi sudo (Preporučeno)

```bash
sudo -u postgres psql -d office_app -f ~/migrate-users-table.sql
```

Ovo će pokrenuti psql kao postgres korisnik bez potrebe za password.

---

### Opcija 2: Koristi TCP/IP konekciju

```bash
psql -h localhost -U postgres -d office_app -f ~/migrate-users-table.sql
```

Ovo forsira TCP/IP konekciju umjesto Unix socket-a.

---

### Opcija 3: Prebaci se na postgres korisnika

```bash
su - postgres
psql -d office_app -f ~/migrate-users-table.sql
```

---

## Najvjerovatnije će raditi:

**Opcija 1** (sudo) je najjednostavnija:

```bash
sudo -u postgres psql -d office_app -f ~/migrate-users-table.sql
```

Javi rezultat!

