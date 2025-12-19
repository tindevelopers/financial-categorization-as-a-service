/**
 * Cloud Storage Provider Interface
 * 
 * Abstraction layer for cloud storage providers (Dropbox, Google Drive)
 * Allows switching between providers without changing business logic
 */

export interface FileInfo {
  id?: string;
  name: string;
  path: string;
  size: number;
  modified: string;
  mimeType?: string;
}

export interface UploadOptions {
  folderPath?: string;
  overwrite?: boolean;
}

export interface CloudStorageProvider {
  /**
   * Upload a file to cloud storage
   * @param file File buffer or stream
   * @param filename Name of the file
   * @param options Upload options (folder path, overwrite)
   * @returns Path or ID of uploaded file
   */
  upload(file: Buffer, filename: string, options?: UploadOptions): Promise<string>;

  /**
   * Download a file from cloud storage
   * @param path Path or ID of the file
   * @returns File buffer
   */
  download(path: string): Promise<Buffer>;

  /**
   * List files in a folder
   * @param folderPath Path to folder (optional, defaults to root)
   * @returns Array of file information
   */
  list(folderPath?: string): Promise<FileInfo[]>;

  /**
   * Delete a file from cloud storage
   * @param path Path or ID of the file
   */
  delete(path: string): Promise<void>;

  /**
   * Get a shareable URL for a file
   * @param path Path or ID of the file
   * @returns Shareable URL
   */
  getUrl(path: string): Promise<string>;

  /**
   * Get the provider name
   */
  getProviderName(): string;
}
