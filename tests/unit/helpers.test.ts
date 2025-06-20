import { hashString, getCacheDirectory, getDefaultCacheFilePath, flattenObjectWithPaths, unflattenObject } from '../../src/helpers';
import path from 'path';
import os from 'os';

describe('Helper Functions', () => {
  describe('hashString', () => {
    it('should generate consistent hash for the same string', () => {
      const text = 'Hello World';
      const hash1 = hashString(text);
      const hash2 = hashString(text);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different strings', () => {
      const hash1 = hashString('Hello World');
      const hash2 = hashString('Hello World!');
      expect(hash1).not.toBe(hash2);
    });

    it('should return a 64-character hex string', () => {
      const hash = hashString('test');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('getCacheDirectory', () => {
    const originalPlatform = process.platform;
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
      process.env = originalEnv;
    });

    it('should return Windows cache directory on win32', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      });
      process.env.APPDATA = 'C:\\Users\\Test\\AppData\\Roaming';
      
      const cacheDir = getCacheDirectory();
      expect(cacheDir).toBe(path.join('C:\\Users\\Test\\AppData\\Roaming', 'translator-gemini'));
    });

    it('should return macOS cache directory on darwin', () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });
      
      const homeDir = os.homedir();
      const cacheDir = getCacheDirectory();
      expect(cacheDir).toBe(path.join(homeDir, 'Library', 'Caches', 'translator-gemini'));
    });

    it('should return Linux cache directory on linux', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });
      delete process.env.XDG_CACHE_HOME;
      
      const homeDir = os.homedir();
      const cacheDir = getCacheDirectory();
      expect(cacheDir).toBe(path.join(homeDir, '.cache', 'translator-gemini'));
    });

    it('should use XDG_CACHE_HOME on Linux if set', () => {
      Object.defineProperty(process, 'platform', {
        value: 'linux'
      });
      process.env.XDG_CACHE_HOME = '/custom/cache';
      
      const cacheDir = getCacheDirectory();
      expect(cacheDir).toBe(path.join('/custom/cache', 'translator-gemini'));
    });
  });

  describe('getDefaultCacheFilePath', () => {
    it('should return cache file path in cache directory', () => {
      const cacheFilePath = getDefaultCacheFilePath();
      expect(cacheFilePath).toContain('translator-gemini');
      expect(cacheFilePath).toContain('translation-cache.json');
    });
  });

  describe('flattenObjectWithPaths', () => {
    it('should flatten simple object', () => {
      const obj = { hello: 'world', foo: 'bar' };
      const result = flattenObjectWithPaths(obj);
      
      expect(result.get('hello')).toBe('world');
      expect(result.get('foo')).toBe('bar');
      expect(result.size).toBe(2);
    });

    it('should flatten nested object', () => {
      const obj = {
        user: {
          name: 'John',
          address: {
            city: 'New York'
          }
        }
      };
      const result = flattenObjectWithPaths(obj);
      
      expect(result.get('user.name')).toBe('John');
      expect(result.get('user.address.city')).toBe('New York');
      expect(result.size).toBe(2);
    });

    it('should flatten arrays', () => {
      const obj = {
        items: ['apple', 'banana', 'cherry']
      };
      const result = flattenObjectWithPaths(obj);
      
      expect(result.get('items[0]')).toBe('apple');
      expect(result.get('items[1]')).toBe('banana');
      expect(result.get('items[2]')).toBe('cherry');
      expect(result.size).toBe(3);
    });

    it('should ignore non-string values', () => {
      const obj = {
        text: 'hello',
        number: 123,
        boolean: true,
        null: null
      };
      const result = flattenObjectWithPaths(obj);
      
      expect(result.get('text')).toBe('hello');
      expect(result.size).toBe(1);
    });

    it('should ignore template strings', () => {
      const obj = {
        normal: 'hello',
        template: '{{variable}}'
      };
      const result = flattenObjectWithPaths(obj);
      
      expect(result.get('normal')).toBe('hello');
      expect(result.has('template')).toBe(false);
      expect(result.size).toBe(1);
    });

    it('should ignore strings without letters', () => {
      const obj = {
        text: 'hello',
        numbers: '123',
        symbols: '!@#$'
      };
      const result = flattenObjectWithPaths(obj);
      
      expect(result.get('text')).toBe('hello');
      expect(result.size).toBe(1);
    });
  });

  describe('unflattenObject', () => {
    it('should unflatten simple paths', () => {
      const flatMap = new Map([
        ['hello', 'world'],
        ['foo', 'bar']
      ]);
      const result = unflattenObject(flatMap);
      
      expect(result).toEqual({
        hello: 'world',
        foo: 'bar'
      });
    });

    it('should unflatten nested paths', () => {
      const flatMap = new Map([
        ['user.name', 'John'],
        ['user.address.city', 'New York']
      ]);
      const result = unflattenObject(flatMap);
      
      expect(result).toEqual({
        user: {
          name: 'John',
          address: {
            city: 'New York'
          }
        }
      });
    });

    it('should unflatten array paths', () => {
      const flatMap = new Map([
        ['items[0]', 'apple'],
        ['items[1]', 'banana'],
        ['items[2]', 'cherry']
      ]);
      const result = unflattenObject(flatMap);
      
      expect(result).toEqual({
        items: ['apple', 'banana', 'cherry']
      });
    });

    it('should handle mixed nested structures', () => {
      const flatMap = new Map([
        ['user.name', 'John'],
        ['user.tags[0]', 'admin'],
        ['user.tags[1]', 'developer'],
        ['settings.theme', 'dark']
      ]);
      const result = unflattenObject(flatMap);
      
      expect(result).toEqual({
        user: {
          name: 'John',
          tags: ['admin', 'developer']
        },
        settings: {
          theme: 'dark'
        }
      });
    });
  });

  describe('flatten and unflatten integration', () => {
    it('should preserve structure when flattening and unflattening', () => {
      const original = {
        app: {
          title: 'My App',
          version: '1.0.0',
          features: ['login', 'dashboard', 'settings']
        },
        messages: {
          welcome: 'Welcome to our app',
          errors: {
            notFound: 'Page not found',
            serverError: 'Server error occurred'
          }
        }
      };

      const flattened = flattenObjectWithPaths(original);
      const unflattened = unflattenObject(flattened);

      // Check that all the string values are preserved
      const result = unflattened as any;
      expect(result.app?.title).toBe('My App');
      expect(Array.isArray(result.app?.features)).toBe(true);
      expect(result.app?.features).toContain('login');
      expect(result.app?.features).toContain('dashboard');
      expect(result.app?.features).toContain('settings');
      expect(result.messages?.welcome).toBe('Welcome to our app');
      expect(result.messages?.errors?.notFound).toBe('Page not found');
      expect(result.messages?.errors?.serverError).toBe('Server error occurred');
    });
  });
});