import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
import { describe, expect, it } from 'vitest';

const coreDir = join(ROOT, 'src/core');

describe('architecture', () => {
  it('[ARCH-001] core stays pure: no three, react, DOM or upper layers', () => {
    for (const f of readdirSync(coreDir).filter((n) => n.endsWith('.ts'))) {
      const src = readFileSync(join(coreDir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/from ['"](three|react|react-dom)(\/[^'"]*)?['"]/);
      expect(src, f).not.toMatch(/from ['"]\.\.\/(engine|ui|state)\//);
      expect(src, f).not.toMatch(/\bdocument\./);
    }
  });
});
