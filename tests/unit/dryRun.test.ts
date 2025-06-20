import { Command } from 'commander';

describe('Dry Run Mode', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program
      .version('1.0.9')
      .description('Test CLI')
      .argument('<inputFiles...>', 'Input files')
      .requiredOption('-l, --lang <langCode>', 'Target language')
      .option('-o, --output <file>', 'Output file')
      .option('--dry-run', 'Preview without API calls')
      .option('--detect-source', 'Auto-detect source language')
      .option('--preserve-formats', 'Preserve special formats')
      .exitOverride();
  });

  it('should parse dry-run flag', () => {
    const argv = ['node', 'test', 'file.json', '-l', 'es', '-o', 'out.json', '--dry-run'];
    program.parse(argv);
    const opts = program.opts();
    
    expect(opts.dryRun).toBe(true);
  });

  it('should work with other flags', () => {
    const argv = [
      'node', 'test', 'file.json', 
      '-l', 'es', 
      '-o', 'out.json', 
      '--dry-run',
      '--detect-source',
      '--preserve-formats'
    ];
    program.parse(argv);
    const opts = program.opts();
    
    expect(opts.dryRun).toBe(true);
    expect(opts.detectSource).toBe(true);
    expect(opts.preserveFormats).toBe(true);
  });

  it('should default to false when not specified', () => {
    const argv = ['node', 'test', 'file.json', '-l', 'es', '-o', 'out.json'];
    program.parse(argv);
    const opts = program.opts();
    
    expect(opts.dryRun).toBeFalsy();
  });
});