import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMock = vi.fn();

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: sendMock })),
  GetObjectCommand: vi.fn().mockImplementation((i) => ({ __cmd: 'Get', input: i })),
  PutObjectCommand: vi.fn().mockImplementation((i) => ({ __cmd: 'Put', input: i })),
  HeadObjectCommand: vi.fn().mockImplementation((i) => ({ __cmd: 'Head', input: i })),
}));

beforeEach(() => {
  sendMock.mockReset();
});

describe('S3StorageClient', () => {
  it('throws if bucket missing', async () => {
    const { S3StorageClient } = await import('../ops/storage-s3.js');
    expect(() => new S3StorageClient({ backend: 's3', endpoint: null })).toThrow(
      /bucket is required/,
    );
  });

  it('put sends PutObjectCommand with body + contentType', async () => {
    sendMock.mockResolvedValueOnce({});
    const { S3StorageClient } = await import('../ops/storage-s3.js');
    const c = new S3StorageClient({
      backend: 's3',
      bucket: 'b',
      region: 'us-east-1',
      endpoint: null,
    });
    await c.put('k', Buffer.from('x'), { contentType: 'text/plain' });
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        __cmd: 'Put',
        input: expect.objectContaining({
          Bucket: 'b',
          Key: 'k',
          ContentType: 'text/plain',
        }),
      }),
    );
  });

  it('head returns null on NotFound', async () => {
    sendMock.mockRejectedValueOnce(
      Object.assign(new Error('nf'), { name: 'NotFound' }),
    );
    const { S3StorageClient } = await import('../ops/storage-s3.js');
    const c = new S3StorageClient({
      backend: 's3',
      bucket: 'b',
      region: 'us-east-1',
      endpoint: null,
    });
    expect(await c.head('missing')).toBeNull();
  });

  it('head returns metadata for existing object', async () => {
    sendMock.mockResolvedValueOnce({
      ContentLength: 42,
      ContentType: 'image/jpeg',
      LastModified: new Date('2026-04-19T00:00:00Z'),
    });
    const { S3StorageClient } = await import('../ops/storage-s3.js');
    const c = new S3StorageClient({
      backend: 's3',
      bucket: 'b',
      region: 'us-east-1',
      endpoint: null,
    });
    const h = await c.head('key');
    expect(h?.size).toBe(42);
    expect(h?.contentType).toBe('image/jpeg');
  });

  it('r2 backend forces path-style addressing', async () => {
    const { S3StorageClient } = await import('../ops/storage-s3.js');
    new S3StorageClient({
      backend: 'r2',
      bucket: 'b',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
    });
    const s3module = await import('@aws-sdk/client-s3');
    // vi.mock replaces S3Client with a mock — access its calls via vi.mocked
    const ctor = vi.mocked(s3module.S3Client);
    expect(ctor).toHaveBeenCalledWith(
      expect.objectContaining({ forcePathStyle: true }),
    );
  });

  it('factory routes s3 backend to S3StorageClient', async () => {
    const { createStorageClient } = await import('../ops/storage.js');
    const c = await createStorageClient({
      backend: 's3',
      bucket: 'acme',
      region: 'us-east-1',
      endpoint: null,
    });
    expect(c).toBeDefined();
    expect(typeof c.get).toBe('function');
  });
});
