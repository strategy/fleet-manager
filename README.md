# FleetManager

[![hits](https://hits.dwyl.com/strategy/fleet-manager.svg?style=flat-square)](http://hits.dwyl.com/strategy/fleet-manager)
[![unique](https://hits.dwyl.com/strategy/fleet-manager.svg?style=flat-square&show=unique)](http://hits.dwyl.com/strategy/fleet-manager)

Aplicație demo de management al flotei auto, folosită în cursul **Fișiere de configurare** (Dockerfile, docker-compose, GitHub Actions).

Mașinile sunt adăugate din interfața web și stau în parcarea din Oradea. Trimise în cursă spre o reședință de județ, ele merg în linie dreaptă cu 90 km/h, iar worker-ul trimite pozițiile GPS în timp real. Pozițiile se văd în tabel și pe hartă.

## Pornire rapidă

Cerințe: Docker Desktop (cu Docker Compose v2).

```bash
cp .env.example .env          # pe Windows: copy .env.example .env
docker compose up -d --build
docker compose ps             # db și api trebuie să ajungă „healthy”
```

| Adresă | Ce găsiți |
|---|---|
| http://localhost:8080 | Interfața web: vehicule, curse, poziții GPS |
| http://localhost:8080/map.html | Harta flotei în timp real (butonul **Hartă**) |
| http://localhost:3000 | Documentația API (Swagger UI) |
| http://localhost:3000/openapi.json | Specificația OpenAPI 3.0 |
| localhost:5432 | PostgreSQL, doar local (din `compose.override.yaml`) |

Oprire:

```bash
docker compose down       # oprește containerele, datele rămân
docker compose down -v    # șterge și volumul: flota pornește goală
```

## Cum se folosește

1. **Add car**: introduceți numărul de înmatriculare (modelul implicit e „Dacia Logan”). Mașina apare în parcarea din Oradea.
2. **Trimite cursa**: alegeți o reședință de județ. Mașina pleacă din Oradea spre oraș, în linie dreaptă.
3. **Trimite parcare**: mașina revine imediat în parcarea din Oradea și nu mai trimite GPS.
4. **Delete**: șterge mașina și istoricul ei GPS.

Stări:

| Semn | Stare | Trimite GPS? |
|---|---|---|
| albastru **P** | în parcare (Oradea) | nu |
| portocaliu **➜** | în cursă | da, la fiecare `GPS_POLL_SECONDS` |
| verde **✓** | a ajuns la destinație | nu |

## Arhitectură

```
browser ──► frontend (nginx :8080) ──/api──► api (Node.js :3000) ──► db (PostgreSQL)
                                                    │
                                                    └──────────────► redis (ultimele poziții GPS)
                         worker (Node.js) ── citește cursele din db, scrie poziții în db + redis
```

| Serviciu | Imagine / build | Rol |
|---|---|---|
| `db` | `postgres:17-alpine` | Tabelul `vehicles`: stare, destinație, poziție curentă |
| `redis` | `redis:7-alpine` | Ultimele 100 de poziții GPS trimise |
| `api` | `./api` | REST API + Swagger; creează tabelul la pornire |
| `worker` | `./api` (alt `command`) | Mută mașinile aflate în cursă spre destinație |
| `frontend` | `./frontend` | nginx: pagina web, harta și proxy pentru `/api` |

`api` și `worker` folosesc aceeași imagine. Worker-ul suprascrie `CMD` și dezactivează `HEALTHCHECK`-ul moștenit, pentru că nu ascultă pe niciun port.

## API

Documentația completă și interactivă e la http://localhost:3000.

| Metodă | Rută | Descriere |
|---|---|---|
| GET | `/health` | Verificare de sănătate |
| GET | `/api/vehicles` | Lista vehiculelor |
| POST | `/api/vehicles` | Adaugă o mașină: `{"plate": "BH-01-FLT", "model": "Ford Transit"}` |
| DELETE | `/api/vehicles/{plate}` | Șterge o mașină |
| GET | `/api/cities` | Destinațiile posibile |
| POST | `/api/vehicles/{plate}/trip` | Pornește o cursă: `{"city": "Cluj-Napoca"}` |
| POST | `/api/vehicles/{plate}/park` | Trimite mașina în parcare |
| GET | `/api/positions` | Ultimele 10 poziții GPS |

Când adăugați o rută în `api/src/server.ts`, actualizați și `api/src/openapi.ts`.

## Configurare

Toate valorile vin din variabile de mediu, citite din `.env` (care nu se comite) și din `compose.yaml`.

| Variabilă | Implicit | Descriere |
|---|---|---|
| `DB_PASSWORD` | — | Parola PostgreSQL, folosită de `db`, `api` și `worker` |
| `LOG_LEVEL` | `info` | Nivelul de log (`debug` local, din `compose.override.yaml`) |
| `GPS_POLL_SECONDS` | `10` | Intervalul la care worker-ul trimite poziții |
| `SPEED_KMH` | `90` | Viteza mașinilor în cursă |
| `SIM_SPEEDUP` | `1` | Accelerarea simulării: `60` = un minut de demo înseamnă o oră de drum |

La viteză reală, Oradea–Cluj (circa 120 km) durează aproape o oră și jumătate. `.env.example` setează `SIM_SPEEDUP=60` pentru demonstrații.

După orice modificare în `.env`, rulați `docker compose up -d`: Compose recreează doar containerele afectate.

## Dezvoltare

Codul API-ului și al worker-ului e în TypeScript, în `api/src/`:

| Fișier | Conținut |
|---|---|
| `server.ts` | Rutele REST și Swagger UI |
| `worker.ts` | Simularea GPS |
| `geo.ts` | Distanța (haversine) și pasul în linie dreaptă |
| `cities.ts` | Reședințele de județ și coordonatele lor |
| `config.ts` | Citirea variabilelor de mediu |
| `openapi.ts` | Specificația OpenAPI |

Verificare și teste, fără Docker (necesită Node.js):

```bash
cd api
npm ci
npm run lint    # verificare de tipuri TypeScript
npm test        # testele din *.test.ts
```

Comenzi utile cu Docker:

```bash
docker compose logs -f worker              # pozițiile GPS, live
docker compose exec db psql -U fleet       # client SQL în baza de date
docker compose config                      # configurația finală, după .env și override
docker compose up -d --build api worker    # reconstruiește după modificări în api/
```

## Integrare continuă

`.github/workflows/ci.yml` rulează la fiecare push pe `main` și la PR-urile care modifică `api/`:

1. **test**: `npm ci`, `npm run lint`, `npm test`, cu un PostgreSQL pornit ca serviciu.
2. **build** (doar pe `main`): construiește imaginea din `api/Dockerfile` și o publică în GitHub Container Registry, etichetată cu SHA-ul commit-ului.

Înainte de primul push, înlocuiți `fleet-team` din `ci.yml` cu utilizatorul sau organizația voastră GitHub, cu litere mici.

## Structura proiectului

```
fleet-manager/
├── .github/workflows/ci.yml   # GitHub Actions
├── api/
│   ├── src/                   # API, worker, teste
│   ├── Dockerfile             # build în două etape (build → runtime)
│   ├── .dockerignore
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── Dockerfile             # nginx + fișiere statice
│   ├── nginx.conf             # proxy /api → serviciul api
│   ├── index.html             # interfața principală
│   └── map.html               # harta (Leaflet + OpenStreetMap)
├── compose.yaml               # toată aplicația
├── compose.override.yaml      # ajustări doar pentru local
├── .env.example               # model pentru .env
├── .gitignore
└── LICENSE                    # MIT
```

## Probleme frecvente

| Simptom | Cauză și rezolvare |
|---|---|
| `port is already allocated` pe 5432 | Aveți deja PostgreSQL local. Ștergeți `ports` de la `db` din `compose.override.yaml`. |
| `api` nu pornește după ce ați schimbat `DB_PASSWORD` | Parola e setată doar la prima inițializare a volumului. Rulați `docker compose down -v`. |
| Mașinile merg foarte încet | `SIM_SPEEDUP` e 1. Setați-l în `.env` și rulați `docker compose up -d`. |
| Harta e goală | Harta încarcă Leaflet și imaginile OpenStreetMap de pe internet. |
| Swagger „Try it out” nu răspunde | `servers` din `openapi.ts` indică `http://localhost:3000`. Pe altă adresă sau alt port, actualizați valoarea. |

## Licență

[MIT](LICENSE): codul poate fi folosit, modificat și redistribuit liber, cu păstrarea notei de copyright.
