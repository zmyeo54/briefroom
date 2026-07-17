# Development Environment Setup

<cite>
**Referenced Files in This Document**
- [package.json](file://package.json)
- [vite.config.js](file://vite.config.js)
- [scripts/dev-api-server.mjs](file://scripts/dev-api-server.mjs)
- [scripts/deepseek_timeout_probe.mjs](file://scripts/deepseek_timeout_probe.mjs)
- [README.md](file://README.md)
- [index.html](file://index.html)
- [src/main.jsx](file://src/main.jsx)
- [api/chat.js](file://api/chat.js)
- [api/tts.js](file://api/tts.js)
- [api/fetch-url.js](file://api/fetch-url.js)
- [api/tts-health.js](file://api/tts-health.js)
- [lib/edgeTts.js](file://lib/edgeTts.js)
- [vercel.json](file://vercel.json)
- [public/llms.txt](file://public/llms.txt)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive documentation for the new DeepSeek timeout diagnostic tool 'deepseek_timeout_probe.mjs'
- Enhanced API development server documentation with improved logging and error handling capabilities
- Updated troubleshooting section with DeepSeek-specific debugging guidance
- Added performance monitoring recommendations for AI service integration
- Expanded environment variable documentation for timeout configuration and diagnostic tools

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Project Initialization](#project-initialization)
5. [Development Server Setup](#development-server-setup)
6. [API Development Server](#api-development-server)
7. [DeepSeek Timeout Diagnostic Tool](#deepseek-timeout-diagnostic-tool)
8. [LLM Discovery and Provider Configuration](#llm-discovery-and-provider-configuration)
9. [Configuration Files](#configuration-files)
10. [Environment Variables](#environment-variables)
11. [IDE Setup Recommendations](#ide-setup-recommendations)
12. [Hot Reloading and Development Workflow](#hot-reloading-and-development-workflow)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Performance Tips](#performance-tips)
15. [Conclusion](#conclusion)

## Introduction

LineCheck is a modern web application built with React and Vite, featuring real-time chat functionality, text-to-speech capabilities, and interview preparation tools. This development environment setup guide will help you establish a complete local development workflow for contributing to or extending the LineCheck project.

The project follows modern JavaScript development practices with a component-based architecture, modular API structure, and efficient build tooling powered by Vite. The development environment includes an enhanced custom API development server with improved error handling, new API endpoints, robust provider selection logic for external AI service integration, comprehensive LLM discovery capabilities through the llms.txt specification, and specialized diagnostic tools for monitoring AI service performance including DeepSeek timeout detection.

## Prerequisites

Before setting up the LineCheck development environment, ensure you have the following prerequisites installed:

### Node.js Requirements
- **Node.js**: Version 18.x or higher (LTS recommended)
- **npm**: Version 9.x or higher (comes bundled with Node.js)
- **Alternative package manager**: Yarn 1.22+ or pnpm 8.x+ (optional)

### System Requirements
- **Operating System**: Windows 10+, macOS 10.15+, or Linux distributions
- **Memory**: Minimum 4GB RAM (8GB recommended for optimal performance)
- **Storage**: At least 500MB free space for dependencies and build artifacts
- **Network**: Internet connection required for initial dependency installation and AI service testing

### Optional Tools
- **Git**: For version control and collaboration
- **Docker**: If you need containerized development environments
- **VS Code**: Recommended IDE with specific extensions (detailed below)
- **curl**: For API endpoint testing and diagnostics

**Section sources**
- [package.json:1-50](file://package.json#L1-L50)

## Installation

### Clone the Repository

```bash
git clone https://github.com/your-org/linecheck.git
cd linecheck
```

### Install Dependencies

Using npm (recommended):
```bash
npm install
```

Using Yarn:
```bash
yarn install
```

Using pnpm:
```bash
pnpm install
```

### Verify Installation

After installation, verify that all dependencies are correctly installed:
```bash
npm list --depth=0
```

This should display the core dependencies including React, Vite, and other project-specific packages.

**Section sources**
- [package.json:50-150](file://package.json#L50-L150)

## Project Initialization

### Initial Configuration

1. **Create Environment File**: Copy the example environment file if it exists:
   ```bash
   cp .env.example .env
   ```

2. **Configure API Endpoints**: Update your `.env` file with the appropriate API endpoints:
   - `VITE_API_BASE_URL`: Base URL for the backend API
   - `VITE_TTS_ENDPOINT`: Text-to-speech service endpoint
   - `VITE_CHAT_ENDPOINT`: Chat service endpoint
   - `DEEPSEEK_TIMEOUT_MS`: Timeout configuration for DeepSeek AI service (default: 30000)

3. **Initialize Local Database** (if applicable): Some features may require local database initialization scripts.

### Build Verification

Test the build process to ensure everything is configured correctly:
```bash
npm run build
```

This creates an optimized production build in the `dist/` directory.

**Section sources**
- [vite.config.js:1-100](file://vite.config.js#L1-L100)

## Development Server Setup

### Starting the Development Server

Start the main development server with hot reloading:
```bash
npm run dev
```

Or using yarn:
```bash
yarn dev
```

The development server typically runs on `http://localhost:5173` by default.

### Development Server Features

The Vite development server provides several powerful features:

- **Hot Module Replacement (HMR)**: Instant updates without full page reloads
- **Fast Refresh**: Component state preservation during updates
- **Source Maps**: Full debugging support with original source code
- **Error Overlay**: Detailed error information directly in the browser
- **Built-in Proxy**: Automatic proxy configuration for API requests

### Custom Port Configuration

To run the development server on a different port:
```bash
npm run dev -- --port 3000
```

Or configure it permanently in `vite.config.js`.

**Section sources**
- [vite.config.js:100-200](file://vite.config.js#L100-L200)
- [src/main.jsx:1-50](file://src/main.jsx#L1-L50)

## API Development Server

### Overview

LineCheck includes a custom API development server that provides mock data and simulated backend functionality for development purposes. This server is built using Node.js and provides RESTful endpoints for chat, text-to-speech, and other features. The server has been significantly enhanced with improved error handling, new API endpoints, robust provider selection logic for external AI service integration, and comprehensive logging capabilities for debugging AI service interactions.

### Starting the API Server

Run the API development server alongside the frontend:
```bash
node scripts/dev-api-server.mjs
```

The API server typically runs on `http://localhost:3001` by default.

### Enhanced API Endpoints

The development API server provides comprehensive endpoints with improved error handling and new functionality:

#### Chat API
- `POST /api/chat` - Send messages and receive AI responses with provider selection
- `GET /api/chat/history` - Retrieve conversation history
- `DELETE /api/chat/clear` - Clear conversation history

#### Text-to-Speech API
- `POST /api/tts` - Convert text to speech audio with provider options
- `GET /api/tts/health` - Check TTS service health status
- `GET /api/tts/status` - Get current TTS service status

#### Utility APIs
- `GET /api/fetch-url` - Fetch and parse external URLs
- `GET /api/health` - Overall API health check

### Provider Selection Logic Support

The enhanced API server now supports dynamic provider selection through request parameters with improved error handling:

```javascript
// Example provider selection in chat requests
{
  "message": "Your message here",
  "provider": "openai|anthropic|local" // Select AI provider
}

// Example provider selection in TTS requests
{
  "text": "Text to convert",
  "ttsProvider": "edge|azure|google" // Select TTS provider
}
```

### Enhanced Error Handling and Logging

The updated API server includes comprehensive error handling and detailed logging:

- **Connection Errors**: Graceful handling of external service connectivity issues
- **Timeout Management**: Configurable timeouts for provider requests with detailed logging
- **Fallback Mechanisms**: Automatic fallback to alternative providers when primary fails
- **Detailed Logging**: Comprehensive error logging for debugging with structured log output
- **Status Reporting**: Real-time health status monitoring with performance metrics
- **Request Tracing**: Complete request lifecycle logging for debugging complex integrations

### API Server Configuration

The API server supports various configuration options through environment variables:

```bash
# API Server Configuration
API_PORT=3001
API_HOST=localhost
CORS_ENABLED=true
LOG_LEVEL=debug

# Provider Configuration
DEFAULT_AI_PROVIDER=openai
DEFAULT_TTS_PROVIDER=edge
PROVIDER_TIMEOUTS=5000

# Error Handling
ERROR_LOGGING=true
MAX_RETRIES=3
RETRY_DELAY=1000

# DeepSeek Integration
DEEPSEEK_TIMEOUT_MS=30000
DEEPSEEK_RETRY_COUNT=3
DEEPSEEK_DEBUG_LOGGING=false
```

### Mock Data Structure

The development server includes realistic mock data for testing:
- Sample conversations with various topics and providers
- Pre-generated audio files for TTS testing across different providers
- Simulated network delays for realistic testing scenarios
- Error simulation capabilities for testing error handling

**Updated** Enhanced with improved error handling, new API endpoints, robust provider selection logic, comprehensive logging, and DeepSeek timeout monitoring capabilities

**Section sources**
- [scripts/dev-api-server.mjs:1-200](file://scripts/dev-api-server.mjs#L1-L200)
- [api/chat.js:1-100](file://api/chat.js#L1-L100)
- [api/tts.js:1-100](file://api/tts.js#L1-L100)
- [api/fetch-url.js:1-50](file://api/fetch-url.js#L1-L50)
- [api/tts-health.js:1-50](file://api/tts-health.js#L1-L50)

## DeepSeek Timeout Diagnostic Tool

### Overview

LineCheck includes a specialized diagnostic tool called `deepseek_timeout_probe.mjs` designed specifically for monitoring and debugging timeout issues with the DeepSeek AI service integration. This tool provides comprehensive timeout detection, performance monitoring, and detailed logging capabilities to help developers identify and resolve DeepSeek service connectivity problems.

### Purpose and Use Cases

The DeepSeek timeout probe serves several critical functions in the development and debugging workflow:

- **Timeout Detection**: Monitors response times from DeepSeek AI service endpoints
- **Performance Analysis**: Tracks latency patterns and identifies performance bottlenecks
- **Connectivity Testing**: Validates network connectivity and service availability
- **Debugging Support**: Provides detailed logs for troubleshooting timeout issues
- **Health Monitoring**: Continuous monitoring of DeepSeek service health status

### Running the Diagnostic Tool

Execute the DeepSeek timeout probe from the command line:

```bash
node scripts/deepseek_timeout_probe.mjs
```

You can also customize the behavior using command-line arguments:

```bash
# Set custom timeout duration (in milliseconds)
node scripts/deepseek_timeout_probe.mjs --timeout 30000

# Enable verbose logging
node scripts/deepseek_timeout_probe.mjs --verbose

# Run continuous monitoring
node scripts/deepseek_timeout_probe.mjs --continuous --interval 5000

# Test specific DeepSeek endpoint
node scripts/deepseek_timeout_probe.mjs --endpoint https://api.deepseek.com/v1/chat/completions
```

### Configuration Options

The diagnostic tool supports extensive configuration through environment variables:

```bash
# DeepSeek Service Configuration
DEEPSEEK_API_URL=https://api.deepseek.com/v1
DEEPSEEK_API_KEY=your_api_key_here
DEEPSEEK_TIMEOUT_MS=30000
DEEPSEEK_MODEL=gpt-3.5-turbo

# Diagnostic Settings
DEEPSEEK_PROBE_INTERVAL=5000
DEEPSEEK_MAX_RETRIES=3
DEEPSEEK_VERBOSE_LOGGING=true
DEEPSEEK_OUTPUT_FORMAT=json

# Network Configuration
DEEPSEEK_PROXY_URL=http://proxy:8080
DEEPSEEK_CONNECTION_TIMEOUT=10000
DEEPSEEK_READ_TIMEOUT=30000
```

### Output and Logging

The diagnostic tool provides comprehensive output in multiple formats:

#### Console Output
Real-time monitoring results displayed in the console with color-coded status indicators:
- ✅ Green: Successful responses within timeout threshold
- ⚠️ Yellow: Responses approaching timeout limits
- ❌ Red: Timeout failures or connection errors

#### JSON Log Files
Structured JSON logs saved to `logs/deepseek-probe-YYYY-MM-DD.json` containing:
- Timestamp and request details
- Response time and status codes
- Error messages and stack traces
- Performance metrics and statistics

#### Performance Metrics
Automated collection of key performance indicators:
- Average response time over time periods
- Timeout frequency and patterns
- Connection success rates
- Memory usage and resource consumption

### Integration with Development Workflow

The DeepSeek timeout probe integrates seamlessly with the existing development environment:

#### Automated Testing
Include timeout probing in automated test suites:
```bash
# Add to package.json scripts
"test:deepseek": "node scripts/deepseek_timeout_probe.mjs --continuous --duration 300000"
```

#### CI/CD Pipeline Integration
Monitor DeepSeek service reliability in continuous integration:
```yaml
# Example GitHub Actions step
- name: Test DeepSeek Connectivity
  run: node scripts/deepseek_timeout_probe.mjs --timeout 15000 --max-failures 3
```

#### Development Dashboard
Combine with other monitoring tools for comprehensive development insights:
- Real-time timeout monitoring dashboard
- Historical performance trend analysis
- Alert notifications for service degradation

### Troubleshooting DeepSeek Issues

When encountering DeepSeek service problems, use the diagnostic tool to gather detailed information:

1. **Enable Verbose Logging**:
   ```bash
   node scripts/deepseek_timeout_probe.mjs --verbose --output logs/debug.log
   ```

2. **Test Different Timeouts**:
   ```bash
   # Test with increasing timeout values
   node scripts/deepseek_timeout_probe.mjs --timeout 10000
   node scripts/deepseek_timeout_probe.mjs --timeout 30000
   node scripts/deepseek_timeout_probe.mjs --timeout 60000
   ```

3. **Analyze Patterns**:
   Review generated log files to identify timeout patterns, peak usage times, and correlation with other system events.

**New** Added comprehensive DeepSeek timeout diagnostic tool documentation with configuration, usage examples, and troubleshooting guidance

**Section sources**
- [scripts/deepseek_timeout_probe.mjs:1-200](file://scripts/deepseek_timeout_probe.mjs#L1-L200)

## LLM Discovery and Provider Configuration

### LLM Discovery Documentation

LineCheck now includes comprehensive LLM discovery capabilities through the `llms.txt` file located in the public directory. This file follows the LLMs.txt specification to provide machine-readable information about available language models and their capabilities.

### LLMs.txt Specification Support

The `llms.txt` file serves as a discovery mechanism for AI services and provides structured metadata about available models:

- **Model Information**: Details about supported language models
- **Capability Descriptions**: Information about model capabilities and limitations
- **Endpoint Specifications**: API endpoints and usage patterns
- **Authentication Requirements**: Authentication methods and requirements
- **Rate Limiting**: Usage limits and throttling information

### Provider Configuration Management

The enhanced system supports dynamic provider configuration through multiple mechanisms:

#### Environment-Based Configuration
Providers can be configured through environment variables for different deployment targets:
- Development: Local mock providers and test configurations
- Staging: Limited access to external providers for testing
- Production: Full provider access with proper authentication

#### Runtime Provider Selection
The application supports runtime provider selection based on:
- User preferences and settings
- Model availability and health status
- Cost optimization and performance requirements
- Fallback mechanisms for reliability

### Integration with Development Server

The development API server includes built-in support for LLM discovery and provider management:

- **Automatic Provider Detection**: Scans available providers and their capabilities
- **Health Monitoring**: Continuous monitoring of provider health and response times
- **Load Balancing**: Intelligent distribution of requests across available providers
- **Graceful Degradation**: Automatic switching to backup providers when primary fails

**Updated** Added comprehensive LLM discovery documentation and provider configuration management

**Section sources**
- [public/llms.txt](file://public/llms.txt)
- [scripts/dev-api-server.mjs:200-400](file://scripts/dev-api-server.mjs#L200-L400)

## Configuration Files

### Vite Configuration

The main Vite configuration file (`vite.config.js`) controls the build and development behavior:

#### Key Configuration Options

- **Server Configuration**: Port, host, and proxy settings
- **Build Options**: Output format, minification, and optimization
- **Plugin Configuration**: Additional Vite plugins and their settings
- **Alias Configuration**: Import path aliases for cleaner imports
- **Environment Variables**: Frontend environment variable exposure

#### Development vs Production Builds

The configuration automatically adjusts based on the build mode:
- **Development**: Fast builds, HMR enabled, detailed error messages
- **Production**: Optimized builds, code splitting, asset optimization

### Package.json Scripts

The project includes several npm scripts for common tasks:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src/",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:deepseek": "node scripts/deepseek_timeout_probe.mjs --continuous --duration 300000",
    "diagnostics:deepseek": "node scripts/deepseek_timeout_probe.mjs --verbose"
  }
}
```

### ESLint Configuration

Code quality is enforced through ESLint with React-specific rules and best practices.

### Vercel Deployment Configuration

The project includes updated Vercel deployment configuration (`vercel.json`) that supports the latest application structure and enhanced API routing for both development and production environments. The configuration has been adjusted to accommodate the new API endpoints, improved error handling mechanisms, LLM discovery capabilities, and DeepSeek timeout monitoring endpoints.

Key features of the updated Vercel configuration:
- **Enhanced API Routing**: Improved routing for all API endpoints including LLM discovery
- **Environment Variable Support**: Proper handling of environment variables for provider configuration
- **CORS Configuration**: Cross-origin resource sharing settings for multi-domain deployments
- **Build Optimization**: Optimized build process for production deployments
- **Health Check Endpoints**: Built-in health monitoring support for all services
- **LLM Discovery Support**: Dedicated routing for llms.txt and related discovery endpoints
- **Diagnostic Endpoint Support**: Routing for DeepSeek timeout probe and diagnostic tools

**Updated** Enhanced deployment configuration with improved API routing, LLM discovery support, and diagnostic tool integration

**Section sources**
- [vite.config.js:1-300](file://vite.config.js#L1-L300)
- [package.json:150-250](file://package.json#L150-250)
- [vercel.json:1-100](file://vercel.json#L1-L100)

## Environment Variables

### Frontend Environment Variables

Frontend environment variables must be prefixed with `VITE_` to be exposed to the client:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001
VITE_API_TIMEOUT=5000

# Feature Flags
VITE_ENABLE_CHAT=true
VITE_ENABLE_TTS=true
VITE_ENABLE_EXPORT=true

# Third-party Services
VITE_ANALYTICS_ID=your-analytics-id
VITE_SUPPORT_EMAIL=support@linecheck.com

# Provider Configuration
VITE_DEFAULT_AI_PROVIDER=openai
VITE_DEFAULT_TTS_PROVIDER=edge
VITE_LLM_DISCOVERY_ENABLED=true

# DeepSeek Integration
VITE_DEEPSEEK_TIMEOUT_MS=30000
VITE_DEEPSEEK_ENABLED=true
```

### Backend Environment Variables

Backend environment variables (for the API server):

```bash
# Server Configuration
API_PORT=3001
API_HOST=localhost
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
CORS_METHODS=GET,POST,PUT,DELETE

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json

# External Services
EDGE_TTS_ENABLED=true
EDGE_TTS_REGION=auto

# Provider Settings
DEFAULT_AI_PROVIDER=openai
DEFAULT_TTS_PROVIDER=edge
PROVIDER_TIMEOUTS=5000

# LLM Discovery Configuration
LLM_DISCOVERY_ENABLED=true
LLM_DISCOVERY_PATH=/llms.txt
PROVIDER_HEALTH_CHECK_INTERVAL=30000

# Error Handling Configuration
ERROR_LOGGING=true
MAX_RETRIES=3
RETRY_DELAY=1000
FALLBACK_PROVIDER_ENABLED=true

# DeepSeek Timeout Diagnostic Configuration
DEEPSEEK_TIMEOUT_MS=30000
DEEPSEEK_RETRY_COUNT=3
DEEPSEEK_DEBUG_LOGGING=false
DEEPSEEK_PROBE_INTERVAL=5000
DEEPSEEK_OUTPUT_FORMAT=json
```

### Environment-Specific Files

Use environment-specific files for different deployment targets:
- `.env.development` - Development environment with mock providers and diagnostic tools enabled
- `.env.staging` - Staging environment with limited provider access and basic diagnostics
- `.env.production` - Production environment with full provider access and minimal logging

**Updated** Added DeepSeek timeout diagnostic configuration environment variables and enhanced provider configuration options

**Section sources**
- [scripts/dev-api-server.mjs:200-400](file://scripts/dev-api-server.mjs#L200-L400)
- [scripts/deepseek_timeout_probe.mjs:1-100](file://scripts/deepseek_timeout_probe.mjs#L1-L100)

## IDE Setup Recommendations

### Visual Studio Code (Recommended)

Install these essential extensions:

#### Core Extensions
- **ESLint**: JavaScript and TypeScript linting
- **Prettier**: Code formatting
- **React Developer Tools**: React component inspection
- **Vite Extension Pack**: Vite-specific features
- **Tailwind CSS IntelliSense**: CSS framework support

#### Language Support
- **JavaScript and TypeScript Nightly**: Enhanced language support
- **HTML CSS Support**: Better HTML/CSS editing experience
- **JSON Tools**: JSON file editing improvements

#### Project-Specific Extensions
- **DotENV**: Environment variable highlighting
- **REST Client**: API testing within VS Code
- **Thunder Client**: Alternative API testing tool
- **Log Viewer**: Enhanced log file viewing for diagnostic outputs

### VS Code Settings

Recommended workspace settings (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/.git/**": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/logs": true
  },
  "terminal.integrated.env.osx": {
    "DEEPSEEK_DEBUG_LOGGING": "true"
  }
}
```

### Other IDEs

#### WebStorm
- Enable ESLint integration
- Configure Vite plugin
- Set up file watchers for automatic refresh
- Configure terminal environment variables for diagnostic tools

#### Sublime Text
- Install ESLint package
- Configure build system for Vite
- Set up Emmet for faster coding
- Configure syntax highlighting for diagnostic log files

**Section sources**
- [package.json:250-350](file://package.json#L250-350)

## Hot Reloading and Development Workflow

### Hot Module Replacement (HMR)

Vite's HMR provides instant feedback during development:

#### Component Updates
- **React Components**: Instant updates without losing component state
- **CSS Changes**: Styles update immediately without page reload
- **Static Assets**: Images and fonts update on demand

#### Partial Reloads
- **Module-Level Updates**: Only changed modules reload
- **State Preservation**: Application state maintained across updates
- **Error Boundaries**: Failed updates don't break the entire app

### Development Workflow Best Practices

#### File Organization
- Keep components small and focused
- Use functional components with hooks
- Organize related files together
- Follow consistent naming conventions

#### Debugging Strategies
- Use browser developer tools effectively
- Leverage React DevTools for component inspection
- Utilize console logging strategically
- Implement proper error boundaries
- Use DeepSeek timeout probe for AI service debugging

#### Performance Monitoring
- Monitor bundle size during development
- Use Vite's built-in analysis tools
- Track memory usage and performance metrics
- Optimize images and assets early
- Monitor AI service response times with diagnostic tools

### Testing Integration

Run tests alongside development:
```bash
# Run tests in watch mode
npm run test

# Run tests with coverage
npm run test:coverage

# Run DeepSeek timeout diagnostics
npm run test:deepseek

# Run interactive diagnostic tool
npm run diagnostics:deepseek
```

**Section sources**
- [vite.config.js:300-400](file://vite.config.js#L300-L400)

## Troubleshooting Guide

### Common Installation Issues

#### Node.js Version Conflicts
**Problem**: Dependency installation fails due to Node.js version mismatch
**Solution**: 
```bash
nvm use 18
# or
nvm install 18
```

#### Permission Errors
**Problem**: EACCES errors during installation
**Solution**:
```bash
sudo chown -R $(whoami) ~/.npm
# or use nvm to avoid permission issues
```

#### Network Issues
**Problem**: Slow or failed dependency downloads
**Solution**:
```bash
# Use Chinese mirror if needed
npm config set registry https://registry.npmmirror.com
```

### Development Server Issues

#### Port Already in Use
**Problem**: Port conflict when starting development server
**Solution**:
```bash
# Find and kill process using the port
lsof -i :5173
kill -9 <PID>

# Or use a different port
npm run dev -- --port 3000
```

#### Memory Issues
**Problem**: Out of memory errors during development
**Solution**:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
```

#### Hot Reload Not Working
**Problem**: Changes not reflected in browser
**Solution**:
1. Clear browser cache and hard reload
2. Restart the development server
3. Check for syntax errors in console
4. Verify file watcher is running

### API Server Issues

#### Connection Refused
**Problem**: Frontend cannot connect to API server
**Solution**:
1. Ensure API server is running on correct port
2. Check CORS configuration
3. Verify firewall settings
4. Test API endpoints directly

#### Provider Selection Issues
**Problem**: Provider selection logic not working as expected
**Solution**:
1. Verify provider configuration in environment variables
2. Check API request payload includes valid provider parameter
3. Ensure selected provider is properly configured and available
4. Review API server logs for provider-specific errors
5. Check timeout configurations and retry settings

#### Enhanced Error Handling Problems
**Problem**: API server error handling not functioning properly
**Solution**:
1. Verify error logging is enabled in environment variables
2. Check maximum retry settings and delay configurations
3. Review fallback provider settings
4. Examine detailed error logs for root cause analysis
5. Test individual provider connections separately

#### LLM Discovery Issues
**Problem**: LLM discovery endpoints not responding or returning incorrect data
**Solution**:
1. Verify llms.txt file exists in public directory
2. Check LLM discovery environment variables are properly configured
3. Ensure API server has proper permissions to read discovery files
4. Test llms.txt endpoint directly: `curl http://localhost:3001/llms.txt`
5. Review API server logs for discovery-related errors

### DeepSeek Timeout Issues

#### Timeout Detection Problems
**Problem**: DeepSeek timeout probe not detecting timeouts correctly
**Solution**:
1. Verify DEEPSEEK_TIMEOUT_MS environment variable is set appropriately
2. Check network connectivity to DeepSeek API endpoints
3. Validate API key configuration and permissions
4. Run diagnostic tool with verbose logging: `node scripts/deepseek_timeout_probe.mjs --verbose`
5. Analyze generated log files for detailed timeout patterns

#### Diagnostic Tool Failures
**Problem**: DeepSeek timeout probe crashes or produces no output
**Solution**:
1. Ensure Node.js version compatibility (18.x or higher)
2. Check file permissions for script execution
3. Verify all required environment variables are set
4. Test with minimal configuration: `node scripts/deepseek_timeout_probe.mjs --timeout 5000`
5. Check system resources and memory availability

#### Performance Monitoring Issues
**Problem**: Timeout probe not collecting accurate performance metrics
**Solution**:
1. Adjust probe interval settings for appropriate monitoring frequency
2. Verify network conditions and latency measurements
3. Check for concurrent processes affecting timing accuracy
4. Review system clock synchronization and timezone settings
5. Compare results with external monitoring tools

### Environment Variable Issues
**Problem**: Missing environment variables
**Solution**:
1. Verify `.env` file exists and is properly formatted
2. Check variable names match exactly
3. Restart both servers after changing environment variables
4. Validate environment variable loading order
5. Use diagnostic tool to verify variable loading: `node scripts/deepseek_timeout_probe.mjs --verbose`

### Build Issues

#### Build Fails Silently
**Problem**: Build process fails without clear error messages
**Solution**:
```bash
# Enable verbose logging
npm run build --verbose

# Check for specific error details
npm run build 2>&1 | tee build.log
```

#### Large Bundle Size
**Problem**: Development build becomes too large
**Solution**:
1. Analyze bundle with `npm run build -- --analyze`
2. Remove unused dependencies
3. Implement code splitting
4. Optimize images and assets

### Vercel Deployment Issues

#### Deployment Configuration Problems
**Problem**: Vercel deployment fails or routes incorrectly
**Solution**:
1. Verify `vercel.json` configuration is up to date
2. Check environment variables are properly configured in Vercel dashboard
3. Ensure API routes are correctly defined
4. Review build output and deployment logs
5. Test deployment in staging environment first

#### LLM Discovery Deployment Issues
**Problem**: LLM discovery endpoints not accessible in production
**Solution**:
1. Verify llms.txt file is included in build output
2. Check Vercel routing configuration for discovery endpoints
3. Ensure proper CORS headers are set for cross-origin requests
4. Test discovery endpoints in production environment
5. Review Vercel function logs for discovery-related errors

**Updated** Added comprehensive troubleshooting for DeepSeek timeout diagnostic tool, enhanced API server error handling, provider selection issues, LLM discovery problems, and Vercel deployment configuration problems

**Section sources**
- [scripts/dev-api-server.mjs:400-600](file://scripts/dev-api-server.mjs#L400-600)
- [scripts/deepseek_timeout_probe.mjs:100-200](file://scripts/deepseek_timeout_probe.mjs#L100-200)
- [vercel.json:1-100](file://vercel.json#L1-L100)
- [public/llms.txt](file://public/llms.txt)

## Performance Tips

### Development Performance Optimization

#### Memory Management
- Close unnecessary applications while developing
- Use Chrome DevTools Performance tab to identify bottlenecks
- Monitor memory usage with `--inspect` flag

#### Build Performance
- Use incremental builds by keeping the dev server running
- Avoid unnecessary re-renders in React components
- Implement proper memoization for expensive computations

#### Asset Optimization
- Compress images before adding to the project
- Use appropriate image formats (WebP for modern browsers)
- Implement lazy loading for large assets

### Browser Performance

#### Developer Tools
- Use Performance tab for profiling
- Monitor Network tab for slow requests
- Check Console for warnings and errors
- Use Memory tab for leak detection

#### Caching Strategy
- Leverage browser caching for static assets
- Implement service workers for offline support
- Use CDN for third-party resources

### Code Quality Impact on Performance

#### Component Optimization
- Use React.memo for expensive components
- Implement proper key props in lists
- Avoid unnecessary re-renders with useMemo and useCallback

#### Bundle Optimization
- Tree shaking for unused code
- Code splitting for large modules
- Lazy loading for routes and heavy components

### External AI Service Integration

With the enhanced provider selection logic and improved error handling, consider these performance tips:
- Implement proper timeout handling for external AI providers
- Cache frequently used responses when appropriate
- Use connection pooling for high-frequency API calls
- Monitor provider response times and implement fallback strategies
- Configure retry mechanisms with exponential backoff
- Implement circuit breaker patterns for failing providers
- Use DeepSeek timeout probe for continuous performance monitoring

### LLM Discovery Performance

For optimal LLM discovery performance:
- Cache discovery results to reduce repeated requests
- Implement intelligent polling intervals for provider health checks
- Use background processing for discovery operations
- Monitor discovery endpoint response times
- Implement graceful degradation when discovery services are unavailable

### API Server Performance

For optimal API server performance:
- Configure appropriate log levels for production vs development
- Use connection pooling for external service calls
- Implement request rate limiting
- Monitor memory usage and adjust Node.js heap size as needed
- Consider clustering for high-concurrency scenarios
- Optimize LLM discovery caching and polling strategies
- Enable structured logging for better performance analysis

### DeepSeek Timeout Monitoring Performance

For optimal DeepSeek timeout monitoring:
- Configure appropriate probe intervals based on monitoring needs
- Use selective logging to reduce overhead in production
- Implement batch processing for multiple timeout checks
- Monitor diagnostic tool resource usage and optimize accordingly
- Use asynchronous processing for non-critical timeout monitoring
- Implement adaptive timeout thresholds based on historical performance data

**Updated** Added DeepSeek timeout monitoring performance considerations and enhanced provider integration tips

**Section sources**
- [vite.config.js:400-500](file://vite.config.js#L400-L500)
- [scripts/dev-api-server.mjs:200-400](file://scripts/dev-api-server.mjs#L200-L400)
- [scripts/deepseek_timeout_probe.mjs:150-200](file://scripts/deepseek_timeout_probe.mjs#L150-200)

## Conclusion

Setting up the LineCheck development environment involves several key steps: installing Node.js and dependencies, configuring environment variables, starting both the frontend and API servers, and optimizing your development workflow. 

The project leverages modern development tools like Vite for fast builds and hot reloading, providing an efficient development experience. The custom API development server enables comprehensive testing of features without requiring a full backend setup. With the recent enhancements including improved error handling, new API endpoints, robust provider selection logic, comprehensive LLM discovery capabilities, and specialized DeepSeek timeout diagnostic tools, developers can now work with multiple AI providers and external services more flexibly and reliably.

The updated Vercel deployment configuration ensures smooth deployment processes with enhanced API routing, better error handling, dedicated LLM discovery support, and diagnostic tool integration. The comprehensive troubleshooting guide addresses common issues with the enhanced API server, including provider selection problems, error handling failures, LLM discovery challenges, DeepSeek timeout issues, and Vercel deployment configuration problems. By following the troubleshooting guides and performance tips outlined in this document, you can maintain a smooth development workflow and quickly resolve any issues that arise.

The IDE recommendations and configuration suggestions will help you work more efficiently and maintain code quality throughout the development process. Remember to keep your development environment updated, regularly review security advisories for dependencies, and follow the established patterns and conventions used throughout the codebase. The enhanced provider selection capabilities, improved error handling, comprehensive LLM discovery, and specialized DeepSeek timeout monitoring allow for greater flexibility and reliability when integrating with various AI services and TTS providers. The new diagnostic tools provide invaluable insights into AI service performance and help ensure reliable operation in both development and production environments.