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

export function flattenObjectWithPaths(obj: JsonValue, currentPath: string = '', result: Map<string, string> = new Map()): Map<string, string> {
  if (typeof obj === 'string') {
    if (/[a-zA-Z]/.test(obj) && !/^{{.*}}$/.test(obj)) {
      result.set(currentPath, obj);
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => flattenObjectWithPaths(item, `${currentPath}[${index}]`, result));
  } else if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      if(Object.prototype.hasOwnProperty.call(obj, key)) {
        flattenObjectWithPaths(obj[key], currentPath ? `${currentPath}.${key}` : key, result);
      }
    }
  }
  return result;
}

export function unflattenObject(flatMap: Map<string, string>): JsonObject {
  const result: JsonObject = {};
  for (const [path, value] of flatMap.entries()) {
    const keys = path.match(/[^.[\]]+/g) || [];
    keys.reduce((acc: any, key: string, index: number) => {
      if (index === keys.length - 1) {
        acc[key] = value;
      } else {
        const nextKeyIsNumeric = /^\d+$/.test(keys[index + 1]);
        if (!acc[key]) {
          acc[key] = nextKeyIsNumeric ? [] : {};
        }
      }
      return acc[key];
    }, result);
  }
  return result;
}