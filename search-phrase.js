// Simple phrase search wrapper for Sphinx
(function() {
  function initPhraseSearch() {
    if (typeof Search === 'undefined' || !Search.query) {
      setTimeout(initPhraseSearch, 50);
      return;
    }

    const originalQuery = Search.query;

    Search.query = function(query) {
      console.log("PHRASE DEBUG: Original search query:", JSON.stringify(query), "Length:", query ? query.length : 'null');
      console.log("PHRASE DEBUG: Query type:", typeof query, "Trimmed:", query ? JSON.stringify(query.trim()) : 'null');
      
      // Handle special clear command with empty quotes
      if (query === '""' || query === "''") {
        console.log("PHRASE DEBUG: Clear command detected - clearing highlights and showing empty results");
        
        // Clear stored phrases to remove highlighting
        localStorage.removeItem("sphinx_highlight_phrases");
        localStorage.removeItem("sphinx_highlight_terms");
        localStorage.removeItem("_sphinx_highlight_terms");
        
        // Clear any existing highlights on current page
        clearHighlights();
        
        // Show empty search results to stay on search page but with no results
        console.log("PHRASE DEBUG: Clear command handled - highlights cleared, showing empty results");
        
        // Return empty results to display "No results found" message
        if (typeof _displayNextItem === 'function') {
          _displayNextItem([], 0, new Set(), new Set());
        }
        
        return; // Don't proceed with normal search
      }
      
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
    
    // Check if current URL indicates a clear command
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query === '""' || query === "''") {
      console.log("PHRASE DEBUG: Clear command detected in URL - clearing localStorage and highlights");
      
      // Check if this was already handled locally (global handler blocked navigation)
      const handledLocally = sessionStorage.getItem('phrase_clear_handled_locally');
      if (handledLocally) {
        console.log("PHRASE DEBUG: Clear was handled locally by global handler, no redirect needed");
        sessionStorage.removeItem('phrase_clear_handled_locally');
        return;
      }
      
      localStorage.removeItem("sphinx_highlight_phrases");
      localStorage.removeItem("sphinx_highlight_terms");
      localStorage.removeItem("_sphinx_highlight_terms");
      clearHighlights();
      
      // Get the previous page from history or use a stored reference
      const previousPage = sessionStorage.getItem('phrase_previous_page');
      console.log("PHRASE DEBUG: Stored previous page:", previousPage);
      console.log("PHRASE DEBUG: Current sessionStorage contents:", Object.keys(sessionStorage));
      
      if (previousPage && previousPage !== window.location.href) {
        console.log("PHRASE DEBUG: Redirecting back to previous page:", previousPage);
        // Redirect back to the previous page immediately
        setTimeout(function() {
          window.location.href = previousPage;
        }, 100);
      } else {
        console.log("PHRASE DEBUG: No valid previous page stored, staying on search results");
        // Just clear the highlights and stay on search results page
      }
      
      return; // Don't proceed with highlighting
    }
    
    // Store current page as previous page for potential redirect back
    if (!window.location.href.includes('search.html')) {
      const currentPage = window.location.href;
      sessionStorage.setItem('phrase_previous_page', currentPage);
      console.log("PHRASE DEBUG: Stored current page as previous:", currentPage);
      console.log("PHRASE DEBUG: Verification - stored value:", sessionStorage.getItem('phrase_previous_page'));
    } else {
      console.log("PHRASE DEBUG: On search page, not storing as previous page");
    }
    
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
        console.log(`PHRASE DEBUG: Looking for phrase: "${phrase}" on page`);
        let foundInAnyNode = false;
        
        textNodes.forEach(textNode => {
          const text = textNode.textContent;
          const lowerText = text.toLowerCase();
          const lowerPhrase = phrase.toLowerCase();
          
          // Check if this text node contains the phrase
          if (lowerText.includes(lowerPhrase)) {
            console.log(`PHRASE DEBUG: Found phrase "${phrase}" in text node:`, text.substring(0, 100));
            foundInAnyNode = true;
          }
          
          let searchIndex = 0;
          
          // Find all occurrences of this phrase in the text node
          while (true) {
            const phraseIndex = lowerText.indexOf(lowerPhrase, searchIndex);
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
        
        if (!foundInAnyNode) {
          console.log(`PHRASE DEBUG: Phrase "${phrase}" NOT FOUND on page`);
          console.log("PHRASE DEBUG: Sample page text:", document.body.textContent.toLowerCase().substring(0, 500));
        }
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

  // Function to clear all existing highlights on the current page
  function clearHighlights() {
    console.log("PHRASE DEBUG: clearHighlights called");
    
    // Remove all highlighted spans
    const highlightedSpans = document.querySelectorAll('.highlighted, span[style*="background-color: yellow"]');
    highlightedSpans.forEach(span => {
      console.log("PHRASE DEBUG: Removing highlight from:", span.textContent);
      const parent = span.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(span.textContent), span);
        parent.normalize(); // Merge adjacent text nodes
      }
    });
    
    console.log("PHRASE DEBUG: Cleared", highlightedSpans.length, "highlights");
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

  // Intercept search form submissions to handle empty searches
  function interceptSearchForm() {
    // Try multiple selectors to find search forms - be more aggressive
    const searchForms = document.querySelectorAll('form[role="search"], #searchbox form, form[action*="search"], form:has(input[name="q"]), .wy-form form, form');
    const searchInputs = document.querySelectorAll('input[name="q"], input[type="search"], #searchbox input');
    
    console.log("PHRASE DEBUG: Found", searchForms.length, "search forms and", searchInputs.length, "search inputs");
    console.log("PHRASE DEBUG: Search forms:", Array.from(searchForms).map(f => f.outerHTML.substring(0, 100)));
    console.log("PHRASE DEBUG: Search inputs:", Array.from(searchInputs).map(i => i.outerHTML));
    
    // Try to find forms that contain search inputs
    const formsWithSearchInputs = [];
    searchInputs.forEach(input => {
      const form = input.closest('form');
      if (form && !formsWithSearchInputs.includes(form)) {
        formsWithSearchInputs.push(form);
        console.log("PHRASE DEBUG: Found form containing search input:", form.outerHTML.substring(0, 100));
      }
    });
    
    // Intercept form submissions with capture=true to run before Sphinx handlers
    // Use ALL forms that contain search inputs
    const allSearchForms = [...new Set([...searchForms, ...formsWithSearchInputs])];
    console.log("PHRASE DEBUG: Will add event listeners to", allSearchForms.length, "forms");
    
    allSearchForms.forEach((form, index) => {
      console.log(`PHRASE DEBUG: Adding submit listener to form ${index}:`, form.outerHTML.substring(0, 100));
      form.addEventListener('submit', function(event) {
        const formData = new FormData(form);
        const query = formData.get('q') || '';
        console.log("PHRASE DEBUG: Form submit intercepted with query:", JSON.stringify(query), "on form:", form.outerHTML.substring(0, 50));
        
        // Check specifically for clear command
        if (query === '""' || query === "''") {
          console.log("PHRASE DEBUG: Clear command form submission - preventing navigation and clearing highlights");
          event.preventDefault(); // Prevent form submission
          event.stopPropagation(); // Stop event bubbling
          event.stopImmediatePropagation(); // Stop other handlers from running
          
          // Clear highlights on current page
          localStorage.removeItem("sphinx_highlight_phrases");
          localStorage.removeItem("sphinx_highlight_terms");
          localStorage.removeItem("_sphinx_highlight_terms");
          clearHighlights();
          
          // Clear the search input
          const searchInput = form.querySelector('input[name="q"], input[type="search"]');
          if (searchInput) {
            searchInput.value = '';
            searchInput.blur(); // Remove focus
          }
          
          console.log("PHRASE DEBUG: Clear command handled at form level - staying on current page");
          return false;
        }
      }, { capture: true }); // Use capture phase to run before other handlers
    });
    
    // Also intercept Enter key on search inputs directly
    searchInputs.forEach(input => {
      // Find the parent form for this input
      let parentForm = input.closest('form');
      if (parentForm) {
        console.log("PHRASE DEBUG: Found parent form for input:", parentForm.outerHTML.substring(0, 100));
        
        // Add form to our list if not already there
        if (!Array.from(searchForms).includes(parentForm)) {
          parentForm.addEventListener('submit', function(event) {
            const formData = new FormData(parentForm);
            const query = formData.get('q') || '';
            console.log("PHRASE DEBUG: Parent form submit intercepted with query:", JSON.stringify(query));
            
            // Check specifically for clear command
            if (query === '""' || query === "''") {
              console.log("PHRASE DEBUG: Clear command parent form submission - preventing navigation and clearing highlights");
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              
              localStorage.removeItem("sphinx_highlight_phrases");
              localStorage.removeItem("sphinx_highlight_terms");
              localStorage.removeItem("_sphinx_highlight_terms");
              clearHighlights();
              
              const searchInput = parentForm.querySelector('input[name="q"], input[type="search"]');
              if (searchInput) {
                searchInput.value = '';
                searchInput.blur();
              }
              
              console.log("PHRASE DEBUG: Clear command handled at parent form level - staying on current page");
              return false;
            }
          }, { capture: true });
        }
      }
      
      input.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
          const query = input.value || '';
          console.log("PHRASE DEBUG: Enter key pressed with query:", JSON.stringify(query));
          
          // Check specifically for clear command
          if (query === '""' || query === "''") {
            console.log("PHRASE DEBUG: Clear command Enter key - preventing navigation and clearing highlights");
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            
            // Clear highlights
            localStorage.removeItem("sphinx_highlight_phrases");
            localStorage.removeItem("sphinx_highlight_terms");
            localStorage.removeItem("_sphinx_highlight_terms");
            clearHighlights();
            
            input.value = '';
            input.blur();
            
            console.log("PHRASE DEBUG: Clear command handled at input level - staying on current page");
            return false;
          }
        }
      }, { capture: true });
    });
  }

  // Try to intercept search forms immediately, even before DOM is ready
  function immediateSearchIntercept() {
    // Use MutationObserver to catch forms as they're added
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            // Check if this node is a form or contains forms
            const forms = node.tagName === 'FORM' ? [node] : node.querySelectorAll ? Array.from(node.querySelectorAll('form')) : [];
            forms.forEach(function(form) {
              const searchInput = form.querySelector('input[name="q"]');
              if (searchInput) {
                console.log("PHRASE DEBUG: MutationObserver found search form, adding immediate handlers");
                addClearHandlers(form, searchInput);
              }
            });
          }
        });
      });
    });

    observer.observe(document, { childList: true, subtree: true });
    
    // Also try immediate detection if elements already exist
    setTimeout(function() {
      const existingForms = document.querySelectorAll('form');
      existingForms.forEach(function(form) {
        const searchInput = form.querySelector('input[name="q"]');
        if (searchInput) {
          console.log("PHRASE DEBUG: Found existing search form, adding immediate handlers");
          addClearHandlers(form, searchInput);
        }
      });
    }, 50);
  }

  function addClearHandlers(form, input) {
    // Prevent duplicate handlers
    if (form._clearHandlersAdded || input._clearHandlersAdded) {
      console.log("PHRASE DEBUG: Clear handlers already added to this form/input, skipping");
      return;
    }
    
    console.log("PHRASE DEBUG: Adding IMMEDIATE clear handlers to form and input");
    
    // Mark as having handlers to prevent duplicates
    form._clearHandlersAdded = true;
    input._clearHandlersAdded = true;
    
    // Add the clear command handlers immediately with maximum priority
    input.addEventListener('keydown', function(event) {
      console.log("PHRASE DEBUG: IMMEDIATE keydown event, key:", event.key, "value:", JSON.stringify(input.value));
      if (event.key === 'Enter' && (input.value === '""' || input.value === "''")) {
        console.log("PHRASE DEBUG: IMMEDIATE Clear command Enter key - BLOCKING EVERYTHING");
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        localStorage.removeItem("sphinx_highlight_phrases");
        localStorage.removeItem("sphinx_highlight_terms");
        localStorage.removeItem("_sphinx_highlight_terms");
        clearHighlights();
        
        input.value = '';
        input.blur();
        
        console.log("PHRASE DEBUG: IMMEDIATE Clear command handled - staying on current page");
        return false;
      }
    }, { capture: true, passive: false });

    form.addEventListener('submit', function(event) {
      const query = new FormData(form).get('q') || '';
      console.log("PHRASE DEBUG: IMMEDIATE form submit event, query:", JSON.stringify(query));
      if (query === '""' || query === "''") {
        console.log("PHRASE DEBUG: IMMEDIATE Clear command form submission - BLOCKING EVERYTHING");
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        localStorage.removeItem("sphinx_highlight_phrases");
        localStorage.removeItem("sphinx_highlight_terms");
        localStorage.removeItem("_sphinx_highlight_terms");
        clearHighlights();
        
        input.value = '';
        input.blur();
        
        console.log("PHRASE DEBUG: IMMEDIATE Clear command handled - staying on current page");
        return false;
      }
    }, { capture: true, passive: false });
    
    console.log("PHRASE DEBUG: IMMEDIATE clear handlers successfully added");
  }

  // Start immediate interception
  immediateSearchIntercept();

  // Also add a global keydown handler as backup
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
      const target = event.target;
      if (target && target.name === 'q' && (target.value === '""' || target.value === "''")) {
        console.log("PHRASE DEBUG: GLOBAL keydown handler caught clear command - BLOCKING");
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        localStorage.removeItem("sphinx_highlight_phrases");
        localStorage.removeItem("sphinx_highlight_terms");
        localStorage.removeItem("_sphinx_highlight_terms");
        clearHighlights();
        
        target.value = '';
        target.blur();
        
        // Mark that we handled this to prevent redirect-back mechanism
        sessionStorage.setItem('phrase_clear_handled_locally', 'true');
        
        console.log("PHRASE DEBUG: GLOBAL clear command handled - staying on current page");
        return false;
      }
    }
  }, { capture: true, passive: false });

  // Also add a global form submit handler as backup
  document.addEventListener('submit', function(event) {
    const form = event.target;
    if (form && form.tagName === 'FORM') {
      const searchInput = form.querySelector('input[name="q"]');
      if (searchInput && (searchInput.value === '""' || searchInput.value === "''")) {
        console.log("PHRASE DEBUG: GLOBAL submit handler caught clear command - BLOCKING");
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        localStorage.removeItem("sphinx_highlight_phrases");
        localStorage.removeItem("sphinx_highlight_terms");
        localStorage.removeItem("_sphinx_highlight_terms");
        clearHighlights();
        
        searchInput.value = '';
        searchInput.blur();
        
        console.log("PHRASE DEBUG: GLOBAL clear command handled - staying on current page");
        return false;
      }
    }
  }, { capture: true, passive: false });

  document.addEventListener('DOMContentLoaded', initPhraseSearch);
  document.addEventListener('DOMContentLoaded', highlightPhrases);
  document.addEventListener('DOMContentLoaded', function() {
    // Delay form interception to ensure all elements are loaded
    setTimeout(interceptSearchForm, 100);
  });
})();
