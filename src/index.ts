import { PublisherBase, PublisherOptions } from '@electron-forge/publisher-base';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import YAML from 'yaml';
import path from 'path';

import GitHub from './util/github';
import NoReleaseError from './util/no-release-error';

interface ArtifactInfo {
  url: string | undefined;
  sha512: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  assets: {
    name: string;
  }[];
  upload_url: string;
}

export default class CustomPublisher extends PublisherBase<any> {
  name = 'github-latest-yml';

  async publish({ makeResults, setStatusLine }: PublisherOptions): Promise<void> {
    const { config } = this;

    const artifactInfoPromises: Promise<ArtifactInfo>[] = [];
    let version;
    let releaseName = '';
    
    for (const result of makeResults) {
      version = result.packageJSON.version;
      releaseName = `v${version}`;

      for (const artifact of result.artifacts) {
        artifactInfoPromises.push((async () => {
          try {
            const artifactName = path.basename(artifact);
            const buffer = await fs.readFile(artifact);
            const hash = crypto.createHash('sha512').update(buffer).digest('hex');
            const size = buffer.length;

            return {
              url: artifactName,
              sha512: hash,
              size,
            };
          } catch (error) {
            throw new Error(`Failed to create artifact info for ${artifact}: ${error}`);
          }
        })());
      }
    }

    const artifactInfo = await Promise.all(artifactInfoPromises);
    const files = artifactInfo.filter((info) => info.url !== undefined);

    const data = {
      version, // replace with your app's version
      files: artifactInfo,
      path: files[0].url, // replace with your app's filename
      sha512: files[0].sha512, // replace with your app's sha512 hash
      releaseDate: new Date().toISOString(),
    };

    const yamlStr = YAML.stringify(data);


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
      if(arch) {
        latestYmlFileName = `latest-mac-${arch}.yml`;
      }
      latestYmlFileName = `latest-mac.yml`;
    } else if (process.platform === 'linux') {
      latestYmlFileName = 'latest-linux.yml';
    }    

    // Initialize GitHub API client
    const github = new GitHub(undefined, true).getGitHub();

    // Get the release corresponding to the current version
    const release = (
      await github.repos.listReleases({
        owner: config.repository.owner,
        repo: config.repository.name,
        per_page: 100,
      })
    ).data.find((testRelease: GitHubRelease) => testRelease.tag_name === releaseName);

    if (!release) {
      throw new NoReleaseError(404);
    }

    // Upload the latest.yml file as a release asset
    await github.repos.uploadReleaseAsset({
      owner: config.repository.owner,
      repo: config.repository.name,
      release_id: release.id,
      name: latestYmlFileName,
      data: yamlStr,
    });
  }
}
