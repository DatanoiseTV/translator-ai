# translator-gemini

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat-square&logo=buy-me-a-coffee)](https://coff.ee/datanoisetv)

Fast and efficient JSON i18n translator powered by Google Gemini API with incremental caching support.

## Features

- **Fast Translation**: Leverages Google's Gemini 2.0 Flash Lite model for quick translations
- **Incremental Caching**: Only translates new or modified strings, dramatically reducing API calls
- **Batch Processing**: Intelligently batches translations for optimal performance
- **Path Preservation**: Maintains exact JSON structure including nested objects and arrays
- **Cross-Platform**: Works on Windows, macOS, and Linux with automatic cache directory detection
- **Developer Friendly**: Built-in performance statistics and progress indicators
- **Cost Effective**: Minimizes API usage through smart caching and diff detection

## Installation

### Global Installation (Recommended)

```bash
npm install -g translator-gemini
```

### Local Installation

```bash
npm install translator-gemini
```

## Configuration

Create a `.env` file in your project root or set the environment variable:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

## Usage

### Basic Usage

```bash
translator-gemini source.json -l es -o spanish.json
```

### Command Line Options

```
translator-gemini <inputFile> [options]

Arguments:
  inputFile                    Path to the source English JSON file

Options:
  -l, --lang <langCode>       Target language code (required)
  -o, --output <outputFile>   Output file path
  --stdout                    Output to stdout instead of file
  --stats                     Show detailed performance statistics
  --no-cache                  Disable incremental translation cache
  --cache-file <path>         Custom cache file path
  -h, --help                  Display help
  -V, --version              Display version
```

### Examples

#### Translate to Spanish
```bash
translator-gemini en.json -l es -o es.json
```

#### Translate to French with statistics
```bash
translator-gemini en.json -l fr -o fr.json --stats
```

#### Output to stdout (useful for piping)
```bash
translator-gemini en.json -l de --stdout > de.json
```

### Parsed output with jq
```bash
translator-gemini en.json -l de --stdout | jq
```

#### Disable caching for fresh translation
```bash
translator-gemini en.json -l ja -o ja.json --no-cache
```

#### Use custom cache location
```bash
translator-gemini en.json -l ko -o ko.json --cache-file /path/to/cache.json
```

### Supported Language Codes

It should support any standardized language codes.

## How It Works

1. **Parsing**: Reads and flattens your JSON structure into paths
2. **Caching**: Checks cache for previously translated strings
3. **Diffing**: Identifies new or modified strings needing translation
4. **Batching**: Groups strings into optimal batch sizes for API efficiency
5. **Translation**: Sends batches to Gemini API for translation
6. **Reconstruction**: Rebuilds the exact JSON structure with translations
7. **Caching**: Updates cache with new translations for future use

## Cache Management

### Default Cache Locations

- **Windows**: `%APPDATA%\translator-gemini\translation-cache.json`
- **macOS**: `~/Library/Caches/translator-gemini/translation-cache.json`
- **Linux**: `~/.cache/translator-gemini/translation-cache.json`

The cache file stores translations indexed by:
- Source file path
- Target language
- SHA-256 hash of source string

This ensures that:
- Modified strings are retranslated
- Removed strings are pruned from cache
- Multiple projects can share the same cache without conflicts

## Performance Tips

1. **Use caching** (enabled by default) to minimize API calls
2. **Batch multiple files** in the same session to leverage warm cache
3. **Use `--stats` flag** to monitor performance and optimization opportunities
4. **Keep source files consistent** to maximize cache hits

## API Limits and Costs

- Uses Gemini 2.0 Flash Lite model for optimal speed and cost
- Chooses best batch size dynamically depending on input key count
- Batches up to 100 strings per API call
- Check [Google's pricing](https://ai.google.dev/pricing) for current rates

## Development

### Building from source

```bash
git clone https://github.com/DatanoiseTV/translator-gemini.git
cd translator-gemini
npm install
npm run build
```

### Testing locally

```bash
npm start -- test.json -l es -o output.json
```

## License

This project requires attribution for both commercial and non-commercial use. See [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues, questions, or suggestions, please open an issue on [GitHub](https://github.com/DatanoiseTV/translator-gemini/issues).

If you find this tool useful, consider supporting the development:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-yellow?style=flat-square&logo=buy-me-a-coffee)](https://coff.ee/datanoisetv)