#!/usr/bin/env node
// Spec-anchored traceability check.
//
// Requirements are level-3 headings `### ABC-123 · Title` inside specs/**/*.md
// (ADRs and other `##` headings are not requirements).
// Inside a requirement block these anchors are validated:
//   `@code path/to/file.ts#symbol`   file exists and contains the identifier
//   `@code path/to/file.ts`          file exists
//   `@const path/to/file.ts#NAME=value`  file contains `NAME = value` / `NAME: value`
//   `@test tests/file.test.ts`       that test file mentions `[ABC-123]`
//   `@e2e`                           scripts/e2e.mjs mentions `[ABC-123]`
//   `@manual`                        verified by visual/manual review (no automation)
// Every `[ABC-123]` cited in tests must exist in the specs.
//
// Usage: node scripts/check-specs.mjs [--strict] [--list]
//   --strict  also fail when a requirement has no @test/@e2e/@manual verification
//   --list    print the requirement index (id, title, verification)

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const strict = process.argv.includes('--strict');
const list = process.argv.includes('--list');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const read = (p) => readFileSync(join(root, p), 'utf8');
const errors = [];
const warnings = [];
const reqs = new Map(); // id -> { title, file, verified, anchors }

// README documents the syntax with placeholder anchors; templates likewise.
const specFiles = walk(join(root, 'specs')).filter((p) => p.endsWith('.md') && !p.includes('_templates') && !p.endsWith('specs/README.md'));
const HEAD = /^###\s+([A-Z]{2,5}-\d{3})\s*[·:-]\s*(.+)$/;
const ANCHOR = /`@(code|const|test|e2e|manual)(?:\s+([^`]+))?`/g;

for (const abs of specFiles) {
  const file = relative(root, abs);
  let current = null;
  for (const [i, line] of readFileSync(abs, 'utf8').split('\n').entries()) {
    const h = line.match(HEAD);
    if (h) {
      const [, id, title] = h;
      if (reqs.has(id)) errors.push(`${file}:${i + 1} duplicate requirement ${id} (also in ${reqs.get(id).file})`);
      current = { id, title: title.trim(), file, line: i + 1, verified: [], anchors: 0 };
      reqs.set(id, current);
      continue;
    }
    if (/^#{1,3}\s/.test(line)) current = null; // a non-requirement heading closes the block
    for (const m of line.matchAll(ANCHOR)) {
      const [, kind, arg = ''] = m;
      const where = `${file}:${i + 1}`;
      if (kind === 'manual') {
        if (current) current.verified.push('manual');
        continue;
      }
      if (kind === 'e2e') {
        if (!current) continue;
        current.verified.push('e2e');
        if (!read('scripts/e2e.mjs').includes(`[${current.id}]`)) errors.push(`${where} ${current.id}: @e2e but scripts/e2e.mjs has no check tagged [${current.id}]`);
        continue;
      }
      const [path, rest] = arg.trim().split('#');
      if (!path || !existsSync(join(root, path)) || statSync(join(root, path)).isDirectory()) {
        errors.push(`${where} @${kind} ${path}: file not found`);
        continue;
      }
      const src = read(path);
      if (current) current.anchors++;
      if (kind === 'code' && rest) {
        const sym = rest.trim();
        const esc = sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pre = /^\w/.test(sym) ? '\\b' : '';
        const post = /\w$/.test(sym) ? '\\b' : '';
        if (!new RegExp(`${pre}${esc}${post}`).test(src)) errors.push(`${where} @code ${path}#${sym}: symbol not found`);
      } else if (kind === 'const') {
        const [name, value] = (rest ?? '').split('=').map((s) => s.trim());
        const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`\\b${esc(name)}\\b\\s*[:=]\\s*${esc(value)}(?![\\d.])`).test(src)) errors.push(`${where} @const ${path}#${name}=${value}: value drifted (code no longer says ${name} = ${value})`);
      } else if (kind === 'test') {
        if (!current) continue;
        current.verified.push('test');
        if (!src.includes(`[${current.id}]`)) errors.push(`${where} ${current.id}: @test ${path} has no test tagged [${current.id}]`);
      }
    }
  }
}

// Reverse direction: IDs cited by tests must exist.
const testSources = [...walk(join(root, 'tests')).filter((p) => /\.test\.ts$/.test(p)), join(root, 'scripts/e2e.mjs')];
for (const abs of testSources) {
  const src = readFileSync(abs, 'utf8');
  for (const m of src.matchAll(/\[([A-Z]{2,5}-\d{3})\]/g)) {
    if (!reqs.has(m[1])) errors.push(`${relative(root, abs)} cites [${m[1]}] which no spec defines`);
  }
}

for (const r of reqs.values()) {
  if (!r.verified.length) (strict ? errors : warnings).push(`${r.file}:${r.line} ${r.id} has no @test/@e2e/@manual verification`);
  if (!r.anchors) warnings.push(`${r.file}:${r.line} ${r.id} has no @code anchor`);
}

if (list) {
  for (const r of [...reqs.values()].sort((a, b) => a.id.localeCompare(b.id))) console.log(`${r.id.padEnd(9)} ${(r.verified.join('+') || '—').padEnd(16)} ${r.title}`);
}
const byKind = { test: 0, e2e: 0, manual: 0, none: 0 };
for (const r of reqs.values()) {
  if (!r.verified.length) byKind.none++;
  for (const k of new Set(r.verified)) byKind[k]++;
}
for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);
console.log(`\n${reqs.size} requirements in ${specFiles.length} spec files · unit ${byKind.test} · e2e ${byKind.e2e} · manual ${byKind.manual} · unverified ${byKind.none}`);
if (errors.length) {
  console.error(`spec:check FAILED with ${errors.length} error(s)`);
  process.exit(1);
}
console.log('spec:check OK');
