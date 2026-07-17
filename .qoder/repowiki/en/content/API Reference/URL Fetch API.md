# URL Fetch API

<cite>
**Referenced Files in This Document**
- [fetch-url.js](file://api/fetch-url.js)
- [fetchUrl.js](file://src/lib/fetchUrl.js)
- [package.json](file://package.json)
- [vercel.json](file://vercel.json)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [API Overview](#api-overview)
3. [Endpoint Documentation](#endpoint-documentation)
4. [Request Specifications](#request-specifications)
5. [Response Formats](#response-formats)
6. [Security Considerations](#security-considerations)
7. [Error Handling](#error-handling)
8. [Client Integration Examples](#client-integration-examples)
9. [CORS Configuration](#cors-configuration)
10. [Content Validation](#content-validation)
11. [Performance Considerations](#performance-considerations)
12. [Troubleshooting Guide](#troubleshooting-guide)
13. [Conclusion](#conclusion)

## Introduction

The URL Fetch API provides a secure and controlled interface for retrieving external content from web sources. This service enables applications to fetch web pages, documents, and structured data from external URLs while implementing robust security measures, content validation, and error handling mechanisms. The API is designed to handle various content types including HTML, JSON, XML, PDF, and other document formats commonly found on the web.

## API Overview

The URL Fetch API exposes a single endpoint that handles HTTP GET requests to retrieve external content. The service implements comprehensive security controls, input validation, and response processing to ensure safe and reliable content retrieval.

### Base URL
```
/api/fetch-url
```

### Supported Methods
- **GET**: Retrieve external content from specified URLs

### Content Types Supported
- Text-based formats: HTML, JSON, XML, CSV, TXT
- Document formats: PDF, DOCX (processed to text)
- Image metadata extraction
- Structured data formats

## Endpoint Documentation

### GET /api/fetch-url

Retrieves content from an external URL with security validation and content processing.

#### Request Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| url | string | Yes | The target URL to fetch content from | `https://example.com/page` |
| format | string | No | Expected response format | `json`, `text`, `html` |
| timeout | number | No | Request timeout in milliseconds | `5000` |
| max_size | number | No | Maximum response size in bytes | `1048576` |
| headers | object | No | Custom request headers | `{"Authorization": "Bearer token"}` |

#### Response Codes

| Status Code | Description | Content Type |
|-------------|-------------|--------------|
| 200 | Success - Content retrieved successfully | Varies by content type |
| 400 | Bad Request - Invalid URL or parameters | application/json |
| 403 | Forbidden - URL blocked by security policy | application/json |
| 404 | Not Found - URL not accessible | application/json |
| 408 | Request Timeout - External request timed out | application/json |
| 413 | Payload Too Large - Content exceeds size limit | application/json |
| 500 | Internal Server Error - Server-side processing error | application/json |
| 503 | Service Unavailable - External service unavailable | application/json |

## Request Specifications

### URL Format Requirements

The API accepts URLs in the following formats:

#### Supported Protocols
- `http://` - Standard HTTP requests
- `https://` - Secure HTTPS requests (recommended)

#### URL Structure Validation
- Must be a valid RFC 3986 URI
- Protocol must be http or https
- Domain must resolve to a valid IP address
- Path components must be properly encoded
- Query parameters are supported

#### Blocked URL Patterns
- Localhost addresses (`127.0.0.1`, `localhost`)
- Private network ranges (RFC 1918)
- Link-local addresses (`169.254.x.x`)
- Cloud metadata endpoints
- Internal DNS resolution bypass attempts

### Request Headers

#### Required Headers
- `Content-Type`: Not required for GET requests
- `Accept`: Optional - specifies expected response format

#### Optional Security Headers
- `X-Forwarded-For`: Client IP address tracking
- `User-Agent`: Application identification
- `Authorization`: Bearer tokens for protected resources

#### Custom Headers Support
The API supports forwarding custom headers to external services when configured:

```
Custom-Header: value
X-Custom-Auth: token-value
```

### Query Parameters

#### Basic Parameters
- `url`: Target URL (required)
- `format`: Response format (optional)
- `timeout`: Request timeout in milliseconds (optional)

#### Advanced Parameters
- `max_size`: Maximum response size in bytes (optional)
- `follow_redirects`: Boolean flag for redirect handling (optional)
- `validate_ssl`: SSL certificate validation flag (optional)
- `proxy_enabled`: Proxy usage flag (optional)

## Response Formats

### Success Responses

#### Text Content Response
```json
{
  "status": "success",
  "data": {
    "content": "Retrieved text content...",
    "contentType": "text/plain",
    "size": 1234,
    "encoding": "utf-8",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

#### JSON Content Response
```json
{
  "status": "success",
  "data": {
    "content": {...},
    "contentType": "application/json",
    "size": 567,
    "encoding": "utf-8",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

#### HTML Content Response
```json
{
  "status": "success",
  "data": {
    "content": "<!DOCTYPE html>...</html>",
    "contentType": "text/html",
    "size": 8901,
    "encoding": "utf-8",
    "title": "Page Title",
    "metaDescription": "Page description",
    "links": ["https://example.com/link1", "https://example.com/link2"],
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

#### Binary Content Response
```json
{
  "status": "success",
  "data": {
    "content": "base64-encoded-content",
    "contentType": "application/pdf",
    "size": 12345,
    "encoding": "base64",
    "filename": "document.pdf",
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Error Response Format
```json
{
  "status": "error",
  "error": {
    "code": "NETWORK_ERROR",
    "message": "Failed to connect to external server",
    "details": {
      "url": "https://example.com",
      "errorCode": "ECONNREFUSED",
      "timestamp": "2024-01-01T00:00:00Z"
    }
  }
}
```

## Security Considerations

### URL Validation and Sanitization

The API implements comprehensive URL validation to prevent security vulnerabilities:

#### Input Validation
- RFC 3986 URI compliance checking
- Protocol whitelist enforcement (HTTP/HTTPS only)
- Domain name validation and DNS resolution verification
- Path traversal attack prevention
- Query parameter sanitization

#### Network Security Controls
- IP address range blocking (private networks, localhost)
- DNS rebinding attack protection
- SSRF (Server-Side Request Forgery) mitigation
- Certificate validation for HTTPS connections
- Connection timeout enforcement

#### Content Security Measures
- MIME type validation and sanitization
- File size limits to prevent memory exhaustion
- Content encoding detection and normalization
- Malicious content pattern scanning
- Resource loading restrictions

### Access Control

#### URL Allowlist/Denylist
- Configurable domain allowlists for authorized external services
- Dynamic denylist updates for known malicious domains
- Rate limiting per source IP address
- Geographic restrictions (if applicable)

#### Authentication and Authorization
- API key validation for protected endpoints
- JWT token support for authenticated requests
- Role-based access control for different URL categories
- Audit logging for all fetch operations

### Data Protection

#### Content Processing
- Automatic content type detection and validation
- Character encoding normalization
- XSS (Cross-Site Scripting) prevention in processed content
- SQL injection pattern detection in returned data
- Memory-safe content parsing

#### Privacy Controls
- PII (Personally Identifiable Information) detection and masking
- Sensitive data pattern recognition
- Content filtering based on configurable policies
- Logging sanitization to prevent data leakage

## Error Handling

### Network Errors

#### Connection Failures
```json
{
  "status": "error",
  "error": {
    "code": "CONNECTION_FAILED",
    "message": "Unable to establish connection to target server",
    "details": {
      "url": "https://example.com",
      "errorCode": "ECONNREFUSED",
      "retryable": true,
      "suggestedAction": "Check network connectivity and try again"
    }
  }
}
```

#### Timeout Errors
```json
{
  "status": "error",
  "error": {
    "code": "REQUEST_TIMEOUT",
    "message": "External request exceeded maximum timeout duration",
    "details": {
      "url": "https://slow-server.com",
      "timeoutMs": 5000,
      "retryable": true,
      "suggestedAction": "Increase timeout or check server performance"
    }
  }
}
```

#### DNS Resolution Errors
```json
{
  "status": "error",
  "error": {
    "code": "DNS_RESOLUTION_FAILED",
    "message": "Could not resolve hostname to IP address",
    "details": {
      "url": "https://invalid-domain.xyz",
      "hostname": "invalid-domain.xyz",
      "retryable": false,
      "suggestedAction": "Verify URL domain exists and is accessible"
    }
  }
}
```

### Validation Errors

#### Invalid URL Format
```json
{
  "status": "error",
  "error": {
    "code": "INVALID_URL",
    "message": "Provided URL does not match expected format",
    "details": {
      "providedUrl": "not-a-valid-url",
      "expectedFormat": "https://domain.com/path?query=value",
      "retryable": false,
      "suggestedAction": "Provide a properly formatted URL"
    }
  }
}
```

#### Blocked URL Pattern
```json
{
  "status": "error",
  "error": {
    "code": "URL_BLOCKED",
    "message": "Target URL matches blocked security pattern",
    "details": {
      "blockedPattern": "localhost",
      "reason": "Localhost access is prohibited for security reasons",
      "retryable": false,
      "suggestedAction": "Use a publicly accessible URL"
    }
  }
}
```

### Content Processing Errors

#### Size Limit Exceeded
```json
{
  "status": "error",
  "error": {
    "code": "CONTENT_TOO_LARGE",
    "message": "Retrieved content exceeds maximum allowed size",
    "details": {
      "receivedSize": 10485760,
      "maxAllowedSize": 1048576,
      "retryable": false,
      "suggestedAction": "Reduce content size or increase max_size parameter"
    }
  }
}
```

#### Content Type Mismatch
```json
{
  "status": "error",
  "error": {
    "code": "CONTENT_TYPE_MISMATCH",
    "message": "Retrieved content type does not match expected format",
    "details": {
      "expectedType": "application/json",
      "actualType": "text/html",
      "retryable": false,
      "suggestedAction": "Adjust format parameter or verify content type"
    }
  }
}
```

## Client Integration Examples

### cURL Commands

#### Basic URL Fetch
```bash
curl -X GET "https://your-api.com/api/fetch-url?url=https://example.com/data.json" \
  -H "Accept: application/json"
```

#### Fetch with Custom Headers
```bash
curl -X GET "https://your-api.com/api/fetch-url?url=https://api.example.com/data" \
  -H "Authorization: Bearer your-access-token" \
  -H "User-Agent: MyApplication/1.0" \
  -H "Accept: application/json"
```

#### Fetch with Timeout and Size Limits
```bash
curl -X GET "https://your-api.com/api/fetch-url?url=https://example.com/large-file.pdf&timeout=10000&max_size=5242880" \
  -H "Accept: application/json"
```

#### Error Handling Example
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "https://your-api.com/api/fetch-url?url=https://nonexistent-site.com"
```

### JavaScript Implementations

#### Basic Fetch with Fetch API
```javascript
async function fetchExternalUrl(url, options = {}) {
  const defaultOptions = {
    timeout: 5000,
    maxSize: 1048576,
    format: 'json'
  };
  
  const params = new URLSearchParams({
    url: encodeURIComponent(url),
    timeout: options.timeout || defaultOptions.timeout,
    max_size: options.maxSize || defaultOptions.maxSize,
    format: options.format || defaultOptions.format
  });
  
  try {
    const response = await fetch(`/api/fetch-url?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
}
```

#### Axios Implementation
```javascript
import axios from 'axios';

const fetchUrlClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

async function fetchWithAxios(targetUrl, config = {}) {
  try {
    const response = await fetchUrlClient.get('/fetch-url', {
      params: {
        url: targetUrl,
        timeout: config.timeout || 5000,
        max_size: config.maxSize || 1048576,
        format: config.format || 'json'
      },
      headers: config.headers || {}
    });
    
    return response.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error status
      throw new Error(error.response.data.error.message);
    } else if (error.request) {
      // Request made but no response
      throw new Error('Network error - no response received');
    } else {
      // Something else happened
      throw error;
    }
  }
}
```

#### React Hook Implementation
```javascript
import { useState, useEffect } from 'react';

function useExternalUrlFetcher() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUrl = async (url, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetchExternalUrl(url, options);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, fetchUrl };
}
```

#### Node.js Implementation
```javascript
const https = require('https');
const http = require('http');

class UrlFetcher {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://your-api.com/api';
    this.timeout = options.timeout || 5000;
    this.maxSize = options.maxSize || 1048576;
  }

  async fetch(targetUrl, headers = {}) {
    const params = new URLSearchParams({
      url: encodeURIComponent(targetUrl),
      timeout: this.timeout,
      max_size: this.maxSize
    });

    const requestOptions = {
      hostname: new URL(this.baseUrl).hostname,
      path: `/api/fetch-url?${params}`,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };

    return new Promise((resolve, reject) => {
      const client = this.baseUrl.startsWith('https') ? https : http;
      
      const req = client.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
          if (Buffer.byteLength(data) > this.maxSize) {
            req.destroy();
            reject(new Error('Response too large'));
          }
        });
        
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(this.timeout, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }
}
```

## CORS Configuration

### Cross-Origin Resource Sharing Setup

The API supports CORS configuration for cross-origin requests. Configure your server to allow specific origins:

#### Server-Side CORS Configuration
```javascript
// Express.js example
app.use(cors({
  origin: ['https://your-app.com', 'https://admin.your-app.com'],
  methods: ['GET'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['X-Rate-Limit', 'X-Request-Id'],
  credentials: true,
  maxAge: 86400
}));
```

#### Browser Security Considerations
- Preflight requests (OPTIONS) are automatically handled
- Credentials require explicit configuration
- Custom headers must be whitelisted
- Cache control headers should be set appropriately

## Content Validation

### Content Type Detection and Validation

The API automatically detects and validates content types:

#### Supported Content Types
- `text/html` - HTML documents with metadata extraction
- `application/json` - JSON data with schema validation
- `text/xml` - XML documents with well-formedness validation
- `text/plain` - Plain text with encoding detection
- `application/pdf` - PDF files with metadata extraction
- `image/*` - Image files with EXIF data extraction

#### Content Processing Pipeline
1. **Initial Validation**: Check content type against allowlist
2. **Size Verification**: Ensure content doesn't exceed limits
3. **Encoding Detection**: Identify character encoding for text content
4. **Security Scanning**: Check for malicious patterns
5. **Data Extraction**: Parse and extract relevant information
6. **Sanitization**: Clean and normalize content
7. **Response Formatting**: Structure data for API consumption

### Schema Validation for JSON Content

When fetching JSON data, the API can perform schema validation:

```json
{
  "validation": {
    "schema": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "email": {"type": "string", "format": "email"},
        "age": {"type": "number", "minimum": 0}
      },
      "required": ["name", "email"]
    },
    "result": "valid",
    "errors": []
  }
}
```

## Performance Considerations

### Caching Strategies

#### Response Caching
- Implement HTTP caching headers (Cache-Control, ETag)
- Use CDN integration for static content
- Apply intelligent cache invalidation strategies
- Monitor cache hit rates and adjust TTL values

#### Connection Pooling
- Reuse HTTP connections for multiple requests
- Implement connection timeout management
- Handle connection failures gracefully
- Monitor connection pool utilization

### Rate Limiting and Throttling

#### Request Rate Limits
- Per-client rate limiting to prevent abuse
- Global rate limiting for system protection
- Burst allowance for legitimate traffic spikes
- Graceful degradation under high load

#### Resource Management
- Memory usage monitoring and limits
- CPU time allocation per request
- Network bandwidth throttling
- Disk I/O optimization for temporary files

## Troubleshooting Guide

### Common Issues and Solutions

#### Connection Problems
**Issue**: Connection timeouts or refused connections
**Solution**: 
- Verify target URL accessibility
- Check firewall rules and network policies
- Validate DNS resolution
- Review proxy configurations

#### Content Parsing Errors
**Issue**: Failed to parse content or invalid format
**Solution**:
- Verify content type matches expected format
- Check for malformed HTML/XML
- Validate JSON structure
- Review encoding specifications

#### Security Blocking
**Issue**: Requests blocked by security policies
**Solution**:
- Add domain to allowlist
- Update security policies
- Verify SSL certificate validity
- Check for suspicious request patterns

#### Performance Issues
**Issue**: Slow response times or resource exhaustion
**Solution**:
- Optimize timeout settings
- Implement request queuing
- Add caching layers
- Monitor resource utilization

### Debugging Tools

#### Request Logging
Enable detailed request logging for troubleshooting:
```json
{
  "request": {
    "timestamp": "2024-01-01T00:00:00Z",
    "url": "https://example.com",
    "headers": {...},
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0"
  },
  "response": {
    "statusCode": 200,
    "duration": 1234,
    "size": 5678,
    "contentType": "application/json"
  }
}
```

#### Health Check Endpoints
Monitor API health and performance:
```
GET /api/health
GET /api/metrics
GET /api/status
```

## Conclusion

The URL Fetch API provides a secure, robust, and flexible solution for retrieving external content from web sources. With comprehensive security measures, extensive error handling, and multiple client integration options, it serves as a reliable foundation for applications requiring external data access.

Key benefits include:
- **Security-first design** with multiple layers of protection
- **Flexible content processing** supporting various formats
- **Comprehensive error handling** with actionable feedback
- **Multiple client integration options** for different platforms
- **Performance optimization** through caching and connection pooling
- **Extensive monitoring and debugging** capabilities

The API is designed to scale with your application needs while maintaining security and reliability standards. Regular updates and improvements ensure continued protection against emerging threats and performance optimizations.