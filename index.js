"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const publisher_base_1 = require("@electron-forge/publisher-base");
const fs_1 = require("fs");
const crypto_1 = __importDefault(require("crypto"));
const yaml_1 = __importDefault(require("yaml"));
const path_1 = __importDefault(require("path"));
const github_1 = __importDefault(require("./util/github"));
const no_release_error_1 = __importDefault(require("./util/no-release-error"));
class CustomPublisher extends publisher_base_1.PublisherBase {
    constructor() {
        super(...arguments);
        this.name = 'github-latest-yml';
    }
    publish({ makeResults, setStatusLine }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { config } = this;
            const artifactInfoPromises = [];
            let version;
            let releaseName = '';
            for (const result of makeResults) {
                version = result.packageJSON.version;
                releaseName = `v${version}`;
                for (const artifact of result.artifacts) {
                    if (path_1.default.basename(artifact).toUpperCase() === 'RELEASES') {
                        continue; // Skip the 'RELEASES' artifact
                    }
                    artifactInfoPromises.push((() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const artifactName = path_1.default.basename(artifact);
                            const buffer = yield fs_1.promises.readFile(artifact);
                            const hash = crypto_1.default.createHash('sha512').update(buffer).digest('hex');
                            const size = buffer.length;
                            return {
                                url: artifactName,
                                sha512: hash,
                                size,
                            };
                        }
                        catch (error) {
                            throw new Error(`Failed to create artifact info for ${artifact}: ${error}`);
                        }
                    }))());
                }
            }
            const artifactInfo = yield Promise.all(artifactInfoPromises);
            const files = artifactInfo.filter((info) => info.url !== undefined);
            const data = {
                version,
                files: artifactInfo,
                path: files[0].url,
                sha512: files[0].sha512,
                releaseDate: new Date().toISOString(),
            };
            const yamlStr = yaml_1.default.stringify(data);
            /**
             * This sucks. The mac build runs once for x64 and once for arm64, so we need to
             * upload the latest.yml file twice, once for each architecture.
             */
            const args = process.argv.slice(2); // Get the arguments excluding 'node' and the script name
            let arch;
            // Find and set the arch and platform from the arguments
            args.forEach((arg, index) => {
                if (arg === '--arch') {
                    arch = args[index + 1];
                }
            });
            let latestYmlFileName = 'latest.yml';
            if (process.platform === 'darwin') {
                if (arch) {
                    latestYmlFileName = `latest-mac-${arch}.yml`;
                }
                latestYmlFileName = `latest-mac.yml`;
            }
            else if (process.platform === 'linux') {
                latestYmlFileName = 'latest-linux.yml';
            }
            // Initialize GitHub API client
            const github = new github_1.default(undefined, true).getGitHub();
            // Get the release corresponding to the current version
            const release = (yield github.repos.listReleases({
                owner: config.repository.owner,
                repo: config.repository.name,
                per_page: 100,
            })).data.find((testRelease) => testRelease.tag_name === releaseName);
            if (!release) {
                throw new no_release_error_1.default(404);
            }
            // Upload the latest.yml file as a release asset
            yield github.repos.uploadReleaseAsset({
                owner: config.repository.owner,
                repo: config.repository.name,
                release_id: release.id,
                name: latestYmlFileName,
                data: yamlStr,
            });
        });
    }
}
exports.default = CustomPublisher;
