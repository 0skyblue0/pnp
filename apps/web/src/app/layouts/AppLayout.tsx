import { useMemo } from "react";
import { useLocation } from "react-router-dom";

function screenFromPath(pathname: string) {
  if (pathname.startsWith("/daily-log")) {
    return "daily";
  }
  if (pathname.startsWith("/response")) {
    return "feedback";
  }
  if (pathname.startsWith("/reservation")) {
    return "reservation";
  }
  if (pathname.startsWith("/prepaid-ledger")) {
    return "prepaid";
  }
  if (pathname.startsWith("/staff")) {
    return "admin";
  }
  if (pathname.startsWith("/notification")) {
    return "alerts";
  }

  return "home";
}

export function AppLayout() {
  const location = useLocation();
  const prototypeUrl = useMemo(() => {
    const params = new URLSearchParams({ screen: screenFromPath(location.pathname) });
    return `/prototype/paul-paullina-management.dc.html?${params.toString()}`;
  }, [location.pathname]);

  return (
    <iframe
      className="block h-screen w-screen border-0"
      src={prototypeUrl}
      title="폴앤폴리나 관리 시스템"
    />
  );
}
