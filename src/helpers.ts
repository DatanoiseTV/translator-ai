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
    return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'translator-gemini');
  } else if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Caches', 'translator-gemini');
  } else {
    return path.join(process.env.XDG_CACHE_HOME || path.join(homeDir, '.cache'), 'translator-gemini');
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