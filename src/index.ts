#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import ora, { Ora } from 'ora';
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import { hashString, getCacheDirectory, getDefaultCacheFilePath, flattenObjectWithPaths, unflattenObject, JsonObject, JsonValue } from './helpers';

dotenv.config();

// --- TYPE DEFINITIONS ---

interface PerformanceStats {
  readAndParseTime: number;
  stringCollectionTime: number;
  totalTranslationTime: number;
  rebuildTime: number;
  fileWriteTime: number;
  totalTime: number;
  batchTimes: number[];
  cacheHits: number;
  newStrings: number;
  prunedStrings: number;
  batchCount: number;
  targetBatchSize: number;
}

type CacheEntry = { [lang: string]: { [hash: string]: string } };
type TranslationCache = { [sourceFilePath: string]: CacheEntry };

// --- CONSTANTS ---
const MAX_BATCH_SIZE = 100;
const MODEL_NAME = "gemini-2.0-flash-lite";

// --- HELPER FUNCTIONS ---

async function loadCache(cacheFilePath: string): Promise<TranslationCache> {
  try {
    await fs.access(cacheFilePath);
    const data = await fs.readFile(cacheFilePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function ensureCacheDirectory(cacheFilePath: string): Promise<void> {
  const dir = path.dirname(cacheFilePath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function saveCache(cache: TranslationCache, cacheFilePath: string): Promise<void> {
  await ensureCacheDirectory(cacheFilePath);
  await fs.writeFile(cacheFilePath, JSON.stringify(cache, null, 2), 'utf-8');
}


async function translateBatch(stringBatch: { [key: string]: string }, targetLang: string, model: any): Promise<Map<string, string>> {
  const prompt = `You are a machine translation service. Your task is to translate the values of the given JSON object from English to the language with the code "${targetLang}".

RULES:
- ONLY return a single, valid JSON object.
- The returned JSON object MUST have the exact same keys as the input object.
- Do not include any other text, greetings, explanations, or markdown formatting like \`\`\`json.
- If a string cannot be translated, return the original English string for that key.

EXAMPLE:
Input:
{
  "key_0": "Hello World",
  "key_1": "This is a test."
}

Output for target language "fr":
{
  "key_0": "Bonjour le monde",
  "key_1": "Ceci est un test."
}

Translate this JSON:
${JSON.stringify(stringBatch, null, 2)}`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      const parsed = JSON.parse(responseText);
      const translationMap = new Map<string, string>();
      for (const key in stringBatch) {
        if (parsed[key]) {
          translationMap.set(stringBatch[key], parsed[key]);
        }
      }
      return translationMap;
    } catch (initialError) {
      const jsonStart = responseText.indexOf('{');
      const jsonEnd = responseText.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonString = responseText.substring(jsonStart, jsonEnd + 1);
        try {
          const parsed = JSON.parse(jsonString);
          const translationMap = new Map<string, string>();
          for (const key in stringBatch) {
            if (parsed[key]) {
              translationMap.set(stringBatch[key], parsed[key]);
            }
          }
          return translationMap;
        } catch (secondaryError) {
          console.error(`\nError: Failed to parse surgically-extracted JSON. Raw response was:`, responseText);
          return new Map();
        }
      } else {
        console.error(`\nError: Could not find a valid JSON structure in the API response. Raw response was:`, responseText);
        return new Map();
      }
    }
  } catch (apiError) {
    const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
    console.error(`\nFatal API Error processing a batch. Details: ${errorMessage}`);
    return new Map();
  }
}

function printStats(stats: PerformanceStats, spinner: Ora, isCacheEnabled: boolean) {
  spinner.info('--- Nerd Stats ---');
  const formatMs = (ms: number) => `${ms.toFixed(2)}ms`;
  const batchTimes = stats.batchTimes.filter(t => t > 0);
  const avgBatchTime = batchTimes.length > 0 ? batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length : 0;

  console.log(`
  - File I/O:
    - Reading & Parsing:      ${formatMs(stats.readAndParseTime)}
    - Writing File:           ${formatMs(stats.fileWriteTime)}
  - Processing:
    - String Collection:      ${formatMs(stats.stringCollectionTime)}
    - JSON Rebuilding:        ${formatMs(stats.rebuildTime)}`);

  if (isCacheEnabled) {
    console.log(`  - Caching & Sync:
    - Strings from Cache:     ${stats.cacheHits}
    - New Strings to API:     ${stats.newStrings}
    - Stale Strings Pruned:   ${stats.prunedStrings}`);
  }

  console.log(`  - Translation (${MODEL_NAME}):
    - Batches Sent to API:    ${stats.batchCount} (target size: ~${stats.targetBatchSize})
    - Total API Time:         ${formatMs(stats.totalTranslationTime)}`);

  if (batchTimes.length > 0) {
    console.log(`    - Batch Times:
      - Fastest:              ${formatMs(Math.min(...batchTimes))}
      - Slowest:              ${formatMs(Math.max(...batchTimes))}
      - Average:              ${formatMs(avgBatchTime)}`);
  }
  
  console.log(`\n  - Total Execution Time:     ${formatMs(stats.totalTime)}`);
}

// --- MAIN CLI LOGIC ---
async function main() {
  const t = { start: performance.now(), last: performance.now() };
  const stats: PerformanceStats = {
    readAndParseTime: 0, stringCollectionTime: 0, totalTranslationTime: 0,
    rebuildTime: 0, fileWriteTime: 0, totalTime: 0,
    batchTimes: [], cacheHits: 0, newStrings: 0, prunedStrings: 0, batchCount: 0, targetBatchSize: 0,
  };

  const program = new Command();
  program
    .version('1.0.2')
    .description('A CLI tool to translate and synchronize JSON i18n files.')
    .argument('<inputFile>', 'Path to the source English JSON file.')
    .requiredOption('-l, --lang <langCode>', 'The target language code.')
    .option('-o, --output <outputFile>', 'The path for the output file.')
    .option('--stdout', 'Output to stdout instead of a file.')
    .option('--stats', 'Show detailed performance statistics.')
    .option('--no-cache', 'Disable the incremental translation cache.')
    .option('--cache-file <path>', 'Specify a custom path for the cache file (cache must be enabled).', getDefaultCacheFilePath())
    .parse(process.argv);

  const inputFile = program.args[0];
  const { lang, output, stdout, stats: showStats, noCache, cacheFile } = program.opts();
  const useCache = !noCache;

  if (!output && !stdout) program.error('Error: You must specify an output method. Use either -o <file> or --stdout.');
  if (output && stdout) program.error('Error: You cannot use both -o and --stdout at the same time.');
  
  const spinner = ora({ text: 'Initializing...', isSilent: stdout }).start();
  
  const sourceFilePath = path.resolve(inputFile);
  const resolvedCacheFile = path.isAbsolute(cacheFile) ? cacheFile : path.resolve(cacheFile);
  let sourceJson: JsonObject;
  try {
    sourceJson = JSON.parse(await fs.readFile(sourceFilePath, 'utf-8'));
    stats.readAndParseTime = performance.now() - t.last; t.last = performance.now();
  } catch (e) {
    spinner.fail(`Failed to read or parse input file: ${inputFile}`);
    process.exit(1);
  }

  // 1. FLATTEN SOURCE TO PATHS
  spinner.text = 'Analyzing source file structure...';
  const sourcePathMap = flattenObjectWithPaths(sourceJson);
  const allSourceStrings = new Set(sourcePathMap.values());
  stats.stringCollectionTime = performance.now() - t.last; t.last = performance.now();
  
  // 2. COMPARE WITH CACHE
  let translationCache: TranslationCache = {};
  const translations = new Map<string, string>();
  let stringsToTranslateAPI = new Set<string>();

  if (useCache) {
    spinner.text = `Loading translation cache from ${resolvedCacheFile}...`;
    translationCache = await loadCache(resolvedCacheFile);
    const langCache = translationCache[sourceFilePath]?.[lang] || {};
    
    allSourceStrings.forEach(str => {
      const h = hashString(str);
      if (langCache[h]) {
        translations.set(h, langCache[h]);
      } else {
        stringsToTranslateAPI.add(str);
      }
    });
    stats.cacheHits = allSourceStrings.size - stringsToTranslateAPI.size;
    stats.newStrings = stringsToTranslateAPI.size;
    spinner.info(`Cache found for '${lang}': ${stats.cacheHits} strings loaded, ${stats.newStrings} new strings to translate.`);
  } else {
    spinner.info('Cache is disabled. All strings will be sent for translation.');
    stringsToTranslateAPI = allSourceStrings;
    stats.newStrings = allSourceStrings.size;
  }

  // 3. TRANSLATE NEW STRINGS
  let successfullyTranslatedCount = 0;
  if (stringsToTranslateAPI.size > 0) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) { spinner.fail('GEMINI_API_KEY not found in .env'); process.exit(1); }
    
    const stringsArray = Array.from(stringsToTranslateAPI);
    const totalStrings = stringsArray.length;
    const numBatches = Math.ceil(totalStrings / MAX_BATCH_SIZE);
    const dynamicBatchSize = Math.ceil(totalStrings / numBatches);
    
    stats.batchCount = numBatches;
    stats.targetBatchSize = dynamicBatchSize;
    spinner.start(`Translating ${stats.newStrings} new strings in ${stats.batchCount} dynamically sized batches (target size: ~${dynamicBatchSize})...`);
    
    const batches: { [key: string]: string }[] = [];
    for (let i = 0; i < totalStrings; i += dynamicBatchSize) {
      batches.push(Object.fromEntries(stringsArray.slice(i, i + dynamicBatchSize).map((str, idx) => [`key_${idx}`, str])));
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: [{ category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }, { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }],
      generationConfig: { responseMimeType: "application/json" },
    });

    const translationPromises = batches.map(async (batch, i) => {
      const batchStartTime = performance.now();
      const result = await translateBatch(batch, lang, model);
      stats.batchTimes[i] = performance.now() - batchStartTime;
      spinner.info(`Batch ${i + 1}/${batches.length} (${Object.keys(batch).length} strings) completed in ${stats.batchTimes[i].toFixed(2)}ms.`);
      return result;
    });

    const newTranslations = await Promise.all(translationPromises);
    stats.totalTranslationTime = performance.now() - t.last; t.last = performance.now();

    newTranslations.forEach(batchMap => {
      batchMap.forEach((translated, original) => {
        const h = hashString(original);
        translations.set(h, translated);
        successfullyTranslatedCount++;
        if (useCache) {
          if (!translationCache[sourceFilePath]) translationCache[sourceFilePath] = {};
          if (!translationCache[sourceFilePath][lang]) translationCache[sourceFilePath][lang] = {};
          translationCache[sourceFilePath][lang][h] = translated;
        }
      });
    });
    spinner.succeed(`Translation complete. Received ${successfullyTranslatedCount} new translations.`);
  } else if (useCache) {
    spinner.succeed('All translations were found in the cache. No API calls needed.');
  }

  // 4. PRUNE CACHE
  let prunedCount = 0;
  if (useCache && translationCache[sourceFilePath]?.[lang]) {
    const currentHashes = new Set(Array.from(allSourceStrings).map(hashString));
    for (const h in translationCache[sourceFilePath][lang]) {
      if (!currentHashes.has(h)) {
        delete translationCache[sourceFilePath][lang][h];
        prunedCount++;
      }
    }
    if (prunedCount > 0) {
      spinner.info(`Pruned ${prunedCount} stale translations from the cache.`);
    }
  }
  stats.prunedStrings = prunedCount;

  // 5. SAVE CACHE
  if (useCache && (successfullyTranslatedCount > 0 || prunedCount > 0)) {
    await saveCache(translationCache, resolvedCacheFile);
    spinner.info(`Cache saved to ${resolvedCacheFile}.`);
  }
  
  // 6. REBUILD FROM PATHS
  spinner.start('Rebuilding translated JSON structure from paths...');
  const finalFlatMap = new Map<string, string>();
  for (const [path, sourceString] of sourcePathMap.entries()) {
    const h = hashString(sourceString);
    const translatedString = translations.get(h) || sourceString; // Fallback to original if translation failed
    finalFlatMap.set(path, translatedString);
  }
  const translatedJson = unflattenObject(finalFlatMap);
  const outputString = JSON.stringify(translatedJson, null, 2);
  stats.rebuildTime = performance.now() - t.last; t.last = performance.now();
  spinner.succeed('Rebuilding complete.');

  // --- FINAL OUTPUT ---
  if (stdout) {
    console.log(outputString);
  } else if (output) {
    await fs.writeFile(output, outputString, 'utf-8');
    stats.fileWriteTime = performance.now() - t.last;
    spinner.succeed(`Successfully created translation file at ${output}`);
  }

  // --- STATS ---
  if (showStats && !stdout) {
    stats.totalTime = performance.now() - t.start;
    printStats(stats, spinner, useCache);
  }
}

main().catch(error => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`\nAn unexpected error occurred: ${errorMessage}`);
  process.exit(1);
});