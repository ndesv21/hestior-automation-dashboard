const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');

class BulkAutomationService {
  constructor() {
    this.campaigns = new Map(); // Store bulk automation campaigns
    this.promptPools = new Map(); // Store prompt pools for each campaign
    this.scheduledJobs = new Map(); // Store cron jobs
    this.campaignStats = new Map(); // Store campaign statistics
    this.executionCallback = null; // Callback for executing jobs
  }

  // Set the callback function for executing jobs
  setExecutionCallback(callback) {
    this.executionCallback = callback;
  }

  // Create a new bulk automation campaign
  createCampaign(campaignData) {
    const {
      name,
      prompts,
      frequency, // 'daily', 'hourly', 'custom'
      articlesPerDay = 1,
      customCron = null,
      publishDelay = 300000,
      isActive = true,
      isLooping = true // Whether to loop back to start when all prompts are used
    } = campaignData;

    const campaignId = uuidv4();
    
    const campaign = {
      id: campaignId,
      name,
      frequency,
      articlesPerDay,
      customCron,
      publishDelay,
      isActive,
      isLooping,
      createdAt: new Date(),
      updatedAt: new Date(),
      currentPromptIndex: 0,
      totalArticlesGenerated: 0,
      lastExecutedAt: null,
      status: 'active'
    };

    // Create prompt pool
    const promptPool = {
      campaignId,
      prompts: prompts.map((prompt, index) => ({
        id: uuidv4(),
        text: prompt,
        index,
        timesUsed: 0,
        lastUsedAt: null
      })),
      totalPrompts: prompts.length
    };

    this.campaigns.set(campaignId, campaign);
    this.promptPools.set(campaignId, promptPool);
    this.campaignStats.set(campaignId, {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0
    });

    // Schedule the campaign
    if (isActive) {
      this.scheduleCampaign(campaignId);
    }

    return { campaignId, campaign, promptPool };
  }

  // Schedule a campaign based on frequency
  scheduleCampaign(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) return;

    let cronExpression;

    switch (campaign.frequency) {
      case 'hourly':
        cronExpression = '0 * * * *'; // Every hour
        break;
      case 'daily':
        // Distribute articles throughout the day
        const hoursInterval = Math.floor(24 / campaign.articlesPerDay);
        cronExpression = `0 */${hoursInterval} * * *`;
        break;
      case 'custom':
        cronExpression = campaign.customCron;
        break;
      default:
        cronExpression = '0 9 * * *'; // Default: 9 AM daily
    }

    // Stop existing scheduled job if any
    if (this.scheduledJobs.has(campaignId)) {
      this.scheduledJobs.get(campaignId).stop();
    }

    // Create new scheduled job
    const scheduledJob = cron.schedule(cronExpression, async () => {
      await this.executeCampaignStep(campaignId);
    }, { scheduled: false });

    this.scheduledJobs.set(campaignId, scheduledJob);
    scheduledJob.start();

