
import { Plus_Jakarta_Sans, Roboto_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

import GuestMenu from "./Guestmenu/guestmenu";
import ClientMenu from "./Clientmenu/clientmenu";
import Footer from "@/components/footer/Footer";

import "./resorts.css";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  display: "swap",
});

export default async function ClientLayout({ children }) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";

  const user = await getSessionUser();
  const userId = user?.id ?? null;

  const GUEST_ONLY_PATHS = ["/", "/login", "/register"];

  const isGuestOnlyPage = GUEST_ONLY_PATHS.includes(pathname);

  if (userId && isGuestOnlyPage) {
    redirect("/dashboard");
  }

  return (
    <div
      className={`${jakartaSans.variable} ${robotoMono.variable} resorts-page font-sans`}
    >
      <main>
        {userId ? <ClientMenu /> : <GuestMenu />}
        {children}
      </main>

      <Footer />
    </div>
  );
}
