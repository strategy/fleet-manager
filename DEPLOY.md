# De la local la producție

Cum ajunge o modificare de pe calculatorul vostru în AWS, pas cu pas. Comenzile sunt date pentru **Windows (cmd)** și **macOS (Terminal)**. Unde nu diferă, apar o singură dată.

## Cele trei medii

| Mediu | Unde rulează | Ce rulează | Cine îl pornește | Comanda |
|---|---|---|---|---|
| **local** | calculatorul vostru, în Docker | Express + DynamoDB Local + nginx | voi | `docker compose up -d --build` |
| **localstack** | calculatorul vostru, AWS emulat | Lambda + DynamoDB + S3 + EventBridge, ca în AWS | voi | `npm run deploy:localstack` (lstk) sau `npm run deploy:localstack:docker` (docker compose) |
| **production** | AWS, regiunea `eu-central-1` (Frankfurt) | Lambda + DynamoDB + S3 + EventBridge | GitHub Actions, la merge în `master` | `npm run deploy:production` |

Nu există staging și nici alte medii de test. LocalStack ține locul lor: acolo verificați că `template.yaml` și codul merg „ca în AWS”, fără cont AWS și fără costuri.

```
 local                      localstack                     production
 docker compose      →      npm run deploy:localstack  →   PR → merge în master
 (scrieți cod)              (verificați infrastructura)    (GitHub Actions face deploy)
```

### De ce sunt două moduri de a porni același cod

| | local (`docker compose`) | localstack / production |
|---|---|---|
| API | `server.ts`: Express ascultă pe portul 3000 | `lambda.ts`: Express în Lambda, prin Function URL |
| Worker | `worker.ts`: buclă la fiecare 10 secunde | `worker-lambda.ts`: pornit de EventBridge o dată pe minut; face câte un pas la fiecare `GpsPollSeconds` (LocalStack 1 s, producție 60 s) |
| Bază de date | DynamoDB Local (container) | DynamoDB |
| Frontend | nginx, cu proxy pentru `/api` | bucket S3 cu website; `config.js` conține adresa API-ului |
| Infrastructura | `compose.yaml` | `template.yaml` (AWS SAM) + `samconfig.toml` |

Rutele (`app.ts`), accesul la date (`db.ts`) și simularea (`simulation.ts`) sunt aceleași în toate mediile.

---

## 1. Uneltele (o singură dată)

