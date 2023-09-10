import { OctokitOptions } from '@octokit/core/dist-types/types.d';
import { Octokit } from '@octokit/rest';
export default class GitHub {
    private options;
    token?: string;
    constructor(authToken?: string | undefined, requireAuth?: boolean, options?: OctokitOptions);
    getGitHub(): Octokit;
}
