import type { GitHubFileResult } from './types';

export interface GitHubParseResult {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
}

/**
 * Parses a GitHub blob URL:
 * https://github.com/owner/repo/blob/branch/path/to/file.txt
 */
export function parseGitHubBlobUrl(rawUrl: string): { data?: GitHubParseResult; error?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { error: 'Please enter a GitHub file URL.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: 'Invalid URL format. Please enter a valid URL.' };
  }

  if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
    return { error: 'URL must be a github.com URL.' };
  }

  // Path format: /owner/repo/blob/branch/path/to/file.txt
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 5 || segments[2] !== 'blob') {
    return {
      error:
        'URL must match the format: https://github.com/owner/repo/blob/branch/path/to/file.ext',
    };
  }

  const owner = segments[0];
  const repo = segments[1];
  const branch = segments[3];
  const filePath = segments.slice(4).join('/');

  if (!owner || !repo || !branch || !filePath) {
    return { error: 'Missing owner, repo, branch, or file path in URL.' };
  }

  return {
    data: {
      owner,
      repo,
      branch,
      filePath,
    },
  };
}

/**
 * Loads the last two commits of a file from GitHub REST API.
 * Ephemeral token in memory only.
 */
export async function loadGitHubFileCommits(
  rawUrl: string,
  token?: string
): Promise<GitHubFileResult> {
  const parseRes = parseGitHubBlobUrl(rawUrl);
  if (parseRes.error || !parseRes.data) {
    throw new Error(parseRes.error || 'Failed to parse GitHub URL.');
  }

  const { owner, repo, branch, filePath } = parseRes.data;

  // Build headers
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
  };
  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  // 1. Fetch commits: include sha=<branch from URL> and path
  const commitsUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
    repo
  )}/commits?path=${encodeURIComponent(filePath)}&sha=${encodeURIComponent(branch)}&per_page=2`;

  let commitsResponse: Response;
  try {
    commitsResponse = await fetch(commitsUrl, { headers });
  } catch (err) {
    throw new Error('Network error: Unable to reach GitHub API. Check your connection.');
  }

  if (!commitsResponse.ok) {
    if (commitsResponse.status === 404) {
      throw new Error(
        `Repository or file not found (404). Ensure '${owner}/${repo}' and branch '${branch}' exist.`
      );
    }
    if (commitsResponse.status === 403) {
      throw new Error(
        'GitHub API rate limit exceeded (403). Please provide a personal access token.'
      );
    }
    if (commitsResponse.status === 401) {
      throw new Error('Invalid GitHub token (401). Check your credentials.');
    }
    const errText = await commitsResponse.text().catch(() => '');
    throw new Error(
      `GitHub API error (${commitsResponse.status}): ${errText || commitsResponse.statusText}`
    );
  }

  const commitsData = await commitsResponse.json();
  if (!Array.isArray(commitsData) || commitsData.length === 0) {
    throw new Error(`No commits found for '${filePath}' on branch '${branch}'.`);
  }

  const newestCommitSha = commitsData[0]?.sha as string;
  const olderCommitSha = commitsData.length > 1 ? (commitsData[1]?.sha as string) : undefined;

  // Helper to fetch raw content at a commit SHA
  // Path segments encoded separately, keeping slashes
  const encodedPath = filePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  const fetchRawContent = async (sha: string): Promise<string> => {
    const contentUrl = `https://api.github.com/repos/${encodeURIComponent(
      owner
    )}/${encodeURIComponent(repo)}/contents/${encodedPath}?ref=${encodeURIComponent(sha)}`;

    const contentHeaders: Record<string, string> = {
      Accept: 'application/vnd.github.raw+json',
    };
    if (token && token.trim()) {
      contentHeaders['Authorization'] = `Bearer ${token.trim()}`;
    }

    const contentRes = await fetch(contentUrl, { credentials: 'omit', headers: contentHeaders });
    if (!contentRes.ok) {
      if (contentRes.status === 404) {
        throw new Error(`File '${filePath}' not found at commit ${sha.slice(0, 7)}.`);
      }
      if (contentRes.status === 403) {
        throw new Error('GitHub API rate limit exceeded while downloading file content.');
      }
      throw new Error(`Failed to download content (${contentRes.status})`);
    }

    return await contentRes.text();
  };

  // Fetch newest (becomes Current)
  const currentText = await fetchRawContent(newestCommitSha);

  // If older commit exists, fetch it; otherwise empty string
  let previousText = '';
  if (olderCommitSha) {
    previousText = await fetchRawContent(olderCommitSha);
  }

  return {
    previousText,
    currentText,
    previousSha: olderCommitSha,
    currentSha: newestCommitSha,
    path: filePath,
  };
}

