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
   * @param {string} ref - Git ref (branch) to run the workflow on
   * @returns {Promise<object>} Workflow dispatch result
   */
  async triggerBuild(projectPath, buildType = 'debug', ref = 'main') {
    try {
      logger.info('Triggering GitHub Actions build', { projectPath, buildType, ref });

      if (!this.githubToken) {
        throw new Error('GitHub token not configured. Set GITHUB_TOKEN in .env');
      }

      const response = await this.apiClient.post(
        `/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${this.workflowFileName}/dispatches`,
        {
          ref,
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
        ref,
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
   * @param {string} branch - Optional branch filter
   * @returns {Promise<Array>} List of workflow runs
   */
  async getWorkflowRuns(limit = 10, branch) {
    try {
      logger.info('Fetching GitHub Actions workflow runs', { limit, branch });

      if (!this.githubToken) {
        throw new Error('GitHub token not configured. Set GITHUB_TOKEN in .env');
      }

      const params = {
        per_page: limit,
        page: 1,
      };

      if (branch) {
        params.branch = branch;
      }

      const response = await this.apiClient.get(
        `/repos/${this.repoOwner}/${this.repoName}/actions/workflows/${this.workflowFileName}/runs`,
        {
          params,
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

  /**
   * Delete a branch by name using GitHub API
   * @param {string} branchName - Branch name (e.g., build/my-app-123)
   * @returns {Promise<void>}
   */
  async deleteBranch(branchName) {
    try {
      if (!this.githubToken) {
        throw new Error('GitHub token not configured. Set GITHUB_TOKEN in .env');
      }

      const encodedBranch = encodeURIComponent(branchName);
      await this.apiClient.delete(
        `/repos/${this.repoOwner}/${this.repoName}/git/refs/heads/${encodedBranch}`
      );
    } catch (error) {
      logger.error('Failed to delete GitHub branch', {
        branchName,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(
        error.response?.data?.message ||
        'Failed to delete GitHub branch'
      );
    }
  }

  /**
   * List branches matching a prefix/pattern
   * @param {string} pattern - Prefix to filter branches
   * @returns {Promise<Array>} List of branches
   */
  async listBranches(pattern = 'build/') {
    try {
      if (!this.githubToken) {
        throw new Error('GitHub token not configured. Set GITHUB_TOKEN in .env');
      }

      const perPage = 100;
      const maxPages = 20;
      const branches = [];

      for (let page = 1; page <= maxPages; page += 1) {
        const response = await this.apiClient.get(
          `/repos/${this.repoOwner}/${this.repoName}/branches`,
          { params: { per_page: perPage, page } }
        );

        const pageData = Array.isArray(response.data) ? response.data : [];
        const filtered = pageData
          .map((branch) => ({
            name: branch.name,
            sha: branch.commit?.sha,
            protected: branch.protected
          }))
          .filter((branch) => branch.name.startsWith(pattern));

        branches.push(...filtered);

        if (pageData.length < perPage) {
          break;
        }
      }

      return branches;
    } catch (error) {
      logger.error('Failed to list GitHub branches', {
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(
        error.response?.data?.message ||
        'Failed to list GitHub branches'
      );
    }
  }

  /**
   * Download an artifact ZIP as a stream
   * @param {number} artifactId - Artifact ID
   * @returns {Promise<object>} Axios response with stream data
   */
  async downloadArtifact(artifactId) {
    try {
      if (!this.githubToken) {
        throw new Error('GitHub token not configured. Set GITHUB_TOKEN in .env');
      }

      const response = await this.apiClient.get(
        `/repos/${this.repoOwner}/${this.repoName}/actions/artifacts/${artifactId}/zip`,
        { responseType: 'stream' }
      );

      return response;
    } catch (error) {
      logger.error('Failed to download GitHub artifact', {
        artifactId,
        error: error.message,
        response: error.response?.data,
      });
      throw new Error(
        error.response?.data?.message ||
        'Failed to download GitHub artifact'
      );
    }
  }
}

module.exports = new GitHubActionsService();
