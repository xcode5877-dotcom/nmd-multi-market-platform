import { Outlet, Link } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-light-bg)' }}>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg text-primary">
            NMD OS
          </Link>
          <nav className="flex gap-4">
            <Link to="/" className="text-gray-700 hover:text-primary">
              Home
            </Link>
            <Link to="/stores" className="text-gray-700 hover:text-primary">
              Stores
            </Link>
            <Link to="/search" className="text-gray-700 hover:text-primary">
              Search
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-[var(--color-dark-surface)] text-gray-400 py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <p>Explore stores and merchants — NMD OS</p>
          <p className="mt-1 text-gray-500">© NMD OS</p>
        </div>
      </footer>
    </div>
  );
}
