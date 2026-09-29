import "./globals.css";

export const metadata = {
  title: "GROMMA BARBER",
  description: "Gestão para barbearias",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
