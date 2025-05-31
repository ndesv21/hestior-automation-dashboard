// Initialize Socket.IO connection
const socket = io();

// DOM Elements
const elements = {
    createJobBtn: document.getElementById('create-job-btn'),
    createJobModal: document.getElementById('create-job-modal'),
    closeModal: document.getElementById('close-modal'),
    cancelJob: document.getElementById('cancel-job'),
    jobForm: document.getElementById('job-form'),
    jobList: document.getElementById('job-list'),
    liveProgress: document.getElementById('live-progress'),
    progressContainer: document.getElementById('progress-container'),
    toastContainer: document.getElementById('toast-container'),
    activeJobs: document.getElementById('active-jobs'),
    activeCampaigns: document.getElementById('active-campaigns'),
    completedJobs: document.getElementById('completed-jobs'),
    failedJobs: document.getElementById('failed-jobs'),
    refreshQueue: document.getElementById('refresh-queue'),
    clearCompleted: document.getElementById('clear-completed'),
    jobDetailsModal: document.getElementById('job-details-modal'),
    closeDetailsModal: document.getElementById('close-details-modal'),
    jobDetailsContent: document.getElementById('job-details-content'),
    
    // Bulk automation elements
    createCampaignBtn: document.getElementById('create-campaign-btn'),
    createCampaignModal: document.getElementById('create-campaign-modal'),
    closeCampaignModal: document.getElementById('close-campaign-modal'),
    cancelCampaign: document.getElementById('cancel-campaign'),
    campaignForm: document.getElementById('campaign-form'),
    campaignsList: document.getElementById('campaigns-list'),
    refreshCampaigns: document.getElementById('refresh-campaigns'),
    campaignDetailsModal: document.getElementById('campaign-details-modal'),
    closeCampaignDetailsModal: document.getElementById('close-campaign-details-modal'),
    campaignDetailsContent: document.getElementById('campaign-details-content'),
    
    // Campaign form elements
    campaignFrequency: document.getElementById('campaign-frequency'),
    articlesPerDayGroup: document.getElementById('articles-per-day-group'),
    customCronGroup: document.getElementById('custom-cron-group')
};

// Quick action buttons
const quickActions = {
    tech: document.getElementById('quick-tech-article'),
    lifestyle: document.getElementById('quick-lifestyle-article'),
    business: document.getElementById('quick-business-article'),
    custom: document.getElementById('quick-custom-article')
};

// Application state
let jobs = new Map();
let campaigns = new Map();
let activeJobs = new Set();

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadInitialData();
});

// Event Listeners
function initializeEventListeners() {
    // Modal controls
    elements.createJobBtn.addEventListener('click', () => showModal(elements.createJobModal));
    elements.closeModal.addEventListener('click', () => hideModal(elements.createJobModal));
    elements.cancelJob.addEventListener('click', () => hideModal(elements.createJobModal));
    elements.closeDetailsModal.addEventListener('click', () => hideModal(elements.jobDetailsModal));
    
    // Campaign modal controls
    elements.createCampaignBtn.addEventListener('click', () => showModal(elements.createCampaignModal));
    elements.closeCampaignModal.addEventListener('click', () => hideModal(elements.createCampaignModal));
    elements.cancelCampaign.addEventListener('click', () => hideModal(elements.createCampaignModal));
    elements.closeCampaignDetailsModal.addEventListener('click', () => hideModal(elements.campaignDetailsModal));
    
    // Form submissions
    elements.jobForm.addEventListener('submit', handleJobSubmission);
    elements.campaignForm.addEventListener('submit', handleCampaignSubmission);
    
    // Campaign frequency change handler
    elements.campaignFrequency.addEventListener('change', handleFrequencyChange);
    
    // Quick actions
    quickActions.tech.addEventListener('click', () => createQuickJob('tech'));
    quickActions.lifestyle.addEventListener('click', () => createQuickJob('lifestyle'));
    quickActions.business.addEventListener('click', () => createQuickJob('business'));
    quickActions.custom.addEventListener('click', () => showModal(elements.createJobModal));
    
    // Queue controls
    elements.refreshQueue.addEventListener('click', loadInitialData);
    elements.refreshCampaigns.addEventListener('click', loadCampaigns);
    elements.clearCompleted.addEventListener('click', clearCompletedJobs);
    
    // Close modals on outside click
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            hideModal(e.target);
        }
    });
}

