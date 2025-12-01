import { useOutletContext } from "react-router-dom";
import type { AdminOutletContext } from "./AdminScheduler";
import SessionsTab from "./SessionsTab";

function SessionsPage() {
  const { authToken } = useOutletContext<AdminOutletContext>();
  return <SessionsTab authToken={authToken} />;
}

export default SessionsPage;
