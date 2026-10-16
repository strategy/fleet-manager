// Deploy FleetManager într-un mediu: `localstack` sau `production`.
//
//   npm run deploy:localstack          → LocalStack pornit cu lstk (metoda A)
//   npm run deploy:localstack:docker   → LocalStack pornit cu docker compose (metoda B)
//   npm run deploy:production          → AWS; rulează automat în GitHub Actions la merge în master
//
// Pașii, în ordine:
//   1. build: compilează API-ul și worker-ul într-un pachet Lambda (api/build/)
//   2. infrastructură + cod: `sam deploy` creează sau actualizează stack-ul din template.yaml
//   3. citește adresele create (API, bucket, website) din stack
//   4. frontend: scrie config.js cu adresa API-ului și urcă fișierele în S3
import { spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = process.argv[2];
const viaDocker = process.argv.includes("--docker");
if ((env !== "localstack" && env !== "production") || (viaDocker && env !== "localstack")) {
  console.error("Utilizare: node scripts/deploy.mjs <localstack [--docker] | production>");
  process.exit(1);
}

// Producție: comenzile sam și aws obișnuite, către AWS.
let sam = ["sam"];
let aws = ["aws"];
if (env === "localstack" && !viaDocker) {
  // Metoda A: lstk trimite aceleași comenzi către LocalStack-ul pornit de el.
  sam = ["lstk", "sam"];
  aws = ["lstk", "aws"];
} else if (viaDocker) {
  // Metoda B: sam și aws obișnuite, redirecționate spre LocalStack prin AWS_ENDPOINT_URL.
  // LocalStack acceptă orice credențiale; le setăm explicit ca să nu se folosească cele de AWS.
  process.env.AWS_ENDPOINT_URL ??= "http://localhost.localstack.cloud:4566";
  process.env.AWS_ACCESS_KEY_ID = "test";
  process.env.AWS_SECRET_ACCESS_KEY = "test";
  delete process.env.AWS_SESSION_TOKEN;
  delete process.env.AWS_PROFILE;
  // Fără LocalStack pornit, oprim aici, înainte de orice comandă AWS.
  const health = `${process.env.AWS_ENDPOINT_URL}/_localstack/health`;
  const running = await fetch(health).then((r) => r.ok, () => false);
  if (!running) {
    console.error(`LocalStack nu răspunde la ${health}.`);
    console.error("Porniți-l cu: docker compose --profile localstack up -d localstack");
    process.exit(1);
  }
}

// Stack-ul, regiunea și parametrii vin din samconfig.toml, ca să nu fie scrise în două locuri.
function samconfig(key, section = "global") {
  const toml = readFileSync(join(root, "samconfig.toml"), "utf8");
  const header = `[${env}.${section}.parameters]`;
  const lines = toml.split(header)[1]?.split("\n[")[0] ?? "";
  const value = lines.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"))?.[1];
  if (!value) throw new Error(`Lipsește ${key} din ${header} în samconfig.toml`);
  return value;
}
const stackName = samconfig("stack_name");
const region = samconfig("region");
// Pagina cere date cel puțin la fel de des cum vin pozițiile GPS, dar măcar o dată la 3 secunde.
const gpsPollSeconds = Number(samconfig("parameter_overrides", "deploy").match(/GpsPollSeconds=(\d+)/)?.[1] ?? 60);
const refreshMs = Math.min(gpsPollSeconds, 3) * 1000;

function run([command, ...args], { cwd = root, capture = false } = {}) {
  console.log(`\n> ${[command, ...args].join(" ")}`);
  // Pe Windows, npm, lstk și sam sunt fișiere .cmd: rulează doar prin shell.
  const shell = process.platform === "win32";
  const quoted = shell ? args.map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)) : args;
  const result = spawnSync(command, quoted, {
    cwd,
    shell,
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });
  if (result.error || result.status !== 0) {
    console.error(`\nComanda a eșuat: ${command} ${args.join(" ")}`);
    if (result.error?.code === "ENOENT") console.error(`Nu găsesc „${command}”. E instalat și în PATH?`);
    process.exit(result.status || 1);
  }
  return result.stdout;
}

console.log(`=== Deploy FleetManager → ${env}${viaDocker ? " (docker compose)" : ""} (stack ${stackName}, regiunea ${region}) ===`);

// 1. build
const api = join(root, "api");
if (!existsSync(join(api, "node_modules"))) run(["npm", "ci"], { cwd: api });
run(["npm", "run", "bundle"], { cwd: api });

// 2. infrastructură + cod
run([...sam, "deploy", "--config-env", env]);

// 3. adresele create de stack
const describe = run(
  [
    ...aws,
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    stackName,
    "--region",
    region,
    "--query",
    "Stacks[0].Outputs",
    "--output",
    "json",
  ],
  { capture: true },
);
// lstk poate afișa o notă înaintea JSON-ului, așa că citim de la primul „[”.
const outputs = JSON.parse(describe.slice(describe.indexOf("[")));
const output = (key) => outputs.find((o) => o.OutputKey === key)?.OutputValue;
const apiUrl = output("ApiUrl").replace(/\/$/, "");
const bucket = output("FrontendBucketName");

// 4. frontend: aceleași fișiere ca local, plus config.js cu adresa API-ului
const site = mkdtempSync(join(tmpdir(), "fleet-frontend-"));
for (const file of ["index.html", "map.html"]) {
  copyFileSync(join(root, "frontend", file), join(site, file));
}
writeFileSync(
  join(site, "config.js"),
  `window.API_URL = ${JSON.stringify(apiUrl)};\nwindow.REFRESH_MS = ${refreshMs};\n`,
);
run([
  ...aws,
  "s3",
  "sync",
  site,
  `s3://${bucket}`,
  "--delete",
  "--region",
  region,
  // fără cache în browser: după un deploy se vede imediat versiunea nouă
  "--cache-control",
  "no-cache",
]);

const websiteUrl = output("WebsiteUrl");
// În GitHub Actions, adresa apare lângă environment-ul production.
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `website=${websiteUrl}\n`);

console.log(`
=== Gata: ${env} ===
Aplicația web: ${websiteUrl}
API (Swagger): ${apiUrl}/docs
`);
