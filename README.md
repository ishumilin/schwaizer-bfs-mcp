<div align="center">
  <img src="./logo.png" alt="Schwaizer Logo" width="100"/>
  <h1>Schwaizer BFS MCP Server</h1>
  <p>
    <strong>An unofficial MCP server for accessing Swiss Federal Statistical Office (BFS) data</strong>
  </p>
  <p>
    <em>This is a community project by Schwaizer and is not an official implementation by the Swiss government.</em>
  </p>
</div>

---

## About Schwaizer

> **SHAPING SWITZERLAND'S AI FUTURE**
> 
> Empowering Swiss businesses and society through responsible AI adoption.
> 
> Founded in 2025, Schwaizer is a non-profit organization dedicated to accelerating the responsible adoption of artificial intelligence across Switzerland.

Website: https://www.schwaizer.ch

---

## Overview

The Schwaizer BFS MCP Server provides programmatic access to statistical data from the Swiss Federal Statistical Office (Bundesamt für Statistik / Office fédéral de la statistique) through the Model Context Protocol (MCP).

This server integrates with three BFS APIs:
- **PXWEB API** - Main statistical data API with comprehensive datasets
- **Swiss Stats Explorer (SSE) API** - Modern SDMX-based API for time-series data
- **DAM API** - Data Asset Management catalog for searching and discovering datasets

## Features

- 🔍 **Search datasets** by keywords, themes, and spatial divisions
- 📊 **Retrieve statistical data** with flexible filtering options
- 🌍 **Multi-language support** (German, French, Italian, English)
- 📈 **Time-series data** access via Swiss Stats Explorer API
- 🗂️ **Browse catalog** with 21 statistical themes
- 🔧 **Metadata exploration** to understand dataset structure
- ⚡ **Rate limiting handling** with automatic retries
- 📝 **Structured logging** for debugging

## Installation

### Prerequisites

- Node.js 20.0.0 or higher
- npm or pnpm

### Install Dependencies

```bash
npm install
```

### Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` to customize settings (optional):

```env
# Logging level (debug, info, warn, error)
LOG_LEVEL=info

# Optional: Rate limiting
BFS_REQUEST_DELAY=0
BFS_MAX_RETRIES=3
```

## Usage

### Running the Server

```bash
npm start
```

The server runs via stdio and can be integrated with any MCP-compatible client.

## Available Tools

### Catalog Tools

#### `search_datasets`
Search for statistical datasets in the BFS catalog.

**Parameters:**
- `language` (optional): Language for results (de, fr, it, en) - default: en
- `query` (optional): Search term to find in titles and descriptions
- `theme` (optional): Filter by theme (prodima number)
- `spatialDivision` (optional): Filter by spatial division level
- `publishingYearStart` (optional): Filter by publishing year start
- `publishingYearEnd` (optional): Filter by publishing year end
- `limit` (optional): Maximum results (1-1000) - default: 50

**Example:**
```javascript
{
  "language": "en",
  "query": "students",
  "theme": 900212,
  "limit": 10
}
```

#### `list_themes`
List all available statistical themes (categories).

**Parameters:**
- `language` (optional): Language for theme names - default: en

**Returns:** List of 21 themes with prodima numbers and codes.

#### `get_dataset_info`
Get detailed information about a specific dataset.

**Parameters:**
- `numberBfs` (optional): BFS number (e.g., "px-x-1502040100_131")
- `numberAsset` (optional): Asset number
- `language` (optional): Language for results - default: en

**Note:** Provide either `numberBfs` or `numberAsset`. The BFS number is different for PXWEB and SSE datasets.

### Data Tools

#### `get_statistical_data`
Retrieve statistical data from the PXWEB API.

**Parameters:**
- `numberBfs` (required): BFS number of the dataset
- `language` (optional): Language for results - default: en
- `query` (optional): Dimension filters as key-value pairs
- `format` (optional): Response format (json-stat, json, csv) - default: json-stat

**Example:**
```javascript
{
  "numberBfs": "px-x-1502040100_131",
  "language": "en",
  "query": {
    "Jahr": ["40", "41"],
    "Studienstufe": ["2", "3"]
  }
}
```

#### `get_sse_data`
Retrieve time-series data from the Swiss Stats Explorer API.

