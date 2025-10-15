import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Custom hook that automatically closes the mobile sidebar when navigation occurs
 */
export function useSidebarAutoClose() {
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();

  useEffect(() => {
    // Only close sidebar on mobile when location changes
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);
}
