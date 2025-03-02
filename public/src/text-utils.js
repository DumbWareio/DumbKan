// Text utility functions for DumbKan

/**
 * Convert URLs in text to clickable links and parse markdown
 * @param {string} text - The input text to be processed
 * @returns {string} HTML-formatted text with clickable links
 */
function linkify(text) {
  if (!text) return '';
  // First parse markdown
  const htmlContent = marked.parse(text, { breaks: true });
  // Then make URLs clickable if they aren't already
  const urlRegex = /(?<!["'])(https?:\/\/[^\s<]+)(?![^<]*>|[^<>]*<\/a>)/g;
  return htmlContent.replace(urlRegex, function(url) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

// Expose function globally
window.linkify = linkify; 