**Parameters:**
- `numberBfs` (required): SSE dataset identifier (e.g., "DF_LWZ_1")
- `language` (optional): Language for results - default: en
- `query` (optional): Dimension filters
- `startPeriod` (optional): Start period (e.g., "2020")
- `endPeriod` (optional): End period (e.g., "2023")

**Note:** The BFS number for SSE datasets is different from the PXWEB datasets.

**Example:**
```javascript
{
  "numberBfs": "DF_PASTA_552_MONTHLY",
  "language": "en",
  "query": {
    "FREQ": "M",
    "ACCOMMODATION_TYPE": ["552001"],
    "COUNTRY_ORIGIN": ["CH", "AUSL"]
  },
  "startPeriod": "2020",
  "endPeriod": "2023"
}
```

### Metadata Tools

#### `get_dataset_metadata`
Get complete metadata structure for a PXWEB dataset.

**Parameters:**
- `numberBfs` (required): BFS number of the dataset
- `language` (optional): Language for labels - default: en

**Returns:** Complete dimension structure with all codes and values.

#### `get_sse_metadata`
Get metadata for a Swiss Stats Explorer dataset.

**Parameters:**
- `numberBfs` (required): SSE dataset identifier
- `language` (optional): Language for labels - default: en

#### `get_dataset_dimensions`
Get a simplified view of available dimensions for filtering.

**Parameters:**
- `numberBfs` (required): BFS number of the dataset
- `language` (optional): Language for labels - default: en

**Returns:** Dimension codes with sample values for quick reference.

## Typical Workflow

### 1. Discover Datasets

```javascript
// Search for datasets about students
search_datasets({
  "query": "students",
  "language": "en",
  "theme": 900212  // Education theme
})
```

### 2. Explore Dataset Structure

```javascript
// Get metadata to understand available dimensions
get_dataset_metadata({
  "numberBfs": "px-x-1502040100_131",
  "language": "en"
})
```

### 3. Retrieve Data

```javascript
// Get filtered data
get_statistical_data({
  "numberBfs": "px-x-1502040100_131",
  "language": "en",
  "query": {
    "Jahr": ["40", "41"],  // Years 2020/21, 2021/22
    "Geschlecht": ["0", "1"]  // All genders
  }
})
```

## Example Use Case: Demographic Analysis

This section demonstrates a complete workflow for finding and retrieving specific demographic data.

**Goal:** Find the total permanent resident population of Zurich (ZH), Bern (BE), and Vaud (VD) for the years 2020-2024.

### Step 1: Search for Relevant Datasets

First, search for datasets related to population at the cantonal level.

```javascript
search_datasets({
  "language": "en",
  "query": "population",
  "spatialDivision": "Cantons"
})
```

This returns a list of datasets. We identify `"px-x-0102010000_102"` ("Permanent and non-permanent resident population by canton, sex, marital status and age, 2010-2024") as the most relevant one.

### Step 2: Get Dataset Metadata

Next, get the metadata to understand the dataset's structure and find the codes for filtering.

```javascript
get_dataset_metadata({
  "numberBfs": "px-x-0102010000_102",
  "language": "en"
})
```

From the metadata, we identify the following codes:
- **Cantons**: `ZH`, `BE`, `VD`
- **Population Type**: `1` (Permanent resident population)
- **Sex**: `-99999` (Total)
- **Marital Status**: `-99999` (Total)
- **Age**: `-99999` (Total)

### Step 3: Retrieve the Data

Finally, use the codes to query the specific data points.

```javascript
get_statistical_data({
  "language": "en",
  "numberBfs": "px-x-0102010000_102",
  "query": {
    "Jahr": ["2020", "2021", "2022", "2023", "2024"],
    "Kanton": ["ZH", "BE", "VD"],
    "Bevölkerungstyp": "1",
    "Geschlecht": "-99999",
    "Zivilstand": "-99999",
    "Alter": "-99999"
  },
  "format": "json"
})
```

### Step 4: Analyze the Results

The query returns the following data, which can then be used for analysis or visualization.

| Year | Canton | Population |
| :--- | :--- | :--- |
| 2020 | Zurich | 1,553,423 |
| 2020 | Bern | 1,043,081 |
| 2020 | Vaud | 814,762 |
| 2021 | Zurich | 1,564,662 |
| 2021 | Bern | 1,047,422 |
| 2021 | Vaud | 822,968 |
| 2022 | Zurich | 1,579,967 |
| 2022 | Bern | 1,051,437 |
| 2022 | Vaud | 830,431 |
| 2023 | Zurich | 1,605,508 |
| 2023 | Bern | 1,063,533 |
| 2023 | Vaud | 845,870 |
| 2024 | Zurich | 1,620,020 |
| 2024 | Bern | 1,071,216 |
| 2024 | Vaud | 855,106 |

