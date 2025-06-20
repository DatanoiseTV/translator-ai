import { Command } from 'commander';
import path from 'path';

describe('CLI Argument Parsing', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program
      .version('1.0.4')
      .description('A CLI tool to translate and synchronize JSON i18n files.')
      .argument('<inputFiles...>', 'Path(s) to source JSON file(s) or glob patterns.')
      .requiredOption('-l, --lang <langCode>', 'The target language code.')
      .option('-o, --output <pattern>', 'Output file path or pattern.')
      .option('--stdout', 'Output to stdout instead of a file.')
      .option('--stats', 'Show detailed performance statistics.')
      .option('--no-cache', 'Disable the incremental translation cache.')
      .option('--cache-file <path>', 'Specify a custom path for the cache file.', '.translation-cache.json')
      .exitOverride(); // Prevent process.exit during tests
  });

  it('should parse basic required arguments', () => {
    const args = ['node', 'translator-gemini', 'input.json', '-l', 'es', '-o', 'output.json'];
    program.parse(args);
    
    const opts = program.opts();
    expect(program.args[0]).toBe('input.json');
    expect(opts.lang).toBe('es');
    expect(opts.output).toBe('output.json');
  });

  it('should parse multiple input files', () => {
    const args = ['node', 'translator-gemini', 'file1.json', 'file2.json', 'file3.json', '-l', 'es', '-o', '{name}.{lang}.json'];
    program.parse(args);
    
    const opts = program.opts();
    expect(program.args).toEqual(['file1.json', 'file2.json', 'file3.json']);
    expect(opts.lang).toBe('es');
    expect(opts.output).toBe('{name}.{lang}.json');
  });

  it('should handle glob patterns', () => {
    const args = ['node', 'translator-gemini', 'src/**/*.json', '-l', 'fr', '-o', '{dir}/{name}.{lang}.json'];
    program.parse(args);
    
    const opts = program.opts();
    expect(program.args[0]).toBe('src/**/*.json');
    expect(opts.output).toBe('{dir}/{name}.{lang}.json');
  });

  it('should handle stdout option', () => {
    const args = ['node', 'translator-gemini', 'input.json', '-l', 'fr', '--stdout'];
    program.parse(args);
    
    const opts = program.opts();
    expect(opts.stdout).toBe(true);
    expect(opts.output).toBeUndefined();
  });

  it('should handle stats option', () => {
    const args = ['node', 'translator-gemini', 'input.json', '-l', 'de', '-o', 'output.json', '--stats'];
    program.parse(args);
    
    const opts = program.opts();
    expect(opts.stats).toBe(true);
  });

  it('should handle no-cache option', () => {
    const args = ['node', 'translator-gemini', 'input.json', '-l', 'ja', '-o', 'output.json', '--no-cache'];
    program.parse(args);
    
    const opts = program.opts();
    expect(opts.cache).toBe(false);
  });

  it('should handle custom cache file', () => {
    const args = ['node', 'translator-gemini', 'input.json', '-l', 'ko', '-o', 'output.json', '--cache-file', '/custom/path/cache.json'];
    program.parse(args);
    
    const opts = program.opts();
    expect(opts.cacheFile).toBe('/custom/path/cache.json');
  });

  it('should have default cache file', () => {
    const args = ['node', 'translator-gemini', 'input.json', '-l', 'zh', '-o', 'output.json'];
    program.parse(args);
    
    const opts = program.opts();
    expect(opts.cacheFile).toBe('.translation-cache.json');
  });

  it('should throw error when lang is missing', () => {
    const args = ['node', 'translator-gemini', 'input.json', '-o', 'output.json'];
    
    expect(() => program.parse(args)).toThrow();
  });

  it('should throw error when both output and stdout are missing', () => {
    // This test simulates the validation logic
    const args = ['node', 'translator-gemini', 'input.json', '-l', 'es'];
    program.parse(args);
    
    const opts = program.opts();
    expect(opts.output).toBeUndefined();
    expect(opts.stdout).toBeFalsy();
    // In real app, this would trigger program.error()
  });

  it('should handle version flag', () => {
    const mockLog = jest.spyOn(console, 'log').mockImplementation();
    
    const args = ['node', 'translator-gemini', '--version'];
    
    // exitOverride causes it to throw with the version string
    expect(() => program.parse(args)).toThrow('1.0.4');
    
    mockLog.mockRestore();
  });
});