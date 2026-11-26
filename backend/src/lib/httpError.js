export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const badRequest = (msg, d) => new HttpError(400, msg, d);
export const unauthorized = (msg = 'Sesi Anda telah berakhir, silakan login kembali.') => new HttpError(401, msg);
export const forbidden = (msg = 'Anda tidak memiliki akses untuk melakukan aksi ini.') => new HttpError(403, msg);
export const notFound = (msg = 'Data tidak ditemukan.') => new HttpError(404, msg);
export const conflict = (msg, d) => new HttpError(409, msg, d);
