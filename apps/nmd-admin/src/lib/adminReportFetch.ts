import { apiHeaders } from '../api';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export class AdminReportFetchError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'AdminReportFetchError';
    this.status = status;
    this.code = code;
  }
}

/** User-facing Arabic message for report/API failures. */
export function adminReportErrorMessage(error: unknown): string {
  if (error instanceof AdminReportFetchError) {
    if (error.status === 401) return 'غير مصرّح — سجّل الدخول مجدداً.';
    if (error.status === 403) return 'ممنوع — لا تملك صلاحية عرض هذا التقرير.';
    if (error.status === 404) {
      return 'المسار غير متوفر على الخادم (404). واجهة التقرير أحدث من نسخة mock-api — حدّث الخادم دون الخلط مع خطأ البيانات الفارغة.';
    }
    if (error.status >= 500) {
      const dbHint =
        /prisma|database|sqlite|postgres|ECONNREFUSED|migration/i.test(error.message)
          ? ' (خطأ قاعدة بيانات)'
          : '';
      return `خطأ داخلي في الخادم (${error.status})${dbHint}. ${error.message}`;
    }
    if (error.status === 0) return 'تعذّر الاتصال بالخادم. تحقق من الشبكة.';
    return error.message || `فشل الطلب (${error.status})`;
  }
  if (error instanceof TypeError) {
    return 'تعذّر الاتصال بالخادم. تحقق من الشبكة.';
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'تعذّر تحميل التقرير. حاول مرة أخرى.';
}

/**
 * Fetch JSON for Super Admin reports with status-aware errors.
 * Never throws on empty arrays/objects — only on HTTP/network failure.
 */
export async function fetchAdminReportJson<T>(path: string): Promise<T> {
  if (!MOCK_API_URL) {
    throw new AdminReportFetchError(
      'VITE_MOCK_API_URL غير مضبوط — لا يمكن تحميل التقرير.',
      0
    );
  }
  const url = `${MOCK_API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: apiHeaders() });
  } catch {
    throw new AdminReportFetchError('تعذّر الاتصال بالخادم. تحقق من الشبكة.', 0);
  }

  if (!res.ok) {
    let bodyMsg = '';
    let code: string | undefined;
    try {
      const err = (await res.json()) as { error?: string; code?: string };
      bodyMsg = err.error?.trim() || '';
      code = err.code;
    } catch {
      try {
        bodyMsg = (await res.text()).slice(0, 200);
      } catch {
        bodyMsg = '';
      }
    }
    const fallback =
      res.status === 401
        ? 'Unauthorized'
        : res.status === 403
          ? 'Forbidden'
          : res.status === 404
            ? 'Not found'
            : `HTTP ${res.status}`;
    throw new AdminReportFetchError(bodyMsg || fallback, res.status, code);
  }

  if (res.status === 204) return undefined as T;
  try {
    return (await res.json()) as T;
  } catch {
    throw new AdminReportFetchError('استجابة غير صالحة من الخادم (JSON).', res.status);
  }
}
