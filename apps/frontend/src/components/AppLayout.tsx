import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ConsentEmailModal from "./ConsentEmailModal";
import { useAuth } from "../context/AuthContext";

export default function AppLayout() {
  const { isFirstLogin } = useAuth();

  return (
    <div className="flex h-screen bg-surface">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      {isFirstLogin && <ConsentEmailModal />}
    </div>
  );
}
