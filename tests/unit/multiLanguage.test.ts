import { Command } from 'commander';

describe('Multiple Language Support', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    program
      .version('1.0.9')
      .description('Test CLI')
      .argument('<inputFiles...>', 'Input files')
      .requiredOption('-l, --lang <langCodes>', 'Target language code(s)')
      .option('-o, --output <pattern>', 'Output pattern')
      .exitOverride(); // Prevent process.exit during tests
  });

  it('should parse single language', () => {
    const argv = ['node', 'test', 'file.json', '-l', 'es', '-o', 'output.json'];
    program.parse(argv);
    const opts = program.opts();
    
    expect(opts.lang).toBe('es');
  });

  it('should parse multiple languages', () => {
    const argv = ['node', 'test', 'file.json', '-l', 'es,fr,de', '-o', 'output-{lang}.json'];
    program.parse(argv);
    const opts = program.opts();
    
    expect(opts.lang).toBe('es,fr,de');
    
    // Simulate language parsing
    const languages = opts.lang.split(',').map((l: string) => l.trim());
    expect(languages).toEqual(['es', 'fr', 'de']);
  });

  it('should handle spaces in language list', () => {
    const argv = ['node', 'test', 'file.json', '-l', 'es, fr, de', '-o', 'output.json'];
    program.parse(argv);
    const opts = program.opts();
    
    const languages = opts.lang.split(',').map((l: string) => l.trim());
    expect(languages).toEqual(['es', 'fr', 'de']);
  });

  it('should support {lang} variable in output pattern', () => {
    const pattern = 'translations/{lang}/app.json';
    const lang = 'es';
    const result = pattern.replace(/\{lang\}/g, lang);
    
    expect(result).toBe('translations/es/app.json');
  });

  it('should replace multiple {lang} occurrences', () => {
    const pattern = '{lang}/messages-{lang}.json';
    const lang = 'fr';
    const result = pattern.replace(/\{lang\}/g, lang);
    
    expect(result).toBe('fr/messages-fr.json');
  });
});