// Socket.IO Event Handlers
socket.on('connect', () => {
    console.log('Connected to server');
    showToast('Connected', 'Real-time updates enabled', 'success');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    showToast('Disconnected', 'Connection lost. Attempting to reconnect...', 'warning');
});

socket.on('job-created', (job) => {
    jobs.set(job.id, job);
    addJobToList(job);
    updateStats();
    showToast('Job Created', 'AI article generation started!', 'success');
});

socket.on('job-started', (job) => {
    jobs.set(job.id, job);
    activeJobs.add(job.id);
    updateJobInList(job);
    showLiveProgress(job);
    updateStats();
    showToast('Job Started', 'AI is now creating your article', 'info');
});

socket.on('metadata-extracted', ({ jobId, metadata }) => {
    const job = jobs.get(jobId);
    if (job) {
        Object.assign(job, metadata);
        updateJobInList(job);
        updateLiveProgress(job);
        showToast('Metadata Ready', `Title: "${metadata.title}"`, 'info');
    }
});

socket.on('progress-update', ({ jobId, step, status, job }) => {
    jobs.set(jobId, job);
    updateJobInList(job);
    updateLiveProgress(job);
    
    const stepNames = {
        content: 'Content Generation',
        metadata: 'Metadata Extraction',
        images: 'Image Generation',
        wordpress: 'WordPress Publishing'
    };
    
    if (status === 'completed') {
        showToast('Step Completed', `${stepNames[step]} finished`, 'success');
    }
});

socket.on('image-generated', ({ jobId, type, index, imageUrl, prompt }) => {
    const job = jobs.get(jobId);
    if (job) {
        if (type === 'featured') {
            showToast('Featured Image Ready', 'Featured image generated', 'info');
        } else {
            showToast('Image Ready', `Content image ${index + 1} generated`, 'info');
        }
    }
});

socket.on('job-completed', (job) => {
    jobs.set(job.id, job);
    activeJobs.delete(job.id);
    updateJobInList(job);
    hideLiveProgress(job.id);
    updateStats();
    showToast('Article Published!', `"${job.title}" is now live on your site!`, 'success');
});

socket.on('job-failed', (job) => {
    jobs.set(job.id, job);
    activeJobs.delete(job.id);
    updateJobInList(job);
    hideLiveProgress(job.id);
    updateStats();
    showToast('Job Failed', `Error: ${job.error}`, 'error');
});

socket.on('job-cancelled', ({ jobId }) => {
    jobs.delete(jobId);
    activeJobs.delete(jobId);
    removeJobFromList(jobId);
    hideLiveProgress(jobId);
    updateStats();
    showToast('Job Cancelled', 'Job has been cancelled', 'info');
});

// Campaign Socket Events
socket.on('campaign-created', ({ campaign }) => {
    campaigns.set(campaign.id, campaign);
    addCampaignToList(campaign);
    updateStats();
    showToast('Campaign Created', `"${campaign.name}" is now active!`, 'success');
});

socket.on('campaign-updated', (campaign) => {
    campaigns.set(campaign.id, campaign);
    updateCampaignInList(campaign);
    updateStats();
    showToast('Campaign Updated', `"${campaign.name}" settings updated`, 'info');
});

socket.on('campaign-status-changed', ({ campaignId, action }) => {
    const campaign = campaigns.get(campaignId);
    if (campaign) {
        campaign.isActive = action === 'resume';
        campaign.status = action === 'resume' ? 'active' : 'paused';
        updateCampaignInList(campaign);
        updateStats();
        showToast('Campaign Status', `Campaign ${action}d`, 'info');
    }
});

socket.on('campaign-deleted', ({ campaignId }) => {
    campaigns.delete(campaignId);
    removeCampaignFromList(campaignId);
    updateStats();
    showToast('Campaign Deleted', 'Campaign has been removed', 'info');
});

socket.on('campaign-job-completed', ({ campaignId, jobId, promptIndex }) => {
    const campaign = campaigns.get(campaignId);
    if (campaign) {
        updateCampaignInList(campaign);
        showToast('Campaign Article', `Article ${promptIndex + 1} published from campaign`, 'success');
    }
});

