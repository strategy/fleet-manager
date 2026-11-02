# FleetManager

Aplicație demo de management al flotei auto, folosită în cursul **Fișiere de configurare** (Dockerfile, docker-compose, GitHub Actions; Dockerfile-urile aplicației sunt pe `master`) și, pe acest branch (`localstack`), pentru drumul codului **de la calculatorul vostru până în AWS**.

Mașinile sunt adăugate din interfața web și stau în parcarea din Oradea. Trimise în cursă spre o reședință de județ, ele merg în linie dreaptă cu 90 km/h, iar worker-ul trimite pozițiile GPS. Pozițiile se văd în tabel și pe hartă.

Pe acest branch, **lucrul de zi cu zi se face în LocalStack**, AWS emulat pe calculatorul vostru: aceleași funcții Lambda, aceleași tabele DynamoDB, același bucket S3 ca în producție, fără cont AWS și fără costuri.

> **Fluxul de lucru complet** (LocalStack → Pull Request → producție) e în **[DEPLOY.md](DEPLOY.md)**.

## Cele două medii

| Mediu | Comanda | Unde |
|---|---|---|
| local, în LocalStack | `npm run deploy:localstack` (metoda A) sau `npm run deploy:localstack:docker` (metoda B) | adresa afișată la final de comandă |
| production | merge în `master` (GitHub Actions rulează `npm run deploy:production`) | adresa din GitHub → Deployments |

Ambele medii pornesc din același `template.yaml`; diferă doar valorile din `samconfig.toml`. Ce merge în LocalStack va merge, cu foarte mare probabilitate, și în producție.

## Instalare

Uneltele de care aveți nevoie:

| Unealtă | La ce folosește |
|---|---|
| Git | codul sursă, branch-uri, Pull Request-uri |
| Docker Desktop | LocalStack rulează în Docker, iar fiecare funcție Lambda într-un container separat |
| Node.js (22 sau mai nou) | teste, build, scriptul de deploy |
| AWS CLI | comenzi către LocalStack / AWS |
| AWS SAM CLI | deploy-ul din `template.yaml` |
| lstk | pornirea LocalStack (doar **metoda A**) |

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

