import { describe, expect, it } from "vitest";

import {
  ATTACHMENT_MANIFEST_VERSION,
  decodeAttachmentContentBase64,
  encodeAttachmentContentBase64,
  parseAttachmentManifestJson,
  serializeAttachmentManifest
} from "./attachmentImportExport.js";

describe("attachmentImportExport", () => {
  it("round-trips manifest JSON", () => {
    const manifest = {
      version: ATTACHMENT_MANIFEST_VERSION,
      projectId: "1",
      exportedAt: new Date().toISOString(),
      includeContent: true,
      attachments: [
        {
          entityType: "case" as const,
          entityId: "10",
          caseId: "10",
          fileName: "proof.txt",
          contentType: "text/plain",
          contentBase64: encodeAttachmentContentBase64(Buffer.from("hello"))
        }
      ]
    };
    const parsed = parseAttachmentManifestJson(serializeAttachmentManifest(manifest));
    expect(parsed.attachments[0]?.fileName).toBe("proof.txt");
    expect(decodeAttachmentContentBase64(parsed.attachments[0]?.contentBase64 ?? "").toString()).toBe(
      "hello"
    );
  });
});
