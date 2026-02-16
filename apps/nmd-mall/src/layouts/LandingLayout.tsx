import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const ANNOUNCEMENT_KEY = 'nmd-announcement-closed';

export default function LandingLayout() {
  const [announcementClosed, setAnnouncementClosed] = useState(false);
  const isMarketsPicker = useLocation().pathname === '/markets';

  useEffect(() => {
    if (localStorage.getItem(ANNOUNCEMENT_KEY) === '1') {
      setAnnouncementClosed(true);
    }
  }, []);

  const closeAnnouncement = () => {
    setAnnouncementClosed(true);
    localStorage.setItem(ANNOUNCEMENT_KEY, '1');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF9] overflow-x-hidden">
      {!announcementClosed && (
        <div className="bg-[#FEF3C7]/80 border-b border-[#FEF3C7] py-2 px-4 flex items-center justify-center gap-2">
          <span className="text-sm text-gray-700">
            🚀 السوق في مرحلته التجريبية — قريبًا انضمام محلات جديدة
          </span>
          <button
            type="button"
            onClick={closeAnnouncement}
            className="p-1 rounded hover:bg-[#FEF3C7] transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/markets" className="flex items-center gap-2">
            <span className="font-bold text-xl text-gray-900">{isMarketsPicker ? 'اختر السوق' : 'NMD Markets'}</span>
            <span className="text-xs text-gray-500">{isMarketsPicker ? 'Markets' : 'اختر السوق'}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F8FAFC] text-gray-500 border border-gray-200">
              Powered by NMD OS
            </span>
          </Link>
          <nav className="flex gap-4">
            {!isMarketsPicker && (
              <Link to="/markets" className="text-gray-700 hover:text-[#D97706] transition-colors text-sm">
                الأسواق
              </Link>
            )}
            {!isMarketsPicker && (
              <>
                <Link to="/legacy/offers" className="text-gray-700 hover:text-[#D97706] transition-colors text-sm">العروض</Link>
                <Link to="/legacy/categories" className="text-gray-700 hover:text-[#D97706] transition-colors text-sm">الفئات</Link>
                <Link to="/legacy/contact" className="text-gray-700 hover:text-[#D97706] transition-colors text-sm">تواصل معنا</Link>
                <Link to="/legacy/about" className="text-gray-700 hover:text-[#D97706] transition-colors text-sm">عن السوق</Link>
                <Link to="/legacy/join" className="text-gray-700 hover:text-[#D97706] transition-colors text-sm">أضف محلك</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Link
        to="/markets"
        className="nmd-btn-active fixed bottom-6 end-6 z-50 md:hidden px-5 py-3 rounded-full bg-[#B45309] text-white font-semibold shadow-lg shadow-[#D97706]/25 hover:bg-[#92400E] transition-all"
      >
        اختر السوق
      </Link>
      <footer className="bg-[#1E293B] text-gray-400 py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            <span className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-gray-300">آمن</span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-gray-300">بياناتك محفوظة</span>
            <span className="text-xs px-3 py-1.5 rounded-full bg-white/10 text-gray-300">بدون تعقيد</span>
          </div>
          <div className="flex flex-wrap justify-center gap-8 mb-6">
            <Link to="/markets" className="hover:text-white transition-colors">الأسواق</Link>
          </div>
          <p className="text-center text-sm">© NMD Markets</p>
        </div>
      </footer>
    </div>
  );
}
