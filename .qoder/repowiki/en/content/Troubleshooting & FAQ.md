# Troubleshooting & FAQ

<cite>
**Referenced Files in This Document**
- [README.md](file://README.md)
- [package.json](file://package.json)
- [vite.config.js](file://vite.config.js)
- [vercel.json](file://vercel.json)
- [index.html](file://index.html)
- [src/main.jsx](file://src/main.jsx)
- [src/App.jsx](file://src/App.jsx)
- [public/manifest.json](file://public/manifest.json)
- [public/sw.js](file://public/sw.js)
- [src/lib/storage.js](file://src/lib/storage.js)
- [src/lib/i18n.js](file://src/lib/i18n.js)
- [src/lib/settingsConfig.js](file://src/lib/settingsConfig.js)
- [src/components/InstallPrompt.jsx](file://src/components/InstallPrompt.jsx)
- [api/tts.js](file://api/tts.js)
- [api/fetch-url.js](file://api/fetch-url.js)
- [lib/edgeTts.js](file://lib/edgeTts.js)
</cite>

## Update Summary
**Changes Made**
- Enhanced service worker troubleshooting with detailed diagnostic steps and resolution strategies
- Expanded PWA issues section with comprehensive installation and update problems
- Added API integration challenges covering CORS, authentication, and error handling
- Improved local storage problem diagnosis with quota management and fallback mechanisms
- Enhanced internationalization troubleshooting with locale loading and fallback chains
- Added deployment complications section covering environment configuration and build issues
- Updated all diagrams with specific source file references for better traceability

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document provides comprehensive troubleshooting guidance and frequently asked questions for LineCheck. It focuses on diagnosing browser compatibility issues, performance problems, Progressive Web App (PWA) and service worker behavior, offline functionality, logging and diagnostics, error reporting, and migration/backward compatibility considerations. The goal is to help users and developers quickly identify root causes and apply effective fixes.

## Project Structure
LineCheck is a modern web application built with Vite and React. Key areas include:
- Frontend entry points and app shell
- PWA assets (manifest and service worker)
- API routes for server-side features (e.g., TTS, URL fetching)
- Client libraries for storage, internationalization, settings, and utilities
- Build and deployment configuration

```mermaid
graph TB
subgraph "Frontend"
IDX["index.html"]
MAIN["src/main.jsx"]
APP["src/App.jsx"]
MANIFEST["public/manifest.json"]
SW["public/sw.js"]
end
subgraph "Build & Deploy"
PKG["package.json"]
VITE["vite.config.js"]
VERCEL["vercel.json"]
end
subgraph "API Routes"
TTS_API["api/tts.js"]
FETCH_URL_API["api/fetch-url.js"]
end
subgraph "Client Libraries"
STORAGE["src/lib/storage.js"]
I18N["src/lib/i18n.js"]
SETTINGS["src/lib/settingsConfig.js"]
end
IDX --> MAIN --> APP
APP --> STORAGE
APP --> I18N
APP --> SETTINGS
APP --> TTS_API
APP --> FETCH_URL_API
MANIFEST --> APP
SW --> APP
PKG --> VITE
VITE --> VERCEL
```

**Diagram sources**
- [index.html:1-200](file://index.html#L1-L200)
- [src/main.jsx:1-200](file://src/main.jsx#L1-L200)
- [src/App.jsx:1-200](file://src/App.jsx#L1-L200)
- [public/manifest.json:1-200](file://public/manifest.json#L1-L200)
- [public/sw.js:1-200](file://public/sw.js#L1-L200)
- [package.json:1-200](file://package.json#L1-L200)
- [vite.config.js:1-200](file://vite.config.js#L1-L200)
- [vercel.json:1-200](file://vercel.json#L1-L200)
- [api/tts.js:1-200](file://api/tts.js#L1-L200)
- [api/fetch-url.js:1-200](file://api/fetch-url.js#L1-L200)
- [src/lib/storage.js:1-200](file://src/lib/storage.js#L1-L200)
- [src/lib/i18n.js:1-200](file://src/lib/i18n.js#L1-L200)
- [src/lib/settingsConfig.js:1-200](file://src/lib/settingsConfig.js#L1-L200)

**Section sources**
- [README.md:1-200](file://README.md#L1-L200)
- [package.json:1-200](file://package.json#L1-L200)
- [vite.config.js:1-200](file://vite.config.js#L1-L200)
- [vercel.json:1-200](file://vercel.json#L1-L200)
- [index.html:1-200](file://index.html#L1-L200)
- [src/main.jsx:1-200](file://src/main.jsx#L1-L200)
- [src/App.jsx:1-200](file://src/App.jsx#L1-L200)
- [public/manifest.json:1-200](file://public/manifest.json#L1-L200)
- [public/sw.js:1-200](file://public/sw.js#L1-L200)
- [src/lib/storage.js:1-200](file://src/lib/storage.js#L1-L200)
- [src/lib/i18n.js:1-200](file://src/lib/i18n.js#L1-L200)
- [src/lib/settingsConfig.js:1-200](file://src/lib/settingsConfig.js#L1-L200)
- [api/tts.js:1-200](file://api/tts.js#L1-L200)
- [api/fetch-url.js:1-200](file://api/fetch-url.js#L1-L200)

## Core Components
- Application bootstrap and routing are initialized from the main entry point and app component. These orchestrate feature modules such as storage, i18n, and settings.
- PWA support is provided via a web manifest and a service worker file.
- Serverless API routes handle external integrations like text-to-speech and URL fetching.
- Client libraries encapsulate persistent storage, language switching, and settings configuration.

Key responsibilities:
- Bootstrap and mount the UI tree
- Register and manage the service worker
- Provide global state and configuration
- Call backend APIs for features requiring server processing

**Section sources**
- [src/main.jsx:1-200](file://src/main.jsx#L1-L200)
- [src/App.jsx:1-200](file://src/App.jsx#L1-L200)
- [public/manifest.json:1-200](file://public/manifest.json#L1-L200)
- [public/sw.js:1-200](file://public/sw.js#L1-L200)
- [api/tts.js:1-200](file://api/tts.js#L1-L200)
- [api/fetch-url.js:1-200](file://api/fetch-url.js#L1-L200)
- [src/lib/storage.js:1-200](file://src/lib/storage.js#L1-L200)
- [src/lib/i18n.js:1-200](file://src/lib/i18n.js#L1-L200)
- [src/lib/settingsConfig.js:1-200](file://src/lib/settingsConfig.js#L1-L200)

## Architecture Overview
The runtime architecture connects the browser-based frontend to serverless endpoints and local storage. The service worker mediates caching and offline behavior.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant SW as "Service Worker"
participant App as "App Shell"
participant API as "Serverless API"
participant Storage as "Local Storage"
Browser->>SW : Install/Update
SW-->>Browser : Activated
Browser->>App : Load index.html + JS
App->>Storage : Initialize settings/preferences
App->>API : Request resources (e.g., TTS, fetch URL)
API-->>App : Response or error
App->>SW : Cache responses (if configured)
SW-->>App : Serve cached content when offline
```

**Diagram sources**
- [public/sw.js:1-200](file://public/sw.js#L1-L200)
- [src/App.jsx:1-200](file://src/App.jsx#L1-L200)
- [api/tts.js:1-200](file://api/tts.js#L1-L200)
- [api/fetch-url.js:1-200](file://api/fetch-url.js#L1-L200)
- [src/lib/storage.js:1-200](file://src/lib/storage.js#L1-L200)

## Detailed Component Analysis

### Service Worker and Offline Behavior
Common symptoms:
- App does not update after deployment
- Offline pages fail to load
- Stale content persists across sessions
- Service worker registration fails silently

Enhanced diagnostic steps:
- Verify registration and activation logs in the browser's developer tools under Application > Service Workers
- Check cache names and entries to ensure expected assets are stored
- Confirm that the service worker scope matches your deployment path
- Monitor service worker lifecycle events (install, activate, fetch, message)
- Validate cache versioning strategy and cleanup policies

Resolution strategies:
- Implement cache busting for critical assets by updating filenames or adding versioned query strings during build
- Ensure the service worker strategy aligns with your needs (e.g., network-first for dynamic data, cache-first for static assets)
- Clear caches and force reload if necessary to validate updates
- Add proper error handling for service worker failures
- Implement background sync for reliable offline operations

**Updated** Enhanced with additional diagnostic steps and resolution strategies for common service worker issues

**Section sources**
- [public/sw.js:1-200](file://public/sw.js#L1-L200)
- [public/manifest.json:1-200](file://public/manifest.json#L1-L200)

### PWA Manifest and Installation
Common symptoms:
- Install prompt does not appear
- App icon missing or incorrect
- Short name or display mode misconfigured
- HTTPS requirement not met
- Missing required manifest fields

Enhanced diagnostic steps:
- Validate the manifest against a JSON validator and check required fields
- Inspect the installability criteria in the browser's Application panel
- Confirm HTTPS requirement and proper MIME types
- Check manifest size limits and icon format requirements
- Verify start_url resolves correctly and app is served over HTTPS

Resolution strategies:
- Add or correct required fields (name, short_name, icons, start_url, display)
- Provide multiple icon sizes for various device densities (192x192, 512x512 minimum)
- Ensure start_url resolves correctly and the app is served over HTTPS
- Configure proper security headers for PWA features
- Implement custom install prompts for better user experience

**Updated** Added more comprehensive diagnostic steps and resolution strategies for PWA installation issues

**Section sources**
- [public/manifest.json:1-200](file://public/manifest.json#L1-L200)
- [src/components/InstallPrompt.jsx:1-200](file://src/components/InstallPrompt.jsx#L1-L200)

### API Integration (Text-to-Speech and URL Fetching)
Common symptoms:
- Text-to-speech requests fail or time out
- URL fetching returns CORS errors or blocked responses
- Inconsistent results across environments
- Authentication failures with external services
- Rate limiting and quota exceeded errors

Enhanced diagnostic steps:
- Inspect network requests and responses in the Network tab
- Review server logs for API route handlers
- Validate environment variables and secrets used by serverless functions
- Check CORS configuration and allowed origins
- Monitor rate limiting headers and response codes
- Test API endpoints independently using curl or Postman

Resolution strategies:
- Configure appropriate CORS headers on the server side
- Implement retries with exponential backoff for transient failures
- Add request timeouts and user-facing error messages
- Handle authentication tokens securely and refresh them automatically
- Implement proper error boundaries and fallback mechanisms
- Add comprehensive logging for debugging API calls

```mermaid
sequenceDiagram
participant UI as "UI Component"
participant Client as "Client Library"
participant API as "Serverless Route"
participant External as "External Service"
UI->>Client : Trigger action (e.g., generate audio)
Client->>API : POST /api/tts with payload
API->>External : Forward request
External-->>API : Audio stream or error
API-->>Client : Response or error
Client-->>UI : Update UI or show error
```

**Diagram sources**
- [api/tts.js:1-200](file://api/tts.js#L1-L200)
- [lib/edgeTts.js:1-200](file://lib/edgeTts.js#L1-L200)
- [api/fetch-url.js:1-200](file://api/fetch-url.js#L1-L200)

**Updated** Enhanced with additional diagnostic steps for CORS, authentication, and rate limiting issues

**Section sources**
- [api/tts.js:1-200](file://api/tts.js#L1-L200)
- [lib/edgeTts.js:1-200](file://lib/edgeTts.js#L1-L200)
- [api/fetch-url.js:1-200](file://api/fetch-url.js#L1-L200)

### Local Storage and Settings
Common symptoms:
- Preferences do not persist across sessions
- Settings reset unexpectedly
- Storage quota exceeded
- Data corruption or serialization errors
- Cross-tab synchronization issues

Enhanced diagnostic steps:
- Inspect Local Storage and Session Storage in the Application panel
- Validate keys and values for serialization issues
- Monitor storage usage and quotas
- Check for storage availability and permissions
- Verify data consistency across tabs and windows
- Test storage operations with different data types

Resolution strategies:
- Wrap storage operations with try/catch and fallback mechanisms
- Normalize and sanitize stored values
- Implement graceful degradation when storage is unavailable
- Use structured storage patterns with versioning
- Implement storage migration for schema changes
- Add storage quota monitoring and cleanup strategies

**Updated** Added comprehensive storage quota management and cross-tab synchronization troubleshooting

**Section sources**
- [src/lib/storage.js:1-200](file://src/lib/storage.js#L1-L200)
- [src/lib/settingsConfig.js:1-200](file://src/lib/settingsConfig.js#L1-L200)

### Internationalization (i18n)
Common symptoms:
- Wrong language displayed
- Missing translations
- Language switch not applied
- Fallback chain not working properly
- Performance issues with large translation files

Enhanced diagnostic steps:
- Check loaded locales and resource availability
- Validate fallback chain and default locale configuration
- Inspect runtime language selection logic
- Monitor translation file loading and parsing
- Verify key existence and formatting placeholders
- Test language switching across different components

Resolution strategies:
- Preload essential locales at startup
- Provide sensible defaults and clear error states for missing keys
- Ensure language changes propagate through context providers
- Implement lazy loading for large translation files
- Add translation validation during build process
- Optimize translation file structure and organization

**Updated** Enhanced with additional diagnostic steps for fallback chains and performance optimization

**Section sources**
- [src/lib/i18n.js:1-200](file://src/lib/i18n.js#L1-L200)

## Dependency Analysis
Build-time and runtime dependencies influence bundling, caching, and deployment behavior.

```mermaid
graph TB
PKG["package.json"]
VITE["vite.config.js"]
VERCEL["vercel.json"]
APP["src/App.jsx"]
MAIN["src/main.jsx"]
SW["public/sw.js"]
MANIFEST["public/manifest.json"]
PKG --> VITE
VITE --> VERCEL
MAIN --> APP
APP --> SW
APP --> MANIFEST
```

**Diagram sources**
- [package.json:1-200](file://package.json#L1-L200)
- [vite.config.js:1-200](file://vite.config.js#L1-L200)
- [vercel.json:1-200](file://vercel.json#L1-L200)
- [src/main.jsx:1-200](file://src/main.jsx#L1-L200)
- [src/App.jsx:1-200](file://src/App.jsx#L1-L200)
- [public/sw.js:1-200](file://public/sw.js#L1-L200)
- [public/manifest.json:1-200](file://public/manifest.json#L1-L200)

**Section sources**
- [package.json:1-200](file://package.json#L1-L200)
- [vite.config.js:1-200](file://vite.config.js#L1-L200)
- [vercel.json:1-200](file://vercel.json#L1-L200)

## Performance Considerations
- Minimize bundle size by code splitting and lazy loading heavy components
- Use efficient caching strategies in the service worker; prefer HTTP caching headers where possible
- Debounce or throttle frequent operations (e.g., search, input handling)
- Profile rendering using browser performance tools; avoid unnecessary re-renders
- Optimize images and assets; leverage modern formats and responsive sizing
- Monitor API latency and implement client-side retries with backoff
- Implement virtual scrolling for large lists and tables
- Use memoization for expensive computations and prevent redundant renders

[No sources needed since this section provides general guidance]

## Troubleshooting Guide

### Browser Compatibility Issues
Symptoms:
- Features fail on older browsers (e.g., Promise, fetch, WebAssembly)
- Polyfills not applied
- Incorrect behavior due to unsupported APIs
- Build errors with modern JavaScript syntax

Diagnostics:
- Check target browsers defined in build configuration
- Inspect transpilation and polyfill inclusion in the final bundle
- Test on representative devices and browsers
- Verify feature detection and graceful degradation

Resolutions:
- Adjust browser targets to match your audience
- Include necessary polyfills for legacy environments
- Gracefully degrade features when APIs are unavailable
- Use feature detection instead of browser detection

**Section sources**
- [vite.config.js:1-200](file://vite.config.js#L1-L200)
- [package.json:1-200](file://package.json#L1-L200)

### Performance Problems
Symptoms:
- Slow initial load
- Janky interactions
- High memory usage
- Large bundle sizes
- Excessive re-renders

Diagnostics:
- Use Performance and Memory tabs to capture timelines and heap snapshots
- Identify large bundles and heavy computations
- Measure network waterfall and cache hit rates
- Analyze component render times and prop drilling
- Check for memory leaks and unused code

Resolutions:
- Split routes and components; defer non-critical work
- Memoize expensive computations and avoid redundant renders
- Optimize service worker caching to reduce network overhead
- Implement code splitting and lazy loading
- Use React.memo and useMemo for performance optimization

**Section sources**
- [src/App.jsx:1-200](file://src/App.jsx#L1-L200)
- [public/sw.js:1-200](file://public/sw.js#L1-L200)

### Debugging Techniques
- Enable verbose logging in development; filter logs by module or severity
- Use structured logging with timestamps and correlation IDs for API calls
- Capture stack traces for unhandled exceptions and report them centrally
- Instrument key user flows with timing markers
- Implement error boundaries for component-level error catching
- Use React DevTools for component inspection and profiling

**Section sources**
- [src/lib/storage.js:1-200](file://src/lib/storage.js#L1-L200)
- [api/tts.js:1-200](file://api/tts.js#L1-L200)

### Error Reporting Mechanisms
- Centralize error boundaries around major UI sections
- Serialize minimal context (no sensitive data) for error reports
- Integrate with an error tracking service for aggregation and alerting
- Provide user-friendly messages and recovery actions
- Implement retry mechanisms for transient failures
- Log detailed error information for debugging while maintaining user privacy

**Section sources**
- [src/App.jsx:1-200](file://src/App.jsx#L1-L200)

### Progressive Web App Issues
Symptoms:
- Install prompt not shown
- Background sync fails
- Push notifications not received
- App not recognized as installable
- Manifest validation errors

Enhanced diagnostics:
- Validate manifest fields and icons
- Check service worker lifecycle events and cache contents
- Verify permissions and capabilities
- Test installability criteria compliance
- Monitor PWA-specific console warnings

Resolutions:
- Ensure HTTPS and valid manifest
- Implement robust update flow with user prompts
- Handle permission denials gracefully
- Add proper security headers for PWA features
- Implement custom install prompts for better UX

**Section sources**
- [public/manifest.json:1-200](file://public/manifest.json#L1-L200)
- [public/sw.js:1-200](file://public/sw.js#L1-L200)
- [src/components/InstallPrompt.jsx:1-200](file://src/components/InstallPrompt.jsx#L1-L200)

### Service Worker Problems
Symptoms:
- Updates not applied
- Stale assets served
- Offline mode broken
- Registration failures
- Cache conflicts between versions

Enhanced diagnostics:
- Inspect SW registration, installation, and activation logs
- Compare cache versions between deployments
- Force SW update and clear caches to test
- Monitor service worker lifecycle events
- Check for cache naming conflicts and cleanup issues

Resolutions:
- Use cache-busting strategies for critical files
- Implement precaching for essential assets and runtime caching for dynamic data
- Provide manual refresh controls for users
- Add proper error handling for service worker failures
- Implement background sync for reliable offline operations

**Section sources**
- [public/sw.js:1-200](file://public/sw.js#L1-L200)

### Offline Functionality Troubleshooting
Symptoms:
- Pages fail to load offline
- Data not available without network
- Sync conflicts
- Background sync failures
- Stale data persistence issues

Enhanced diagnostics:
- Verify offline routes and cached resources
- Check background sync queues and retry policies
- Validate conflict resolution logic
- Monitor network connectivity status
- Test offline scenarios comprehensively

Resolutions:
- Precache core pages and assets
- Queue mutations and reconcile on reconnect
- Show clear offline indicators and instructions
- Implement optimistic UI updates with rollback capability
- Add conflict resolution strategies for concurrent modifications

**Section sources**
- [public/sw.js:1-200](file://public/sw.js#L1-L200)

### Deployment Complications
Symptoms:
- Environment variables not accessible
- Build failures in production
- Asset loading issues
- CORS configuration problems
- SSL/TLS certificate errors

Enhanced diagnostics:
- Verify environment variable configuration in hosting platform
- Check build output and asset paths
- Validate deployment configuration files
- Test API endpoints in production environment
- Monitor deployment logs and error outputs

Resolutions:
- Configure environment variables in hosting platform dashboard
- Use relative paths for assets and API calls
- Implement proper CORS configuration for production domains
- Set up proper SSL certificates and security headers
- Add health check endpoints for deployment verification

**New Section** Added comprehensive deployment troubleshooting covering environment configuration and build issues

### Setup and Configuration FAQs
- How to configure build targets? Adjust browser targets in the build configuration
- How to set environment variables for API routes? Define variables in the hosting platform's dashboard and reference them in serverless functions
- How to customize the PWA manifest? Edit the manifest file and provide required fields and icons
- How to configure service worker caching strategies? Modify the service worker file and implement appropriate caching policies
- How to set up internationalization? Configure locale files and language switching logic

**Section sources**
- [vite.config.js:1-200](file://vite.config.js#L1-L200)
- [vercel.json:1-200](file://vercel.json#L1-L200)
- [public/manifest.json:1-200](file://public/manifest.json#L1-L200)

### Feature Usage FAQs
- How to enable text-to-speech? Ensure API route is deployed and accessible; verify credentials and rate limits
- How to change language? Select a supported locale; confirm resources are loaded and fallbacks are configured
- How to export or share generated content? Use provided export utilities and verify file format support
- How to configure offline functionality? Set up service worker caching and background sync
- How to handle API errors gracefully? Implement error boundaries and user-friendly error messages

**Section sources**
- [api/tts.js:1-200](file://api/tts.js#L1-L200)
- [src/lib/i18n.js:1-200](file://src/lib/i18n.js#L1-L200)

### Migration Guides and Backwards Compatibility
- Upgrading build tooling: Review breaking changes in dependency updates; adjust configuration accordingly
- Changing API contracts: Version endpoints and maintain backward-compatible responses during transition
- Updating PWA behavior: Validate new service worker strategies across devices; provide rollback paths
- Migrating storage schemas: Implement data migration scripts and version checking
- Updating internationalization: Maintain translation key compatibility and provide fallbacks

**Section sources**
- [package.json:1-200](file://package.json#L1-L200)
- [vite.config.js:1-200](file://vite.config.js#L1-L200)
- [public/sw.js:1-200](file://public/sw.js#L1-L200)

## Conclusion
By systematically inspecting browser capabilities, service worker behavior, API integrations, and local storage, most issues in LineCheck can be diagnosed and resolved efficiently. Adopt robust logging, error reporting, and caching strategies to improve reliability and user experience. Keep configurations aligned with your deployment environment and audience expectations, and plan migrations carefully to maintain backwards compatibility.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Diagnostic Tools Checklist
- Open Developer Tools: Console, Network, Application (Storage, Service Workers), Performance, Memory
- Validate manifest and service worker registration
- Inspect cache entries and versions
- Review server logs for API routes
- Reproduce issues on multiple browsers/devices
- Test offline functionality and network throttling
- Monitor memory usage and performance metrics
- Validate PWA installability criteria

**Section sources**
- [public/manifest.json:1-200](file://public/manifest.json#L1-L200)
- [public/sw.js:1-200](file://public/sw.js#L1-L200)
- [api/tts.js:1-200](file://api/tts.js#L1-L200)

### Common Error Codes and Solutions
- **CORS Errors**: Configure proper CORS headers and allowed origins
- **404 Not Found**: Verify asset paths and deployment configuration
- **500 Internal Server Error**: Check server logs and API endpoint implementation
- **Network Error**: Validate internet connectivity and API availability
- **Storage Quota Exceeded**: Implement data cleanup and compression strategies
- **Service Worker Registration Failed**: Check HTTPS requirements and file paths

**New Section** Added comprehensive error code reference with solutions

### Performance Monitoring Checklist
- Bundle size analysis and optimization
- Initial load time measurement
- Runtime performance profiling
- Memory leak detection
- Network request optimization
- Caching effectiveness evaluation
- User experience metrics tracking

**New Section** Added performance monitoring guidelines and best practices