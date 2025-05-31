class AutomationQueue {
  constructor() {
    this.jobs = new Map();
    this.queue = [];
    this.completed = [];
    this.failed = [];
  }

  addJob(job) {
    this.jobs.set(job.id, job);
    this.queue.push(job);
    return job.id;
  }

  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
      this.jobs.set(jobId, job);
    }
    return job;
  }

  removeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.delete(jobId);
      this.queue = this.queue.filter(j => j.id !== jobId);
      this.completed = this.completed.filter(j => j.id !== jobId);
      this.failed = this.failed.filter(j => j.id !== jobId);
    }
    return job;
  }

  completeJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'completed';
      job.completedAt = new Date();
      this.queue = this.queue.filter(j => j.id !== jobId);
      this.completed.push(job);
    }
    return job;
  }

  failJob(jobId, error) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.error = error;
      job.failedAt = new Date();
      this.queue = this.queue.filter(j => j.id !== jobId);
      this.failed.push(job);
    }
    return job;
  }

  getQueue() {
    return this.queue;
  }

  getCompleted() {
    return this.completed;
  }

  getFailed() {
    return this.failed;
  }

  getAllJobs() {
    return Array.from(this.jobs.values());
  }

  getJobsByStatus(status) {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }

  getStats() {
    return {
      total: this.jobs.size,
      pending: this.queue.length,
      completed: this.completed.length,
      failed: this.failed.length,
      running: this.getJobsByStatus('running').length
    };
  }

  clear() {
    this.jobs.clear();
    this.queue = [];
    this.completed = [];
    this.failed = [];
  }
}

module.exports = new AutomationQueue(); 