Din martie 2026, LocalStack cere un cont, indiferent de metodă. Creați-l pe [app.localstack.cloud](https://app.localstack.cloud). Cu GitHub Student Developer Pack primiți planul **Student**; altfel folosiți planul gratuit **Hobby** (uz necomercial). FleetManager folosește doar servicii incluse în Hobby (Lambda, DynamoDB, S3, EventBridge, CloudFormation).

### Proiectul

```bash
git clone https://github.com/strategy/fleet-manager.git
cd fleet-manager
git switch localstack
```

## Pornire: două metode

LocalStack emulează AWS pe calculatorul vostru. Emulatorul e mereu aceeași imagine Docker, [`localstack/localstack`](https://hub.docker.com/r/localstack/localstack); diferă doar cine o pornește.

| | Metoda A: `lstk` | Metoda B: `docker compose` |
|---|---|---|
| Cine pornește containerul | `lstk` | `docker compose up -d` (`compose.yaml` are doar serviciul `localstack`) |
| Autentificare | login în browser, o singură dată | token în fișierul `.env.localstack` |
| Comenzi către LocalStack | `lstk aws ...`, `lstk sam ...` | `aws ...`, `sam ...` cu `AWS_ENDPOINT_URL` setat |
| Deploy | `npm run deploy:localstack` | `npm run deploy:localstack:docker` |
| Recomandat pentru | lucrul de zi cu zi | a vedea cum e configurat LocalStack; CI |

> ⚠️ **Folosiți ori metoda A, ori metoda B, niciodată pe amândouă deodată.** Ambele pornesc un container LocalStack pe portul 4566. Al doilea nu poate porni, sau comenzile ajung la alt emulator decât credeți. Înainte să schimbați metoda, opriți-o pe cea veche: `lstk stop` pentru A, `docker compose stop` pentru B.
>
> Datele din LocalStack nu se păstrează la oprire: stack-ul, mașinile și pozițiile GPS dispar. După fiecare pornire, rulați din nou deploy-ul.

### Metoda A: `lstk`

```bash
lstk                                # prima dată: login în browser; pornește LocalStack
lstk status                         # LocalStack trebuie să fie „running”
npm run deploy:localstack           # build + sam deploy + frontend în S3
```

Oprire și loguri:

```bash
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
docker compose up -d                                     # pornește containerul LocalStack
curl http://localhost:4566/_localstack/health            # serviciile trebuie să fie „available”/„running”
npm run deploy:localstack:docker                         # build + sam deploy + frontend în S3
```

`docker compose up -d` pornește **doar** containerul LocalStack: nu construiește imagini și nu pornește alte containere. Aplicația propriu-zisă rulează în LocalStack, ca funcții Lambda.

Oprire și loguri:

```bash
docker compose logs -f localstack       # logurile LocalStack
docker compose stop                     # oprește LocalStack
```

### Adresele aplicației

La final, comanda de deploy afișează adresele (diferă la fiecare stack nou):

```
=== Gata: localstack ===
Aplicația web: http://fleet-manager-frontendbucket-xxxx.s3-website.localhost.localstack.cloud:4566
API (Swagger): http://xxxx.lambda-url.us-east-1.localhost.localstack.cloud:4566/docs
```

| Adresă | Ce găsiți |
|---|---|
| **Aplicația web** | Interfața: vehicule, curse, poziții GPS |
| Aplicația web + `/map.html` | Harta flotei în timp real (butonul **Hartă**) |
| **API (Swagger)** | Documentația API (Swagger UI) |
| adresa API + `/openapi.json` | Specificația OpenAPI 3.0 |

Le puteți afișa oricând din nou (metoda A cu `lstk aws`, metoda B cu `aws`, vezi [Comenzi către LocalStack](#comenzi-către-localstack)):

```bash
lstk aws cloudformation describe-stacks --stack-name fleet-manager --query "Stacks[0].Outputs" --output table
```

## Cum se folosește

1. **Add car**: introduceți numărul de înmatriculare (modelul implicit e „Dacia Logan”). Mașina apare în parcarea din Oradea.
2. **Trimite cursa**: alegeți o reședință de județ. Mașina pleacă din Oradea spre oraș, în linie dreaptă.
3. **Trimite parcare**: mașina revine imediat în parcarea din Oradea și nu mai trimite GPS.
4. **Delete**: șterge mașina și istoricul ei GPS.

| Semn | Stare | Trimite GPS? |
|---|---|---|
| albastru **P** | în parcare (Oradea) | nu |
| portocaliu **➜** | în cursă | da, la fiecare `GPS_POLL_SECONDS`: LocalStack 1 s, producție 60 s |
| verde **✓** | a ajuns la destinație | nu |

Imediat după primul deploy, prima poziție GPS poate întârzia până la un minut, până pornește EventBridge worker-ul.

## Comenzi către LocalStack

Aceleași comenzi AWS ca în producție, trimise la LocalStack.

**Metoda A**: puneți `lstk` în fața comenzii (`lstk aws ...`, `lstk sam ...`).

**Metoda B**: comenzile `aws` și `sam` ajung la LocalStack doar cu variabilele de mai jos setate. **Fără ele, ajung în contul AWS real.** Variabilele rămân setate doar în fereastra de terminal curentă; `npm run deploy:localstack:docker` le setează singur.

Windows (cmd):

```bat
set AWS_ENDPOINT_URL=http://localhost.localstack.cloud:4566
set AWS_ACCESS_KEY_ID=test
set AWS_SECRET_ACCESS_KEY=test
set AWS_DEFAULT_REGION=us-east-1
```

macOS:

```bash
export AWS_ENDPOINT_URL=http://localhost.localstack.cloud:4566
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test
export AWS_DEFAULT_REGION=us-east-1
```

Comenzile, scrise pentru metoda A. La metoda B, scrieți-le fără `lstk`:

```bash
# stack-ul și adresele
lstk aws cloudformation describe-stacks --stack-name fleet-manager --query "Stacks[0].Outputs" --output table

# numele reale ale resurselor (funcții, tabele, bucket)
lstk aws cloudformation describe-stack-resources --stack-name fleet-manager --query "StackResources[].[LogicalResourceId,PhysicalResourceId]" --output table

# funcțiile Lambda
lstk aws lambda list-functions --query "Functions[].FunctionName"

# logurile unei funcții, live (Ctrl+C iese); numele îl luați din comanda de mai sus
lstk aws logs tail /aws/lambda/NUMELE_FUNCTIEI --follow

# conținutul tabelelor (VehiclesTable, PositionsTable)
lstk aws dynamodb scan --table-name NUMELE_TABELULUI

# fișierele frontend-ului din S3
lstk aws s3 ls s3://NUMELE_BUCKETULUI
```

Logurile worker-ului (`WorkerFunction`) arată pozițiile GPS trimise; cele ale `ApiFunction`, cererile primite de API.

### Adaugă un vehicul din terminal

`A` este adresa API afișată la deploy, fără `/docs`.

macOS:

```bash
A=http://xxxx.lambda-url.us-east-1.localhost.localstack.cloud:4566
curl -s -X POST $A/api/vehicles -H 'Content-Type: application/json' -d '{"plate":"GPS-1S"}'
curl -s -X POST $A/api/vehicles/GPS-1S/trip -H 'Content-Type: application/json' -d '{"city":"Cluj-Napoca"}'
curl -s $A/api/positions
```

Windows (cmd):

```bat
set "A=http://xxxx.lambda-url.us-east-1.localhost.localstack.cloud:4566"
curl -s -X POST %A%/api/vehicles -H "Content-Type: application/json" -d "{\"plate\":\"GPS-1S\"}"
curl -s -X POST %A%/api/vehicles/GPS-1S/trip -H "Content-Type: application/json" -d "{\"city\":\"Cluj-Napoca\"}"
curl -s %A%/api/positions
```

## Arhitectură

LocalStack și producție (`template.yaml`):

```
browser ──► S3 website (index.html, map.html, config.js)
   │
   └──── fetch(API_URL) ──► Lambda Function URL ──► ApiFunction (Express) ──► DynamoDB
                                                                                 ▲
                         EventBridge, o dată pe minut ──► WorkerFunction ────────┘
```

| Resursă (`template.yaml`) | Cod | Rol |
|---|---|---|
| `VehiclesTable`, `PositionsTable` | — | Vehiculele și ultimele poziții GPS (expiră după o oră) |
| `ApiFunction` + Function URL | `lambda.ts` | REST API + Swagger |
| `WorkerFunction` + regulă EventBridge | `worker-lambda.ts` | Mută mașinile aflate în cursă spre destinație |
| `FrontendBucket` (S3 website) | `frontend/` | Pagina web și harta |

EventBridge nu poate porni o funcție mai des de o dată pe minut. De aceea `WorkerFunction` face câte un pas la fiecare `GPS_POLL_SECONDS` în minutul respectiv (până la 59 de secunde), apoi se oprește; la 60 de secunde face un singur pas.

Worker-ul calculează distanța din timpul scurs de la ultima poziție. De aceea mașinile merg la fel de repede oricare ar fi intervalul: 1 secundă în LocalStack, 60 de secunde în producție.

## API

Documentația completă și interactivă e la `<adresa API>/docs`.

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

## Configurare

Valorile vin din `template.yaml`, cu valorile pe mediu din `samconfig.toml` (secțiunile `[localstack...]` și `[production...]`).

| Variabilă | Implicit | Descriere |
|---|---|---|
| `LOG_LEVEL` | `info` | Nivelul de log (`debug` în LocalStack) |
| `GPS_POLL_SECONDS` | `10` | La câte secunde trimite worker-ul poziții GPS: parametrul `GpsPollSeconds` din `samconfig.toml` (1 în LocalStack, 60 în producție). Pagina web cere date la fel de des, dar măcar o dată la 3 secunde |
| `SPEED_KMH` | `90` | Viteza mașinilor în cursă |
| `SIM_SPEEDUP` | `1` | Accelerarea simulării: `60` = un minut de demo înseamnă o oră de drum (setat 60 în ambele medii) |
| `VEHICLES_TABLE`, `POSITIONS_TABLE` | `fleet-vehicles`, `fleet-positions` | Numele tabelelor; în AWS și LocalStack le pune `template.yaml` |

O valoare schimbată în `samconfig.toml` ajunge în LocalStack la următorul `npm run deploy:localstack`.

## Dezvoltare

Codul API-ului și al worker-ului e în TypeScript, în `api/src/`:

| Fișier | Conținut |
|---|---|
| `app.ts` | Rutele REST și Swagger UI (aceleași în toate mediile) |
| `lambda.ts` | Pornirea în Lambda: Express prin `serverless-http` |
| `worker-lambda.ts` | Worker-ul Lambda: pașii simulării pe apel |
| `db.ts` | Accesul la DynamoDB |
| `simulation.ts` | Un pas al simulării GPS |
| `geo.ts` | Distanța (haversine) și pasul în linie dreaptă |
| `cities.ts` | Reședințele de județ și coordonatele lor |
| `config.ts` | Citirea variabilelor de mediu |
| `openapi.ts` | Specificația OpenAPI |

Ciclul de lucru:

1. modificați codul (`api/src`, `frontend/`, `template.yaml` sau `samconfig.toml`);
2. rulați testele, fără Docker:

   ```bash
   cd api
   npm ci
   npm run lint      # verificare de tipuri TypeScript
   npm test          # testele din *.test.ts
   cd ..
   ```

3. rulați din nou deploy-ul: `npm run deploy:localstack` (A) sau `npm run deploy:localstack:docker` (B). `sam deploy` actualizează doar ce s-a schimbat; adresele rămân aceleași cât timp LocalStack nu e oprit;
4. reîncărcați pagina și urmăriți logurile funcției modificate (`logs tail`, vezi [Comenzi către LocalStack](#comenzi-către-localstack)).

Verificarea șablonului, ca în CI:

```bash
sam validate --lint
```

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
│   ├── package.json           # scripturi: lint, test, bundle
│   └── tsconfig.json
├── frontend/
│   ├── config.js              # adresa API-ului (rescrisă la deploy)
│   ├── index.html             # interfața principală
│   └── map.html               # harta (Leaflet + OpenStreetMap)
├── infra/
│   └── github-oidc.yaml       # rolul IAM pentru GitHub Actions (o singură dată)
├── scripts/
│   └── deploy.mjs             # deploy în localstack (metoda A sau B) sau production
├── template.yaml              # infrastructura AWS (SAM): Lambda, DynamoDB, S3, EventBridge
├── samconfig.toml             # setările pe mediu: localstack, production
├── package.json               # npm run deploy:localstack[:docker] / deploy:production
├── compose.yaml               # doar LocalStack (metoda B)
├── DEPLOY.md                  # fluxul de la LocalStack la producție
├── .env.localstack.example    # model pentru .env.localstack (token LocalStack, metoda B)
└── LICENSE                    # MIT
```

## Probleme frecvente

| Simptom | Cauză și rezolvare |
|---|---|
| `port is already allocated` pe 4566 | LocalStack rulează deja, pornit prin cealaltă metodă. Opriți-l (`lstk stop` sau `docker compose stop localstack`) și folosiți o singură metodă. |
| `lstk` nu pornește sau cere login | Rulați `lstk` fără argumente pentru login. Docker Desktop trebuie să fie pornit. |
| Metoda B: `LocalStack nu răspunde la .../_localstack/health` | Containerul nu e pornit (`docker compose up -d`) sau token-ul din `.env.localstack` lipsește. Vedeți `docker compose logs localstack`. |
| Stack-ul `fleet-manager` nu există / pagina nu se mai deschide | LocalStack a fost oprit și datele s-au pierdut. Rulați din nou deploy-ul. |
| Pagina se încarcă, dar tabelul arată „API indisponibil” | `config.js` nu are adresa API-ului. Rulați din nou deploy-ul și verificați adresa API afișată la final. |
| Nicio poziție GPS în primul minut | EventBridge pornește worker-ul o dată pe minut. Imediat după deploy, așteptați până la un minut. |
| Mașinile merg foarte încet | `SimSpeedup` din `samconfig.toml` e 1. Puneți 60 și rulați din nou deploy-ul. |
| Harta e goală | Harta încarcă Leaflet și imaginile OpenStreetMap de pe internet. |
| Swagger nu se încarcă | Swagger UI vine de pe `cdn.jsdelivr.net`; e nevoie de internet. |
| `[ERROR]: 'charmap' codec can't encode character 'ț'` (Windows, `sam`) | Rulați `set PYTHONUTF8=1` în cmd, apoi din nou deploy-ul. |
| Alte probleme cu LocalStack sau cu deploy-ul | Vezi [DEPLOY.md → Probleme frecvente](DEPLOY.md#probleme-frecvente). |

## Licență

[MIT](LICENSE): codul poate fi folosit, modificat și redistribuit liber, cu păstrarea notei de copyright.