Pașii de instalare pentru Windows și macOS (Git, Docker Desktop, Node.js, AWS CLI, AWS SAM CLI, lstk) și contul LocalStack sunt în [README → Instalare](README.md#instalare).

## 2. Mediul local

```bash
git clone https://github.com/strategy/fleet-manager.git
cd fleet-manager
git switch localstack
```

Windows (cmd):

```bat
copy .env.example .env
```

macOS:

```bash
cp .env.example .env
```

```bash
docker compose up -d --build        # pornește aplicația
docker compose ps                   # api trebuie să ajungă „healthy”
docker compose logs -f worker       # pozițiile GPS, live (Ctrl+C iese)
```

Aplicația e la http://localhost:8080, iar API-ul (Swagger) la http://localhost:3000.

Testele, fără Docker:

```bash
cd api
npm ci
npm run lint
npm test
cd ..
```

## 3. Lucrul pe branch-ul vostru

Nimeni nu lucrează direct pe `master`. Fiecare student are branch-ul lui:

```bash
git switch master
git pull                                    # porniți de la ultima versiune
git switch -c student/popescu-ion           # branch-ul vostru
```

Scrieți codul, verificați-l local (pasul 2), apoi salvați-l:

```bash
git status
git add .
git commit -m "Adaugă filtrarea vehiculelor după stare"
git push -u origin student/popescu-ion      # prima dată; apoi doar git push
```

## 4. Verificare în LocalStack

Înainte de PR, verificați că aplicația merge cu Lambda, DynamoDB și S3, adică așa cum va rula în producție.

LocalStack se poate porni în două feluri, descrise pe larg în [README → LocalStack: două metode](README.md#localstack-două-metode). **Folosiți ori una, ori cealaltă, niciodată pe amândouă deodată.**

Metoda A, cu `lstk` (recomandată):

```bash
lstk                                # prima dată: login în browser, apoi pornește LocalStack
lstk status                         # LocalStack trebuie să fie pornit
npm run deploy:localstack           # build + sam deploy + upload frontend
```

Metoda B, cu `docker compose` (token-ul în `.env.localstack`):

```bash
docker compose --profile localstack up -d localstack
npm run deploy:localstack:docker
```

La final scriptul afișează adresele:

```
=== Gata: localstack ===
Aplicația web: http://fleet-manager-frontendbucket-xxxx.s3-website.localhost.localstack.cloud:4566
API (Swagger): http://xxxx.lambda-url.us-east-1.localhost.localstack.cloud:4566/docs
```

În LocalStack, worker-ul trimite o poziție GPS pe secundă pentru fiecare mașină aflată în cursă (`GpsPollSeconds=1` în `samconfig.toml`). Imediat după primul deploy, prima poziție poate întârzia până la un minut, până pornește EventBridge worker-ul.

Ce face scriptul de deploy (vezi `scripts/deploy.mjs`):

1. `npm run bundle` în `api/`: esbuild pune API-ul și worker-ul în `api/build/` (pachetul Lambda);
2. `sam deploy --config-env localstack`: creează sau actualizează stack-ul din `template.yaml`;
3. `aws cloudformation describe-stacks`: citește adresele create (API, bucket);
4. scrie `config.js` cu adresa API-ului și urcă frontend-ul în S3 cu `aws s3 sync`.

La metoda A, comenzile `sam` și `aws` rulează prin `lstk` (`lstk sam`, `lstk aws`). La metoda B, rulează direct, cu `AWS_ENDPOINT_URL=http://localhost.localstack.cloud:4566`. Fără una dintre cele două, aceeași comandă ar merge în contul AWS real.

Comenzile utile pentru fiecare metodă (stack, funcții, loguri, tabele) sunt în README, la metoda respectivă.

## 5. Pull Request

Pe GitHub, deschideți un **Pull Request** din branch-ul vostru către `master`. La fiecare PR (și la fiecare push nou pe el), GitHub Actions rulează job-ul **test**:

- `npm ci`, `npm run lint`, `npm test`
- `npm run bundle` (pachetul Lambda se construiește)
- `sam validate --lint` (`template.yaml` e corect)

PR-ul poate fi unit doar dacă **test** e verde și cineva l-a aprobat (vezi pasul 7, protecția branch-ului `master`).

## 6. Merge în master = deploy în producție

La merge, GitHub Actions rulează din nou **test**, apoi **deploy**:

```
merge în master
   └─ test     (aceleași verificări ca la PR)
   └─ deploy   environment "production"
        ├─ GitHub cere AWS un token temporar (OIDC), fără chei salvate în GitHub
        ├─ preia rolul IAM github-deploy-fleet-manager
        └─ npm run deploy:production
              ├─ npm run bundle
              ├─ sam deploy --config-env production
              └─ aws s3 sync (frontend + config.js)
```

Adresa aplicației apare în GitHub la **Actions → rularea → deploy** și la **Deployments → production**.

Același lucru se poate face de mână, de pe calculatorul cuiva cu drepturi în contul AWS, cu `npm run deploy:production`. În mod normal nu e nevoie: producția se actualizează doar prin merge în `master`.

### O modificare a stricat producția

Nu reparați direct în AWS. Anulați commit-ul tot printr-un PR:

```bash
git switch master
git pull
git switch -c revert-filtrare
git revert HASH_COMMIT                      # hash-ul din git log --oneline
git push -u origin revert-filtrare
```

Deschideți PR-ul. La merge, deploy-ul pune înapoi versiunea anterioară.

---

## 7. Configurarea producției (o singură dată, profesorul)

Pașii de mai jos se fac o singură dată, de către cine administrează contul AWS și repository-ul GitHub.

### 7.1 Contul AWS și AWS CLI

Logați-vă în AWS CLI cu un utilizator care are drepturi de administrator (de exemplu prin IAM Identity Center):

```bash
aws configure sso                   # sau: aws configure, cu access key
aws sts get-caller-identity         # verifică în ce cont sunteți
```

### 7.2 Rolul pentru GitHub Actions (OIDC)

`infra/github-oidc.yaml` creează:

- providerul OIDC `token.actions.githubusercontent.com` (AWS acceptă token-urile GitHub);
- rolul `github-deploy-fleet-manager`, pe care îl poate prelua **doar** un job din environment-ul `production` al repository-ului vostru.

Windows (cmd):

```bat
aws cloudformation deploy --region eu-central-1 --template-file infra/github-oidc.yaml --stack-name fleet-manager-github-oidc --capabilities CAPABILITY_NAMED_IAM --parameter-overrides GitHubRepo=strategy/fleet-manager
aws cloudformation describe-stacks --region eu-central-1 --stack-name fleet-manager-github-oidc --query "Stacks[0].Outputs[0].OutputValue" --output text
```

macOS:

```bash
aws cloudformation deploy --region eu-central-1 \
  --template-file infra/github-oidc.yaml \
  --stack-name fleet-manager-github-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides GitHubRepo=strategy/fleet-manager
aws cloudformation describe-stacks --region eu-central-1 --stack-name fleet-manager-github-oidc \
  --query "Stacks[0].Outputs[0].OutputValue" --output text
```

A doua comandă afișează ARN-ul rolului, de forma `arn:aws:iam::123456789012:role/github-deploy-fleet-manager`.

Dacă primiți eroare că providerul OIDC există deja (alt proiect îl folosește), adăugați `CreateOidcProvider=false` după `GitHubRepo=...`.

### 7.3 Environment-ul `production` în GitHub

În repository: **Settings → Environments → New environment** → `production`:

1. **Environment variables → Add variable**: `AWS_DEPLOY_ROLE_ARN` = ARN-ul de la pasul 7.2.
2. **Deployment branches and tags**: *Selected branches* → `master`. Doar `master` poate face deploy.
3. Opțional, **Required reviewers**: deploy-ul așteaptă aprobarea voastră înainte să pornească.

### 7.4 Protecția branch-ului `master`

**Settings → Branches → Add branch ruleset** (sau *Add classic branch protection rule*) pentru `master`:

- **Require a pull request before merging**, cu cel puțin 1 aprobare;
- **Require status checks to pass** → adăugați `test`;
- **Block force pushes**.

Din acest moment, singurul drum spre producție e: branch → PR → test verde → aprobare → merge.

### 7.5 Ștergerea producției (la finalul semestrului)

```bash
sam delete --config-env production                                        # aplicația
aws cloudformation delete-stack --region eu-central-1 --stack-name fleet-manager-github-oidc   # rolul OIDC
```

## Costuri

Cu traficul unui curs, aplicația costă cel mult câțiva cenți pe lună. Conturile AWS noi primesc în plus credite de început.

| Serviciu | Folosire | Gratuit |
|---|---|---|
| Lambda | worker-ul: ~43.000 de apeluri/lună, plus apelurile API | 1 milion de apeluri/lună, permanent |
| DynamoDB | două tabele, plată per cerere | 25 GB, permanent |
| S3 | 3 fișiere statice | nu; costă sub un cent pe lună |
| EventBridge | o regulă, un eveniment pe minut | evenimentele programate nu se plătesc |
| CloudWatch Logs | logurile funcțiilor | 5 GB/lună |

Puneți totuși un buget cu alertă în contul AWS (**Billing → Budgets**), de exemplu 5 USD pe lună.

## Probleme frecvente

| Simptom | Cauză și rezolvare |
|---|---|
| `lstk` nu pornește sau cere login | Rulați `lstk` fără argumente pentru login. Docker Desktop trebuie să fie pornit. |
| `port is already allocated` pe 4566 | LocalStack rulează deja, pornit prin cealaltă metodă. Opriți-l (`lstk stop` sau `docker compose stop localstack`) și folosiți o singură metodă. |
| Metoda B: LocalStack se oprește imediat după pornire | Lipsește sau e greșit token-ul din `.env.localstack`. Vedeți `docker compose logs localstack`. |
| `Nu găsesc „sam”` / `„lstk”` sau `sam not found in PATH` | Unealta nu e instalată (pasul 1) sau terminalul a fost deschis înainte de instalare. Redeschideți-l. |
| `Note: No AWS profile found, run 'lstk setup aws'` | Doar o informare: `lstk aws` merge și fără profil. Opțional, `lstk setup aws` creează un profil AWS pentru LocalStack. |
| Deploy-ul în GitHub eșuează la `configure-aws-credentials` | Lipsește `AWS_DEPLOY_ROLE_ARN` din environment-ul `production`, sau `GitHubRepo` din pasul 7.2 nu se potrivește cu repository-ul. |
| Pagina se încarcă, dar tabelul arată „API indisponibil” | `config.js` nu are adresa API-ului. Rulați din nou deploy-ul și verificați adresa API afișată la final. |
| Nicio poziție GPS în primul minut | EventBridge pornește worker-ul o dată pe minut. Imediat după deploy, așteptați până la un minut. În producție (`GpsPollSeconds=60`) vine o poziție pe minut. |
| API-ul din producție răspunde `403 Forbidden` | Lipsește permisiunea publică a Function URL. Verificați cu `aws lambda get-policy --function-name NUMELE_FUNCTIEI`. |
