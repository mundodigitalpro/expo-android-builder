class StagingError extends Error {
  constructor(message, code = 'STAGING_ERROR', status = 400) {
    super(message);
    this.name = 'StagingError';
    this.code = code;
    this.status = status;
  }
}

StagingError.codes = Object.freeze({
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  INVALID_PROJECT: 'INVALID_PROJECT',
  PROJECT_TOO_LARGE: 'PROJECT_TOO_LARGE',
  DIRTY_REPO: 'DIRTY_REPO',
  PUSH_FAILED: 'PUSH_FAILED',
  STAGING_IN_PROGRESS: 'STAGING_IN_PROGRESS',
  GITHUB_NOT_CONFIGURED: 'GITHUB_NOT_CONFIGURED'
});

module.exports = StagingError;
