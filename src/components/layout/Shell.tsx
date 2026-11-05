import { Link, useLocation } from "wouter";
import { LayoutDashboard, Library, FileText, HelpCircle, Settings, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/projects", label: "المشاريع", icon: Library },
  { href: "/documents", label: "المستندات", icon: FileText },
  { href: "/questions", label: "بنك الأسئلة", icon: HelpCircle },
  { href: "/page-designer", label: "تصميم الصفحات", icon: PenTool },
];

const settingsItem = { href: "/settings", label: "الإعدادات", icon: Settings };

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isBuilder = location.startsWith("/builder/");

  if (isBuilder) {
    return <main className="h-screen w-full overflow-hidden bg-background text-foreground">{children}</main>;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background" dir="rtl">
      <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col border-l border-sidebar-border shadow-xl z-20 shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border gap-3">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shadow-sm shrink-0">
            <FileText className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-base tracking-tight leading-tight">منشئ الأوراق<br/>التعليمية</span>
        </div>

        <nav className="flex-1 py-5 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-md cursor-pointer transition-colors group gap-3",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/70")} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Link href={settingsItem.href}
            className={cn(
              "flex items-center px-3 py-2 text-sm transition-colors rounded-md gap-3",
              location === settingsItem.href
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )}
          >
            <Settings className={cn("w-5 h-5 shrink-0", location === settingsItem.href ? "text-primary" : "text-sidebar-foreground/50")} />
            <span>{settingsItem.label}</span>
          </Link>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-y-auto relative z-0 bg-background text-foreground min-w-0">
        {children}
      </main>
    </div>
  );
}