    console.log(`📅 Campaign "${campaign.name}" scheduled with expression: ${cronExpression}`);
  }

  // Execute one step of a campaign (generate one article)
  async executeCampaignStep(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    const promptPool = this.promptPools.get(campaignId);
    
    if (!campaign || !promptPool || !campaign.isActive) {
      return null;
    }

    try {
      // Get next prompt
      const nextPrompt = this.getNextPrompt(campaignId);
      if (!nextPrompt) {
        console.log(`⚠️ No more prompts available for campaign "${campaign.name}"`);
        if (!campaign.isLooping) {
          this.pauseCampaign(campaignId);
        }
        return null;
      }

      // Create individual job for this prompt
      const jobData = {
        contentPrompt: nextPrompt.text,
        publishDelay: campaign.publishDelay,
        campaignId: campaignId,
        campaignName: campaign.name,
        promptId: nextPrompt.id,
        promptIndex: nextPrompt.index
      };

      // Update campaign stats
      campaign.currentPromptIndex = nextPrompt.index;
      campaign.totalArticlesGenerated++;
      campaign.lastExecutedAt = new Date();
      campaign.updatedAt = new Date();

      // Update prompt usage
      nextPrompt.timesUsed++;
      nextPrompt.lastUsedAt = new Date();

      console.log(`🚀 Executing campaign "${campaign.name}" - Prompt ${nextPrompt.index + 1}/${promptPool.totalPrompts}: "${nextPrompt.text.substring(0, 50)}..."`);

      // Execute the job if callback is set
      if (this.executionCallback) {
        await this.executionCallback(jobData);
      }

      return jobData;

    } catch (error) {
      console.error(`❌ Error executing campaign step for "${campaign.name}":`, error);
      const stats = this.campaignStats.get(campaignId);
      if (stats) {
        stats.failedExecutions++;
      }
      return null;
    }
  }

  // Get the next prompt in sequence
  getNextPrompt(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    const promptPool = this.promptPools.get(campaignId);
    
    if (!campaign || !promptPool) return null;

    const prompts = promptPool.prompts;
    if (prompts.length === 0) return null;

    let nextIndex = campaign.currentPromptIndex;
    
    // If we've reached the end and looping is enabled, start from beginning
    if (nextIndex >= prompts.length) {
      if (campaign.isLooping) {
        nextIndex = 0;
        campaign.currentPromptIndex = 0;
      } else {
        return null; // No more prompts and not looping
      }
    }

    const nextPrompt = prompts[nextIndex];
    
    // Move to next prompt for next execution
    campaign.currentPromptIndex = nextIndex + 1;
    
    return nextPrompt;
  }

  // Pause a campaign
  pauseCampaign(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      campaign.isActive = false;
      campaign.status = 'paused';
      campaign.updatedAt = new Date();
      
      if (this.scheduledJobs.has(campaignId)) {
        this.scheduledJobs.get(campaignId).stop();
      }
      
      console.log(`⏸️ Campaign "${campaign.name}" paused`);
    }
  }

  // Resume a campaign
  resumeCampaign(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      campaign.isActive = true;
      campaign.status = 'active';
      campaign.updatedAt = new Date();
      
      this.scheduleCampaign(campaignId);
      console.log(`▶️ Campaign "${campaign.name}" resumed`);
    }
  }

  // Stop and delete a campaign
  deleteCampaign(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      // Stop scheduled job
      if (this.scheduledJobs.has(campaignId)) {
        this.scheduledJobs.get(campaignId).stop();
        this.scheduledJobs.delete(campaignId);
      }
      
      // Remove from storage
      this.campaigns.delete(campaignId);
      this.promptPools.delete(campaignId);
      this.campaignStats.delete(campaignId);
      
      console.log(`🗑️ Campaign "${campaign.name}" deleted`);
      return true;
    }
    return false;
  }

  // Update campaign settings
  updateCampaign(campaignId, updates) {
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      Object.assign(campaign, updates);
      campaign.updatedAt = new Date();
      
      // Reschedule if frequency changed and campaign is active
      if ((updates.frequency || updates.articlesPerDay || updates.customCron) && campaign.isActive) {
        this.scheduleCampaign(campaignId);
      }
      
      return campaign;
    }
    return null;
  }

  // Add prompts to existing campaign
  addPromptsToCampaign(campaignId, newPrompts) {
    const promptPool = this.promptPools.get(campaignId);
    if (promptPool) {
      const startIndex = promptPool.prompts.length;
      const newPromptObjects = newPrompts.map((prompt, index) => ({
        id: uuidv4(),
        text: prompt,
        index: startIndex + index,
        timesUsed: 0,
        lastUsedAt: null
      }));
      
      promptPool.prompts.push(...newPromptObjects);
      promptPool.totalPrompts = promptPool.prompts.length;
      
      return newPromptObjects;
    }
    return null;
  }

  // Get all campaigns
  getAllCampaigns() {
    return Array.from(this.campaigns.values());
  }

  // Get campaign details
  getCampaign(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    const promptPool = this.promptPools.get(campaignId);
    const stats = this.campaignStats.get(campaignId);
    
    if (campaign) {
      return {
        campaign,
        promptPool,
        stats,
        nextPrompt: this.getNextPrompt(campaignId)
      };
    }
    return null;
  }

  // Get campaign statistics
  getCampaignStats(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    const stats = this.campaignStats.get(campaignId);
    const promptPool = this.promptPools.get(campaignId);
    
    if (campaign && stats && promptPool) {
      return {
        ...stats,
        totalPrompts: promptPool.totalPrompts,
        currentPromptIndex: campaign.currentPromptIndex,
        totalArticlesGenerated: campaign.totalArticlesGenerated,
        progressPercentage: promptPool.totalPrompts > 0 ? 
          Math.round((campaign.currentPromptIndex / promptPool.totalPrompts) * 100) : 0,
        isActive: campaign.isActive,
        lastExecutedAt: campaign.lastExecutedAt
      };
    }
    return null;
  }

  // Update execution stats
  updateExecutionStats(campaignId, success, executionTime) {
    const stats = this.campaignStats.get(campaignId);
    if (stats) {
      stats.totalExecutions++;
      if (success) {
        stats.successfulExecutions++;
      } else {
        stats.failedExecutions++;
      }
      
      // Update average execution time
      stats.averageExecutionTime = 
        (stats.averageExecutionTime * (stats.totalExecutions - 1) + executionTime) / stats.totalExecutions;
    }
  }
}

module.exports = new BulkAutomationService(); 