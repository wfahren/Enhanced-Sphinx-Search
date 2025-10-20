# Enhanced Sphinx Search with Phrase Highlighting

This repository contains a Sphinx documentation site with enhanced search functionality that supports both exact phrase matching and multi-term searches with intelligent highlighting.

## Features

### 🔍 **Smart Search Types**

| Search Input | Behavior | Example |
|-------------|----------|---------|
| `single word` | Treats as exact phrase | `openvpn` → finds pages containing "openvpn" |
| `multiple words` | Treats as exact phrase | `openvpn server` → finds pages with "openvpn server" phrase |
| `"quoted text"` | Exact phrase search | `"public key"` → finds pages with exact phrase |
| `word1, word2` | Multiple terms (AND logic) | `openvpn, server` → finds pages with BOTH words |
| `word1, word2, word3` | All terms required | `key, server, config` → finds pages with ALL words |

### ✨ **Enhanced Highlighting**

- **Phrase Highlighting**: Complete phrases highlighted as units (not broken into individual words)
- **Multi-term Highlighting**: When using comma-separated search, all matching terms are highlighted
- **Persistent Highlighting**: Highlights remain when navigating between search result pages
- **Clean Transitions**: Highlights are properly cleared when performing new searches

### 🎯 **User Experience**

- **Intuitive**: No need to remember complex search syntax
- **Flexible**: Support for both phrase and multi-term searches
- **Visual**: Clear highlighting shows exactly what matched
- **Fast**: Asynchronous filtering for responsive search experience

## Installation

### Requirements

- Sphinx documentation generator
- Any Sphinx theme (tested with Read the Docs theme)
- Modern web browser with JavaScript enabled

> **⚠️ Important**: When opening HTML files directly in a browser using `Ctrl+O` or the `file://` protocol, JavaScript functionality is limited by browser security policies. The enhanced search features may not work properly. For full functionality, serve the documentation through a web server (even a local one like `python -m http.server`).

### Setup

1. **Add the search enhancement script** to your Sphinx project:

   ```text
   source/_static/js/search-phrase.js
   ```

2. **Update your `conf.py`** to include the script:

   ```python
   html_js_files = [
       'js/search-phrase.js',
       # ... your other JS files
   ]
   ```

3. **Build your documentation**:

   ```bash
   make html
   ```

## Technical Details

### Architecture

The enhancement uses a **wrapper approach** that:

- Preserves all original Sphinx functionality
- Adds phrase search capabilities on top
- Avoids conflicts with existing JavaScript
- Works with any Sphinx theme that doesn't override the search system

### Files Structure

```text
source/
├── _static/
│   └── js/
│       └── search-phrase.js    # Enhanced search wrapper
├── conf.py                     # Sphinx configuration
└── ...                         # Your documentation files
```

### How It Works

1. **Search Interception**: Wraps the original `Search.query` function
2. **Query Processing**: Analyzes input to determine search type (phrase vs. multi-term)
3. **Content Filtering**: Fetches and analyzes page content to verify phrase/term presence
4. **Result Display**: Shows filtered results using original Sphinx display functions
5. **Highlighting**: Applies custom highlighting on destination pages via localStorage

### Browser Support

- Modern browsers with ES6+ support
- Async/await functionality required
- localStorage support required

## Usage Examples

### Basic Searches

```text
openvpn                    # Find pages about OpenVPN
"public key infrastructure" # Find exact phrase
server configuration       # Find "server configuration" phrase
```

### Multi-term Searches

```text
openvpn, server           # Pages with both "openvpn" AND "server"
key, certificate, config  # Pages with all three terms
public, private, key      # Pages discussing all key types
```

### Advanced Examples

```text
"elliptic curve", RSA     # Exact phrase + additional term
configuration, setup      # Multiple related terms
"step by step"            # Exact instructional phrase
```

## Customization

### Styling

The highlighting uses this CSS class:

```css
.highlighted {
    background-color: yellow;
}
```

You can customize the appearance by adding CSS rules to your theme.

### Debug Mode

The script includes comprehensive debug logging. Check browser console for:

- Search query processing
- Content filtering results
- Highlighting operations
- localStorage management

### Theme Compatibility

This enhancement should work with any Sphinx theme that:

- Uses the standard Sphinx search system
- Doesn't completely override the `Search` object
- Supports custom JavaScript files via `html_js_files`

**Tested themes:**

- Read the Docs theme ✅
- Basic Sphinx theme ✅
- Most standard themes ✅

## Development

### Building

```bash
make clean
make html
```

### Testing

Test various search patterns:

1. Single words: `test`
2. Phrases: `test phrase`
3. Multi-terms: `test, phrase, example`
4. Navigation: Back button, multiple result pages
5. Highlighting: Check console for debug info

### Debugging

Enable browser developer console to see detailed logging:

- Query processing steps
- Content analysis results
- Highlighting operations
- Storage management

## Troubleshooting

### Common Issues

**Q: Search enhancement not working**
A: Check that `search-phrase.js` is loaded and there are no JavaScript console errors

**Q: Search doesn't work when opening files directly (file:// protocol)**
A: This is expected due to browser security restrictions. Use one of these solutions:

- Serve through a web server: `python -m http.server 8000` then visit `http://localhost:8000`
- Use the built-in development server if available
- Deploy to a web server for production use

**Q: Highlighting not appearing**
A: Ensure localStorage is enabled and check browser console for any errors

**Q: Multi-term search not working**
A: Verify you're using commas to separate terms: `term1, term2, term3`

**Q: Phrase search giving wrong results**
A: Check if quotes are needed for exact phrase matching: `"exact phrase"`

### Browser Compatibility

- **Chrome/Firefox/Safari/Edge**: Full support when served via HTTP(S)
- **File:// Protocol**: Limited functionality due to security restrictions
- **Older Browsers**: May not support all ES6+ features

## License

This enhancement maintains the same license as your documentation project.

## Contributing

When modifying the search functionality:

1. Test all search types thoroughly
2. Verify highlighting works on various page types
3. Check browser console for any JavaScript errors
4. Test navigation (back button, multiple searches)
5. Ensure compatibility with your Sphinx theme

## Changelog

### v1.0.0

- Initial implementation with phrase search
- Auto-quoting for single words
- Multi-term search with commas
- Persistent highlighting system
- Theme-agnostic wrapper approach

---

*This enhanced search system was developed to provide users with intuitive and powerful search capabilities while maintaining full compatibility with existing Sphinx documentation workflows.*