// API Functions
async function loadInitialData() {
    try {
        const response = await fetch('/api/automation/status');
        const data = await response.json();
        
        // Clear existing jobs
        jobs.clear();
        activeJobs.clear();
        elements.jobList.innerHTML = '';
        
        // Load jobs from queue
        data.queue.forEach(job => {
            jobs.set(job.id, job);
            if (job.status === 'running') {
                activeJobs.add(job.id);
                showLiveProgress(job);
            }
            addJobToList(job);
        });
        
        // Load campaigns
        if (data.campaigns) {
            campaigns.clear();
            elements.campaignsList.innerHTML = '';
            data.campaigns.forEach(campaign => {
                campaigns.set(campaign.id, campaign);
                addCampaignToList(campaign);
            });
        }
        
        updateStats();
    } catch (error) {
        console.error('Error loading initial data:', error);
        showToast('Error', 'Failed to load automation status', 'error');
    }
}

async function loadCampaigns() {
    try {
        const response = await fetch('/api/automation/campaigns');
        const campaignsData = await response.json();
        
        campaigns.clear();
        elements.campaignsList.innerHTML = '';
        
        campaignsData.forEach(campaign => {
            campaigns.set(campaign.id, campaign);
            addCampaignToList(campaign);
        });
        
        updateStats();
    } catch (error) {
        console.error('Error loading campaigns:', error);
        showToast('Error', 'Failed to load campaigns', 'error');
    }
}

async function createJob(jobData) {
    try {
        const response = await fetch('/api/automation/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jobData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            hideModal(elements.createJobModal);
            elements.jobForm.reset();
        } else {
            throw new Error(result.error || 'Failed to create job');
        }
    } catch (error) {
        console.error('Error creating job:', error);
        showToast('Error', `Failed to create job: ${error.message}`, 'error');
    }
}

async function createCampaign(campaignData) {
    try {
        const response = await fetch('/api/automation/campaigns', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(campaignData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            hideModal(elements.createCampaignModal);
            elements.campaignForm.reset();
            handleFrequencyChange(); // Reset form visibility
        } else {
            throw new Error(result.error || 'Failed to create campaign');
        }
    } catch (error) {
        console.error('Error creating campaign:', error);
        showToast('Error', `Failed to create campaign: ${error.message}`, 'error');
    }
}

async function pauseResumeCampaign(campaignId, action) {
    try {
        const response = await fetch(`/api/automation/campaigns/${campaignId}/${action}`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || `Failed to ${action} campaign`);
        }
    } catch (error) {
        console.error(`Error ${action}ing campaign:`, error);
        showToast('Error', `Failed to ${action} campaign: ${error.message}`, 'error');
    }
}

async function deleteCampaign(campaignId) {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/automation/campaigns/${campaignId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete campaign');
        }
    } catch (error) {
        console.error('Error deleting campaign:', error);
        showToast('Error', `Failed to delete campaign: ${error.message}`, 'error');
    }
}

async function getCampaignDetails(campaignId) {
    try {
        const response = await fetch(`/api/automation/campaigns/${campaignId}`);
        const campaignDetails = await response.json();
        return campaignDetails;
    } catch (error) {
        console.error('Error getting campaign details:', error);
        return null;
    }
}

async function executeCampaignStep(campaignId) {
    try {
        const response = await fetch(`/api/automation/campaigns/${campaignId}/execute`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success && result.job) {
            showToast('Campaign Executed', 'Manual campaign step executed', 'success');
        } else {
            showToast('No Action', result.message || 'No prompts available', 'info');
        }
    } catch (error) {
        console.error('Error executing campaign step:', error);
        showToast('Error', `Failed to execute campaign: ${error.message}`, 'error');
    }
}

