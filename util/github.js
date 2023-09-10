import { retry } from '@octokit/plugin-retry';
import { Octokit } from '@octokit/rest';
import debug from 'debug';
const logInfo = debug('electron-forge:publisher:github:info');
const logDebug = debug('electron-forge:publisher:github:debug');
export default class GitHub {
    constructor(authToken = undefined, requireAuth = false, options = {}) {
        const noOp = () => {
            /* Intentionally does nothing */
        };
        this.options = Object.assign(Object.assign({}, options), { log: {
                debug: logDebug.enabled ? logDebug : noOp,
                error: console.error,
                info: logInfo.enabled ? logInfo : noOp,
                warn: console.warn,
            }, userAgent: 'Electron Forge' });
        if (authToken) {
            this.token = authToken;
        }
        else if (process.env.GITHUB_TOKEN) {
            this.token = process.env.GITHUB_TOKEN;
        }
        else if (requireAuth) {
            throw new Error('Please set GITHUB_TOKEN in your environment to access these features');
        }
    }
    getGitHub() {
        const options = Object.assign({}, this.options);
        if (this.token) {
            options.auth = this.token;
        }
        const RetryableOctokit = Octokit.plugin(retry);
        const github = new RetryableOctokit(options);
        return github;
    }
}
