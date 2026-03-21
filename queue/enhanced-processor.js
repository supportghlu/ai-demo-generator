/**
 * Enhanced Demo Generation Queue Processor
 * Processes jobs using the new enhanced optimization pipeline
 */

import { getNextQueuedJob, updateStatus, setError, retryJob, addLog, setDemoUrl } from '../db.js';
import { processEnhancedDemo } from '../services/enhanced-orchestrator.js';

const POLL_INTERVAL = 10000; // 10 seconds
const MAX_RETRIES = 2;

let processing = false;

/**
 * Process a single demo generation job with enhanced optimization
 */
async function processEnhancedJob(job) {
  console.log(`[enhanced-processor] Starting enhanced job ${job.id} for ${job.website_url}`);

  try {
    // Update status to processing
    updateStatus(job.id, 'processing_enhanced');
    addLog(job.id, 'processing_enhanced', `Starting enhanced demo generation for ${job.website_url}`);

    // Prepare lead data for enhanced processor
    const leadData = {
      contactId: job.contact_id,
      name: job.name,
      email: job.email,
      phone: job.phone,
      websiteUrl: job.website_url,
      companyName: job.company_name || job.name
    };

    // Process through enhanced pipeline
    const result = await processEnhancedDemo(leadData);

    if (result.success) {
      // Enhanced demo completed successfully
      setDemoUrl(job.id, result.demoUrl);
      
      // Log enhanced analysis results
      if (result.analysis) {
        addLog(job.id, 'analysis_complete', 
          `Industry: ${result.analysis.industry} | ` +
          `Score: ${result.analysis.optimizationScore}/10 | ` +
          `Time: ${result.analysis.generationTime}s`);
        
        if (result.analysis.improvements > 0) {
          addLog(job.id, 'optimizations_applied', 
            `Applied ${result.analysis.improvements} conversion optimizations`);
        }
      }

      // Log any warnings
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => {
          addLog(job.id, 'warning', error);
        });
      }

      addLog(job.id, 'completed_enhanced', 
        `Enhanced demo generation complete: ${result.demoUrl}`);
      
      console.log(`[enhanced-processor] Enhanced job ${job.id} completed: ${result.demoUrl}`);

    } else {
      // Enhanced demo failed
      console.error(`[enhanced-processor] Enhanced job ${job.id} failed:`, result.error);
      addLog(job.id, 'enhanced_error', result.error);

      // Log partial analysis if available
      if (result.analysis) {
        addLog(job.id, 'partial_analysis', 
          `Partial analysis: ${result.analysis.industry || 'unknown'} industry`);
      }

      // Retry logic
      if (job.retry_count < MAX_RETRIES) {
        addLog(job.id, 'retry_enhanced', 
          `Enhanced processing failed, retrying (${job.retry_count + 1}/${MAX_RETRIES})`);
        retryJob(job.id);
        return;
      } else {
        setError(job.id, `Enhanced processing failed: ${result.error}`);
        return;
      }
    }

  } catch (err) {
    console.error(`[enhanced-processor] Job ${job.id} processing error:`, err);
    addLog(job.id, 'processing_error', err.message);
    
    if (job.retry_count < MAX_RETRIES) {
      addLog(job.id, 'retry_exception', 
        `Processing exception, retrying (${job.retry_count + 1}/${MAX_RETRIES})`);
      retryJob(job.id);
    } else {
      setError(job.id, `Processing exception: ${err.message}`);
    }
  }
}

/**
 * Poll for next job and process it
 */
async function pollEnhanced() {
  if (processing) return;
  processing = true;

  try {
    const job = getNextQueuedJob();
    if (job) {
      // Check if this should use enhanced processing
      const useEnhanced = shouldUseEnhancedProcessing(job);
      
      if (useEnhanced) {
        await processEnhancedJob(job);
      } else {
        // Fall back to original processing if needed
        console.log(`[enhanced-processor] Job ${job.id} using standard processing`);
        // Could import and call original processJob here if needed
      }
    }
  } catch (err) {
    console.error('[enhanced-processor] Poll error:', err);
  } finally {
    processing = false;
  }
}

/**
 * Determine if a job should use enhanced processing
 */
function shouldUseEnhancedProcessing(job) {
  // Re-enabled enhanced processing with proper Anthropic API configuration
  // Enhanced features now using Anthropic API (not rate limited)
  // - Feature flags
  // - Client tier  
  // - Job parameters
  return true; // Re-enabled with Anthropic API fix
}

/**
 * Start the enhanced queue processor
 */
export function startEnhancedProcessor() {
  console.log('[enhanced-processor] Enhanced queue processor started (polling every 10s)');
  console.log('[enhanced-processor] Features: Industry Analysis + Conversion Optimization');
  setInterval(pollEnhanced, POLL_INTERVAL);
  pollEnhanced(); // Run immediately
}

/**
 * Get enhanced processing statistics
 */
export function getProcessorStats() {
  return {
    processing,
    pollInterval: POLL_INTERVAL,
    maxRetries: MAX_RETRIES,
    features: [
      'Industry Analysis',
      'Conversion Optimization', 
      'Enhanced Website Generation',
      'AI Widget Integration'
    ]
  };
}