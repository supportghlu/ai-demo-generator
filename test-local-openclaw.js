// Test the demo system with OpenClaw integration enabled locally
import 'dotenv/config';
import { generateWebsite } from './services/ai-generator.js';

// Sample scraped data for testing
const testData = {
  url: 'https://example-business.com',
  title: 'Example Marketing Agency',
  metaDescription: 'We help businesses grow with digital marketing',
  colors: ['#2563eb', '#1e40af', '#f8fafc'],
  fonts: ['Arial', 'sans-serif'],
  headings: [
    { level: 'h1', text: 'Welcome to Example Marketing' },
    { level: 'h2', text: 'Our Services' },
    { level: 'h2', text: 'About Us' }
  ],
  sections: [
    { textPreview: 'We are a full-service marketing agency specializing in digital marketing, SEO, and social media management.' },
    { textPreview: 'Our team has over 10 years of experience helping businesses grow their online presence.' }
  ],
  images: [
    { src: 'https://example-business.com/logo.png', alt: 'Company Logo' },
    { src: 'https://example-business.com/team.jpg', alt: 'Our Team' }
  ],
  navigation: [
    { text: 'Home' },
    { text: 'Services' },  
    { text: 'About' },
    { text: 'Contact' }
  ]
};

async function testLocalOpenClaw() {
  console.log('🧪 Testing Demo System with Local OpenClaw Integration\n');
  
  // Test with OpenClaw enabled
  process.env.USE_OPENCLAW = 'true';
  
  console.log('--- Testing with OpenClaw Integration (Claude Sonnet) ---');
  
  const start = Date.now();
  const result = await generateWebsite(testData, testData.url);
  const duration = Date.now() - start;
  
  if (result.success) {
    console.log('✅ OpenClaw generation successful!');
    console.log(`📊 Generated HTML length: ${result.files.html.length} chars`);
    console.log(`⏱️  Duration: ${duration}ms`);
    
    // Quality checks
    const html = result.files.html;
    const checks = {
      'HTML structure': html.includes('<html') && html.includes('</html>'),
      'Embedded CSS': html.includes('<style'),
      'Company name': html.includes('Example Marketing'),
      'Professional design': html.includes('gradient') || html.includes('rgba') || html.includes('box-shadow'),
      'Responsive design': html.includes('viewport') || html.includes('@media'),
      'Modern styling': html.includes('flex') || html.includes('grid') || html.includes('rem')
    };
    
    console.log('\n🔍 Quality Assessment:');
    Object.entries(checks).forEach(([check, passed]) => {
      console.log(`- ${check}: ${passed ? '✅' : '❌'}`);
    });
    
    // Save for comparison
    await import('fs/promises').then(fs => 
      fs.writeFile('openclaw-output.html', html)
    );
    console.log('\n💾 Output saved to openclaw-output.html');
    
    return true;
  } else {
    console.log('❌ OpenClaw generation failed:', result.error);
    
    // Test fallback to API
    console.log('\n--- Testing API Fallback (GPT-4) ---');
    process.env.USE_OPENCLAW = 'false';
    
    const fallbackResult = await generateWebsite(testData, testData.url);
    if (fallbackResult.success) {
      console.log('✅ API fallback successful!');
      console.log(`📊 Generated HTML length: ${fallbackResult.files.html.length} chars`);
      
      await import('fs/promises').then(fs => 
        fs.writeFile('api-fallback-output.html', fallbackResult.files.html)
      );
      console.log('💾 Fallback output saved to api-fallback-output.html');
      return true;
    } else {
      console.log('❌ Both OpenClaw and API fallback failed');
      return false;
    }
  }
}

testLocalOpenClaw().then(success => {
  process.exit(success ? 0 : 1);
});