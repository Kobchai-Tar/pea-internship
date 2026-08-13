import { describe, it, expect, beforeEach, vi } from "bun:test";
import { NotFoundError } from "elysia";

// Mock s3 client to control responses
vi.mock("@/lib/s3", () => ({
  s3Client: { send: vi.fn() },
  BUCKET_NAME: "test-bucket",
}));

const { s3Client } = await import("@/lib/s3");
const { FileService } = await import("./service");

const service = new FileService();

describe("FileService#getFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // กรณีสำเร็จ: s3Client.send คืน object ที่มี Body.transformToByteArray และ ContentType
  // คาดว่า service จะคืน { buffer, contentType }
  it("returns buffer and contentType when S3 returns object", async () => {
    (s3Client.send as any).mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
      ContentType: "image/png",
    });

    const res = await service.getFile("path/to/file.png");
    expect(res).toHaveProperty("buffer");
    expect(res).toHaveProperty("contentType", "image/png");
    expect(res.buffer).toBeInstanceOf(Uint8Array);
  });

  // กรณีไม่พบหรือเกิดข้อผิดพลาดจาก S3: คาดว่าจะโยน NotFoundError
  it("throws NotFoundError when S3 send fails", async () => {
    (s3Client.send as any).mockImplementationOnce(() => { throw new Error("nope"); });

    await expect(service.getFile("missing" as any)).rejects.toBeInstanceOf(NotFoundError);
  });
});
