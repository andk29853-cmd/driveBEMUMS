import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Clock,
  HardDrive,
  Settings,
  Sun,
  Moon,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  Cloud,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { api } from '../lib/api';
import { onDriveChange } from '../lib/events';
import { formatBytes, initials, ROLE_LABEL } from '../lib/format';
import Dropdown from './Dropdown';
import UploadPanel from './UploadPanel';

export default function AppLayout() {
  const { user, appSettings, logout, refresh, isLoggedIn, isManager } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [overview, setOverview] = useState(null);

  const loadOverview = useCallback(() => {
    if (!user) {
      setOverview(null);
      return;
    }
    api
      .get('/stats/overview')
      .then(setOverview)
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    loadOverview();
    return onDriveChange(loadOverview);
  }, [loadOverview]);

  const navItems = [
    { to: '/', label: 'Semua Folder', icon: FolderKanban, end: true },
    { to: '/recent', label: 'Terbaru', icon: Clock },
    ...(isManager
      ? [
          { to: '/buckets', label: 'Manajemen Bucket', icon: HardDrive },
          { to: '/settings', label: 'Pengaturan', icon: Settings },
        ]
      : []),
  ];

  const usedBytes = overview?.usedBytes ?? 0;
  const capacityBytes = overview?.capacityBytes ?? 0;

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Navbar Full-Width */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Kiri: Hamburger (Mobile) + Brand + Menu Navigasi */}
          <div className="flex items-center gap-3 lg:gap-6">
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="icon-btn md:hidden"
              aria-label="Buka navigasi"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                  Drive BEM UMS
                </h1>
                <p className="hidden max-w-[220px] truncate text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:block">
                  {appSettings?.cabinetName || 'Cloud Arsip Terpusat'}
                </p>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      clsx(
                        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
                        isActive
                          ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70'
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Kanan: Ringkasan Kapasitas + Theme Toggle + Login Admin / Profil */}
          <div className="flex items-center gap-2.5">
            {overview && (
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/60 xl:flex">
                <span className="text-slate-500 dark:text-slate-400">Kapasitas drive:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {formatBytes(usedBytes)} / {formatBytes(capacityBytes)}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="icon-btn"
              title={theme === 'dark' ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}
              aria-label="Ganti tema"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
            </button>

            {isLoggedIn ? (
              <Dropdown
                trigger={({ toggle }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1.5 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80 dark:hover:bg-slate-800"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                      {initials(user?.name)}
                    </div>
                    <div className="hidden pr-1 sm:block">
                      <p className="max-w-[140px] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                        {user?.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{ROLE_LABEL[user?.role]}</p>
                    </div>
                  </button>
                )}
                items={[
                  ...(isManager
                    ? [
                        {
                          label: 'Pengaturan Akun',
                          icon: Settings,
                          onClick: () => navigate('/settings'),
                        },
                        { divider: true },
                      ]
                    : []),
                  {
                    label: 'Keluar Mode Admin',
                    icon: LogOut,
                    danger: true,
                    onClick: async () => {
                      logout();
                      await refresh();
                      navigate('/');
                    },
                  },
                ]}
              />
            ) : (
              <Link to="/login" className="btn-secondary btn-sm">
                <ShieldCheck className="h-4 w-4 text-brand-600" />
                <span>Login Admin</span>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Nav Menu */}
        {mobileOpen && (
          <nav className="space-y-1 border-t border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 md:hidden">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition',
                      isActive
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/70'
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main Content Full Screen (extra bottom padding on mobile for bottom nav) */}
      <main className="w-full min-w-0 flex-1 p-3.5 pb-24 sm:p-6 sm:pb-24 md:pb-8 lg:p-8">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi Mobile"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-slate-200/80 bg-white/95 px-2 py-1.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 md:hidden"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex min-w-[64px] flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition',
                  isActive
                    ? 'text-brand-600 dark:text-brand-400'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="whitespace-nowrap">{item.label.replace('Manajemen ', '')}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Floating Upload Progress Panel */}
      <UploadPanel />
    </div>
  );
}
