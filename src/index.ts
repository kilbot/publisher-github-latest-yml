import { PublisherBase, PublisherOptions } from '@electron-forge/publisher-base';
import { readFile } from 'fs/promises';
import { createWriteStream } from 'fs';
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
        if (path.basename(artifact).toUpperCase() === 'RELEASES') {
          continue; // Skip the 'RELEASES' artifact
        }
        
        artifactInfoPromises.push((async () => {
          try {
            const artifactName = path.basename(artifact);
            const buffer = await readFile(artifact);
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
      releaseDate: `'${new Date().toISOString()}'`,
    };

    let yamlStr = YAML.stringify(data);

    let latestYmlFileName = 'latest.yml';
    if (process.platform === 'darwin') {
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

    // Get the list of assets for the current release
    const assets = release.assets;

    // Check if the latestYmlFileName asset exists
    const existingAsset = assets.find((asset) => asset.name === latestYmlFileName);

    if (existingAsset) {
      // Get the asset's content
      const response = await github.repos.getReleaseAsset({
        headers: {
          Accept: 'application/octet-stream',
        },
        owner: config.repository.owner,
        repo: config.repository.name,
        asset_id: existingAsset.id,
      });

      // Convert ArrayBuffer to a UTF-8 string
      const text = new TextDecoder('utf-8').decode(new Uint8Array(response.data as unknown as ArrayBuffer));

      // Parse the existing YAML data
      const existingData = YAML.parse(text);

      // Append the new artifactInfo to the existing files array
      existingData.files.push(...artifactInfo);

      yamlStr = YAML.stringify(existingData);


      // delete the existing asset
      await github.repos.deleteReleaseAsset({
        owner: config.repository.owner,
        repo: config.repository.name,
        asset_id: existingAsset.id,
      });
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
