import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { defineConfig, Plugin } from 'vite';
import { PERFORMANCE_BUDGETS } from './src/config';

const DEFERRED_AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav']);
const GZIP_EXTENSIONS = new Set(['.html', '.css', '.js', '.json', '.svg']);

function walkFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? walkFiles(path) : [path];
  });
}

function firstScreenBudgetPlugin(): Plugin {
  return {
    name: 'daily-grind-first-screen-budget',
    closeBundle() {
      const measuredBytes = walkFiles('dist')
        .filter((path) => !DEFERRED_AUDIO_EXTENSIONS.has(extname(path)))
        .reduce((sum, path) => {
          const contents = readFileSync(path);
          const fileBytes = GZIP_EXTENSIONS.has(extname(path))
            ? gzipSync(contents).byteLength
            : contents.byteLength;
          return sum + fileBytes;
        }, 0);

      const budgetBytes = PERFORMANCE_BUDGETS.FIRST_SCREEN_GZIP_MAX_BYTES;
      const measuredMiB = (measuredBytes / 1024 / 1024).toFixed(2);
      const budgetMiB = (budgetBytes / 1024 / 1024).toFixed(2);
      console.log(`[首屏预算] ${measuredMiB} MiB / ${budgetMiB} MiB（音频交互后加载）`);

      if (measuredBytes > budgetBytes) {
        throw new Error(`首屏资源超出预算：${measuredBytes} > ${budgetBytes} bytes`);
      }
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [firstScreenBudgetPlugin()],
  server: {
    port: 5173,
    host: true
  }
});
