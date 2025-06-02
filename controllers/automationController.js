const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');

const openaiService = require('../services/openaiService');
const wordpressService = require('../services/wordpressService');
const automationQueue = require('../services/automationQueue');
const bulkAutomationService = require('../services/bulkAutomationService');

// Store active automations
let activeAutomations = new Map();
let scheduledJobs = new Map();

// Set up the execution callback for bulk automation service
bulkAutomationService.setExecutionCallback(async (jobData) => {
  const job = {
    id: uuidv4(),
    ...jobData,
    status: 'pending',
    createdAt: new Date(),
    progress: {
      content: 'pending',
      metadata: 'pending',
      images: 'pending',
      wordpress: 'pending'
    }
  };

  automationQueue.addJob(job);
  
  // Get io instance from the app (we'll need to pass this properly)
  const { io } = require('../server');
  executeAutomation(job, io);
});

// Get automation status
router.get('/status', (req, res) => {
  const io = req.app.get('io');
  const status = {
    active: activeAutomations.size > 0,
    queue: Array.from(automationQueue.getQueue()),
    activeJobs: Array.from(activeAutomations.keys()),
    scheduledJobs: Array.from(scheduledJobs.keys()),
    campaigns: bulkAutomationService.getAllCampaigns()
  };
  res.json(status);
});

