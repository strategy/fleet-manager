# FleetManager

Aplicație demo de management al flotei auto, folosită în cursul **Fișiere de configurare** (Dockerfile, docker-compose, GitHub Actions) și, pe acest branch (`localstack`), pentru drumul codului **de la calculatorul vostru până în AWS**.

Mașinile sunt adăugate din interfața web și stau în parcarea din Oradea. Trimise în cursă spre o reședință de județ, ele merg în linie dreaptă cu 90 km/h, iar worker-ul trimite pozițiile GPS. Pozițiile se văd în tabel și pe hartă.

> **Fluxul de lucru complet** (local → LocalStack → Pull Request → producție) e în **[DEPLOY.md](DEPLOY.md)**.

## Cele trei medii

| Mediu | Comanda | Unde |
|---|---|---|
| local | `docker compose up -d --build` | http://localhost:8080 |
| localstack | `npm run deploy:localstack` (metoda A) sau `npm run deploy:localstack:docker` (metoda B) | adresa afișată la final de comandă |
| production | merge în `master` (GitHub Actions rulează `npm run deploy:production`) | adresa din GitHub → Deployments |

## Instalare

Uneltele de care aveți nevoie:

| Unealtă | La ce folosește | Mediul |
|---|---|---|
| Git | codul sursă, branch-uri, Pull Request-uri | toate |
| Docker Desktop | containerele aplicației; LocalStack rulează tot în Docker | local, localstack |
| Node.js (22 sau mai nou) | teste, build, scriptul de deploy | toate |
| AWS CLI | comenzi către AWS / LocalStack | localstack, production |
| AWS SAM CLI | deploy-ul din `template.yaml` | localstack, production |
| lstk | pornirea LocalStack (doar **metoda A**) | localstack |

### Windows

Folosiți **Command Prompt (cmd)**. `winget` vine cu Windows 10 și 11; dacă lipsește, instalați „App Installer” din Microsoft Store.

1. Activați WSL 2, de care are nevoie Docker Desktop. Deschideți cmd **ca administrator** (clic dreapta → *Run as administrator*), apoi reporniți calculatorul:

   ```bat
   wsl --install
   ```

2. Instalați uneltele, într-un cmd obișnuit:

   ```bat
   winget install --id Git.Git -e
   winget install --id Docker.DockerDesktop -e
   winget install --id OpenJS.NodeJS.LTS -e
   winget install --id Amazon.AWSCLI -e
   winget install --id Amazon.SAM-CLI -e
   ```

3. Porniți **Docker Desktop** din meniul Start și așteptați „Engine running”.

4. **Închideți și redeschideți cmd**, ca să fie găsite comenzile noi. Doar pentru metoda A, instalați lstk:

   ```bat
   npm install -g @localstack/lstk
   ```

### macOS

Folosiți **Terminal**.

