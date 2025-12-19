import type { CloudStorageProvider } from "./CloudStorageProvider";
import { DropboxStorageProvider } from "./DropboxStorageProvider";
import { GoogleDriveStorageProvider } from "./GoogleDriveStorageProvider";

export class StorageProviderFactory {
  static create(
    provider: "dropbox" | "google_drive",
    accessToken: string
  ): CloudStorageProvider {
    switch (provider) {
      case "dropbox":
        return new DropboxStorageProvider(accessToken);
      case "google_drive":
        return new GoogleDriveStorageProvider(accessToken);
      default:
        throw new Error(`Unsupported storage provider: ${provider}`);
    }
  }
}
