# Development Environment Setup

<cite>
**Referenced Files in This Document**
- [package.json](file://package.json)
- [vite.config.js](file://vite.config.js)
- [scripts/dev-api-server.mjs](file://scripts/dev-api-server.mjs)
- [README.md](file://README.md)
- [index.html](file://index.html)
- [src/main.jsx](file://src/main.jsx)
- [api/chat.js](file://api/chat.js)
- [api/tts.js](file://api/tts.js)
- [lib/edgeTts.js](file://lib/edgeTts.js)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Project Initialization](#project-initialization)
5. [Development Server Setup](#development-server-setup)
6. [API Development Server](#api-development-server)
7. [Configuration Files](#configuration-files)
8. [Environment Variables](#environment-variables)
9. [IDE Setup Recommendations](#ide-setup-recommendations)
10. [Hot Reloading and Development Workflow](#hot-reloading-and-development-workflow)
11. [Troubleshooting Guide](#troubleshooting-guide)
12. [Performance Tips](#performance-tips)
13. [Conclusion](#conclusion)

## Introduction

LineCheck is a modern web application built with React and Vite, featuring real-time chat functionality, text-to-speech capabilities, and interview preparation tools. This development environment setup guide will help you establish a complete local development workflow for contributing to or extending the LineCheck project.

The project follows modern JavaScript development practices with a component-based architecture, modular API structure, and efficient build tooling powered by Vite.

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
- **Network**: Internet connection required for initial dependency installation

### Optional Tools
- **Git**: For version control and collaboration
- **Docker**: If you need containerized development environments
- **VS Code**: Recommended IDE with specific extensions (detailed below)

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

LineCheck includes a custom API development server that provides mock data and simulated backend functionality for development purposes. This server is built using Node.js and provides RESTful endpoints for chat, text-to-speech, and other features.

### Starting the API Server

Run the API development server alongside the frontend:
```bash
node scripts/dev-api-server.mjs
```

The API server typically runs on `http://localhost:3001` by default.

### API Endpoints

The development API server provides the following endpoints:

#### Chat API
- `POST /api/chat` - Send messages and receive AI responses
- `GET /api/chat/history` - Retrieve conversation history
- `DELETE /api/chat/clear` - Clear conversation history

#### Text-to-Speech API
- `POST /api/tts` - Convert text to speech audio
- `GET /api/tts/health` - Check TTS service health status
- `GET /api/tts/status` - Get current TTS service status

#### Utility APIs
- `GET /api/fetch-url` - Fetch and parse external URLs
- `GET /api/health` - Overall API health check

### API Server Configuration

The API server supports various configuration options through environment variables:

```bash
# API Server Configuration
API_PORT=3001
API_HOST=localhost
CORS_ENABLED=true
LOG_LEVEL=debug
```

### Mock Data Structure

The development server includes realistic mock data for testing:
- Sample conversations with various topics
- Pre-generated audio files for TTS testing
- Simulated network delays for realistic testing

**Section sources**
- [scripts/dev-api-server.mjs:1-200](file://scripts/dev-api-server.mjs#L1-L200)
- [api/chat.js:1-100](file://api/chat.js#L1-L100)
- [api/tts.js:1-100](file://api/tts.js#L1-L100)

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
    "test:coverage": "vitest --coverage"
  }
}
```

### ESLint Configuration

Code quality is enforced through ESLint with React-specific rules and best practices.

**Section sources**
- [vite.config.js:1-300](file://vite.config.js#L1-L300)
- [package.json:150-250](file://package.json#L150-L250)

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
```

### Environment-Specific Files

Use environment-specific files for different deployment targets:
- `.env.development` - Development environment
- `.env.staging` - Staging environment  
- `.env.production` - Production environment

**Section sources**
- [scripts/dev-api-server.mjs:200-400](file://scripts/dev-api-server.mjs#L200-L400)

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
    "**/build": true
  }
}
```

### Other IDEs

#### WebStorm
- Enable ESLint integration
- Configure Vite plugin
- Set up file watchers for automatic refresh

#### Sublime Text
- Install ESLint package
- Configure build system for Vite
- Set up Emmet for faster coding

**Section sources**
- [package.json:250-350](file://package.json#L250-L350)

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

#### Performance Monitoring
- Monitor bundle size during development
- Use Vite's built-in analysis tools
- Track memory usage and performance metrics
- Optimize images and assets early

### Testing Integration

Run tests alongside development:
```bash
# Run tests in watch mode
npm run test

# Run tests with coverage
npm run test:coverage
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

#### Environment Variable Issues
**Problem**: Missing environment variables
**Solution**:
1. Verify `.env` file exists and is properly formatted
2. Check variable names match exactly
3. Restart both servers after changing environment variables

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

**Section sources**
- [scripts/dev-api-server.mjs:400-600](file://scripts/dev-api-server.mjs#L400-L600)

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

**Section sources**
- [vite.config.js:400-500](file://vite.config.js#L400-L500)

## Conclusion

Setting up the LineCheck development environment involves several key steps: installing Node.js and dependencies, configuring environment variables, starting both the frontend and API servers, and optimizing your development workflow. 

The project leverages modern development tools like Vite for fast builds and hot reloading, providing an efficient development experience. The custom API development server enables comprehensive testing of features without requiring a full backend setup.

By following the troubleshooting guides and performance tips outlined in this document, you can maintain a smooth development workflow and quickly resolve any issues that arise. The IDE recommendations and configuration suggestions will help you work more efficiently and maintain code quality throughout the development process.

Remember to keep your development environment updated, regularly review security advisories for dependencies, and follow the established patterns and conventions used throughout the codebase.