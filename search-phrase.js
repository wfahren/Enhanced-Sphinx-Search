// Simple phrase search wrapper for Sphinx
(function() {
  function initPhraseSearch() {
    if (typeof Search === 'undefined' || !Search.query) {
      setTimeout(initPhraseSearch, 50);
      return;
    }

    const originalQuery = Search.query;

    Search.query = function(query) {
      console.log("PHRASE DEBUG: Original search query:", query);
      
      let phrases = [];
      
      // Check if query contains commas - if so, treat as multiple terms
      if (query.includes(',')) {
        // Split by comma and treat each part as a separate phrase
        phrases = query.split(',')
          .map(term => term.trim())
          .filter(term => term.length > 0)
          .map(term => term.replace(/^"|"$/g, '').toLowerCase()); // Remove quotes if present
        console.log("PHRASE DEBUG: Comma-separated search - treating as multiple phrases:", phrases);
      } else {
        // No commas - treat entire query as one phrase (remove outer quotes if present)
        const cleanQuery = query.replace(/^"|"$/g, '').trim();
        if (cleanQuery.length > 0) {
          phrases = [cleanQuery.toLowerCase()];
        }
        console.log("PHRASE DEBUG: Single phrase search:", phrases);
      }
      
      if (phrases.length === 0) {
        console.log("PHRASE DEBUG: No phrases after processing, using original search");
        localStorage.removeItem("sphinx_highlight_phrases");
        return originalQuery.call(this, query);
      }
      
      console.log("PHRASE DEBUG: Using phrase search for:", phrases);

      // Get initial results using original search
      const [searchQuery, searchTerms, excludedTerms, highlightTerms, objectTerms] = Search._parseQuery(query);
      const results = Search._performSearch(searchQuery, searchTerms, excludedTerms, highlightTerms, objectTerms);
      
      console.log("PHRASE DEBUG: Original search found", results.length, "results");
      console.log("PHRASE DEBUG: Will filter for phrases:", phrases);
      
      // Filter asynchronously by phrase content
      (async function() {
        const filtered = [];
        const contentRoot = document.documentElement.dataset.content_root;
        
        for (const result of results) {
          const [docName] = result;
          const url = contentRoot + docName + DOCUMENTATION_OPTIONS.FILE_SUFFIX;
          
          try {
            const response = await fetch(url);
            const html = await response.text();
            const text = Search.htmlToText(html).toLowerCase();
            
            const hasAllPhrases = phrases.every(phrase => text.includes(phrase));
            console.log(`PHRASE DEBUG: ${docName} contains all phrases:`, hasAllPhrases);
            
            if (hasAllPhrases) {
              filtered.push(result);
            }
          } catch (e) {
            console.log(`PHRASE DEBUG: Error fetching ${docName}, including anyway:`, e.message);
            filtered.push(result); // Include on error
          }
        }
        
        console.log("PHRASE DEBUG: Filtered down to", filtered.length, "results");

        // Store phrases for custom highlighting on destination pages
        console.log("PHRASE DEBUG: Storing phrases for custom highlighting:", phrases);
        // Store phrases separately to avoid word-splitting
        localStorage.setItem("sphinx_highlight_phrases", JSON.stringify(phrases));
        // Clear ALL possible Sphinx highlighting terms to prevent conflicts
        localStorage.removeItem("sphinx_highlight_terms");
        localStorage.removeItem("_sphinx_highlight_terms"); // Alternative key
        console.log("PHRASE DEBUG: Stored phrases in localStorage and cleared Sphinx terms");
        
        // Display results with phrase highlighting in search results
        // Use phrase terms for highlighting in search results too
        const phraseTerms = new Set(phrases);
        _displayNextItem(filtered, filtered.length, phraseTerms, phraseTerms);
      })();
    };
  }

  // Custom phrase highlighting for destination pages
  function highlightPhrases() {
    console.log("PHRASE DEBUG: highlightPhrases function called on:", window.location.href);
    console.log("PHRASE DEBUG: Page visit count:", (parseInt(sessionStorage.getItem("phrase_page_count") || "0") + 1));
    sessionStorage.setItem("phrase_page_count", parseInt(sessionStorage.getItem("phrase_page_count") || "0") + 1);
    
    const storedPhrases = localStorage.getItem("sphinx_highlight_phrases");
    console.log("PHRASE DEBUG: stored phrases from localStorage:", storedPhrases);
    
    // Monitor localStorage changes
    const allKeys = Object.keys(localStorage);
    const highlightKeys = allKeys.filter(key => key.includes('highlight') || key.includes('sphinx'));
    console.log("PHRASE DEBUG: All highlight-related localStorage keys:", highlightKeys);
    highlightKeys.forEach(key => {
      console.log(`PHRASE DEBUG: ${key} =`, localStorage.getItem(key));
    });
    
    // ONLY intervene if we have phrases to highlight
    // Otherwise let the normal Sphinx highlighting system work completely uninterrupted
    if (!storedPhrases) {
      console.log("PHRASE DEBUG: No stored phrases - letting normal Sphinx highlighting work without interference");
      return;
    }
    
    // We have phrases, so clear existing highlights and apply phrase highlighting
    const existingHighlights = document.querySelectorAll('span.highlighted, .highlighted, span[style*="background-color"]');
    console.log("PHRASE DEBUG: Found existing highlights to clear:", existingHighlights.length);
    existingHighlights.forEach(span => {
      console.log("PHRASE DEBUG: Clearing highlight:", span.outerHTML);
      const parent = span.parentNode;
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize(); // Merge adjacent text nodes
    });
    
    try {
      const phrases = JSON.parse(storedPhrases);
      console.log("PHRASE DEBUG: Highlighting phrases on page:", phrases);
      
      // Find and highlight each phrase in the page content
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      
      const textNodes = [];
      let node;
      while (node = walker.nextNode()) {
        textNodes.push(node);
      }
      
      // Collect all highlighting operations first to avoid DOM modification conflicts
      const highlightOperations = [];
      
      phrases.forEach(phrase => {
        textNodes.forEach(textNode => {
          const text = textNode.textContent;
          const lowerText = text.toLowerCase();
          let searchIndex = 0;
          
          // Find all occurrences of this phrase in the text node
          while (true) {
            const phraseIndex = lowerText.indexOf(phrase.toLowerCase(), searchIndex);
            if (phraseIndex === -1) break;
            
            const parent = textNode.parentNode;
            if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') {
              break;
            }
            
            highlightOperations.push({
              textNode: textNode,
              phraseIndex: phraseIndex,
              phrase: phrase,
              phraseLength: phrase.length
            });
            
            searchIndex = phraseIndex + phrase.length;
          }
        });
      });
      
      console.log("PHRASE DEBUG: Found", highlightOperations.length, "highlighting operations for phrases:", phrases);
      
      // Sort operations by text node and position to apply them correctly
      highlightOperations.sort((a, b) => {
        if (a.textNode !== b.textNode) return 0;
        return b.phraseIndex - a.phraseIndex; // Apply in reverse order to maintain positions
      });
      
      // Apply highlighting operations
      const processedNodes = new Set();
      highlightOperations.forEach(op => {
        if (processedNodes.has(op.textNode)) return; // Skip if node already processed
        
        // Get current text (may have changed due to previous operations)
        const text = op.textNode.textContent;
        let modifiedText = text;
        const replacements = [];
        
        // Find all phrases in this text node
        phrases.forEach(phrase => {
          const lowerText = modifiedText.toLowerCase();
          let searchIndex = 0;
          
          while (true) {
            const phraseIndex = lowerText.indexOf(phrase.toLowerCase(), searchIndex);
            if (phraseIndex === -1) break;
            
            replacements.push({
              start: phraseIndex,
              end: phraseIndex + phrase.length,
              phrase: phrase
            });
            
            searchIndex = phraseIndex + phrase.length;
          }
        });
        
        if (replacements.length > 0) {
          // Sort replacements by position (reverse order for correct replacement)
          replacements.sort((a, b) => b.start - a.start);
          
          // Apply all replacements to create highlighted HTML
          let finalHTML = text;
          replacements.forEach(replacement => {
            const beforeText = finalHTML.substring(0, replacement.start);
            const phraseText = finalHTML.substring(replacement.start, replacement.end);
            const afterText = finalHTML.substring(replacement.end);
            finalHTML = beforeText + '<span class="highlighted" style="background-color: yellow;">' + phraseText + '</span>' + afterText;
          });
          
          // Replace the text node with HTML
          const tempSpan = document.createElement('span');
          tempSpan.innerHTML = finalHTML;
          const parentElement = op.textNode.parentElement;
          
          // Move all child nodes from temp span to parent
          while (tempSpan.firstChild) {
            parentElement.insertBefore(tempSpan.firstChild, op.textNode);
          }
          parentElement.removeChild(op.textNode);
          
          processedNodes.add(op.textNode);
        }
      });
      
    } catch (e) {
      console.error("PHRASE DEBUG: Error parsing stored phrases:", e);
    }
  }

  // Monitor localStorage changes to catch external clearing
  const originalRemoveItem = localStorage.removeItem;
  const originalSetItem = localStorage.setItem;
  const originalClear = localStorage.clear;
  
  localStorage.removeItem = function(key) {
    if (key.includes('highlight') || key.includes('sphinx')) {
      console.log("PHRASE DEBUG: External code removing localStorage key:", key);
      console.trace("PHRASE DEBUG: Stack trace for localStorage removal");
    }
    return originalRemoveItem.call(this, key);
  };
  
  localStorage.setItem = function(key, value) {
    if (key.includes('highlight') || key.includes('sphinx')) {
      console.log("PHRASE DEBUG: External code setting localStorage key:", key, "=", value);
    }
    return originalSetItem.call(this, key, value);
  };
  
  localStorage.clear = function() {
    console.log("PHRASE DEBUG: External code clearing ALL localStorage");
    console.trace("PHRASE DEBUG: Stack trace for localStorage clear");
    return originalClear.call(this);
  };

  document.addEventListener('DOMContentLoaded', initPhraseSearch);
  document.addEventListener('DOMContentLoaded', highlightPhrases);
})();