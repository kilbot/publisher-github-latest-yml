import { PublisherBase, PublisherOptions } from '@electron-forge/publisher-base';
export default class CustomPublisher extends PublisherBase<any> {
    name: string;
    publish({ makeResults, setStatusLine }: PublisherOptions): Promise<void>;
}