async function cancelJob(jobId) {
    try {
        const response = await fetch(`/api/automation/jobs/${jobId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to cancel job');
        }
    } catch (error) {
        console.error('Error cancelling job:', error);
        showToast('Error', `Failed to cancel job: ${error.message}`, 'error');
    }
}

async function getJobDetails(jobId) {
    try {
        const response = await fetch(`/api/automation/jobs/${jobId}`);
        const job = await response.json();
        return job;
    } catch (error) {
        console.error('Error getting job details:', error);
        return null;
    }
}

// UI Functions
function showModal(modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
}

function handleJobSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const jobData = {
        contentPrompt: formData.get('contentPrompt'),
        publishDelay: parseInt(formData.get('publishDelay')) * 60000, // Convert to milliseconds
        schedule: formData.get('schedule') || null
    };
    
    createJob(jobData);
}

function handleCampaignSubmission(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const prompts = formData.get('prompts')
        .split('\n')
        .map(prompt => prompt.trim())
        .filter(prompt => prompt.length > 0);
    
    if (prompts.length === 0) {
        showToast('Error', 'Please enter at least one prompt', 'error');
        return;
    }
    
    const campaignData = {
        name: formData.get('name'),
        prompts: prompts,
        frequency: formData.get('frequency'),
        articlesPerDay: parseInt(formData.get('articlesPerDay')) || 1,
        customCron: formData.get('customCron') || null,
        publishDelay: parseInt(formData.get('publishDelay')) * 60000, // Convert to milliseconds
        isLooping: formData.get('isLooping') === 'on'
    };
    
    createCampaign(campaignData);
}

function handleFrequencyChange() {
    const frequency = elements.campaignFrequency.value;
    
    if (frequency === 'custom') {
        elements.customCronGroup.style.display = 'block';
        elements.articlesPerDayGroup.style.display = 'none';
    } else {
        elements.customCronGroup.style.display = 'none';
        elements.articlesPerDayGroup.style.display = frequency === 'daily' ? 'block' : 'none';
    }
}

function createQuickJob(type) {
    const templates = {
        tech: {
            contentPrompt: 'Write a comprehensive article about the latest trends in artificial intelligence and machine learning in 2024. Cover emerging technologies, practical applications, and future implications for businesses and society.'
        },
        lifestyle: {
            contentPrompt: 'Create an engaging article about sustainable living practices and wellness tips for modern life. Include practical advice for reducing environmental impact while maintaining a healthy lifestyle.'
        },
        business: {
            contentPrompt: 'Write a professional article about entrepreneurship and business growth strategies in the digital age. Focus on modern marketing techniques, remote work trends, and building successful online businesses.'
        }
    };
    
    const template = templates[type];
    if (template) {
        createJob({
            ...template,
            publishDelay: 300000 // 5 minutes
        });
    }
}

function addJobToList(job) {
    const jobElement = createJobElement(job);
    elements.jobList.appendChild(jobElement);
}

function updateJobInList(job) {
    const existingElement = document.querySelector(`[data-job-id="${job.id}"]`);
    if (existingElement) {
        const newElement = createJobElement(job);
        existingElement.replaceWith(newElement);
    }
}

function removeJobFromList(jobId) {
    const element = document.querySelector(`[data-job-id="${jobId}"]`);
    if (element) {
        element.remove();
    }
}

function createJobElement(job) {
    const div = document.createElement('div');
    div.className = 'job-item';
    div.setAttribute('data-job-id', job.id);
    
    const statusClass = `status-${job.status.replace(/[-\s]/g, '').toLowerCase()}`;
    const progressSteps = ['content', 'metadata', 'images', 'wordpress'];
    
    div.innerHTML = `
        <div class="job-header">
            <div>
                <div class="job-title">${job.title || 'AI Article Generation'}</div>
                <div class="job-prompt">${job.contentPrompt.substring(0, 100)}...</div>
                ${job.category ? `<div style="font-size: 0.8rem; color: #667eea; margin-top: 0.25rem;">📂 ${job.category}</div>` : ''}
                ${job.campaignName ? `<div style="font-size: 0.8rem; color: #10b981; margin-top: 0.25rem;">🚀 Campaign: ${job.campaignName}</div>` : ''}
            </div>
            <div class="job-status ${statusClass}">${job.status.replace('-', ' ')}</div>
        </div>
        
        <div class="job-progress">
            ${progressSteps.map(step => {
                const status = job.progress[step];
                const icons = {
                    content: 'fas fa-edit',
                    metadata: 'fas fa-tags',
                    images: 'fas fa-image',
                    wordpress: 'fas fa-wordpress'
                };
                
                const labels = {
                    content: 'Content',
                    metadata: 'Metadata',
                    images: 'Images',
                    wordpress: 'WordPress'
                };
                
                return `
                    <div class="progress-step">
                        <div class="progress-icon progress-${status}">
                            <i class="${icons[step]}"></i>
                        </div>
                        <div class="progress-label">${labels[step]}</div>
                    </div>
                `;
            }).join('')}
        </div>
        
        <div class="job-meta">
            <div>
                <span>Created: ${new Date(job.createdAt).toLocaleString()}</span>
                ${job.tags && job.tags.length > 0 ? `<span> • Tags: ${job.tags.join(', ')}</span>` : ''}
            </div>
            <div class="job-actions">
                <button class="btn btn-secondary" onclick="showJobDetails('${job.id}')">
                    <i class="fas fa-info"></i> Details
                </button>
                ${job.status === 'pending' || job.status === 'scheduled' ? 
                    `<button class="btn btn-danger" onclick="cancelJob('${job.id}')">
                        <i class="fas fa-times"></i> Cancel
                    </button>` : ''
                }
            </div>
        </div>
    `;
    
    return div;
}

function showLiveProgress(job) {
    elements.liveProgress.style.display = 'block';
    
    const existingProgress = document.querySelector(`[data-live-job-id="${job.id}"]`);
    if (!existingProgress) {
        const progressElement = document.createElement('div');
        progressElement.className = 'live-job';
        progressElement.setAttribute('data-live-job-id', job.id);
        elements.progressContainer.appendChild(progressElement);
    }
    
    updateLiveProgress(job);
}

function updateLiveProgress(job) {
    const progressElement = document.querySelector(`[data-live-job-id="${job.id}"]`);
    if (progressElement) {
        progressElement.innerHTML = `
            <div class="job-title">${job.title || 'AI Article Generation'}</div>
            ${job.campaignName ? `<div class="campaign-label">Campaign: ${job.campaignName}</div>` : ''}
            <div class="job-progress">
                <div class="progress-step">
                    <div class="progress-icon progress-${job.progress.content}">
                        <i class="fas fa-edit"></i>
                    </div>
                    <div class="progress-label">Content: ${job.progress.content}</div>
                </div>
                <div class="progress-step">
                    <div class="progress-icon progress-${job.progress.metadata}">
                        <i class="fas fa-tags"></i>
                    </div>
                    <div class="progress-label">Metadata: ${job.progress.metadata}</div>
                </div>
                <div class="progress-step">
                    <div class="progress-icon progress-${job.progress.images}">
                        <i class="fas fa-image"></i>
                    </div>
                    <div class="progress-label">Images: ${job.progress.images}</div>
                </div>
                <div class="progress-step">
                    <div class="progress-icon progress-${job.progress.wordpress}">
                        <i class="fas fa-wordpress"></i>
                    </div>
                    <div class="progress-label">WordPress: ${job.progress.wordpress}</div>
                </div>
            </div>
        `;
    }
}

function hideLiveProgress(jobId) {
    const progressElement = document.querySelector(`[data-live-job-id="${jobId}"]`);
    if (progressElement) {
        progressElement.remove();
    }
    
    // Hide live progress section if no active jobs
    if (elements.progressContainer.children.length === 0) {
        elements.liveProgress.style.display = 'none';
    }
}

async function showJobDetails(jobId) {
    const job = await getJobDetails(jobId);
    if (!job) {
        showToast('Error', 'Failed to load job details', 'error');
        return;
    }
    
    elements.jobDetailsContent.innerHTML = `
        <div class="job-details">
            <h4>${job.title || 'AI Article Generation'}</h4>
            <p><strong>Status:</strong> ${job.status}</p>
            <p><strong>Content Prompt:</strong> ${job.contentPrompt}</p>
            
            ${job.campaignName ? `<p><strong>Campaign:</strong> ${job.campaignName}</p>` : ''}
            ${job.category ? `<p><strong>Category:</strong> ${job.category}</p>` : ''}
            ${job.tags && job.tags.length > 0 ? `<p><strong>Tags:</strong> ${job.tags.join(', ')}</p>` : ''}
            
            ${job.imagePrompts && job.imagePrompts.length > 0 ? `
                <p><strong>AI-Generated Image Prompts:</strong></p>
                <ul>
                    ${job.imagePrompts.map(prompt => `<li>${prompt}</li>`).join('')}
                </ul>
            ` : ''}
            
            ${job.featuredImagePrompt ? `<p><strong>Featured Image Prompt:</strong> ${job.featuredImagePrompt}</p>` : ''}
            
            <p><strong>Created:</strong> ${new Date(job.createdAt).toLocaleString()}</p>
            ${job.startedAt ? `<p><strong>Started:</strong> ${new Date(job.startedAt).toLocaleString()}</p>` : ''}
            ${job.completedAt ? `<p><strong>Completed:</strong> ${new Date(job.completedAt).toLocaleString()}</p>` : ''}
            ${job.publishedAt ? `<p><strong>Published:</strong> ${new Date(job.publishedAt).toLocaleString()}</p>` : ''}
            
            ${job.generatedContent ? `
                <div class="generated-content">
                    <h5>Generated Content:</h5>
                    <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; padding: 1rem; border-radius: 8px;">
                        ${job.generatedContent}
                    </div>
                </div>
            ` : ''}
            
            ${job.featuredImage ? `
                <div class="featured-image">
                    <h5>Featured Image:</h5>
                    <img src="${job.featuredImage.url}" alt="${job.featuredImage.prompt}" style="width: 100%; max-width: 300px; border-radius: 8px;">
                </div>
            ` : ''}
            
            ${job.generatedImages && job.generatedImages.length > 0 ? `
                <div class="generated-images">
                    <h5>Generated Images:</h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                        ${job.generatedImages.map(img => `
                            <img src="${img.url}" alt="${img.prompt}" style="width: 100%; border-radius: 8px;">
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${job.wordpressPostId ? `<p><strong>WordPress Post ID:</strong> ${job.wordpressPostId}</p>` : ''}
            ${job.error ? `<p style="color: #e53e3e;"><strong>Error:</strong> ${job.error}</p>` : ''}
        </div>
    `;
    
    showModal(elements.jobDetailsModal);
}

function updateStats() {
    const activeJobsCount = activeJobs.size;
    const activeCampaignsCount = Array.from(campaigns.values()).filter(c => c.isActive).length;
    const completedJobsCount = Array.from(jobs.values()).filter(j => j.status === 'published').length;
    const failedJobsCount = Array.from(jobs.values()).filter(j => j.status === 'failed').length;
    
    elements.activeJobs.textContent = activeJobsCount;
    elements.activeCampaigns.textContent = activeCampaignsCount;
    elements.completedJobs.textContent = completedJobsCount;
    elements.failedJobs.textContent = failedJobsCount;
}

function clearCompletedJobs() {
    const completedJobs = Array.from(jobs.values()).filter(job => 
        job.status === 'completed' || job.status === 'published'
    );
    
    completedJobs.forEach(job => {
        jobs.delete(job.id);
        removeJobFromList(job.id);
    });
    
    updateStats();
    showToast('Cleared', 'Completed jobs have been cleared', 'info');
}

function showToast(title, message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
    
    // Remove on click
    toast.addEventListener('click', () => {
        toast.remove();
    });
}

// Global functions for inline event handlers
window.showJobDetails = showJobDetails;
window.cancelJob = cancelJob;
window.showCampaignDetails = showCampaignDetails;
window.pauseResumeCampaign = pauseResumeCampaign;
window.deleteCampaign = deleteCampaign;
window.executeCampaignStep = executeCampaignStep;

// Campaign UI Functions
function addCampaignToList(campaign) {
    const campaignElement = createCampaignElement(campaign);
    elements.campaignsList.appendChild(campaignElement);
}

function updateCampaignInList(campaign) {
    const existingElement = document.querySelector(`[data-campaign-id="${campaign.id}"]`);
    if (existingElement) {
        const newElement = createCampaignElement(campaign);
        existingElement.replaceWith(newElement);
    }
}

function removeCampaignFromList(campaignId) {
    const element = document.querySelector(`[data-campaign-id="${campaignId}"]`);
    if (element) {
        element.remove();
    }
}

function createCampaignElement(campaign) {
    const div = document.createElement('div');
    div.className = 'campaign-item';
    div.setAttribute('data-campaign-id', campaign.id);
    
    const statusClass = `status-${campaign.status.toLowerCase()}`;
    const frequencyText = campaign.frequency === 'custom' ? 'Custom' : 
                         campaign.frequency === 'daily' ? `${campaign.articlesPerDay}/day` : 
                         'Hourly';
    
    // Calculate progress percentage
    const progressPercentage = campaign.totalPrompts > 0 ? 
        Math.round((campaign.currentPromptIndex || 0) / campaign.totalPrompts * 100) : 0;
    
    div.innerHTML = `
        <div class="campaign-header">
            <div>
                <div class="campaign-title">${campaign.name}</div>
                <div class="campaign-meta">
                    <span><i class="fas fa-clock"></i> ${frequencyText}</span>
                    <span><i class="fas fa-list"></i> ${campaign.totalArticlesGenerated || 0} articles generated</span>
                    ${campaign.isLooping ? '<span><i class="fas fa-sync"></i> Looping</span>' : ''}
                </div>
            </div>
            <div class="campaign-status ${statusClass}">${campaign.status}</div>
        </div>
        
        <div class="campaign-progress">
            <div class="progress-info">
                <span>Progress: ${campaign.currentPromptIndex || 0} / ${campaign.totalPrompts || 0} prompts</span>
                ${campaign.lastExecutedAt ? `<span>Last: ${new Date(campaign.lastExecutedAt).toLocaleString()}</span>` : ''}
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progressPercentage}%"></div>
            </div>
        </div>
        
        <div class="campaign-actions">
            <button class="btn btn-secondary" onclick="showCampaignDetails('${campaign.id}')">
                <i class="fas fa-info"></i> Details
            </button>
            <button class="btn btn-secondary" onclick="executeCampaignStep('${campaign.id}')">
                <i class="fas fa-play"></i> Execute Now
            </button>
            ${campaign.isActive ? 
                `<button class="btn btn-warning" onclick="pauseResumeCampaign('${campaign.id}', 'pause')">
                    <i class="fas fa-pause"></i> Pause
                </button>` :
                `<button class="btn btn-success" onclick="pauseResumeCampaign('${campaign.id}', 'resume')">
                    <i class="fas fa-play"></i> Resume
                </button>`
            }
            <button class="btn btn-danger" onclick="deleteCampaign('${campaign.id}')">
                <i class="fas fa-trash"></i> Delete
            </button>
        </div>
    `;
    
    return div;
}

async function showCampaignDetails(campaignId) {
    const campaignDetails = await getCampaignDetails(campaignId);
    if (!campaignDetails) {
        showToast('Error', 'Failed to load campaign details', 'error');
        return;
    }
    
    const { campaign, promptPool, stats } = campaignDetails;
    
    elements.campaignDetailsContent.innerHTML = `
        <div class="campaign-details">
            <h4>${campaign.name}</h4>
            <div class="details-grid">
                <div class="detail-section">
                    <h5>Campaign Settings</h5>
                    <p><strong>Status:</strong> ${campaign.status}</p>
                    <p><strong>Frequency:</strong> ${campaign.frequency === 'custom' ? 'Custom' : 
                                                   campaign.frequency === 'daily' ? `${campaign.articlesPerDay} articles per day` : 
                                                   'Hourly'}</p>
                    ${campaign.customCron ? `<p><strong>Cron Expression:</strong> ${campaign.customCron}</p>` : ''}
                    <p><strong>Publish Delay:</strong> ${campaign.publishDelay / 60000} minutes</p>
                    <p><strong>Looping:</strong> ${campaign.isLooping ? 'Yes' : 'No'}</p>
                    <p><strong>Created:</strong> ${new Date(campaign.createdAt).toLocaleString()}</p>
                    ${campaign.lastExecutedAt ? `<p><strong>Last Executed:</strong> ${new Date(campaign.lastExecutedAt).toLocaleString()}</p>` : ''}
                </div>
                
                <div class="detail-section">
                    <h5>Statistics</h5>
                    <p><strong>Total Prompts:</strong> ${promptPool.totalPrompts}</p>
                    <p><strong>Current Position:</strong> ${campaign.currentPromptIndex || 0}</p>
                    <p><strong>Articles Generated:</strong> ${campaign.totalArticlesGenerated || 0}</p>
                    ${stats ? `
                        <p><strong>Successful Executions:</strong> ${stats.successfulExecutions || 0}</p>
                        <p><strong>Failed Executions:</strong> ${stats.failedExecutions || 0}</p>
                        ${stats.averageExecutionTime ? `<p><strong>Avg Execution Time:</strong> ${Math.round(stats.averageExecutionTime / 1000)}s</p>` : ''}
                    ` : ''}
                </div>
            </div>
            
            <div class="prompts-section">
                <h5>Prompts (${promptPool.totalPrompts} total)</h5>
                <div class="prompts-list">
                    ${promptPool.prompts.map((prompt, index) => `
                        <div class="prompt-item ${index < (campaign.currentPromptIndex || 0) ? 'completed' : index === (campaign.currentPromptIndex || 0) ? 'current' : 'pending'}">
                            <div class="prompt-index">${index + 1}</div>
                            <div class="prompt-text">${prompt.text}</div>
                            <div class="prompt-meta">
                                ${prompt.timesUsed > 0 ? `Used ${prompt.timesUsed} times` : 'Not used yet'}
                                ${prompt.lastUsedAt ? ` • Last: ${new Date(prompt.lastUsedAt).toLocaleString()}` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    showModal(elements.campaignDetailsModal);
} 