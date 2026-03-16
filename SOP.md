# SOP: AI Website Demo Generation System

## Purpose

Automatically generate a live AI-enabled version of a prospect's website, deliver it to them via email, and store the demo link in the CRM.

The goal is to show prospects their own website with AI chat and voice installed, increasing demo engagement and booked calls.

## System Overview

1. Lead submits website through opt-in form
2. System receives the website URL
3. Website is sent to Replit AI for cloning
4. AI widgets are injected into the cloned site
5. The demo site is deployed publicly
6. The demo link is stored in CRM
7. The lead receives an email with their demo

---

## Step 1: Monitor Lead Capture Form

Monitor the AI Website Demo opt-in form. When a submission occurs, capture:

- Name
- Email
- Phone
- Website URL

Create a CRM record with: Lead Source = AI Website Demo

## Step 2: Validate Website URL

Before sending to Replit, verify:

- The URL loads successfully
- The domain is reachable
- The website is not behind authentication

If validation fails: Status = FAILED, notify ops team.

## Step 3: Send Website to Replit AI

### REPLIT AI PROMPT

```
Recreate the website located at [INSERT WEBSITE URL] as accurately as possible.

I confirm I have full permission and consent to replicate this website.

Your task is to reproduce:

• The exact content
• The exact layout structure
• The same navigation
• The same sections
• The same headings and body text
• The same images (use the live image URLs from the website)
• The same page structure
• The same footer
• The same embedded media
• The same downloads section
• The same product layout
• The same blog structure

The final result should visually and structurally match the live website as closely as possible.

IMPORTANT

Do NOT copy raw HTML, CSS, or JavaScript from the original source code.

Rebuild it cleanly from scratch using original code while matching the visual output 1:1.

Technical Requirements

HTML5
Modern CSS (Flexbox/Grid)
Minimal vanilla JavaScript
Fully responsive design
Sticky navigation
Working dropdown menus
Responsive video embeds
Functional frontend contact forms
SEO meta tags

File structure must include:

index.html
style.css
script.js

Match:

Fonts
Colors
Spacing
Alignment
Section order
Button styles
Hover effects
```

## Step 4: Inject AI Widgets

After the site is generated, insert the following scripts before the closing `</body>` tag in index.html:

```html
<script 
src="https://beta.leadconnectorhq.com/loader.js"
data-resources-url="https://beta.leadconnectorhq.com/chat-widget/loader.js"
data-widget-id="69a567efdf0831625b117057">
</script>

<script 
src="https://beta.leadconnectorhq.com/loader.js"
data-resources-url="https://beta.leadconnectorhq.com/chat-widget/loader.js"
data-widget-id="69a56938a27e8cfa95d8377c">
</script>
```

Verify:
- Scripts load correctly
- No JavaScript conflicts
- Layout remains unchanged

## Step 5: Deploy Demo Website

Deploy the cloned site publicly using the format:

```
demo.yourdomain.com/{company-slug}
```

Slug rules:
- lowercase
- replace spaces with hyphens
- remove special characters

Example: `demo.yourdomain.com/charles-bentley`

## Step 6: Save Demo Link in CRM

Save the deployed demo URL in CRM.

Field name: `AI Demo Website`

Also store:
- Demo Generated Timestamp
- Demo Status (SUCCESS / FAILED / RETRY)

## Step 7: Send Demo Email

### Email Template

**Subject:** Your AI Website Demo Is Ready

**Body:**

```
Hi {{name}},

We built a live demo showing how AI would work directly on your website.

You can view it here:

{{AI Demo Website}}

Try asking the AI questions as if you were a customer visiting your site.

This shows how your website could automatically answer questions, capture leads, and convert visitors.

Let me know what you think.
```

## Step 8: Log System Activity

For every demo generation, record:
- Website URL
- Demo URL
- Generation Time
- Status

## Failure Handling

- If cloning fails: retry once
- If second attempt fails: Status = FAILED, notify ops team

## Success Criteria

- User submits a website
- Replit generates the clone
- AI widgets are inserted
- The site is deployed
- A demo link is generated
- The email is sent automatically
