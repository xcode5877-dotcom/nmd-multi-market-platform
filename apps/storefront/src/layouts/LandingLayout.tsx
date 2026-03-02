import { Outlet, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { X, User } from 'lucide-react';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';

const ANNOUNCEMENT_KEY = 'nmd-announcement-closed';

export default function LandingLayout() {
  const [announcementClosed, setAnnouncementClosed] = useState(false);
  const { customer } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();

  useEffect(() => {
    if (localStorage.getItem(ANNOUNCEMENT_KEY) === '1') setAnnouncementClosed(true);
  }, []);

  const closeAnnouncement = () => {
    setAnnouncementClosed(true);
    localStorage.setItem(ANNOUNCEMENT_KEY, '1');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF9] overflow-x-hidden">
      {!announcementClosed && (
        <div className="bg-[#FEF3C7]/80 border-b border-[#FEF3C7] py-2 px-4 flex items-center justify-center gap-2">
          <span className="text-sm text-gray-700">السوق في مرحلته التجريبية</span>
          <button type="button" onClick={closeAnnouncement} className="p-1 rounded hover:bg-[#FEF3C7]" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-bold text-xl text-gray-900">اختر السوق</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border">NMD OS</span>
          </Link>
          <nav className="flex items-center gap-4">
            {customer ? (
              <Link to="/my-activity" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100">
                <User className="w-5 h-5" />
                <span className="hidden sm:inline">حسابي</span>
              </Link>
            ) : (
              <button type="button" onClick={() => openAuthModal()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#D97706] hover:bg-amber-50">
                <User className="w-5 h-5" />
                <span className="hidden sm:inline">تسجيل الدخول</span>
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Link to="/" className="fixed bottom-6 end-6 z-50 md:hidden px-5 py-3 rounded-full bg-[#B45309] text-white font-semibold shadow-lg">
        اختر السوق
      </Link>
      <footer className="bg-[#1E293B] text-gray-400 py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <Link to="/" className="hover:text-white">الأسواق</Link>
          <p className="mt-4 text-sm">© NMD Markets</p>
        </div>
      </footer>
    </div>
  );
}
