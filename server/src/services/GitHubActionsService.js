const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Service for interacting with GitHub Actions API
 */
class GitHubActionsService {
  constructor() {
    this.githubToken = process.env.GITHUB_TOKEN;
    this.repoOwner = process.env.GITHUB_REPO_OWNER || 'mundodigitalpro';
    this.repoName = process.env.GITHUB_REPO_NAME || 'expo-android-builder';
    this.workflowFileName = 'gradle-build-android.yml';

    if (!this.githubToken) {
      logger.warn('GITHUB_TOKEN not configured. GitHub Actions integration will not work.');
    }

    this.apiClient = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `Bearer ${this.githubToken}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: 30000,
    });
  }

  /**
   * Trigger a GitHub Actions workflow
   * @param {string} projectPath - Path to project (e.g., 'app')
   * @param {string} buildType - Build type: 'debug' or 'release'
   * @returns {Promise<object>} Workflow dispatch result
   */
  async triggerBuild(projectPath, buildType = 'debug') {
    try {
      logger.info('Triggering GitHub Actions build', { projectPath, buildType });

      if (!this.githubToken) {
        throw new Error('GitHub token not configured. Set GITHUB_TOKEN in .env');
      }

      const response = await this.apiClient.post(
        `/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${this.workflowFileName}/dispatches`,
        {
          ref: 'main',
          inputs: {
            project_path: projectPath,
            build_type: buildType,
          },
        }
      );

      logger.info('GitHub Actions build triggered successfully', {
        projectPath,
        buildType,
        status: response.status
      });

      return {
        success: true,
        message: 'Build triggered successfully',
        projectPath,
        buildType,
      };
    } catch (error) {
      logger.error('Failed to trigger GitHub Actions build', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(
        error.response?.data?.message ||
        'Failed to trigger GitHub Actions build'
      );
    }
  }

  /**
   * Get recent workflow runs
   * @param {number} limit - Number of runs to fetch (default: 10)
   * @returns {Promise<Array>} List of workflow runs
   */
  async getWorkflowRuns(limit = 10) {
    try {
      logger.info('Fetching GitHub Actions workflow runs', { limit });

      if (!this.githubToken) {
        throw new Error('GitHub token not configured. Set GITHUB_TOKEN in .env');
      }

      const response = await this.apiClient.get(
        `/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${this.workflowFileName}/runs`,
        {
          params: {
            per_page: limit,
            page: 1,
          },
        }
      );

      const runs = response.data.workflow_runs.map(run => ({
        id: run.id,
        name: run.name,
        status: run.status, // queued, in_progress, completed
        conclusion: run.conclusion, // success, failure, cancelled, null
        createdAt: run.created_at,
        updatedAt: run.updated_at,
        htmlUrl: run.html_url,
        runNumber: run.run_number,
        event: run.event,
        branch: run.head_branch,
      }));

      logger.info('Fetched workflow runs successfully', { count: runs.length });
      return runs;
    } catch (error) {
      logger.error('Failed to fetch GitHub Actions workflow runs', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(
        error.response?.data?.message ||
        'Failed to fetch workflow runs'
      );
    }
  }

  /**
   * Get artifacts for a specific workflow run
   * @param {number} runId - Workflow run ID
   * @returns {Promise<Array>} List of artifacts
   */
  async getArtifacts(runId) {
    try {
      logger.info('Fetching artifacts for workflow run', { runId });

      if (!this.githubToken) {
        throw new Error('GitHub token not configured. Set GITHUB_TOKEN in .env');
      }

      const response = await this.apiClient.get(
        `/repos/${this.repoOwner}/${this.repoName}/actions/runs/${runId}/artifacts`
      );

      const artifacts = response.data.artifacts.map(artifact => ({
        id: artifact.id,
        name: artifact.name,
        sizeInBytes: artifact.size_in_bytes,
        downloadUrl: artifact.archive_download_url,
        createdAt: artifact.created_at,
        expiresAt: artifact.expires_at,
      }));

      logger.info('Fetched artifacts successfully', {
        runId,
        count: artifacts.length
      });
      return artifacts;
    } catch (error) {
      logger.error('Failed to fetch artifacts', {
        runId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(
        error.response?.data?.message ||
        'Failed to fetch artifacts'
      );
    }
  }

  /**
   * Get download URL for an artifact
   * Note: GitHub requires authentication to download artifacts
   * The mobile app will need to open the GitHub Actions page instead
   * @param {number} artifactId - Artifact ID
   * @returns {Promise<string>} Download URL
   */
  async getArtifactDownloadUrl(artifactId) {
    try {
      logger.info('Getting artifact download URL', { artifactId });

      if (!this.githubToken) {
        throw new Error('GitHub token not configured. Set GITHUB_TOKEN in .env');
      }

      // Note: This returns a redirect URL that requires authentication
      // For mobile app, it's better to direct users to the GitHub Actions page
      return `https://github.com/${this.repoOwner}/${this.repoName}/actions`;
    } catch (error) {
      logger.error('Failed to get artifact download URL', {
        artifactId,
        error: error.message,
      });
      throw new Error('Failed to get artifact download URL');
    }
  }

  /**
   * Check if GitHub Actions is configured
   * @returns {boolean} True if configured
   */
  isConfigured() {
    return !!this.githubToken;
  }
}

module.exports = new GitHubActionsService();
