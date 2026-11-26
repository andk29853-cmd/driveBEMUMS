import { resolveUrl } from './api';

/**
 * Upload langsung dari browser ke Presigned URL (S3/R2/B2/Storj/MinIO/Local)
 * menggunakan XMLHttpRequest agar progress real-time dapat dipantau.
 */
export function uploadToPresignedUrl({ url, method = 'PUT', headers = {} }, file, onProgress) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open(method, resolveUrl(url), true);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100), e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let message = `Storage menolak upload (HTTP ${xhr.status}).`;
        try {
          const data = JSON.parse(xhr.responseText);
          if (data?.message) message = data.message;
        } catch {
          /* respons XML dari S3 */
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () =>
      reject(new Error('Gagal terhubung ke storage bucket. Periksa koneksi atau konfigurasi CORS bucket.'));
    xhr.onabort = () => reject(Object.assign(new Error('Upload dibatalkan.'), { aborted: true }));
    xhr.send(file);
  });
  return { promise, abort: () => xhr.abort() };
}