1. Instalați Homebrew, dacă nu îl aveți (vezi [brew.sh](https://brew.sh)):

   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. Instalați uneltele:

   ```bash
   brew install git
   brew install --cask docker
   brew install node
   brew install awscli
   brew install aws-sam-cli
   ```

3. Porniți Docker Desktop și așteptați „Engine running”:

   ```bash
   open -a Docker
   ```

4. Doar pentru metoda A, instalați lstk:

   ```bash
   brew install localstack/tap/lstk
   ```

### Verificare (Windows și macOS)

```bash
git --version
docker --version
docker compose version
node --version
aws --version
sam --version
lstk --version          # doar dacă folosiți metoda A
```

### Cont LocalStack

Din martie 2026, LocalStack cere un cont, indiferent de metodă. Creați-l pe [app.localstack.cloud](https://app.localstack.cloud). Cu GitHub Student Developer Pack primiți planul **Student**; altfel folosiți planul gratuit **Hobby** (uz necomercial).

### Proiectul

```bash
git clone https://github.com/strategy/fleet-manager.git
cd fleet-manager
git switch localstack
```

## LocalStack: două metode

LocalStack emulează AWS pe calculatorul vostru. Emulatorul e mereu aceeași imagine Docker, [`localstack/localstack`](https://hub.docker.com/r/localstack/localstack); diferă doar cine o pornește.

| | Metoda A: `lstk` | Metoda B: `docker compose` |
|---|---|---|
| Cine pornește containerul | `lstk` | serviciul `localstack` din `compose.yaml` |
| Autentificare | login în browser, o singură dată | token în fișierul `.env.localstack` |
| Comenzi către LocalStack | `lstk aws ...`, `lstk sam ...` | `aws ...`, `sam ...` cu `AWS_ENDPOINT_URL` setat |
| Deploy | `npm run deploy:localstack` | `npm run deploy:localstack:docker` |
| Recomandat pentru | lucrul de zi cu zi | a vedea cum e configurat LocalStack; CI |

> ⚠️ **Folosiți ori metoda A, ori metoda B, niciodată pe amândouă deodată.** Ambele pornesc un container LocalStack pe portul 4566. Al doilea nu poate porni, sau comenzile ajung la alt emulator decât credeți. Înainte să schimbați metoda, opriți-o pe cea veche: `lstk stop` pentru A, `docker compose stop localstack` pentru B.
>
> Datele din LocalStack nu se păstrează la oprire. După fiecare pornire, rulați din nou deploy-ul.

### Metoda A: `lstk`

```bash
lstk                                # prima dată: login în browser; pornește LocalStack
lstk status                         # LocalStack trebuie să fie „running”
npm run deploy:localstack           # build + sam deploy + frontend în S3
```

Comenzi utile:

```bash
lstk aws cloudformation describe-stacks --stack-name fleet-manager
lstk aws lambda list-functions --query "Functions[].FunctionName"
lstk aws logs tail /aws/lambda/NUMELE_FUNCTIEI --follow
lstk aws dynamodb scan --table-name NUMELE_TABELULUI
lstk logs                           # logurile LocalStack
lstk stop                           # oprește LocalStack
```

### Metoda B: `docker compose`

Token-ul îl găsiți în [app.localstack.cloud](https://app.localstack.cloud), pagina **Auth Tokens**. Puneți-l în `.env.localstack`, care nu se comite.

Windows (cmd):

```bat
copy .env.localstack.example .env.localstack
notepad .env.localstack
```

macOS:

```bash
cp .env.localstack.example .env.localstack
open -e .env.localstack
```

Pornire și deploy:

```bash
docker compose --profile localstack up -d localstack     # pornește doar LocalStack
curl http://localhost:4566/_localstack/health            # serviciile trebuie să fie „available”/„running”
npm run deploy:localstack:docker                         # build + sam deploy + frontend în S3
```

Serviciul are profilul `localstack`, deci `docker compose up -d` (mediul local) nu îl pornește. Pornește doar când e cerut explicit, ca mai sus.

Comenzile `aws` și `sam` trimit cererile la LocalStack doar cu variabilele de mai jos setate. Fără ele, ajung în contul AWS real.

Windows (cmd):

```bat
set AWS_ENDPOINT_URL=http://localhost.localstack.cloud:4566
set AWS_ACCESS_KEY_ID=test
set AWS_SECRET_ACCESS_KEY=test
set AWS_DEFAULT_REGION=us-east-1
aws cloudformation describe-stacks --stack-name fleet-manager
aws lambda list-functions --query "Functions[].FunctionName"
aws logs tail /aws/lambda/NUMELE_FUNCTIEI --follow
aws dynamodb scan --table-name NUMELE_TABELULUI
```

macOS:

```bash
export AWS_ENDPOINT_URL=http://localhost.localstack.cloud:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
aws cloudformation describe-stacks --stack-name fleet-manager
aws lambda list-functions --query "Functions[].FunctionName"
aws logs tail /aws/lambda/NUMELE_FUNCTIEI --follow
aws dynamodb scan --table-name NUMELE_TABELULUI
```

Variabilele rămân setate doar în fereastra de terminal curentă. `npm run deploy:localstack:docker` le setează singur.

Oprire și loguri:

```bash
docker compose logs -f localstack       # logurile LocalStack
docker compose stop localstack          # oprește LocalStack
```

## Pornire rapidă (local)

Cerințe: vezi [Instalare](#instalare).

```bash
cp .env.example .env          # pe Windows: copy .env.example .env
docker compose up -d --build
docker compose ps             # api trebuie să ajungă „healthy”
```

| Adresă | Ce găsiți |
|---|---|
| http://localhost:8080 | Interfața web: vehicule, curse, poziții GPS |
| http://localhost:8080/map.html | Harta flotei în timp real (butonul **Hartă**) |
| http://localhost:3000 | Documentația API (Swagger UI) |
| http://localhost:3000/openapi.json | Specificația OpenAPI 3.0 |
| http://localhost:8000 | DynamoDB Local, doar local (din `compose.override.yaml`) |

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

| Semn | Stare | Trimite GPS? |
|---|---|---|
| albastru **P** | în parcare (Oradea) | nu |
| portocaliu **➜** | în cursă | da, la fiecare `GPS_POLL_SECONDS`: local 10 s, LocalStack 1 s, producție 60 s |
| verde **✓** | a ajuns la destinație | nu |

## Arhitectură

Local (`compose.yaml`):

```
browser ──► frontend (nginx :8080) ──/api──► api (Express :3000) ──► dynamodb (DynamoDB Local :8000)
                                                                          ▲
                                     worker (Node.js, buclă la 10 s) ─────┘
```

LocalStack și producție (`template.yaml`):

```
browser ──► S3 website (index.html, map.html, config.js)
   │
   └──── fetch(API_URL) ──► Lambda Function URL ──► ApiFunction (Express) ──► DynamoDB
                                                                                 ▲
                         EventBridge, o dată pe minut ──► WorkerFunction ────────┘
```

| Local | AWS / LocalStack | Rol |
|---|---|---|
| `dynamodb` (`amazon/dynamodb-local`) | `VehiclesTable`, `PositionsTable` | Vehiculele și ultimele poziții GPS (expiră după o oră) |
| `api` (`./api`, `server.ts`) | `ApiFunction` (`lambda.ts`) | REST API + Swagger |
| `worker` (`./api`, `worker.ts`) | `WorkerFunction` (`worker-lambda.ts`) | Mută mașinile aflate în cursă spre destinație |
| `frontend` (`./frontend`, nginx) | `FrontendBucket` (S3 website) | Pagina web și harta |

EventBridge nu poate porni o funcție mai des de o dată pe minut. De aceea `WorkerFunction` face câte un pas la fiecare `GPS_POLL_SECONDS` în minutul respectiv (până la 59 de secunde), apoi se oprește; la 60 de secunde face un singur pas.

Worker-ul calculează distanța din timpul scurs de la ultima poziție. De aceea mașinile merg la fel de repede oricare ar fi intervalul: 10 secunde local, 1 secundă în LocalStack, 60 de secunde în producție.

## API

Documentația completă și interactivă e la http://localhost:3000 (local) sau la `<adresa API>/docs` (LocalStack, producție).

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

Când adăugați o rută în `api/src/app.ts`, actualizați și `api/src/openapi.ts`.

### API adauga un vehicul din terminal

linux
```
A=http://op9xp7e67to56jubo5emv9w3cbfqmgne.lambda-url.us-east-1.localhost.localstack.cloud:4566; curl -s -o /dev/null -XDELETE $A/api/vehicles/GPS-1S; curl -s -XPOST $A/api/vehicles -H 'Content-Type: application/json' -d '{"plate":"GPS-1S"}' >/dev/null;
```

windows
```
set "A=http://op9xp7e67to56jubo5emv9w3cbfqmgne.lambda-url.us-east-1.localhost.localstack.cloud:4566" && curl -s -X POST %A%/api/vehicles -H "Content-Type: application/json" -d "{\"plate\":\"GPS-2S\"}
```

## Configurare

Local, valorile vin din `.env` (care nu se comite) și din `compose.yaml`. În LocalStack și producție vin din `template.yaml`, cu valorile pe mediu din `samconfig.toml`.

| Variabilă | Implicit | Descriere |
|---|---|---|
| `LOG_LEVEL` | `info` | Nivelul de log (`debug` local și în LocalStack) |
| `GPS_POLL_SECONDS` | `10` | La câte secunde trimite worker-ul poziții GPS. Local din `.env`; în LocalStack și producție din parametrul `GpsPollSeconds` din `samconfig.toml` (1 și 60). Pagina web cere date la fel de des, dar măcar o dată la 3 secunde |
| `SPEED_KMH` | `90` | Viteza mașinilor în cursă |
| `SIM_SPEEDUP` | `1` | Accelerarea simulării: `60` = un minut de demo înseamnă o oră de drum |
| `DYNAMODB_ENDPOINT` | — | Doar local: adresa DynamoDB Local (`http://dynamodb:8000`) |
| `VEHICLES_TABLE`, `POSITIONS_TABLE` | `fleet-vehicles`, `fleet-positions` | Numele tabelelor; în AWS le pune `template.yaml` |

`.env.example`, `samconfig.toml` (LocalStack și producție) setează `SIM_SPEEDUP=60` pentru demonstrații.

## Dezvoltare

Codul API-ului și al worker-ului e în TypeScript, în `api/src/`:

| Fișier | Conținut |
|---|---|
| `app.ts` | Rutele REST și Swagger UI (aceleași în toate mediile) |
| `server.ts` | Pornirea locală: `app.listen` pe portul 3000 |
| `lambda.ts` | Pornirea în Lambda: Express prin `serverless-http` |
| `db.ts` | Accesul la DynamoDB |
| `simulation.ts` | Un pas al simulării GPS |
| `worker.ts` | Worker-ul local: rulează simularea în buclă |
| `worker-lambda.ts` | Worker-ul Lambda: un pas pe apel |
| `geo.ts` | Distanța (haversine) și pasul în linie dreaptă |
| `cities.ts` | Reședințele de județ și coordonatele lor |
| `config.ts` | Citirea variabilelor de mediu |
| `openapi.ts` | Specificația OpenAPI |

Verificare și teste, fără Docker (necesită Node.js):

```bash
cd api
npm ci
npm run lint      # verificare de tipuri TypeScript
npm test          # testele din *.test.ts
npm run bundle    # pachetul Lambda în api/build/ (esbuild)
```

Comenzi utile cu Docker:

```bash
docker compose logs -f worker              # pozițiile GPS, live
docker compose config                      # configurația finală, după .env și override
docker compose up -d --build api worker    # reconstruiește după modificări în api/
aws dynamodb scan --table-name fleet-vehicles --endpoint-url http://localhost:8000 --region eu-central-1
```

Ultima comandă cere credențiale AWS oarecare. Dacă nu aveți, setați `AWS_ACCESS_KEY_ID=local` și `AWS_SECRET_ACCESS_KEY=local`.

## CI/CD

`.github/workflows/ci.yml`:

1. **test**, la fiecare Pull Request către `master` și la fiecare push în `master`: `npm ci`, `npm run lint`, `npm test`, `npm run bundle`, `sam validate --lint`.
2. **deploy**, doar la push în `master` (adică la merge-ul unui PR): `npm run deploy:production` în environment-ul GitHub `production`, cu autentificare în AWS prin OIDC, fără chei salvate în GitHub.

Configurarea o singură dată (rolul IAM, environment-ul `production`, protecția branch-ului `master`) e în [DEPLOY.md](DEPLOY.md#7-configurarea-producției-o-singură-dată-profesorul).

## Structura proiectului

```
fleet-manager/
├── .github/workflows/ci.yml   # GitHub Actions: test la PR, deploy la merge în master
├── api/
│   ├── src/                   # API, worker, teste
│   ├── Dockerfile             # imaginea locală (docker compose)
│   ├── package.json           # scripturi: lint, test, bundle
│   └── tsconfig.json
├── frontend/
│   ├── Dockerfile             # nginx + fișiere statice (local)
│   ├── nginx.conf             # proxy /api → serviciul api
│   ├── config.js              # adresa API-ului (goală local; rescrisă la deploy)
│   ├── index.html             # interfața principală
│   └── map.html               # harta (Leaflet + OpenStreetMap)
├── infra/
│   └── github-oidc.yaml       # rolul IAM pentru GitHub Actions (o singură dată)
├── scripts/
│   └── deploy.mjs             # deploy în localstack sau production
├── compose.yaml               # mediul local + LocalStack (profil, metoda B)
├── compose.override.yaml      # ajustări doar pentru local
├── template.yaml              # infrastructura AWS (SAM): Lambda, DynamoDB, S3, EventBridge
├── samconfig.toml             # setările pe mediu: localstack, production
├── package.json               # npm run deploy:localstack / deploy:production
├── DEPLOY.md                  # fluxul de la local la producție
├── .env.example               # model pentru .env
├── .env.localstack.example    # model pentru .env.localstack (token LocalStack, metoda B)
└── LICENSE                    # MIT
```

## Probleme frecvente

| Simptom | Cauză și rezolvare |
|---|---|
| `port is already allocated` pe 8000 | Alt proces folosește portul. Ștergeți `ports` de la `dynamodb` din `compose.override.yaml`. |
| Mașinile merg foarte încet | `SIM_SPEEDUP` e 1. Setați-l în `.env` și rulați `docker compose up -d`. |
| Harta e goală | Harta încarcă Leaflet și imaginile OpenStreetMap de pe internet. |
| Swagger nu se încarcă | Swagger UI vine de pe `cdn.jsdelivr.net`; e nevoie de internet. |
| Probleme cu LocalStack sau cu deploy-ul | Vezi [DEPLOY.md → Probleme frecvente](DEPLOY.md#probleme-frecvente). |
| [ERROR]: 'charmap' codec can't encode character '\u021b' in position 5: character maps to <undefined> | set PYTHONUTF8=1 |

## Licență

[MIT](LICENSE): codul poate fi folosit, modificat și redistribuit liber, cu păstrarea notei de copyright.
