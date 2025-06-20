import { createHash } from 'crypto';
import path from 'path';
import os from 'os';

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject { [key:string]: JsonValue; }
export interface JsonArray extends Array<JsonValue> {}

export const hashString = (text: string): string => createHash('sha256').update(text).digest('hex');

export function getCacheDirectory(): string {
  const platform = process.platform;
  const homeDir = os.homedir();
  
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'translator-ai');
  } else if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Caches', 'translator-ai');
  } else {
    return path.join(process.env.XDG_CACHE_HOME || path.join(homeDir, '.cache'), 'translator-ai');
  }
}

export function getDefaultCacheFilePath(): string {
  return path.join(getCacheDirectory(), 'translation-cache.json');
}

// Use a unique separator that won't appear in normal keys
const PATH_SEPARATOR = '\x00';
const DOT_ESCAPE = '\x01';

export function flattenObjectWithPaths(obj: JsonValue, currentPath: string = '', result: Map<string, string> = new Map()): Map<string, string> {
  if (typeof obj === 'string') {
    if (/[a-zA-Z]/.test(obj) && !/^{{.*}}$/.test(obj)) {
      result.set(currentPath, obj);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const newPath = currentPath ? `${currentPath}${PATH_SEPARATOR}[${index}]` : `[${index}]`;
      flattenObjectWithPaths(item, newPath, result);
    });
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if(Object.prototype.hasOwnProperty.call(obj, key)) {
        // Escape dots in the key to preserve them
        const escapedKey = key.replace(/\./g, DOT_ESCAPE);
        const newPath = currentPath ? `${currentPath}${PATH_SEPARATOR}${escapedKey}` : escapedKey;
        flattenObjectWithPaths(obj[key], newPath, result);
      }
    }
  }
  return result;
}

export function unflattenObject(flatMap: Map<string, string>): JsonObject {
  const result: JsonObject = {};
  
  for (const [path, value] of flatMap.entries()) {
    const parts = path.split(PATH_SEPARATOR);
    
    let current: any = result;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      
      if (part.startsWith('[') && part.endsWith(']')) {
        // Array index
        const index = parseInt(part.slice(1, -1));
        if (isLast) {
          current[index] = value;
        } else {
          if (!current[index]) {
            // Look ahead to determine if next is array or object
            const nextPart = parts[i + 1];
            current[index] = nextPart.startsWith('[') ? [] : {};
          }
          current = current[index];
        }
      } else {
        // Regular key - unescape dots
        const key = part.replace(new RegExp(DOT_ESCAPE, 'g'), '.');
        if (isLast) {
          current[key] = value;
        } else {
          if (!current[key]) {
            // Look ahead to determine if next is array or object
            const nextPart = parts[i + 1];
            current[key] = nextPart.startsWith('[') ? [] : {};
          }
          current = current[key];
        }
      }
    }
  }
  
  return result;
}

// Format preservation helpers
export interface PreservedFormat {
  original: string;
  processed: string;
  preservedParts: Array<{
    marker: string;
    value: string;
    start: number;
    end: number;
  }>;
}

export function preserveFormats(text: string): PreservedFormat {
  const preservedParts: PreservedFormat['preservedParts'] = [];
  let processed = text;
  let markerIndex = 0;
  
  // Patterns to preserve (order matters - most specific first)
  const patterns = [
    // URLs (http/https)
    { regex: /https?:\/\/[^\s<>"{}|\\^\[\]`]+/gi, type: 'url' },
    // Email addresses
    { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, type: 'email' },
    // Template variables (various formats)
    { regex: /\{\{[^}]+\}\}/g, type: 'template' }, // {{variable}}
    { regex: /\{[0-9]+\}/g, type: 'placeholder' }, // {0}, {1}
    { regex: /%[sdfbxo]/g, type: 'format' }, // %s, %d, etc.
    { regex: /\$\{[^}]+\}/g, type: 'template' }, // ${variable}
    { regex: /:[a-zA-Z_][a-zA-Z0-9_]*/g, type: 'named' }, // :param
    // Numbers with units
    { regex: /\b\d+(?:\.\d+)?(?:\s*(?:px|em|rem|%|pt|vh|vw|ms|s|kg|g|m|km|mi|GB|MB|KB))\b/gi, type: 'unit' },
    // Currency
    { regex: /[$€£¥₹]\s*\d+(?:,\d{3})*(?:\.\d{2})?/g, type: 'currency' },
    { regex: /\d+(?:,\d{3})*(?:\.\d{2})?\s*[$€£¥₹]/g, type: 'currency' },
    // ISO dates
    { regex: /\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)?/g, type: 'date' },
    // Version numbers
    { regex: /\bv?\d+\.\d+(?:\.\d+)*(?:-[a-zA-Z0-9.-]+)?/g, type: 'version' },
    // Hex colors
    { regex: /#[0-9a-fA-F]{3,8}\b/g, type: 'color' },
    // File paths (basic)
    { regex: /(?:\/[a-zA-Z0-9._-]+)+(?:\.[a-zA-Z0-9]+)?/g, type: 'path' },
    // Windows paths
    { regex: /[A-Z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*/gi, type: 'path' },
  ];
  
  // Extract and replace each pattern
  for (const { regex, type } of patterns) {
    processed = processed.replace(regex, (match, offset) => {
      const marker = `__PRESERVE_${type.toUpperCase()}_${markerIndex}__`;
      preservedParts.push({
        marker,
        value: match,
        start: offset,
        end: offset + match.length
      });
      markerIndex++;
      return marker;
    });
  }
  
  return {
    original: text,
    processed,
    preservedParts
  };
}

export function restoreFormats(text: string, preservedFormat: PreservedFormat): string {
  let restored = text;
  
  // Restore in reverse order to maintain correct positions
  for (const part of preservedFormat.preservedParts) {
    restored = restored.replace(part.marker, part.value);
  }
  
  return restored;
}