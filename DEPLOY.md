# De la LocalStack la producție

Cum ajunge o modificare de pe calculatorul vostru în AWS, pas cu pas. Comenzile sunt date pentru **Windows (cmd)** și **macOS (Terminal)**. Unde nu diferă, apar o singură dată.

## Cele două medii

| Mediu | Unde rulează | Ce rulează | Cine îl pornește | Comanda |
|---|---|---|---|---|
| **localstack** | calculatorul vostru, AWS emulat | Lambda + DynamoDB + S3 + EventBridge, ca în AWS | voi | `npm run deploy:localstack` (metoda A, lstk) sau `npm run deploy:localstack:docker` (metoda B, docker compose) |
| **production** | AWS, regiunea `eu-central-1` (Frankfurt) | Lambda + DynamoDB + S3 + EventBridge | GitHub Actions, la merge în `master` | `npm run deploy:production` |

Nu există un mediu local separat, nici staging. Scrieți codul și îl verificați direct în LocalStack: aceleași resurse ca în producție, din același `template.yaml`, fără cont AWS și fără costuri. Pe calculatorul vostru nu rulează containere ale aplicației și nu se construiește niciun Dockerfile: singurul container pornit de voi e LocalStack, iar el pornește funcțiile Lambda.

```
 localstack                                  production
 npm run deploy:localstack[:docker]    →     PR → merge în master
 (scrieți și verificați codul)               (GitHub Actions face deploy)
```

### Ce diferă între LocalStack și producție

Doar valorile din `samconfig.toml`:

| | localstack | production |
|---|---|---|
| Regiunea | `us-east-1` (emulat) | `eu-central-1` |
| `GpsPollSeconds` | 1 (o poziție GPS pe secundă) | 60 |
| `LogLevel` | `debug` | `info` |
| Comenzile `sam` / `aws` | prin `lstk` (A) sau cu `AWS_ENDPOINT_URL` (B) | direct, cu rolul IAM din GitHub Actions |

Codul (`app.ts`, `db.ts`, `simulation.ts`, `lambda.ts`, `worker-lambda.ts`) și infrastructura (`template.yaml`) sunt aceleași.

---

## 1. Uneltele (o singură dată)

