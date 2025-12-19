import { google } from "googleapis";
import type { CloudStorageProvider, FileInfo, UploadOptions } from "./CloudStorageProvider";

export class GoogleDriveStorageProvider implements CloudStorageProvider {
  private drive: ReturnType<typeof google.drive>;
  private auth: any;

  constructor(accessToken: string) {
    this.auth = new google.auth.OAuth2();
    this.auth.setCredentials({ access_token: accessToken });
    
    this.drive = google.drive({ version: "v3", auth: this.auth });
  }

  async upload(file: Buffer, filename: string, options?: UploadOptions): Promise<string> {
    const fileMetadata: any = {
      name: filename,
    };

    // If folder path provided, find or create folder
    if (options?.folderPath) {
      const folderId = await this.getOrCreateFolder(options.folderPath);
      fileMetadata.parents = [folderId];
    }

    const media = {
      mimeType: this.getMimeType(filename),
      body: file,
    };

    try {
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media,
      });

      return response.data.id || "";
    } catch (error: any) {
      throw new Error(`Google Drive upload failed: ${error.message}`);
    }
  }

  async download(fileId: string): Promise<Buffer> {
    try {
      const response = await this.drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error: any) {
      throw new Error(`Google Drive download failed: ${error.message}`);
    }
  }

  async list(folderId?: string): Promise<FileInfo[]> {
    const query = folderId
      ? `'${folderId}' in parents and trashed=false`
      : "trashed=false and 'root' in parents";

    try {
      const response = await this.drive.files.list({
        q: query,
        fields: "files(id, name, size, modifiedTime, mimeType)",
        pageSize: 100,
      });

      if (!response.data.files) {
        return [];
      }

      return response.data.files.map((file) => ({
        id: file.id!,
        name: file.name!,
        path: file.id!, // Google Drive uses IDs, not paths
        size: parseInt(file.size || "0"),
        modified: file.modifiedTime || "",
        mimeType: file.mimeType,
      }));
    } catch (error: any) {
      throw new Error(`Google Drive list failed: ${error.message}`);
    }
  }

  async delete(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({ fileId });
    } catch (error: any) {
      throw new Error(`Google Drive delete failed: ${error.message}`);
    }
  }

  async getUrl(fileId: string): Promise<string> {
    return `https://drive.google.com/file/d/${fileId}/view`;
  }

  getProviderName(): string {
    return "google_drive";
  }

  private getMimeType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xls: "application/vnd.ms-excel",
      csv: "text/csv",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }

  private async getOrCreateFolder(folderPath: string): Promise<string> {
    const parts = folderPath.split("/").filter(Boolean);
    let currentFolderId = "root";

    for (const folderName of parts) {
      // Check if folder exists
      const response = await this.drive.files.list({
        q: `name='${folderName}' and '${currentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id)",
      });

      if (response.data.files && response.data.files.length > 0) {
        currentFolderId = response.data.files[0].id!;
      } else {
        // Create folder
        const createResponse = await this.drive.files.create({
          requestBody: {
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [currentFolderId],
          },
          fields: "id",
        });
        currentFolderId = createResponse.data.id!;
      }
    }

    return currentFolderId;
  }
}
