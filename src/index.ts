#!/usr/bin/env node

import { Command } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import ora, { Ora } from 'ora';
import dotenv from 'dotenv';
import { performance } from 'perf_hooks';
import { glob } from 'glob';
import { hashString, getCacheDirectory, getDefaultCacheFilePath, flattenObjectWithPaths, unflattenObject, JsonObject, JsonValue, preserveFormats, restoreFormats, PreservedFormat, sortObjectKeys, compareKeys } from './helpers';
import { TranslatorFactory, TranslatorType } from './translators/factory';
import { TranslationProvider } from './translators/base';

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

interface MultiFileStats extends PerformanceStats {
  totalFiles: number;
  totalStrings: number;
  uniqueStrings: number;
  savedApiCalls: number;
  deduplicationSavings: number;
}

type CacheEntry = { [lang: string]: { [hash: string]: string } };
type TranslationCache = { [sourceFilePath: string]: CacheEntry };

// --- CONSTANTS ---
const MAX_BATCH_SIZE = 100;

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

async function translateBatch(strings: string[], targetLang: string, translator: TranslationProvider, sourceLang: string = 'English', shouldPreserveFormats: boolean = false): Promise<Map<string, string>> {
  try {
    let processedStrings = strings;
    const formatMaps = new Map<string, PreservedFormat>();
    
    // If format preservation is enabled, process strings first
    if (shouldPreserveFormats) {
      processedStrings = strings.map(str => {
        const preserved = preserveFormats(str);
        formatMaps.set(str, preserved);
        return preserved.processed;
      });
    }
    
    const translations = await translator.translate(processedStrings, targetLang, sourceLang);
    const translationMap = new Map<string, string>();
    
    strings.forEach((original, index) => {
      if (translations[index]) {
        let translated = translations[index];
        
        // Restore preserved formats if enabled
        if (shouldPreserveFormats && formatMaps.has(original)) {
          translated = restoreFormats(translated, formatMaps.get(original)!);
        }
        
        translationMap.set(original, translated);
      }
    });
    
    return translationMap;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\nTranslation error: ${errorMessage}`);
    return new Map();
  }
}

// Legacy function for backward compatibility with Gemini direct usage
async function translateBatchLegacy(stringBatch: { [key: string]: string }, targetLang: string, model: any): Promise<Map<string, string>> {
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

function printStats(stats: PerformanceStats | MultiFileStats, spinner: Ora, isCacheEnabled: boolean) {
  spinner.info('--- Translation Statistics ---');
  const formatMs = (ms: number) => `${ms.toFixed(2)}ms`;
  const batchTimes = stats.batchTimes.filter(t => t > 0);
  const avgBatchTime = batchTimes.length > 0 ? batchTimes.reduce((a, b) => a + b, 0) / batchTimes.length : 0;

  // Check if it's multi-file stats
  const isMultiFile = 'totalFiles' in stats;
  
  if (isMultiFile) {
    console.log(`
  - Files:
    - Total processed:        ${stats.totalFiles}
    - Total strings:          ${stats.totalStrings}
    - Unique strings:         ${stats.uniqueStrings}
    - Deduplication savings:  ${stats.deduplicationSavings} strings (${((stats.deduplicationSavings / stats.totalStrings) * 100).toFixed(1)}%)`);
  }

  console.log(`
  - File I/O:
    - Reading & Parsing:      ${formatMs(stats.readAndParseTime)}
    - Writing File(s):        ${formatMs(stats.fileWriteTime)}
  - Processing:
    - String Collection:      ${formatMs(stats.stringCollectionTime)}
    - JSON Rebuilding:        ${formatMs(stats.rebuildTime)}`);

  if (isCacheEnabled) {
    console.log(`  - Caching & Sync:
    - Strings from Cache:     ${stats.cacheHits}
    - New Strings to API:     ${stats.newStrings}
    - Stale Strings Pruned:   ${stats.prunedStrings}`);
  }

  console.log(`  - Translation:
    - Batches Sent to API:    ${stats.batchCount} (target size: ~${stats.targetBatchSize})
    - Total API Time:         ${formatMs(stats.totalTranslationTime)}`);

  if (isMultiFile && stats.savedApiCalls > 0) {
    console.log(`    - API Calls Saved:      ${stats.savedApiCalls} (by deduplication)`);
  }

  if (batchTimes.length > 0) {
    console.log(`    - Batch Times:
      - Fastest:              ${formatMs(Math.min(...batchTimes))}
      - Slowest:              ${formatMs(Math.max(...batchTimes))}
      - Average:              ${formatMs(avgBatchTime)}`);
  }
  
  console.log(`\n  - Total Execution Time:     ${formatMs(stats.totalTime)}`);
}

// --- SINGLE FILE PROCESSING ---
async function processSingleFile(
  inputFile: string,
  lang: string,
  output: string | undefined,
  stdout: boolean,
  showStats: boolean,
  useCache: boolean,
  cacheFile: string,
  translator: TranslationProvider,
  detectSource: boolean = false,
  dryRun: boolean = false,
  preserveFormats: boolean = false,
  includeMetadata: boolean = false,
  sortKeys: boolean = false,
  checkKeys: boolean = false
): Promise<void> {
  const t = { start: performance.now(), last: performance.now() };
  const stats: PerformanceStats = {
    readAndParseTime: 0, stringCollectionTime: 0, totalTranslationTime: 0,
    rebuildTime: 0, fileWriteTime: 0, totalTime: 0,
    batchTimes: [], cacheHits: 0, newStrings: 0, prunedStrings: 0, batchCount: 0, targetBatchSize: 0,
  };

  const spinner = ora({ text: 'Initializing...', isSilent: stdout }).start();
  
  const sourceFilePath = path.resolve(inputFile);
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
  
  // 1.5. DETECT SOURCE LANGUAGE IF REQUESTED
  let sourceLang = 'English';
  if (detectSource && translator.detectLanguage && allSourceStrings.size > 0) {
    spinner.text = 'Detecting source language...';
    const stringsArray = Array.from(allSourceStrings);
    sourceLang = await translator.detectLanguage(stringsArray);
    spinner.info(`Detected source language: ${sourceLang}`);
  }
  
  // Handle dry-run mode
  if (dryRun) {
    spinner.info('--- DRY RUN MODE ---');
    console.log(`\nSource file: ${inputFile}`);
    console.log(`Total strings: ${allSourceStrings.size}`);
    console.log(`Source language: ${sourceLang}`);
    console.log(`Target language: ${lang}`);
    console.log(`Format preservation: ${preserveFormats ? 'enabled' : 'disabled'}`);
    
    if (useCache) {
      const resolvedCacheFile = path.isAbsolute(cacheFile) ? cacheFile : path.resolve(cacheFile);
      const translationCache = await loadCache(resolvedCacheFile);
      const langCache = translationCache[sourceFilePath]?.[lang] || {};
      
      let cacheHits = 0;
      let newStrings = 0;
      
      allSourceStrings.forEach(str => {
        const h = hashString(str);
        if (langCache[h]) {
          cacheHits++;
        } else {
          newStrings++;
        }
      });
      
      console.log(`\nCache statistics:`);
      console.log(`  - Cache file: ${resolvedCacheFile}`);
      console.log(`  - Cached translations: ${cacheHits}`);
      console.log(`  - New strings to translate: ${newStrings}`);
      
      if (newStrings > 0) {
        const numBatches = Math.ceil(newStrings / MAX_BATCH_SIZE);
        console.log(`  - Estimated API calls: ${numBatches}`);
      }
    } else {
      const numBatches = Math.ceil(allSourceStrings.size / MAX_BATCH_SIZE);
      console.log(`\nCache disabled. All strings would be translated.`);
      console.log(`Estimated API calls: ${numBatches}`);
    }
    
    const finalOutput = output ? output.replace(/\{lang\}/g, lang) : 'stdout';
    console.log(`\nOutput would be written to: ${finalOutput}`);
    spinner.succeed('Dry run complete. No API calls were made.');
    return;
  }
  
  // 2. COMPARE WITH CACHE
  let translationCache: TranslationCache = {};
  const translations = new Map<string, string>();
  let stringsToTranslateAPI = new Set<string>();

  const resolvedCacheFile = path.isAbsolute(cacheFile) ? cacheFile : path.resolve(cacheFile);

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
    const stringsArray = Array.from(stringsToTranslateAPI);
    const totalStrings = stringsArray.length;
    const numBatches = Math.ceil(totalStrings / MAX_BATCH_SIZE);
    const dynamicBatchSize = Math.ceil(totalStrings / numBatches);
    
    stats.batchCount = numBatches;
    stats.targetBatchSize = dynamicBatchSize;
    spinner.start(`Translating ${stats.newStrings} new strings in ${stats.batchCount} dynamically sized batches (target size: ~${dynamicBatchSize}) using ${translator.name}...`);
    
    const batches: string[][] = [];
    for (let i = 0; i < totalStrings; i += dynamicBatchSize) {
      batches.push(stringsArray.slice(i, i + dynamicBatchSize));
    }

    const translationPromises = batches.map(async (batch, i) => {
      const batchStartTime = performance.now();
      const result = await translateBatch(batch, lang, translator, sourceLang, preserveFormats);
      stats.batchTimes[i] = performance.now() - batchStartTime;
      spinner.info(`Batch ${i + 1}/${batches.length} (${batch.length} strings) completed in ${stats.batchTimes[i].toFixed(2)}ms.`);
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
  
  // Start with a deep copy of the original to preserve all keys
  let translatedJson = JSON.parse(JSON.stringify(sourceJson)) as JsonObject;
  
  const PATH_SEPARATOR = '\x00';
  const DOT_ESCAPE = '\x01';
  
  // Apply translations by updating the values in place
  function applyTranslations(obj: any, path: string[] = []): void {
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          applyTranslations(obj[key], [...path, key]);
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        applyTranslations(item, [...path, `[${index}]`]);
      });
    } else if (typeof obj === 'string') {
      // Build the flattened path
      const flatPath = path.map(p => p.replace(/\./g, DOT_ESCAPE)).join(PATH_SEPARATOR);
      if (sourcePathMap.has(flatPath)) {
        const sourceString = sourcePathMap.get(flatPath)!;
        const h = hashString(sourceString);
        const translatedString = translations.get(h);
        if (translatedString) {
          // Update the value in the parent object
          const parentPath = path.slice(0, -1);
          const lastKey = path[path.length - 1];
          let parent = translatedJson;
          for (const p of parentPath) {
            if (p.startsWith('[') && p.endsWith(']')) {
              parent = parent[parseInt(p.slice(1, -1))] as any;
            } else {
              parent = parent[p] as any;
            }
          }
          if (lastKey.startsWith('[') && lastKey.endsWith(']')) {
            parent[parseInt(lastKey.slice(1, -1))] = translatedString;
          } else {
            parent[lastKey] = translatedString;
          }
        }
      }
    }
  }
  
  applyTranslations(translatedJson);
  
  // Apply sorting if requested
  if (sortKeys) {
    translatedJson = sortObjectKeys(translatedJson) as JsonObject;
  }
  
  // Add metadata using _comment convention
  let outputJson = translatedJson;
  if (includeMetadata) {
    outputJson = {
      "_translator_metadata": {
        "tool": "translator-ai v1.1.0",
        "repository": "https://github.com/DatanoiseTV/translator-ai",
        "provider": translator.name,
        "source_language": detectSource ? sourceLang : "English",
        "target_language": lang,
        "timestamp": new Date().toISOString(),
        "total_strings": sourcePathMap.size,
        "source_file": path.basename(inputFile)
      },
      ...translatedJson
    };
  }
  
  const outputString = JSON.stringify(outputJson, null, 2);
  stats.rebuildTime = performance.now() - t.last; t.last = performance.now();
  spinner.succeed('Rebuilding complete.');

  // --- FINAL OUTPUT ---
  if (stdout) {
    console.log(outputString);
  } else if (output) {
    const finalOutput = output.replace(/\{lang\}/g, lang);
    await fs.writeFile(finalOutput, outputString, 'utf-8');
    stats.fileWriteTime = performance.now() - t.last;
    spinner.succeed(`Successfully created translation file at ${finalOutput}`);
  }

  // --- KEY CHECKING ---
  if (checkKeys) {
    const comparison = compareKeys(sourceJson, outputJson);
    
    if (!comparison.isValid) {
      spinner.fail(`Key verification failed!`);
      console.error(`\nMissing keys (${comparison.missingKeys.size}):`);
      for (const key of comparison.missingKeys) {
        console.error(`  - ${key}`);
      }
      
      if (comparison.extraKeys.size > 0) {
        console.error(`\nUnexpected extra keys (${comparison.extraKeys.size}):`);
        for (const key of comparison.extraKeys) {
          console.error(`  + ${key}`);
        }
      }
      
      process.exit(1);
    } else {
      spinner.succeed(`Key verification passed: all ${comparison.sourceKeys.size} keys are present in output.`);
    }
  }

  // --- STATS ---
  if (showStats && !stdout) {
    stats.totalTime = performance.now() - t.start;
    printStats(stats, spinner, useCache);
  }
}

// --- MULTIPLE FILES PROCESSING ---
async function processMultipleFiles(
  inputPatterns: string[],
  lang: string,
  outputPattern: string | undefined,
  stdout: boolean,
  showStats: boolean,
  useCache: boolean,
  cacheFile: string,
  translator: TranslationProvider,
  detectSource: boolean = false,
  dryRun: boolean = false,
  preserveFormats: boolean = false,
  includeMetadata: boolean = false,
  sortKeys: boolean = false,
  checkKeys: boolean = false
): Promise<void> {
  const t = { start: performance.now(), last: performance.now() };
  const stats: MultiFileStats = {
    readAndParseTime: 0, stringCollectionTime: 0, totalTranslationTime: 0,
    rebuildTime: 0, fileWriteTime: 0, totalTime: 0,
    batchTimes: [], cacheHits: 0, newStrings: 0, prunedStrings: 0, batchCount: 0, targetBatchSize: 0,
    totalFiles: 0, totalStrings: 0, uniqueStrings: 0, savedApiCalls: 0, deduplicationSavings: 0
  };

  const spinner = ora({ text: 'Initializing...', isSilent: stdout }).start();

  // 1. COLLECT ALL FILES
  spinner.text = 'Collecting files...';
  const allFiles: string[] = [];
  
  for (const pattern of inputPatterns) {
    if (pattern.includes('*') || pattern.includes('?') || pattern.includes('[')) {
      // It's a glob pattern
      const files = await glob(pattern, { absolute: true });
      allFiles.push(...files);
    } else {
      // It's a direct file path
      allFiles.push(path.resolve(pattern));
    }
  }

  // Remove duplicates
  const uniqueFiles = [...new Set(allFiles)];
  stats.totalFiles = uniqueFiles.length;

  if (stats.totalFiles === 0) {
    spinner.fail('No files found matching the input patterns.');
    process.exit(1);
  }

  spinner.info(`Found ${stats.totalFiles} file(s) to process.`);

  // 2. READ AND COLLECT ALL UNIQUE STRINGS
  spinner.text = 'Reading and analyzing files...';
  const fileDataMap = new Map<string, { json: JsonObject, paths: Map<string, string>, outputPath: string }>();
  const globalStringMap = new Map<string, Set<string>>(); // string -> set of files containing it

  for (const filePath of uniqueFiles) {
    try {
      const sourceJson = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      const pathMap = flattenObjectWithPaths(sourceJson);
      
      // Determine output path
      let outputPath: string;
      if (stdout) {
        outputPath = 'stdout';
      } else if (outputPattern) {
        const dir = path.dirname(filePath);
        const base = path.basename(filePath, '.json');
        outputPath = outputPattern
          .replace(/\{dir\}/g, dir)
          .replace(/\{name\}/g, base)
          .replace(/\{lang\}/g, lang);
      } else {
        // Default: same directory with language suffix
        const dir = path.dirname(filePath);
        const base = path.basename(filePath, '.json');
        outputPath = path.join(dir, `${base}.${lang}.json`);
      }

      fileDataMap.set(filePath, { json: sourceJson, paths: pathMap, outputPath });

      // Collect unique strings
      for (const str of pathMap.values()) {
        if (!globalStringMap.has(str)) {
          globalStringMap.set(str, new Set());
        }
        globalStringMap.get(str)!.add(filePath);
        stats.totalStrings++;
      }
    } catch (e) {
      spinner.fail(`Failed to read or parse file: ${filePath}`);
      console.error(e);
    }
  }

  stats.readAndParseTime = performance.now() - t.last; t.last = performance.now();
  stats.uniqueStrings = globalStringMap.size;
  stats.deduplicationSavings = stats.totalStrings - stats.uniqueStrings;

  spinner.succeed(`Analyzed ${stats.totalFiles} files: ${stats.totalStrings} total strings, ${stats.uniqueStrings} unique.`);

  // 2.5. DETECT SOURCE LANGUAGE IF REQUESTED
  let sourceLang = 'English';
  if (detectSource && translator.detectLanguage && stats.uniqueStrings > 0) {
    spinner.text = 'Detecting source language...';
    const sampleStrings = Array.from(globalStringMap.keys()).slice(0, 10);
    sourceLang = await translator.detectLanguage(sampleStrings);
    spinner.info(`Detected source language: ${sourceLang}`);
  }
  
  // Handle dry-run mode for multiple files
  if (dryRun) {
    spinner.info('--- DRY RUN MODE ---');
    console.log(`\nFiles to process: ${stats.totalFiles}`);
    console.log(`Total strings: ${stats.totalStrings}`);
    console.log(`Unique strings: ${stats.uniqueStrings}`);
    console.log(`Deduplication savings: ${stats.deduplicationSavings} strings (${((stats.deduplicationSavings / stats.totalStrings) * 100).toFixed(1)}%)`);
    console.log(`Source language: ${sourceLang}`);
    console.log(`Target language: ${lang}`);
    console.log(`Format preservation: ${preserveFormats ? 'enabled' : 'disabled'}`);
    
    if (useCache) {
      const resolvedCacheFile = path.isAbsolute(cacheFile) ? cacheFile : path.resolve(cacheFile);
      const translationCache = await loadCache(resolvedCacheFile);
      
      let totalCacheHits = 0;
      let totalNewStrings = 0;
      
      for (const [str, files] of globalStringMap) {
        const hash = hashString(str);
        let foundInCache = false;
        
        for (const file of files) {
          if (translationCache[file]?.[lang]?.[hash]) {
            foundInCache = true;
            break;
          }
        }
        
        if (foundInCache) {
          totalCacheHits++;
        } else {
          totalNewStrings++;
        }
      }
      
      console.log(`\nCache statistics:`);
      console.log(`  - Cache file: ${resolvedCacheFile}`);
      console.log(`  - Cached translations: ${totalCacheHits}`);
      console.log(`  - New strings to translate: ${totalNewStrings}`);
      
      if (totalNewStrings > 0) {
        const numBatches = Math.ceil(totalNewStrings / MAX_BATCH_SIZE);
        console.log(`  - Estimated API calls: ${numBatches}`);
        
        const callsWithoutDedup = Math.ceil(stats.totalStrings / MAX_BATCH_SIZE);
        const savedCalls = Math.max(0, callsWithoutDedup - numBatches);
        if (savedCalls > 0) {
          console.log(`  - API calls saved by deduplication: ${savedCalls}`);
        }
      }
    } else {
      const numBatches = Math.ceil(stats.uniqueStrings / MAX_BATCH_SIZE);
      console.log(`\nCache disabled. All unique strings would be translated.`);
      console.log(`Estimated API calls: ${numBatches}`);
      
      const callsWithoutDedup = Math.ceil(stats.totalStrings / MAX_BATCH_SIZE);
      const savedCalls = Math.max(0, callsWithoutDedup - numBatches);
      if (savedCalls > 0) {
        console.log(`API calls saved by deduplication: ${savedCalls}`);
      }
    }
    
    console.log(`\nOutput files:`);
    for (const [filePath, fileData] of fileDataMap) {
      console.log(`  - ${path.relative(process.cwd(), filePath)} → ${stdout ? 'stdout' : path.relative(process.cwd(), fileData.outputPath)}`);
    }
    
    spinner.succeed('Dry run complete. No API calls were made.');
    return;
  }

  // 3. LOAD CACHE AND DETERMINE WHAT NEEDS TRANSLATION
  const resolvedCacheFile = path.isAbsolute(cacheFile) ? cacheFile : path.resolve(cacheFile);
  let translationCache: TranslationCache = {};
  const globalTranslations = new Map<string, string>(); // hash -> translation
  const stringsToTranslate = new Set<string>();

  if (useCache) {
    spinner.text = `Loading translation cache...`;
    translationCache = await loadCache(resolvedCacheFile);
    
    // Check cache for each unique string
    for (const [str, files] of globalStringMap) {
      const hash = hashString(str);
      let foundInCache = false;
      
      // Check if this string is cached for any of the files
      for (const file of files) {
        if (translationCache[file]?.[lang]?.[hash]) {
          globalTranslations.set(hash, translationCache[file][lang][hash]);
          foundInCache = true;
          stats.cacheHits++;
          break;
        }
      }
      
      if (!foundInCache) {
        stringsToTranslate.add(str);
      }
    }
    
    spinner.info(`Cache: ${stats.cacheHits} translations found, ${stringsToTranslate.size} new strings to translate.`);
  } else {
    for (const str of globalStringMap.keys()) {
      stringsToTranslate.add(str);
    }
  }

  stats.stringCollectionTime = performance.now() - t.last; t.last = performance.now();
  stats.newStrings = stringsToTranslate.size;

  // 4. TRANSLATE NEW STRINGS IN BATCHES
  if (stringsToTranslate.size > 0) {
    const stringsArray = Array.from(stringsToTranslate);
    const numBatches = Math.ceil(stringsArray.length / MAX_BATCH_SIZE);
    stats.batchCount = numBatches;
    stats.targetBatchSize = Math.min(MAX_BATCH_SIZE, Math.ceil(stringsArray.length / numBatches));
    
    spinner.start(`Translating ${stringsToTranslate.size} unique strings in ${numBatches} batches using ${translator.name}...`);

    let translatedCount = 0;
    for (let i = 0; i < numBatches; i++) {
      const batchStart = i * MAX_BATCH_SIZE;
      const batchEnd = Math.min(batchStart + MAX_BATCH_SIZE, stringsArray.length);
      const batchStrings = stringsArray.slice(batchStart, batchEnd);

      spinner.text = `Translating batch ${i + 1}/${numBatches} (${batchStrings.length} strings)...`;
      
      const batchStartTime = performance.now();
      const batchTranslations = await translateBatch(batchStrings, lang, translator, sourceLang, preserveFormats);
      stats.batchTimes.push(performance.now() - batchStartTime);
      
      batchTranslations.forEach((translated, original) => {
        const hash = hashString(original);
        globalTranslations.set(hash, translated);
        translatedCount++;
      });

      spinner.info(`Batch ${i + 1}/${numBatches} completed in ${stats.batchTimes[stats.batchTimes.length - 1].toFixed(2)}ms.`);
    }

    stats.totalTranslationTime = performance.now() - t.last; t.last = performance.now();
    spinner.succeed(`Translation complete. ${translatedCount} strings translated in ${stats.batchCount} API calls.`);
  } else {
    spinner.succeed('All translations found in cache. No API calls needed.');
  }

  // Calculate saved API calls
  if (stats.totalFiles > 1 && stats.deduplicationSavings > 0) {
    // Without deduplication, we would need more API calls
    const callsWithoutDedup = Math.ceil(stats.totalStrings / MAX_BATCH_SIZE);
    const actualCalls = stats.batchCount;
    stats.savedApiCalls = Math.max(0, callsWithoutDedup - actualCalls);
  }

  // 5. UPDATE CACHE WITH NEW TRANSLATIONS
  if (useCache && stringsToTranslate.size > 0) {
    // Update cache for all files that contain the newly translated strings
    for (const [str, files] of globalStringMap) {
      const hash = hashString(str);
      if (globalTranslations.has(hash)) {
        const translation = globalTranslations.get(hash)!;
        for (const file of files) {
          if (!translationCache[file]) translationCache[file] = {};
          if (!translationCache[file][lang]) translationCache[file][lang] = {};
          translationCache[file][lang][hash] = translation;
        }
      }
    }
    
    await saveCache(translationCache, resolvedCacheFile);
    spinner.info(`Cache updated.`);
  }

  // 6. REBUILD AND WRITE OUTPUT FILES
  spinner.start('Creating translated files...');
  let filesWritten = 0;

  for (const [filePath, fileData] of fileDataMap) {
    // Start with a deep copy of the original to preserve all keys
    let translatedJson = JSON.parse(JSON.stringify(fileData.json)) as JsonObject;
    
    const PATH_SEPARATOR = '\x00';
    const DOT_ESCAPE = '\x01';
    
    // Apply translations by updating the values in place
    function applyTranslations(obj: any, path: string[] = []): void {
      if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            applyTranslations(obj[key], [...path, key]);
          }
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          applyTranslations(item, [...path, `[${index}]`]);
        });
      } else if (typeof obj === 'string') {
        // Build the flattened path
        const flatPath = path.map(p => p.replace(/\./g, DOT_ESCAPE)).join(PATH_SEPARATOR);
        if (fileData.paths.has(flatPath)) {
          const sourceString = fileData.paths.get(flatPath)!;
          const hash = hashString(sourceString);
          const translatedString = globalTranslations.get(hash);
          if (translatedString) {
            // Update the value in the parent object
            const parentPath = path.slice(0, -1);
            const lastKey = path[path.length - 1];
            let parent: any = translatedJson;
            for (const p of parentPath) {
              if (p.startsWith('[') && p.endsWith(']')) {
                parent = parent[parseInt(p.slice(1, -1))];
              } else {
                parent = parent[p];
              }
            }
            if (lastKey.startsWith('[') && lastKey.endsWith(']')) {
              parent[parseInt(lastKey.slice(1, -1))] = translatedString;
            } else {
              parent[lastKey] = translatedString;
            }
          }
        }
      }
    }
    
    applyTranslations(translatedJson);
    
    // Apply sorting if requested
    if (sortKeys) {
      translatedJson = sortObjectKeys(translatedJson) as JsonObject;
    }
    
    // Add metadata using _comment convention
    let outputJson = translatedJson;
    if (includeMetadata) {
      outputJson = {
        "_translator_metadata": {
          "tool": "translator-ai v1.1.0",
          "repository": "https://github.com/DatanoiseTV/translator-ai",
          "provider": translator.name,
          "source_language": detectSource ? sourceLang : "English",
          "target_language": lang,
          "timestamp": new Date().toISOString(),
          "total_strings": fileData.paths.size,
          "source_file": path.basename(filePath)
        },
        ...translatedJson
      };
    }
    
    const outputString = JSON.stringify(outputJson, null, 2);

    if (stdout) {
      console.log(`\n=== ${path.basename(filePath)} ===`);
      console.log(outputString);
    } else {
      const outputDir = path.dirname(fileData.outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(fileData.outputPath, outputString, 'utf-8');
      filesWritten++;
    }
  }

  stats.rebuildTime = performance.now() - t.last; t.last = performance.now();
  stats.fileWriteTime = performance.now() - t.last;

  if (!stdout) {
    spinner.succeed(`Created ${filesWritten} translated file(s).`);
  }

  // 7. KEY CHECKING
  if (checkKeys && !stdout) {
    spinner.start('Verifying keys...');
    let allValid = true;
    const failedFiles: string[] = [];
    
    for (const [filePath, fileData] of fileDataMap) {
      const sourceJson = fileData.json;
      
      // Read the output file to check
      const outputContent = await fs.readFile(fileData.outputPath, 'utf-8');
      const outputJson = JSON.parse(outputContent);
      
      const comparison = compareKeys(sourceJson, outputJson);
      
      if (!comparison.isValid) {
        allValid = false;
        failedFiles.push(filePath);
        
        console.error(`\n${path.basename(filePath)}: Missing keys (${comparison.missingKeys.size}):`);
        for (const key of comparison.missingKeys) {
          console.error(`  - ${key}`);
        }
        
        if (comparison.extraKeys.size > 0) {
          console.error(`  Extra keys (${comparison.extraKeys.size}):`);
          for (const key of comparison.extraKeys) {
            console.error(`  + ${key}`);
          }
        }
      }
    }
    
    if (!allValid) {
      spinner.fail(`Key verification failed for ${failedFiles.length} file(s)!`);
      process.exit(1);
    } else {
      spinner.succeed(`Key verification passed: all files have correct keys.`);
    }
  }

  // 8. SHOW STATISTICS
  if (showStats && !stdout) {
    stats.totalTime = performance.now() - t.start;
    printStats(stats, spinner, useCache);
  }
}

// --- MAIN CLI LOGIC ---
async function main() {
  const program = new Command();
  
  // Check if --list-providers is in args before setting up the full parser
  if (process.argv.includes('--list-providers')) {
    console.log('Checking available translation providers...\n');
    const providers = await TranslatorFactory.listAvailableProviders();
    if (providers.length > 0) {
      console.log('Available providers:');
      providers.forEach(p => console.log(`  - ${p}`));
    } else {
      console.log('No translation providers available.');
      console.log('\nTo use Gemini: Set GEMINI_API_KEY environment variable');
      console.log('To use Ollama: Install and run Ollama, then: ollama pull deepseek-r1:latest');
    }
    process.exit(0);
  }
  
  program
    .version('1.1.0')
    .description('Translate JSON i18n files efficiently with caching and deduplication.')
    .argument('<inputFiles...>', 'Path(s) to source JSON file(s) or glob patterns')
    .requiredOption('-l, --lang <langCodes>', 'Target language code(s), comma-separated for multiple')
    .option('-o, --output <pattern>', 'Output file path or pattern. Use {dir}, {name}, {lang} for multiple files')
    .option('--stdout', 'Output to stdout instead of files')
    .option('--stats', 'Show detailed statistics')
    .option('--no-cache', 'Disable translation cache')
    .option('--cache-file <path>', 'Custom cache file path', getDefaultCacheFilePath())
    .option('--provider <type>', 'Translation provider: gemini, ollama, or openai', 'gemini')
    .option('--ollama-url <url>', 'Ollama API URL', 'http://localhost:11434')
    .option('--ollama-model <model>', 'Ollama model name', 'deepseek-r1:latest')
    .option('--list-providers', 'List available translation providers')
    .option('--verbose', 'Enable verbose output for debugging')
    .option('--detect-source', 'Auto-detect source language instead of assuming English')
    .option('--dry-run', 'Preview what would be translated without making API calls')
    .option('--preserve-formats', 'Preserve URLs, emails, numbers, dates, and other formats')
    .option('--metadata', 'Add translation metadata to output files (may break some i18n parsers)')
    .option('--sort-keys', 'Sort output JSON keys alphabetically')
    .option('--check-keys', 'Verify all source keys exist in output (exit with error if keys are missing)')
    .option('--gemini-model <model>', 'Gemini model to use', 'gemini-2.0-flash-lite')
    .option('--openai-model <model>', 'OpenAI model to use', 'gpt-4o-mini')
    .parse(process.argv);

  const inputFiles = program.args;
  const { 
    lang, output, stdout, stats: showStats, cache, cacheFile,
    provider, ollamaUrl, ollamaModel, geminiModel, openaiModel, detectSource, dryRun, verbose, preserveFormats: shouldPreserveFormats,
    metadata, sortKeys, checkKeys
  } = program.opts();

  if (!output && !stdout) {
    program.error('Error: Specify either -o <pattern> or --stdout');
  }
  if (output && stdout) {
    program.error('Error: Cannot use both -o and --stdout');
  }
  
  // Enable verbose mode if requested
  if (verbose) {
    process.env.OLLAMA_VERBOSE = 'true';
  }

  // Parse target languages
  const targetLanguages = lang.split(',').map((l: string) => l.trim()).filter((l: string) => l);
  if (targetLanguages.length === 0) {
    program.error('Error: No valid target languages specified');
  }

  // Create translator
  let translator: TranslationProvider;
  try {
    translator = await TranslatorFactory.create({
      type: provider as TranslatorType,
      ollamaBaseUrl: ollamaUrl,
      ollamaModel: ollamaModel,
      geminiModel: geminiModel,
      openaiModel: openaiModel,
    });
    console.log(`Using translation provider: ${translator.name}\n`);
  } catch (error) {
    console.error(`Error initializing translator: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }

  // Determine if we're processing single or multiple files
  const isSingleFile = inputFiles.length === 1 && 
                      !inputFiles[0].includes('*') && 
                      !inputFiles[0].includes('?') && 
                      !inputFiles[0].includes('[');

  try {
    // Process each target language
    for (const targetLang of targetLanguages) {
      if (targetLanguages.length > 1) {
        console.log(`\n=== Processing language: ${targetLang} ===\n`);
      }
      
      if (isSingleFile) {
        await processSingleFile(inputFiles[0], targetLang, output, stdout, showStats, cache, cacheFile, translator, detectSource, dryRun, shouldPreserveFormats, metadata, sortKeys, checkKeys);
      } else {
        await processMultipleFiles(inputFiles, targetLang, output, stdout, showStats, cache, cacheFile, translator, detectSource, dryRun, shouldPreserveFormats, metadata, sortKeys, checkKeys);
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\nAn unexpected error occurred: ${errorMessage}`);
    process.exit(1);
  }
}

main().catch(error => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`\nAn unexpected error occurred: ${errorMessage}`);
  process.exit(1);
});