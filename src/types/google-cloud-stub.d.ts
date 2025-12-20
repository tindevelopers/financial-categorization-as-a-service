// Stub type declarations for optional Google Cloud dependencies
// These modules may not be installed, but are dynamically imported at runtime

declare module '@google-cloud/documentai' {
  export class DocumentProcessorServiceClient {
    constructor(options?: { keyFilename?: string; projectId?: string });
    processDocument(request: any): Promise<any>;
  }
}

declare module '@google-cloud/storage' {
  export class Storage {
    constructor(options?: { projectId?: string; keyFilename?: string });
    bucket(name: string): Bucket;
  }
  
  export class Bucket {
    file(name: string): File;
  }
  
  export class File {
    save(buffer: Buffer): Promise<void>;
    download(): Promise<[Buffer]>;
    exists(): Promise<[boolean]>;
    getMetadata(): Promise<[any]>;
    setMetadata(metadata: any): Promise<void>;
    setStorageClass(storageClass: string): Promise<void>;
    delete(): Promise<void>;
  }
}

