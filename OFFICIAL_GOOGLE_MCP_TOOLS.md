# Official Google MCP Tools & Configuration Guide

## Overview
This document lists official Google Model Context Protocol (MCP) tools that can help with configuration, integration, and development workflows.

---

## 🔵 Official Google Cloud MCP Servers (npm packages)

### Currently Configured ✅

#### 1. **@google-cloud/gcloud-mcp**
- **Package**: `@google-cloud/gcloud-mcp`
- **Version**: 0.5.2
- **Description**: Model Context Protocol (MCP) Server for interacting with GCP APIs
- **Homepage**: https://github.com/googleapis/gcloud-mcp
- **Status**: ✅ Configured
- **Use Cases**: 
  - General GCP API interactions
  - Cloud resource management
  - Service configuration

#### 2. **@google-cloud/cloud-run-mcp**
- **Package**: `@google-cloud/cloud-run-mcp`
- **Version**: 1.6.0
- **Description**: Cloud Run MCP deployment tool
- **Homepage**: https://github.com/GoogleCloudPlatform/cloud-run-mcp
- **Status**: ✅ Configured
- **Use Cases**:
  - Deploy and manage Cloud Run services
  - Container orchestration
  - Serverless application management

#### 3. **@google-cloud/observability-mcp**
- **Package**: `@google-cloud/observability-mcp`
- **Version**: 0.2.1
- **Description**: MCP Server for GCP environment for interacting with various Observability APIs
- **Homepage**: https://github.com/googleapis/gcloud-mcp
- **Status**: ✅ Configured
- **Use Cases**:
  - Monitoring and logging
  - Performance metrics
  - Cloud monitoring dashboards

---

## 🟢 Additional Official Google MCP Tools Available

### Google Maps Platform

#### 4. **Google Maps Code Assist Toolkit**
- **Package**: `@googlemaps/code-assist-mcp` (or similar)
- **Documentation**: https://developers.google.com/maps/ai/mcp
- **Use Cases**:
  - Google Maps integration
  - Location services
  - Geocoding and mapping
- **Configuration**: Supports local MCP server setup with stdio transport

#### 5. **Grounding Lite MCP Server**
- **Documentation**: https://developers.google.com/maps/ai/grounding-lite
- **Use Cases**:
  - Grounding LLMs with Google Maps data
  - Location-aware AI responses
- **Requirements**:
  - Enable Maps Grounding Lite API
  - API key or OAuth authentication

### Google Analytics

#### 6. **Google Analytics MCP Server**
- **Documentation**: https://developers.google.com/analytics/devguides/MCP
- **Use Cases**:
  - Query analytics data via natural language
  - Build custom analytics agents
  - Access user counts, top products, etc.
- **Integration**: Works with Gemini and other LLMs

### Google Workspace

#### 7. **Google Workspace MCP Server**
- **Website**: https://workspacemcp.com
- **Use Cases**:
  - Gmail integration
  - Google Drive access
  - Google Docs, Sheets, Calendar
  - Multi-user OAuth 2.1 support
- **Features**:
  - One-click installation for Claude Desktop
  - Environment variable support
  - Automatic credential loading

### Google Cloud Platform Services

#### 8. **BigQuery MCP Integration**
- **Documentation**: https://cloud.google.com/bigquery/docs/pre-built-tools-with-mcp-toolbox
- **Use Cases**:
  - Query BigQuery databases
  - Data analysis and reporting
  - SQL query execution
- **Integration**: MCP Toolbox compatible

#### 9. **Dataplex Universal Catalog MCP**
- **Documentation**: https://cloud.google.com/dataplex/docs/pre-built-tools-with-mcp-toolbox
- **Use Cases**:
  - Data cataloging
  - Data governance
  - Asset discovery
- **Integration**: MCP Toolbox compatible

#### 10. **Cloud Healthcare API MCP**
- **Documentation**: https://cloud.google.com/healthcare-api/docs/tutorials/pre-built-tools-with-mcp-toolbox
- **Use Cases**:
  - Healthcare data management
  - HIPAA-compliant data access
  - Medical record integration
- **Integration**: MCP Toolbox compatible

#### 11. **Google Kubernetes Engine (GKE) MCP Server**
- **Documentation**: https://docs.cloud.google.com/kubernetes-engine/docs/how-to/use-gke-mcp
- **Use Cases**:
  - Kubernetes cluster management
  - Container orchestration
  - Model Armor integration for security
- **Features**: Remote MCP server support

