/**
 * Enhanced Demo Generation Queue Processor - PostgreSQL Edition
 * Uses hybrid database backend and persistent storage
 */

import { getNextQueuedJob, updateStatus, setError, retryJob, addLog, setDemoUrl } from '../db-hybrid.js';
import { processEnhancedDemo } from '../services/enhanced-orchestrator.js';
import { broadcastSSE } from '../routes/api.js';

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
    await updateStatus(job.id, 'processing_enhanced');
    await addLog(job.id, 'processing_enhanced', `Starting enhanced demo generation for ${job.website_url}`);
    broadcastSSE({ type: 'job_started', jobId: job.id, websiteUrl: job.website_url });

    // Prepare lead data for enhanced processor
    const leadData = {
      jobId: job.id,
      contactId: job.contact_id,
      name: job.name,
      email: job.email,
      phone: job.phone,
      websiteUrl: job.website_url,
      companyName: job.company_name || job.name,
      hasWebsite: job.has_website !== false,
      businessType: job.business_type || null,
      location: job.location || null,
      idealCustomers: job.ideal_customers || null,
      servicesOffered: job.services_offered || null
    };

    // Process through enhanced pipeline
    const result = await processEnhancedDemo(leadData);

    if (result.success) {
      // Enhanced demo completed successfully
      await setDemoUrl(job.id, result.demoUrl);
      
      // Log enhanced analysis results
      if (result.analysis) {
        await addLog(job.id, 'analysis_complete', 
          `Industry: ${result.analysis.industry || 'unknown'} | ` +
          `Score: ${result.analysis.optimizationScore || 'n/a'}/10 | ` +
          `Time: ${result.analysis.generationTime}s`);
        
        if (result.analysis.improvements > 0) {
          await addLog(job.id, 'optimizations_applied', 
            `Applied ${result.analysis.improvements} conversion optimizations`);
        }
      }

      // Log any warnings
      if (result.errors && result.errors.length > 0) {
        for (const error of result.errors) {
          await addLog(job.id, 'warning', error);
        }
      }

      await addLog(job.id, 'completed_enhanced', 
        `Enhanced demo generation complete: ${result.demoUrl}`);
      
      console.log(`[enhanced-processor] Enhanced job ${job.id} completed: ${result.demoUrl}`);
      broadcastSSE({ type: 'job_completed', jobId: job.id, demoUrl: result.demoUrl });

    } else {
      // Enhanced demo failed
      console.error(`[enhanced-processor] Enhanced job ${job.id} failed:`, result.error);
      await addLog(job.id, 'enhanced_error', result.error);

      // Log partial analysis if available
      if (result.analysis) {
        await addLog(job.id, 'partial_analysis', 
          `Partial analysis: ${result.analysis.industry || 'unknown'} industry`);
      }

      // Retry logic
      if (job.retry_count < MAX_RETRIES) {
        await addLog(job.id, 'retry_enhanced', 
          `Enhanced processing failed, retrying (${job.retry_count + 1}/${MAX_RETRIES})`);
        await retryJob(job.id);
        return;
      } else {
        await setError(job.id, `Enhanced processing failed: ${result.error}`);
        broadcastSSE({ type: 'job_failed', jobId: job.id, error: result.error });
        return;
      }
    }

  } catch (err) {
    console.error(`[enhanced-processor] Job ${job.id} processing error:`, err);
    await addLog(job.id, 'processing_error', err.message);

    if (job.retry_count < MAX_RETRIES) {
      await addLog(job.id, 'retry_exception',
        `Processing exception, retrying (${job.retry_count + 1}/${MAX_RETRIES})`);
      await retryJob(job.id);
    } else {
      await setError(job.id, `Processing exception: ${err.message}`);
      broadcastSSE({ type: 'job_failed', jobId: job.id, error: err.message });
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
    const job = await getNextQueuedJob();
    if (job) {
      // Check if this should use enhanced processing
      const useEnhanced = shouldUseEnhancedProcessing(job);
      
      if (useEnhanced) {
        await processEnhancedJob(job);
      } else {
        // Fall back to original processing if needed
        console.log(`[enhanced-processor] Job ${job.id} using standard processing`);
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
  // Enhanced processing enabled with database persistence
  return true;
}

/**
 * Start the enhanced queue processor
 */
export function startEnhancedProcessor() {
  console.log('[enhanced-processor] Enhanced queue processor started (polling every 10s)');
  console.log('[enhanced-processor] Features: Industry Analysis + Conversion Optimization + Persistent Storage');
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
      'AI Widget Integration',
      'Database Persistence'
    ]
  };
}