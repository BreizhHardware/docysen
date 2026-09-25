import { useState } from "react";
import { Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import ConsentEmailModal from "./ConsentEmailModal";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const { isFirstLogin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="bg-surface flex h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
      {isFirstLogin && <ConsentEmailModal />}
    </div>
  );
}