#### 12. **Compute Engine MCP Tools**
- **Documentation**: https://docs.cloud.google.com/compute/docs/reference/mcp/tools_overview
- **Use Cases**:
  - VM instance management
  - Compute resource configuration
  - Infrastructure automation

### Firebase

#### 13. **Firebase Studio MCP Server**
- **Documentation**: https://firebase.google.com/docs/studio/mcp-servers
- **Use Cases**:
  - Firestore data access
  - Realtime Database queries
  - SDK configuration
  - Firebase service setup

### Google Ads

#### 14. **Google Ads MCP Server**
- **Use Cases**:
  - Google Ads API integration
  - Campaign management
  - Keyword research
  - GAQL query execution
- **Features**: Automatic OAuth 2.0 authentication

### Google Merchant API

#### 15. **Merchant API MCP Integration**
- **Documentation**: https://developers.google.com/merchant/api/guides/devdocs-mcp
- **Use Cases**:
  - Migrate Content API for Shopping code
  - Merchant API integration
  - Product data management

### Chrome DevTools

#### 16. **Chrome DevTools MCP Server**
- **GitHub**: https://github.com/mcp/ChromeDevTools/chrome-devtools-mcp
- **Use Cases**:
  - Browser automation
  - Performance debugging
  - Live browser inspection
  - Chrome DevTools integration

---

## 📋 MCP Toolbox

Google provides an **MCP Toolbox** that includes pre-built tools for:
- BigQuery
- Dataplex Universal Catalog
- Cloud Healthcare API

These tools are compatible with various MCP clients including:
- Gemini CLI
- Claude Code
- Cursor
- Visual Studio Code

---

## 🔧 Configuration Recommendations

### For Your Current Setup

You already have these official Google Cloud MCP servers configured:
1. ✅ `@google-cloud/gcloud-mcp` - General GCP APIs
2. ✅ `@google-cloud/cloud-run-mcp` - Cloud Run services
3. ✅ `@google-cloud/observability-mcp` - Monitoring & logging

### Recommended Additions

Based on your project (financial categorization service), consider adding:

1. **BigQuery MCP** - For data analysis and reporting
   ```json
   "bigquery": {
     "command": "npx",
     "args": ["-y", "@google-cloud/bigquery-mcp"],
     "env": {
       "GOOGLE_APPLICATION_CREDENTIALS": "/Users/gene/.config/gcloud/application_default_credentials.json",
       "GOOGLE_CLOUD_PROJECT": "sdk-ai-blog-writer"
     }
   }
   ```

2. **Firebase MCP** - If using Firestore for data storage
   ```json
   "firebase": {
     "command": "npx",
     "args": ["-y", "@firebase/mcp-server"],
     "env": {
       "GOOGLE_APPLICATION_CREDENTIALS": "/Users/gene/.config/gcloud/application_default_credentials.json"
     }
   }
   ```

3. **Google Analytics MCP** - For analytics integration
   ```json
   "google-analytics": {
     "command": "npx",
     "args": ["-y", "@google/analytics-mcp"],
     "env": {
       "GOOGLE_APPLICATION_CREDENTIALS": "/Users/gene/.config/gcloud/application_default_credentials.json"
     }
   }
   ```

---

## 📚 Official Documentation Links

- **Google Cloud MCP**: https://docs.cloud.google.com/mcp
- **Google Maps MCP**: https://developers.google.com/maps/ai/mcp
- **MCP Toolbox**: https://cloud.google.com/bigquery/docs/pre-built-tools-with-mcp-toolbox
- **Firebase MCP**: https://firebase.google.com/docs/studio/mcp-servers
- **Known Issues**: https://docs.cloud.google.com/mcp/known-issues

---

## 🔍 Finding More Official MCP Servers

To discover additional official Google MCP servers:

1. **npm search**:
   ```bash
   npm search "@google-cloud" mcp
   npm search "@google" mcp
   ```

2. **Google Cloud Documentation**:
   - Visit https://cloud.google.com/docs
   - Search for "MCP" or "Model Context Protocol"

3. **GitHub**:
   - Search `googleapis` organization
   - Look for repositories with "mcp" in the name

---

## ✅ Verification

To verify official Google MCP packages:
```bash
npm view @google-cloud/gcloud-mcp
npm view @google-cloud/cloud-run-mcp
npm view @google-cloud/observability-mcp
```

All official Google packages will have:
- `@google-cloud/` or `@google/` prefix
- Official GitHub repositories under `googleapis` or `GoogleCloudPlatform`
- Official documentation on Google Cloud or Google Developers sites

---

**Last Updated**: December 28, 2024


