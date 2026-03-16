/**
 * Widget Injector — injects GHL AI chat and voice widgets into HTML
 */

const WIDGET_SCRIPTS = `
<!-- GHLU AI Chat Widget -->
<script src="https://beta.leadconnectorhq.com/loader.js" data-resources-url="https://beta.leadconnectorhq.com/chat-widget/loader.js" data-widget-id="69a567efdf0831625b117057"></script>

<!-- GHLU AI Voice Widget -->
<script src="https://beta.leadconnectorhq.com/loader.js" data-resources-url="https://beta.leadconnectorhq.com/chat-widget/loader.js" data-widget-id="69a56938a27e8cfa95d8377c"></script>
`;

/**
 * Inject AI widget scripts into HTML content
 * @param {string} html - The HTML content to inject into
 * @returns {string} Modified HTML with widgets injected
 */
export function injectWidgets(html) {
  if (!html || typeof html !== 'string') {
    throw new Error('Invalid HTML content provided');
  }

  // Try to inject before </body>
  const bodyCloseIndex = html.lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    return html.slice(0, bodyCloseIndex) + WIDGET_SCRIPTS + html.slice(bodyCloseIndex);
  }

  // Try before </html>
  const htmlCloseIndex = html.lastIndexOf('</html>');
  if (htmlCloseIndex !== -1) {
    return html.slice(0, htmlCloseIndex) + WIDGET_SCRIPTS + html.slice(htmlCloseIndex);
  }

  // Fallback: append to end
  return html + WIDGET_SCRIPTS;
}

/**
 * Verify that widget scripts are present in HTML
 * @param {string} html - HTML to check
 * @returns {boolean}
 */
export function verifyWidgets(html) {
  return html.includes('69a567efdf0831625b117057') && html.includes('69a56938a27e8cfa95d8377c');
}
