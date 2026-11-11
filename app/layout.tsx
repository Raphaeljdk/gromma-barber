import "./globals.css";
import "./inventory-notifications.css";
import "./agenda-multiunit-history.css";
import "./customer-directory.css";
import "./management-audit.css";
import "./agenda-people-filters.css";
import "./gromma-reference-theme.css";
import "./gromma-navigation-polish.css";
import "./gromma-unified-shell.css";
import "./gromma-professional-fast-ai.css";
import "./gromma-business-compact.css";
import "./gromma-personalizacao-layout.css";
import "./gromma-business-experience.css";

export const metadata = {
  title: "GROMMA BARBER",
  description: "Gestão para barbearias",
};

const themeScript = `
(() => {
  try {
    const saved = localStorage.getItem("gromma-theme");
    // New interface is light by default across the public site, login and ERP.
    // Keep the user's explicit theme choice when one exists.
    const theme = saved === "light" || saved === "dark" ? saved : "light";
    document.documentElement.dataset.theme = theme;
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
