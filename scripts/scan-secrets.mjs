// Scans the files git tracks (or the paths given) for credentials that must never be
// committed: provider keys, Blob and Redis tokens, access-code assignments and private
// keys. Exit code 1 with file:line and the pattern name; the matched value is never
// printed. Run by CI before the test suites and usable locally: `node scripts/scan-secrets.mjs`.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const patterns = [
  { name: 'Meta or OpenAI-style API key', re: /\b(sk|LLM|meta)[-_][A-Za-z0-9_-]{24,}\b/ },
  { name: 'Vercel Blob token', re: /\bvercel_blob_rw_[A-Za-z0-9_-]{16,}\b/ },
  { name: 'Upstash or Redis URL with credentials', re: /\brediss?:\/\/[^\s:@/]+:[^\s@/]+@/ },
  { name: 'Upstash REST token', re: /\bA[A-Za-z0-9]{20,}[a-z0-9]{40,}\b/ },
  { name: 'private key block', re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'access code assignment', re: /EXPLAINBACK_ACCESS_CODES\s*=\s*[A-Za-z0-9-]+:[A-Za-z0-9-]{8,}:\d{4}-\d{2}-\d{2}:\d+/ },
  { name: 'secret assignment', re: /\b(MODEL_API_KEY|BLOB_READ_WRITE_TOKEN|EXPLAINBACK_TESTER_PASSWORD|KV_REST_API_TOKEN|UPSTASH_REDIS_REST_TOKEN)\s*=\s*['"]?[A-Za-z0-9_./+-]{12,}/ },
];
// Placeholders used by the example files and tests; the scan must not flag them.
const allowed = [/CHANGE-ME/, /BROWSER-TEST-CODE/, /your-key-here/i, /\$\{/];
const skip = /^(package-lock\.json|public\/gallery\/|public\/gallery-shows\.mjs|public\/icons\/|output\/)/;

const files = process.argv.length > 2
  ? process.argv.slice(2)
  : execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
let findings = 0;
for (const file of files) {
  if (skip.test(file)) continue;
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  if (text.includes('\0')) continue;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (allowed.some(a => a.test(line))) return;
    for (const { name, re } of patterns) {
      if (re.test(line)) { findings++; console.error(`${file}:${i + 1}: possible ${name}`); break; }
    }
  });
}
if (findings) { console.error(`${findings} possible secret(s) found. Move them to .env.local or the deployment's environment variables.`); process.exit(1); }
console.log(`No committed secrets found in ${files.length} files.`);
