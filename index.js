var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { PublisherBase } from '@electron-forge/publisher-base';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import YAML from 'yaml';
import path from 'path';
import GitHub from './util/github';
export default class CustomPublisher extends PublisherBase {
    constructor() {
        super(...arguments);
        this.name = 'github-latest-yml';
    }
    publish({ makeResults, setStatusLine }) {
        return __awaiter(this, void 0, void 0, function* () {
            const { config } = this;
            const artifactInfoPromises = [];
            let version;
            let releaseName;
            for (const result of makeResults) {
                version = result.packageJSON.version;
                releaseName = `v${version}`;
                for (const artifact of result.artifacts) {
                    artifactInfoPromises.push((() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const artifactName = path.basename(artifact);
                            const buffer = yield fs.readFile(artifact);
                            const hash = crypto.createHash('sha512').update(buffer).digest('hex');
                            const size = buffer.length;
                            return {
                                url: artifactName,
                                sha512: hash,
                                size,
                            };
                        }
                        catch (error) {
                            throw new Error(`Failed to create artifact info for ${artifact}: ${error.message}`);
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
            const yamlStr = YAML.stringify(data);
            let latestYmlFileName = 'latest.yml';
            if (process.platform === 'darwin') {
                latestYmlFileName = 'latest-mac.yml';
            }
            else if (process.platform === 'linux') {
                latestYmlFileName = 'latest-linux.yml';
            }
            // Initialize GitHub API client
            const github = new GitHub(undefined, true).getGitHub();
            // Get the release corresponding to the current version
            const release = yield github.repos.getReleaseByTag({
                owner: config.repository.owner,
                repo: config.repository.name,
                tag: releaseName
            });
            // Upload the latest.yml file as a release asset
            yield github.repos.uploadReleaseAsset({
                owner: config.repository.owner,
                repo: config.repository.name,
                release_id: release.data.id,
                name: latestYmlFileName,
                data: yamlStr,
            });
        });
    }
}
