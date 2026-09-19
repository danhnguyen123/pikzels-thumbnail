import { createContext, useContext, useEffect, useState } from "react";
import {
  Palette, Pencil, Star, FileText, Dna, Settings, Images,
  PanelLeftClose, PanelLeftOpen, BookOpen, Languages,
} from "lucide-react";
import { api, type Config } from "./api";
import { cn } from "./lib";
import { ToastProvider } from "./ui";
import { useI18n } from "./i18n";
import Create from "./pages/Create";
import Edit from "./pages/Edit";
import Score from "./pages/Score";
import Titles from "./pages/Titles";
import Personas from "./pages/Personas";
import Gallery from "./pages/Gallery";
import ApiPage from "./pages/ApiPage";

const NAV = [
  { key: "Create", tk: "nav.create", icon: Palette },
  { key: "Edit", tk: "nav.edit", icon: Pencil },
  { key: "Score", tk: "nav.score", icon: Star },
  { key: "Titles", tk: "nav.titles", icon: FileText },
  { key: "Personas", tk: "nav.personas", icon: Dna },
  { key: "Gallery", tk: "nav.gallery", icon: Images },
  { key: "API", tk: "nav.api", icon: Settings },
] as const;

export const ConfigCtx = createContext<Config | null>(null);
export const useConfig = () => useContext(ConfigCtx);

export const NavCtx = createContext<(page: string) => void>(() => {});
export const useNav = () => useContext(NavCtx);

const PAGES: Record<string, React.FC> = {
  Create, Gallery, Edit, Score, Titles, Personas, API: ApiPage,
};

export default function App() {
  const [page, setPage] = useState<string>(() => localStorage.getItem("page") || "Create");
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem("nav") === "1");
  const [cfg, setCfg] = useState<Config | null>(null);
  const { t, lang, setLang } = useI18n();

  useEffect(() => { api.config().then(setCfg).catch(() => {}); }, []);
  useEffect(() => { localStorage.setItem("page", page); }, [page]);
  useEffect(() => { localStorage.setItem("nav", collapsed ? "1" : "0"); }, [collapsed]);

  const Page = PAGES[page] || Create;

  return (
    <ConfigCtx.Provider value={cfg}>
     <NavCtx.Provider value={setPage}>
      <ToastProvider>
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className={cn(
            "flex flex-col border-r border-border bg-panel transition-all duration-200",
            collapsed ? "w-16" : "w-64"
          )}>
            <div className="flex items-center justify-between px-3 h-14 border-b border-border">
              {!collapsed && <span className="font-bold text-lg">Package</span>}
              <button className="btn-nav w-auto" onClick={() => setCollapsed((c) => !c)}
                title={collapsed ? "Mở rộng" : "Thu gọn"}>
                {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
            </div>
            <nav className="flex-1 p-2 space-y-1">
              {NAV.map(({ key, tk, icon: Icon }) => (
                <button key={key} onClick={() => setPage(key)} title={collapsed ? t(tk) : undefined}
                  className={cn("btn-nav", page === key && "btn-nav-active", collapsed && "justify-center")}>
                  <Icon size={18} className="shrink-0" />
                  {!collapsed && <span className="truncate">{t(tk)}</span>}
                </button>
              ))}
            </nav>
            {/* Language toggle */}
            <div className="p-2 border-t border-border">
              {collapsed ? (
                <button className="btn-nav justify-center" onClick={() => setLang(lang === "vi" ? "en" : "vi")}
                  title={lang === "vi" ? "English" : "Tiếng Việt"}>
                  <Languages size={18} />
                </button>
              ) : (
                <div className="flex gap-1">
                  {(["vi", "en"] as const).map((l) => (
                    <button key={l} onClick={() => setLang(l)}
                      className={cn("btn-nav justify-center flex-1", lang === l && "btn-nav-active")}>
                      {l === "vi" ? "Tiếng Việt" : "English"}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {!collapsed && (
              <a href="https://docs.pikzels.com/" target="_blank"
                className="btn-nav m-2" rel="noreferrer">
                <BookOpen size={18} /> {t("common.docs")}
              </a>
            )}
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-y-auto">
            <div className={cn("p-6", page !== "Gallery" && "mx-auto max-w-6xl")}>
              {cfg && !cfg.key_ok && page !== "API" && (
                <div className="card border-amber-500/40 text-amber-300 p-3 mb-4 text-sm">
                  {t("common.noKeyWarn")}
                </div>
              )}
              <Page />
            </div>
          </main>
        </div>
      </ToastProvider>
     </NavCtx.Provider>
    </ConfigCtx.Provider>
  );
}