// Create new automation job - simplified to just content prompt
router.post('/create', async (req, res) => {
  try {
    const {
      contentPrompt,
      publishDelay = 300000,
      schedule = null
    } = req.body;

    if (!contentPrompt) {
      return res.status(400).json({ error: 'Content prompt is required' });
    }

    const jobId = uuidv4();
    const io = req.app.get('io');

    const job = {
      id: jobId,
      contentPrompt,
      publishDelay,
      status: 'pending',
      createdAt: new Date(),
      progress: {
        content: 'pending',
        metadata: 'pending',
        images: 'pending',
        wordpress: 'pending'
      }
    };

    if (schedule) {
      // Schedule the job
      const cronJob = cron.schedule(schedule, () => {
        executeAutomation(job, io);
      }, { scheduled: false });
      
      scheduledJobs.set(jobId, cronJob);
      cronJob.start();
      
      job.status = 'scheduled';
      job.schedule = schedule;
    } else {
      // Execute immediately
      executeAutomation(job, io);
    }

    automationQueue.addJob(job);
    io.emit('job-created', job);

    res.json({ success: true, jobId, job });
  } catch (error) {
    console.error('Error creating automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// BULK AUTOMATION ENDPOINTS

// Create bulk automation campaign
router.post('/campaigns', async (req, res) => {
  try {
    const {
      name,
      prompts,
      frequency = 'daily',
      articlesPerDay = 1,
      customCron = null,
      publishDelay = 300000,
      isLooping = true
    } = req.body;

    if (!name || !prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ 
        error: 'Campaign name and prompts array are required' 
      });
    }

    const result = bulkAutomationService.createCampaign({
      name,
      prompts,
      frequency,
      articlesPerDay,
      customCron,
      publishDelay,
      isLooping
    });

    const io = req.app.get('io');
    io.emit('campaign-created', result);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error creating bulk campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all campaigns
router.get('/campaigns', (req, res) => {
  try {
    const campaigns = bulkAutomationService.getAllCampaigns();
    res.json(campaigns);
  } catch (error) {
    console.error('Error getting campaigns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign details
router.get('/campaigns/:campaignId', (req, res) => {
  try {
    const { campaignId } = req.params;
    const campaignDetails = bulkAutomationService.getCampaign(campaignId);
    
    if (!campaignDetails) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaignDetails);
  } catch (error) {
    console.error('Error getting campaign details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update campaign
router.put('/campaigns/:campaignId', (req, res) => {
  try {
    const { campaignId } = req.params;
    const updates = req.body;
    
    const updatedCampaign = bulkAutomationService.updateCampaign(campaignId, updates);
    
    if (!updatedCampaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const io = req.app.get('io');
    io.emit('campaign-updated', updatedCampaign);

    res.json({ success: true, campaign: updatedCampaign });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Pause/Resume campaign
router.post('/campaigns/:campaignId/:action', (req, res) => {
  try {
    const { campaignId, action } = req.params;
    
    let result;
    if (action === 'pause') {
      result = bulkAutomationService.pauseCampaign(campaignId);
    } else if (action === 'resume') {
      result = bulkAutomationService.resumeCampaign(campaignId);
    } else {
      return res.status(400).json({ error: 'Invalid action. Use pause or resume.' });
    }

    const io = req.app.get('io');
    io.emit('campaign-status-changed', { campaignId, action });

    res.json({ success: true, action });
  } catch (error) {
    console.error(`Error ${action}ing campaign:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Delete campaign
router.delete('/campaigns/:campaignId', (req, res) => {
  try {
    const { campaignId } = req.params;
    const deleted = bulkAutomationService.deleteCampaign(campaignId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const io = req.app.get('io');
    io.emit('campaign-deleted', { campaignId });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add prompts to campaign
router.post('/campaigns/:campaignId/prompts', (req, res) => {
  try {
    const { campaignId } = req.params;
    const { prompts } = req.body;
    
    if (!prompts || !Array.isArray(prompts)) {
      return res.status(400).json({ error: 'Prompts array is required' });
    }

    const newPrompts = bulkAutomationService.addPromptsToCampaign(campaignId, prompts);
    
    if (!newPrompts) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const io = req.app.get('io');
    io.emit('prompts-added', { campaignId, newPrompts });

    res.json({ success: true, newPrompts });
  } catch (error) {
    console.error('Error adding prompts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get campaign statistics
router.get('/campaigns/:campaignId/stats', (req, res) => {
  try {
    const { campaignId } = req.params;
    const stats = bulkAutomationService.getCampaignStats(campaignId);
    
    if (!stats) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(stats);
  } catch (error) {
    console.error('Error getting campaign stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute campaign step manually (for testing)
router.post('/campaigns/:campaignId/execute', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const io = req.app.get('io');
    
    const jobData = await bulkAutomationService.executeCampaignStep(campaignId);
    
    if (jobData) {
      // Execute the automation with the job data
      const job = {
        id: uuidv4(),
        ...jobData,
        status: 'pending',
        createdAt: new Date(),
        progress: {
          content: 'pending',
          metadata: 'pending',
          images: 'pending',
          wordpress: 'pending'
        }
      };

      automationQueue.addJob(job);
      executeAutomation(job, io);
      
      res.json({ success: true, job });
    } else {
      res.json({ success: false, message: 'No prompts available or campaign inactive' });
    }
  } catch (error) {
    console.error('Error executing campaign step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update job configuration
router.put('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const updates = req.body;
    const io = req.app.get('io');

    const job = automationQueue.getJob(jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Update job properties
    Object.assign(job, updates);
    job.updatedAt = new Date();

    automationQueue.updateJob(jobId, job);
    io.emit('job-updated', job);

    res.json({ success: true, job });
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel automation job
router.delete('/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const io = req.app.get('io');

    // Cancel scheduled job if exists
    if (scheduledJobs.has(jobId)) {
      scheduledJobs.get(jobId).stop();
      scheduledJobs.delete(jobId);
    }

    // Remove from active automations
    if (activeAutomations.has(jobId)) {
      activeAutomations.delete(jobId);
    }

    // Remove from queue
    automationQueue.removeJob(jobId);
    
    io.emit('job-cancelled', { jobId });
    res.json({ success: true });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get job details
router.get('/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = automationQueue.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({ error: error.message });
  }
});

// ================================
// PAGE GENERATION ENDPOINTS
// ================================

// Create new page generation job
router.post('/create-page', async (req, res) => {
  try {
    const {
      contentPrompt,
      parentPageId = null,
      publishDelay = 0, // Pages typically publish immediately
      schedule = null
    } = req.body;

    if (!contentPrompt) {
      return res.status(400).json({ error: 'Content prompt is required' });
    }

    const jobId = uuidv4();
    const io = req.app.get('io');

    const job = {
      id: jobId,
      type: 'page', // Distinguish from articles
      contentPrompt,
      parentPageId,
      publishDelay,
      status: 'pending',
      createdAt: new Date(),
      progress: {
        content: 'pending',
        metadata: 'pending',
        images: 'pending',
        wordpress: 'pending'
      }
    };

    if (schedule) {
      // Schedule the job
      const cronJob = cron.schedule(schedule, () => {
        executePageAutomation(job, io);
      }, { scheduled: false });
      
      scheduledJobs.set(jobId, cronJob);
      cronJob.start();
      
      job.status = 'scheduled';
      job.schedule = schedule;
    } else {
      // Execute immediately
      executePageAutomation(job, io);
    }

    automationQueue.addJob(job);
    io.emit('page-job-created', job);

    res.json({ success: true, jobId, job });
  } catch (error) {
    console.error('Error creating page automation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create bulk page automation campaign
router.post('/page-campaigns', async (req, res) => {
  try {
    const {
      name,
      prompts,
      frequency = 'daily',
      pagesPerDay = 1,
      customCron = null,
      publishDelay = 0,
      isLooping = true,
      parentPageId = null
    } = req.body;

    if (!name || !prompts || !Array.isArray(prompts) || prompts.length === 0) {
      return res.status(400).json({ 
        error: 'Campaign name and prompts array are required' 
      });
    }

    const result = bulkAutomationService.createCampaign({
      name,
      prompts,
      frequency,
      articlesPerDay: pagesPerDay, // Reuse the same property
      customCron,
      publishDelay,
      isLooping,
      type: 'page', // Mark as page campaign
      parentPageId
    });

    const io = req.app.get('io');
    io.emit('page-campaign-created', result);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error creating bulk page campaign:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get parent pages for page hierarchy
router.get('/parent-pages', async (req, res) => {
  try {
    const parentPages = await wordpressService.getParentPages();
    res.json(parentPages);
  } catch (error) {
    console.error('Error getting parent pages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute page campaign step manually (for testing)
router.post('/page-campaigns/:campaignId/execute', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const io = req.app.get('io');
    
    const jobData = await bulkAutomationService.executeCampaignStep(campaignId);
    
    if (jobData) {
      // Execute the page automation with the job data
      const job = {
        id: uuidv4(),
        type: 'page',
        ...jobData,
        status: 'pending',
        createdAt: new Date(),
        progress: {
          content: 'pending',
          metadata: 'pending',
          images: 'pending',
          wordpress: 'pending'
        }
      };

      automationQueue.addJob(job);
      executePageAutomation(job, io);
      
      res.json({ success: true, job });
    } else {
      res.json({ success: false, message: 'No prompts available or campaign inactive' });
    }
  } catch (error) {
    console.error('Error executing page campaign step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modified executeAutomation to handle campaign jobs
async function executeAutomation(job, io) {
  const { id: jobId } = job;
  const startTime = Date.now();
  
  try {
    activeAutomations.set(jobId, job);
    job.status = 'running';
    job.startedAt = new Date();
    
    io.emit('job-started', job);

    // Step 1: Generate article content
    updateProgress(job, 'content', 'generating', io);
    console.log(`🎯 Generating article for: "${job.contentPrompt}"`);
    
    const content = await openaiService.generateArticle(job.contentPrompt);
    job.generatedContent = content;
    updateProgress(job, 'content', 'completed', io);
    
    console.log(`✅ Article generated (${content.length} characters)`);

    // Step 2: Extract metadata from generated content
    updateProgress(job, 'metadata', 'generating', io);
    console.log(`🔍 Extracting metadata from generated content...`);
    
    const metadata = await openaiService.extractMetadataFromContent(content);
    job.title = metadata.title;
    job.category = metadata.category;
    job.tags = metadata.tags;
    job.imagePrompts = metadata.imagePrompts;
    job.featuredImagePrompt = metadata.featuredImagePrompt;
    
    updateProgress(job, 'metadata', 'completed', io);
    console.log(`✅ Metadata extracted: Title="${metadata.title}", Category="${metadata.category}"`);
    
    // Emit metadata update
    io.emit('metadata-extracted', { jobId, metadata });

    // Step 3: Generate images based on extracted prompts
    updateProgress(job, 'images', 'generating', io);
    console.log(`🖼️ Generating ${job.imagePrompts.length + 1} images...`);
    
    // Generate featured image
    const featuredImageUrl = await openaiService.generateImage(job.featuredImagePrompt);
    job.featuredImage = { prompt: job.featuredImagePrompt, url: featuredImageUrl };
    
    io.emit('image-generated', { jobId, type: 'featured', imageUrl: featuredImageUrl });
    
    // Generate content images
    const contentImages = await Promise.all(
      job.imagePrompts.map(async (prompt, index) => {
        const imageUrl = await openaiService.generateImage(prompt);
        io.emit('image-generated', { jobId, index, imageUrl, prompt });
        return { prompt, url: imageUrl, index };
      })
    );
    
    job.generatedImages = contentImages;
    updateProgress(job, 'images', 'completed', io);
    console.log(`✅ All images generated successfully`);

    // Step 4: Upload images to WordPress and get placement
    updateProgress(job, 'wordpress', 'creating', io);
    console.log(`📤 Uploading images to WordPress...`);
    
    // Upload featured image
    const featuredImageData = await wordpressService.uploadImageFromUrl(
      featuredImageUrl, 
      `featured-${jobId}.jpg`,
      job.featuredImagePrompt
    );
    job.featuredImageId = featuredImageData.id;
    
    // Upload content images
    const uploadedImages = await Promise.all(
      contentImages.map(async (image, index) => {
        const uploadedImage = await wordpressService.uploadImageFromUrl(
          image.url,
          `content-${jobId}-${index}.jpg`,
          image.prompt
        );
        return {
          ...image,
          wordpressId: uploadedImage.id,
          wordpressUrl: uploadedImage.url
        };
      })
    );
    
    job.uploadedImages = uploadedImages;
    console.log(`✅ All images uploaded to WordPress`);

    // Step 5: Find optimal image placement in content
    console.log(`📍 Finding optimal image placement...`);
    const imagePlacements = await openaiService.findImagePlacementInContent(content, contentImages.length);
    
    // Step 6: Insert images into content
    let finalContent = insertImagesIntoContent(content, uploadedImages, imagePlacements);
    job.finalContent = finalContent;
    
    console.log(`✅ Images inserted into content`);

    // Step 7: Create WordPress post with all metadata
    const postData = {
      title: job.title,
      content: finalContent,
      status: 'draft',
      categories: [job.category],
      tags: job.tags,
      featuredImageId: job.featuredImageId
    };

    const postId = await wordpressService.createPost(postData);
    job.wordpressPostId = postId;
    
    console.log(`✅ WordPress post created with ID: ${postId}`);
    
    // Step 8: Schedule publishing
    setTimeout(async () => {
      try {
        await wordpressService.publishPost(postId);
        job.status = 'published';
        job.publishedAt = new Date();
        updateProgress(job, 'wordpress', 'published', io);
        io.emit('job-completed', job);
        
        // Update campaign stats if this is a campaign job
        if (job.campaignId) {
          const executionTime = Date.now() - startTime;
          bulkAutomationService.updateExecutionStats(job.campaignId, true, executionTime);
          io.emit('campaign-job-completed', { 
            campaignId: job.campaignId, 
            jobId: job.id,
            promptIndex: job.promptIndex 
          });
        }
        
        console.log(`🚀 Post "${job.title}" published successfully!`);
      } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        io.emit('job-failed', job);
        
        // Update campaign stats if this is a campaign job
        if (job.campaignId) {
          const executionTime = Date.now() - startTime;
          bulkAutomationService.updateExecutionStats(job.campaignId, false, executionTime);
        }
        
        console.error(`❌ Failed to publish post: ${error.message}`);
      } finally {
        activeAutomations.delete(jobId);
      }
    }, job.publishDelay);

    updateProgress(job, 'wordpress', 'scheduled', io);
    job.status = 'scheduled-for-publish';
    
    console.log(`⏰ Post scheduled for publishing in ${job.publishDelay / 1000} seconds`);

  } catch (error) {
    console.error('Automation error:', error);
    job.status = 'failed';
    job.error = error.message;
    job.failedAt = new Date();
    
    // Update campaign stats if this is a campaign job
    if (job.campaignId) {
      const executionTime = Date.now() - startTime;
      bulkAutomationService.updateExecutionStats(job.campaignId, false, executionTime);
    }
    
    io.emit('job-failed', job);
    activeAutomations.delete(jobId);
  }
}

// Page automation execution function
async function executePageAutomation(job, io) {
  const { id: jobId } = job;
  const startTime = Date.now();
  
  try {
    activeAutomations.set(jobId, job);
    job.status = 'running';
    job.startedAt = new Date();
    
    io.emit('page-job-started', job);

    // Step 1: Generate page content
    updateProgress(job, 'content', 'generating', io);
    console.log(`📄 Generating page for: "${job.contentPrompt}"`);
    
    const content = await openaiService.generatePage(job.contentPrompt);
    job.generatedContent = content;
    updateProgress(job, 'content', 'completed', io);
    
    console.log(`✅ Page generated (${content.length} characters)`);

    // Step 2: Extract page metadata from generated content
    updateProgress(job, 'metadata', 'generating', io);
    console.log(`🔍 Extracting page metadata from generated content...`);
    
    const metadata = await openaiService.extractPageMetadata(content);
    job.title = metadata.title;
    job.slug = metadata.slug;
    job.metaDescription = metadata.metaDescription;
    job.pageType = metadata.pageType;
    job.imagePrompts = metadata.imagePrompts;
    job.featuredImagePrompt = metadata.featuredImagePrompt;
    
    updateProgress(job, 'metadata', 'completed', io);
    console.log(`✅ Page metadata extracted: Title="${metadata.title}", Type="${metadata.pageType}"`);
    
    // Emit metadata update
    io.emit('page-metadata-extracted', { jobId, metadata });

    // Step 3: Generate images based on extracted prompts (fewer images for pages)
    updateProgress(job, 'images', 'generating', io);
    console.log(`🖼️ Generating ${job.imagePrompts.length + 1} images for page...`);
    
    // Generate featured image
    const featuredImageUrl = await openaiService.generateImage(job.featuredImagePrompt);
    job.featuredImage = { prompt: job.featuredImagePrompt, url: featuredImageUrl };
    
    io.emit('page-image-generated', { jobId, type: 'featured', imageUrl: featuredImageUrl });
    
    // Generate content images
    const contentImages = await Promise.all(
      job.imagePrompts.map(async (prompt, index) => {
        const imageUrl = await openaiService.generateImage(prompt);
        io.emit('page-image-generated', { jobId, index, imageUrl, prompt });
        return { prompt, url: imageUrl, index };
      })
    );
    
    job.generatedImages = contentImages;
    updateProgress(job, 'images', 'completed', io);
    console.log(`✅ All page images generated successfully`);

    // Step 4: Upload images to WordPress
    updateProgress(job, 'wordpress', 'creating', io);
    console.log(`📤 Uploading page images to WordPress...`);
    
    // Upload featured image
    const featuredImageData = await wordpressService.uploadImageFromUrl(
      featuredImageUrl, 
      `page-featured-${jobId}.jpg`,
      job.featuredImagePrompt
    );
    job.featuredImageId = featuredImageData.id;
    
    // Upload content images
    const uploadedImages = await Promise.all(
      contentImages.map(async (image, index) => {
        const uploadedImage = await wordpressService.uploadImageFromUrl(
          image.url,
          `page-content-${jobId}-${index}.jpg`,
          image.prompt
        );
        return {
          ...image,
          wordpressId: uploadedImage.id,
          wordpressUrl: uploadedImage.url
        };
      })
    );
    
    job.uploadedImages = uploadedImages;
    console.log(`✅ All page images uploaded to WordPress`);

    // Step 5: Find optimal image placement in page content
    console.log(`📍 Finding optimal image placement for page...`);
    const imagePlacements = await openaiService.findPageImagePlacement(content, contentImages.length);
    
    // Step 6: Insert images into page content
    let finalContent = insertImagesIntoPageContent(content, uploadedImages, imagePlacements);
    job.finalContent = finalContent;
    
    console.log(`✅ Images inserted into page content`);

    // Step 7: Create WordPress page
    const pageData = {
      title: job.title,
      content: finalContent,
      status: job.publishDelay > 0 ? 'draft' : 'publish',
      parentId: job.parentPageId,
      featuredImageId: job.featuredImageId
    };

    const pageId = await wordpressService.createPage(pageData);
    job.wordpressPageId = pageId;
    
    console.log(`✅ WordPress page created with ID: ${pageId}`);
    
    // Step 8: Schedule publishing if needed
    if (job.publishDelay > 0) {
      setTimeout(async () => {
        try {
          await wordpressService.publishPage(pageId);
          job.status = 'published';
          job.publishedAt = new Date();
          updateProgress(job, 'wordpress', 'published', io);
          io.emit('page-job-completed', job);
          
          // Update campaign stats if this is a campaign job
          if (job.campaignId) {
            const executionTime = Date.now() - startTime;
            bulkAutomationService.updateExecutionStats(job.campaignId, true, executionTime);
            io.emit('page-campaign-job-completed', { 
              campaignId: job.campaignId, 
              jobId: job.id,
              promptIndex: job.promptIndex 
            });
          }
          
          console.log(`🚀 Page "${job.title}" published successfully!`);
        } catch (error) {
          job.status = 'failed';
          job.error = error.message;
          io.emit('page-job-failed', job);
          
          // Update campaign stats if this is a campaign job
          if (job.campaignId) {
            const executionTime = Date.now() - startTime;
            bulkAutomationService.updateExecutionStats(job.campaignId, false, executionTime);
          }
          
          console.error(`❌ Failed to publish page: ${error.message}`);
        } finally {
          activeAutomations.delete(jobId);
        }
      }, job.publishDelay);

      updateProgress(job, 'wordpress', 'scheduled', io);
      job.status = 'scheduled-for-publish';
      
      console.log(`⏰ Page scheduled for publishing in ${job.publishDelay / 1000} seconds`);
    } else {
      // Page was published immediately
      job.status = 'published';
      job.publishedAt = new Date();
      updateProgress(job, 'wordpress', 'published', io);
      io.emit('page-job-completed', job);
      
      // Update campaign stats if this is a campaign job
      if (job.campaignId) {
        const executionTime = Date.now() - startTime;
        bulkAutomationService.updateExecutionStats(job.campaignId, true, executionTime);
        io.emit('page-campaign-job-completed', { 
          campaignId: job.campaignId, 
          jobId: job.id,
          promptIndex: job.promptIndex 
        });
      }
      
      console.log(`🚀 Page "${job.title}" published successfully!`);
      activeAutomations.delete(jobId);
    }

  } catch (error) {
    console.error('Page automation error:', error);
    job.status = 'failed';
    job.error = error.message;
    job.failedAt = new Date();
    
    // Update campaign stats if this is a campaign job
    if (job.campaignId) {
      const executionTime = Date.now() - startTime;
      bulkAutomationService.updateExecutionStats(job.campaignId, false, executionTime);
    }
    
    io.emit('page-job-failed', job);
    activeAutomations.delete(jobId);
  }
}

function updateProgress(job, step, status, io) {
  job.progress[step] = status;
  job.updatedAt = new Date();
  io.emit('progress-update', { jobId: job.id, step, status, job });
}

function insertImagesIntoContent(content, images, placements) {
  const paragraphs = content.split('\n\n');
  
  // Sort placements by position in reverse order to avoid index shifting
  const sortedPlacements = placements
    .map((placement, index) => ({ ...placement, imageIndex: index }))
    .sort((a, b) => b.position - a.position);
  
  // Insert images at specified positions
  sortedPlacements.forEach(placement => {
    const image = images[placement.imageIndex];
    if (image && placement.position < paragraphs.length) {
      const imageHtml = `\n\n<figure class="wp-block-image">
        <img src="${image.wordpressUrl}" alt="${image.prompt}" class="wp-image-${image.wordpressId}" />
        <figcaption>${image.prompt}</figcaption>
      </figure>\n\n`;
      
      paragraphs.splice(placement.position + 1, 0, imageHtml);
    }
  });
  
  return paragraphs.join('\n\n');
}

// Page-specific image insertion function
function insertImagesIntoPageContent(content, images, placements) {
  // Split by sections (h2, h3 tags) rather than paragraphs for better page structure
  const sections = content.split(/(<h[2-4][^>]*>.*?<\/h[2-4]>)/gi);
  
  // Sort placements by position in reverse order to avoid index shifting
  const sortedPlacements = placements
    .map((placement, index) => ({ ...placement, imageIndex: index }))
    .sort((a, b) => b.position - a.position);
  
  // Insert images at specified positions
  sortedPlacements.forEach(placement => {
    const image = images[placement.imageIndex];
    if (image && placement.position < sections.length) {
      const sizeClass = placement.size === 'full-width' ? 'size-full' : 
                        placement.size === 'half-width' ? 'size-medium' : 'size-thumbnail';
      
      const imageHtml = `\n\n<figure class="wp-block-image ${sizeClass}">
        <img src="${image.wordpressUrl}" alt="${image.prompt}" class="wp-image-${image.wordpressId}" />
        <figcaption>${image.prompt}</figcaption>
      </figure>\n\n`;
      
      sections.splice(placement.position + 1, 0, imageHtml);
    }
  });
  
  return sections.join('');
}

module.exports = router; 