Pașii de instalare pentru Windows și macOS (Git, Docker Desktop, Node.js, AWS CLI, AWS SAM CLI, lstk) și contul LocalStack sunt în [README → Instalare](README.md#instalare).

```bash
git clone https://github.com/strategy/fleet-manager.git
cd fleet-manager
git switch localstack
```

## 2. Pornirea LocalStack și primul deploy

LocalStack se poate porni în două feluri, descrise pe larg în [README → Pornire: două metode](README.md#pornire-două-metode). **Folosiți ori una, ori cealaltă, niciodată pe amândouă deodată.**

Metoda A, cu `lstk` (recomandată):

```bash
lstk                                # prima dată: login în browser, apoi pornește LocalStack
lstk status                         # LocalStack trebuie să fie pornit
npm run deploy:localstack           # build + sam deploy + upload frontend
```

Metoda B, cu `docker compose` (token-ul în `.env.localstack`, vezi README):

```bash
docker compose up -d                # pornește doar containerul LocalStack
npm run deploy:localstack:docker    # build + sam deploy + upload frontend
```

`compose.yaml` conține un singur serviciu, `localstack`; `docker compose up -d` nu construiește și nu pornește nimic altceva.

La final scriptul afișează adresele:

```
=== Gata: localstack ===
Aplicația web: http://fleet-manager-frontendbucket-xxxx.s3-website.localhost.localstack.cloud:4566
API (Swagger): http://xxxx.lambda-url.us-east-1.localhost.localstack.cloud:4566/docs
```

În LocalStack, worker-ul trimite o poziție GPS pe secundă pentru fiecare mașină aflată în cursă (`GpsPollSeconds=1` în `samconfig.toml`). Imediat după primul deploy, prima poziție poate întârzia până la un minut, până pornește EventBridge worker-ul.

Datele din LocalStack nu se păstrează la oprire. După fiecare pornire a LocalStack, rulați din nou deploy-ul.

Ce face scriptul de deploy (vezi `scripts/deploy.mjs`):

1. `npm run bundle` în `api/`: esbuild pune API-ul și worker-ul în `api/build/` (pachetul Lambda);
2. `sam deploy --config-env localstack`: creează sau actualizează stack-ul din `template.yaml`;
3. `aws cloudformation describe-stacks`: citește adresele create (API, bucket);
4. scrie `config.js` cu adresa API-ului și urcă frontend-ul în S3 cu `aws s3 sync`.

La metoda A, comenzile `sam` și `aws` rulează prin `lstk` (`lstk sam`, `lstk aws`). La metoda B, rulează direct, cu `AWS_ENDPOINT_URL=http://localhost.localstack.cloud:4566`. Fără una dintre cele două, aceeași comandă ar merge în contul AWS real.

## 3. Lucrul pe branch-ul vostru

Nimeni nu lucrează direct pe `master`. Fiecare student are branch-ul lui:

```bash
git switch master
git pull                                    # porniți de la ultima versiune
git switch -c student/popescu-ion           # branch-ul vostru
```

Ciclul de lucru, cu LocalStack pornit:

1. modificați codul (`api/src`, `frontend/`, `template.yaml` sau `samconfig.toml`);
2. rulați testele (nu au nevoie de Docker):

   ```bash
   cd api
   npm ci
   npm run lint
   npm test
   cd ..
   ```

3. rulați din nou deploy-ul (`npm run deploy:localstack` sau `npm run deploy:localstack:docker`). `sam deploy` actualizează doar ce s-a schimbat, iar adresele rămân aceleași;
4. reîncărcați pagina și urmăriți logurile funcției modificate:

   ```bash
   lstk aws logs tail /aws/lambda/NUMELE_FUNCTIEI --follow     # metoda B: fără lstk, cu AWS_ENDPOINT_URL setat
   ```

   Numele funcțiilor și ale tabelelor, plus celelalte comenzi utile, sunt în [README → Comenzi către LocalStack](README.md#comenzi-către-localstack).

Când merge, salvați modificarea:

```bash
git status
git add .
git commit -m "Adaugă filtrarea vehiculelor după stare"
git push -u origin student/popescu-ion      # prima dată; apoi doar git push
```

## 4. Verificare înainte de Pull Request

Înainte de PR, verificați în LocalStack aceleași lucruri pe care le verifică CI-ul, plus aplicația propriu-zisă:

```bash
cd api
npm run lint
npm test
npm run bundle
cd ..
sam validate --lint                 # template.yaml e corect
npm run deploy:localstack           # sau deploy:localstack:docker
```

Apoi, în pagina web: adăugați o mașină, trimiteți-o în cursă și urmăriți pozițiile GPS în tabel și pe hartă. Dacă ați schimbat API-ul, încercați ruta nouă din Swagger (`<adresa API>/docs`).

Un deploy reușit în LocalStack înseamnă că `template.yaml` și codul merg „ca în AWS”. Ce rămâne diferit în producție sunt doar valorile din `samconfig.toml` și drepturile IAM (LocalStack Hobby nu le verifică).

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
| `port is already allocated` pe 4566 | LocalStack rulează deja, pornit prin cealaltă metodă. Opriți-l (`lstk stop` sau `docker compose stop`) și folosiți o singură metodă. |
| Metoda B: LocalStack se oprește imediat după pornire | Lipsește sau e greșit token-ul din `.env.localstack`. Vedeți `docker compose logs localstack`. |
| `Nu găsesc „sam”` / `„lstk”` sau `sam not found in PATH` | Unealta nu e instalată (pasul 1) sau terminalul a fost deschis înainte de instalare. Redeschideți-l. |
| `Note: No AWS profile found, run 'lstk setup aws'` | Doar o informare: `lstk aws` merge și fără profil. Opțional, `lstk setup aws` creează un profil AWS pentru LocalStack. |
| Deploy-ul în GitHub eșuează la `configure-aws-credentials` | Lipsește `AWS_DEPLOY_ROLE_ARN` din environment-ul `production`, sau `GitHubRepo` din pasul 7.2 nu se potrivește cu repository-ul. |
| Pagina se încarcă, dar tabelul arată „API indisponibil” | `config.js` nu are adresa API-ului. Rulați din nou deploy-ul și verificați adresa API afișată la final. |
| Nicio poziție GPS în primul minut | EventBridge pornește worker-ul o dată pe minut. Imediat după deploy, așteptați până la un minut. În producție (`GpsPollSeconds=60`) vine o poziție pe minut. |
| API-ul din producție răspunde `403 Forbidden` | Lipsește permisiunea publică a Function URL. Verificați cu `aws lambda get-policy --function-name NUMELE_FUNCTIEI`. |
