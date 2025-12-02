import { useOutletContext } from "react-router-dom";
import type { AdminOutletContext } from "./AdminScheduler";
import RssStreamsTab from "./RssStreamsTab";

function RssStreamsPage() {
  const { authToken } = useOutletContext<AdminOutletContext>();
  return <RssStreamsTab authToken={authToken} />;
}

export default RssStreamsPage;