This workflow demonstrates how to efficiently navigate the BFS data catalog and retrieve precise data for analysis.

## BFS Themes

The BFS organizes data into 21 thematic areas:

| Code | Theme | Prodima |
|------|-------|---------|
| 00 | Statistical basis and overviews | 900001 |
| 01 | Population | 900010 |
| 02 | Territory and environment | 900035 |
| 03 | Work and income | 900051 |
| 04 | National economy | 900075 |
| 05 | Prices | 900084 |
| 06 | Industry and services | 900092 |
| 07 | Agriculture and forestry | 900104 |
| 08 | Energy | 900127 |
| 09 | Construction and housing | 900140 |
| 10 | Tourism | 900160 |
| 11 | Mobility and transport | 900169 |
| 12 | Money, banks and insurance | 900191 |
| 13 | Social security | 900198 |
| 14 | Health | 900210 |
| 15 | Education and science | 900212 |
| 16 | Culture, media, information society, sports | 900214 |
| 17 | Politics | 900226 |
| 18 | General Government and finance | 900239 |
| 19 | Crime and criminal justice | 900257 |
| 20 | Economic and social situation of the population | 900269 |
| 21 | Sustainable development, regional disparities | 900276 |

## Rate Limiting

The BFS PXWEB API has rate limits. If you encounter HTTP 429 errors:

1. **Add delays between requests**: Set `BFS_REQUEST_DELAY` in `.env`
2. **Query specific dimensions**: Instead of requesting all data, filter by specific dimensions
3. **Use smaller datasets**: Break large queries into smaller chunks

## API Documentation

### PXWEB API
- Base URL: `https://www.pxweb.bfs.admin.ch/api/v1`
- Documentation: [PXWEB API Guide](https://www.bfs.admin.ch/bfs/en/home/services/recherche/stat-tab-online-data-search.html)

### Swiss Stats Explorer (SSE)
- Base URL: `https://stats.swiss/api/v1`
- Format: SDMX-based XML responses

### DAM API
- Base URL: `https://dam-api.bfs.admin.ch/hub/api`
- Purpose: Dataset catalog and metadata

## Error Handling

The server provides clear error messages for common issues:

- **404 Not Found**: Dataset doesn't exist - check the BFS number
- **429 Too Many Requests**: Rate limit exceeded - add delay or reduce query size
- **400 Bad Request**: Invalid query parameters - check dimension codes and values
- **No records found**: Query filters don't match any data - adjust filters or time period

## Development

### Project Structure

```
schwaizer-bfs-mcp/
├── src/
│   ├── index.js              # MCP server entry point
│   ├── config.js             # Configuration loader
│   ├── api/                  # API clients
│   │   ├── pxweb-client.js   # PXWEB API
│   │   ├── sse-client.js     # Swiss Stats Explorer
│   │   └── dam-client.js     # DAM catalog
│   ├── tools/                # MCP tool implementations
│   │   ├── catalog-tools.js  # Search & discovery
│   │   ├── data-tools.js     # Data retrieval
│   │   └── metadata-tools.js # Metadata access
│   └── utils/                # Utilities
│       ├── logger.js         # Logging
│       └── formatting.js     # Helpers
├── tests/                    # Test files
├── docs/                     # Documentation
├── .env.example              # Environment template
├── package.json              # Dependencies
└── README.md                 # This file
```

### Scripts

- `npm start` - Start the MCP server
- `npm run dev` - Start with auto-reload on file changes
- `npm test` - Run tests (when implemented)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - See LICENSE file for details

## Disclaimer

This is an unofficial community project and is not affiliated with or endorsed by the Swiss Federal Statistical Office (BFS/OFS/UST/UFS).

## Resources

- [BFS Official Website](https://www.bfs.admin.ch/)
- [BFS Data Catalog](https://www.bfs.admin.ch/bfs/en/home/statistics/catalogue.html)
- [Swiss Stats Explorer](https://stats.swiss/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Schwaizer Organization](https://github.com/schwaizer)

## Support

For issues and questions, please open an issue on the project's GitHub repository.

---

**Built with ❤️ by Schwaizer for the Swiss AI community**
