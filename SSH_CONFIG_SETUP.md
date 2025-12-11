# SSH Config Setup za stabilnu konekciju

## Problem
Cursor Remote-SSH gubi konekciju sa serverom.

## Rješenje

Kreiraj/editiraj `C:\Users\TvojeIme\.ssh\config` fajl i dodaj sljedeće:

```
Host hetzner-server
    HostName 46.224.115.49
    User armin
    ServerAliveInterval 60
    ServerAliveCountMax 3
    TCPKeepAlive yes
    Compression yes
    ControlMaster auto
    ControlPath ~/.ssh/master-%r@%h:%p
    ControlPersist 10m
    StrictHostKeyChecking no
    UserKnownHostsFile ~/.ssh/known_hosts
```

## Kako koristiti

1. Nakon što kreiraš config fajl, u Cursor-u:
   - `F1` → `Remote-SSH: Connect to Host...`
   - Izaberi `hetzner-server` (umjesto `armin@46.224.115.49`)

2. Ili direktno u terminalu:
   ```bash
   ssh hetzner-server
   ```

## Objašnjenje opcija

- `ServerAliveInterval 60` - šalje keep-alive signal svakih 60 sekundi
- `ServerAliveCountMax 3` - ako 3 puta zaredom nema odgovora, prekida konekciju
- `TCPKeepAlive yes` - omogućava TCP keep-alive
- `ControlMaster auto` - koristi connection sharing za brže povezivanje
- `ControlPersist 10m` - zadržava master connection 10 minuta

## Alternativno rješenje - direktno u terminalu

Ako Cursor i dalje gubi konekciju, probaj:

```bash
ssh -o ServerAliveInterval=60 -o ServerAliveCountMax=3 armin@46.224.115.49
```

