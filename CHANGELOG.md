# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2025-01-20

### Added
- **Ollama Support**: Added support for local translation using Ollama with DeepSeek-R1
  - New `--provider` flag to choose between 'gemini' or 'ollama'
  - `--ollama-url` to specify custom Ollama API endpoint
  - `--ollama-model` to use different Ollama models
  - `--list-providers` command to check available providers
  - Optimized prompts and parameters for DeepSeek-R1 format
  - Handles both JSON array and object responses from Ollama
  - No API costs - runs entirely on local hardware

- **Model Context Protocol (MCP)**: Added MCP server for Claude Desktop integration
  - New `translator-gemini-mcp` binary for MCP server
  - Supports both Gemini and Ollama providers via environment variable
  - Enables direct file translation within Claude conversations

### Changed
- Abstracted translation logic into provider-based architecture
- Updated CLI to support multiple translation backends
- Enhanced error handling for different response formats

### Fixed
- Improved JSON extraction from various LLM response formats
- Better handling of thinking tags in DeepSeek responses

## [1.0.4] - 2025-01-20

### Added
- **Multi-file Processing**: Process multiple files with automatic deduplication
  - Accepts multiple input files and glob patterns
  - Identifies duplicate strings across files
  - Translates each unique string only once
  - Shows deduplication statistics and API call savings
  - Example: 23% savings when processing 4 files with shared strings

### Changed
- CLI now accepts variadic arguments for multiple files
- Output pattern supports `{dir}`, `{name}`, and `{lang}` variables

## [1.0.3] - 2025-01-20

### Fixed
- Critical bug with JSON keys containing dots (e.g., "auth.login")
- Implemented proper key escaping using null bytes as separators
- Fixed issue with society-flow test case

## [1.0.2] - 2025-01-20

### Fixed
- npm repository URL warnings
- Package metadata improvements

## [1.0.1] - 2025-01-20

### Added
- GitHub Actions workflow for automated npm publishing
- Cross-platform cache directory support
  - Windows: `%APPDATA%\translator-gemini\`
  - macOS: `~/Library/Caches/translator-gemini/`
  - Linux: `~/.cache/translator-gemini/`

### Fixed
- Build issues with postbuild script
- TypeScript configuration

## [1.0.0] - 2025-01-20

### Initial Release
- Fast translation using Google's Gemini 2.0 Flash Lite model
- Incremental caching system with SHA-256 hashing
- Batch processing with dynamic sizing
- Path preservation for complex JSON structures
- Global npm installation support
- Comprehensive CLI with multiple options
- Performance statistics and progress indicators