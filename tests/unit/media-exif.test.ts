import { afterEach, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  upload: vi.fn(async (...args: unknown[]) => { void args; return { error: null }; }),
  getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: `https://example.test/listing-media/${path}` } })),
}));
vi.mock('@/lib/server/auth', () => ({
  requireUser: async () => ({
    user: { id: '10000000-0000-4000-8000-000000000001' },
    db: { storage: { from: () => ({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl }) } },
  }),
}));

const origin = 'http://localhost:3200';
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

// Read the TIFF IFD0 directory to establish that the generated fixture has a GPS IFD.
function hasGpsIfd(exif: Buffer): boolean {
  const start = exif.subarray(0, 6).equals(Buffer.from('Exif\0\0')) ? 6 : 0;
  const little = exif.toString('ascii', start, start + 2) === 'II';
  const u16 = (i: number) => little ? exif.readUInt16LE(i) : exif.readUInt16BE(i);
  const u32 = (i: number) => little ? exif.readUInt32LE(i) : exif.readUInt32BE(i);
  const offset = start + u32(start + 4);
  const count = u16(offset);
  return Array.from({ length: count }, (_, i) => u16(offset + 2 + 12 * i)).includes(0x8825);
}

async function send(bytes: Uint8Array, type: string, contentLength = '1000') {
  vi.stubEnv('APP_URL', origin);
  const form = new FormData();
  form.append('file', new File([Uint8Array.from(bytes)], 'test-image', { type }));
  const request = new Request(`${origin}/api/media`, {
    method: 'POST', headers: { origin, 'content-length': contentLength }, body: form,
  });
  const { POST } = await import('@/app/api/media/route');
  return POST(request);
}

async function createGpsJpeg() {
  return sharp({ create: { width: 3, height: 2, channels: 3, background: '#fff' } })
    .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '44/1 25/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '26/1 6/1 0/1' } })
    .withMetadata({ orientation: 6 }).jpeg().toBuffer();
}

describe('POST /api/media', () => {
  it('strips GPS and orientation metadata, rotates the image and uses the authenticated owner path', async () => {
    const input = await createGpsJpeg();
    const before = await sharp(input).metadata();
    expect(before.exif).toBeDefined();
    expect(hasGpsIfd(before.exif!)).toBe(true);
    expect(before.orientation).toBe(6);

    const response = await send(input, 'image/jpeg');
    expect(response.status).toBe(200);
    expect(mocks.upload).toHaveBeenCalledOnce();
    const [path, bytes, options] = mocks.upload.mock.calls[0] as [string, Buffer, unknown];
    expect(path).toMatch(/^10000000-0000-4000-8000-000000000001\/[0-9a-f-]{36}\.webp$/);
    expect(options).toEqual({ contentType: 'image/webp', upsert: false });
    const after = await sharp(bytes).metadata();
    expect(after.format).toBe('webp');
    expect(after.exif).toBeUndefined();
    expect(after.orientation).toBeUndefined();
    expect([after.width, after.height]).toEqual([2, 3]);
    expect(await response.json()).toEqual({ data: { url: `https://example.test/listing-media/${path}` } });
  });

  it('rejects a request exceeding the content-length limit', async () => {
    const response = await send(new Uint8Array([1]), 'image/jpeg', '4000001');
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'Upload one image smaller than 3 MB.' });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejects a file exceeding the actual file-size limit even with a small content-length', async () => {
    const response = await send(new Uint8Array(3_000_001), 'image/jpeg');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Upload a JPG, PNG or WebP smaller than 3 MB.' });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejects valid GIF input', async () => {
    const gif = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).gif().toBuffer();
    const response = await send(gif, 'image/gif');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Only still JPG, PNG and WebP photographs are supported.' });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejects animated WebP even though still WebP is supported', async () => {
    const raw = Buffer.from([...Array(4).fill([255, 0, 0]).flat(), ...Array(4).fill([0, 0, 255]).flat()]);
    const animated = await sharp(raw, { raw: { width: 2, height: 4, channels: 3, pageHeight: 2 } }).webp({ delay: [100, 100], loop: 0 }).toBuffer();
    expect((await sharp(animated).metadata()).pages).toBe(2);
    const response = await send(animated, 'image/webp');
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Only still JPG, PNG and WebP photographs are supported.' });
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
