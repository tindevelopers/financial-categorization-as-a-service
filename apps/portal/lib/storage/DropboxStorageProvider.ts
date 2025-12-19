import { Dropbox } from "dropbox";
import type { CloudStorageProvider, FileInfo, UploadOptions } from "./CloudStorageProvider";

export class DropboxStorageProvider implements CloudStorageProvider {
  private client: Dropbox;

  constructor(accessToken: string) {
    this.client = new Dropbox({
      accessToken,
    });
  }

  async upload(file: Buffer, filename: string, options?: UploadOptions): Promise<string> {
    const path = options?.folderPath 
      ? `${options.folderPath}/${filename}`
      : `/${filename}`;

    try {
      const response = await this.client.filesUpload({
        path,
        contents: file,
        mode: options?.overwrite ? { ".tag": "overwrite" } : { ".tag": "add" },
      });

      return response.result.path_display || path;
    } catch (error: any) {
      if (error?.status === 409 && options?.overwrite) {
        // File exists, try overwrite explicitly
        const overwriteResponse = await this.client.filesUpload({
          path,
          contents: file,
          mode: { ".tag": "overwrite" },
        });
        return overwriteResponse.result.path_display || path;
      }
      throw new Error(`Dropbox upload failed: ${error.message}`);
    }
  }

  async download(path: string): Promise<Buffer> {
    try {
      const response = await this.client.filesDownload({ path });
      const fileBinary = (response.result as any).fileBinary;
      return Buffer.from(fileBinary);
    } catch (error: any) {
      throw new Error(`Dropbox download failed: ${error.message}`);
    }
  }

  async list(folderPath: string = "/"): Promise<FileInfo[]> {
    try {
      const response = await this.client.filesListFolder({ path: folderPath });
      
      if (!response.result.entries) {
        return [];
      }

      return response.result.entries
        .filter(entry => entry[".tag"] === "file")
        .map((entry: any) => ({
          id: entry.id,
          name: entry.name,
          path: entry.path_display,
          size: entry.size || 0,
          modified: entry.server_modified || entry.client_modified || "",
          mimeType: undefined, // Dropbox doesn't always provide this
        }));
    } catch (error: any) {
      throw new Error(`Dropbox list failed: ${error.message}`);
    }
  }

  async delete(path: string): Promise<void> {
    try {
      await this.client.filesDeleteV2({ path });
    } catch (error: any) {
      throw new Error(`Dropbox delete failed: ${error.message}`);
    }
  }

  async getUrl(path: string): Promise<string> {
    try {
      const response = await this.client.filesGetTemporaryLink({ path });
      return response.result.link;
    } catch (error: any) {
      // If temporary link fails, return a path-based URL
      return `https://www.dropbox.com/home${path}`;
    }
  }

  getProviderName(): string {
    return "dropbox";
  }
}
