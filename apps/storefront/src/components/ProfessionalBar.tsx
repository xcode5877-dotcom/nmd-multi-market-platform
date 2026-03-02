import { useTheme } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { trackProfessionalContact } from '../lib/trackLead';

/** WhatsApp icon (inline SVG) */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/** Phone icon (inline SVG) */
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}

export function ProfessionalBar() {
  const { branding } = useTheme();
  const tenantId = useAppStore((s) => s.tenantId);
  const { customer } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const whatsapp = branding?.whatsappPhone;
  const phone = branding?.phone ?? whatsapp;
  const hasContact = !!(whatsapp || phone);

  if (!hasContact) return null;

  const waUrl = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}`
    : null;
  const telUrl = phone ? `tel:${phone}` : null;

  return (
    <>
      <div
        className="md:hidden"
        style={{ height: 'var(--professional-bar-height)' }}
        aria-hidden
      />
      <div
        className="md:hidden fixed bottom-0 start-0 end-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 shadow-[0_-1px_3px_rgba(0,0,0,0.06)]"
        style={{
          paddingTop: '0.75rem',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        }}
        dir="rtl"
      >
        <div className="flex gap-3 px-4">
          {waUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (!tenantId) return;
                const doRedirect = async (c?: { id: string }) => {
                  await trackProfessionalContact(tenantId, 'whatsapp', c?.id);
                  window.open(waUrl, '_blank', 'noopener,noreferrer');
                };
                if (customer) doRedirect(customer);
                else openAuthModal({ onSuccess: doRedirect });
              }}
              className="flex-1 flex items-center justify-center gap-2 min-h-[3rem] rounded-xl bg-[#25D366] text-white font-medium text-base hover:opacity-90 active:opacity-95 transition-opacity cursor-pointer"
            >
              <WhatsAppIcon className="w-5 h-5" />
              تواصل الآن
            </button>
          )}
          {telUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (!tenantId) return;
                const doRedirect = async (c?: { id: string }) => {
                  await trackProfessionalContact(tenantId, 'call', c?.id);
                  window.location.href = telUrl;
                };
                if (customer) doRedirect(customer);
                else openAuthModal({ onSuccess: doRedirect });
              }}
              className="flex-1 flex items-center justify-center gap-2 min-h-[3rem] rounded-xl bg-[#2563eb] text-white font-medium text-base hover:opacity-90 active:opacity-95 transition-opacity cursor-pointer"
            >
              <PhoneIcon className="w-5 h-5" />
              اتصال هاتفي
            </button>
          )}
        </div>
      </div>
    </>
  );
}
