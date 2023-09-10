"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugin_retry_1 = require("@octokit/plugin-retry");
const rest_1 = require("@octokit/rest");
const debug_1 = __importDefault(require("debug"));
const logInfo = (0, debug_1.default)('electron-forge:publisher:github:info');
const logDebug = (0, debug_1.default)('electron-forge:publisher:github:debug');
class GitHub {
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
        const RetryableOctokit = rest_1.Octokit.plugin(plugin_retry_1.retry);
        const github = new RetryableOctokit(options);
        return github;
    }
}
exports.default = GitHub;
