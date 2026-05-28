"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface HomeCardLinkProps {
  href: string;
  className: string;
  children: React.ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

export default function HomeCardLink({
  href,
  className,
  children,
  requireAuth = false,
  requireAdmin = false,
}: HomeCardLinkProps) {
  const [isAuthorized, setIsAuthorized] = useState(false);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.loggedIn && data.user) {
          if (requireAdmin) {
            setIsAuthorized(data.user.role === "admin");
          } else {
            setIsAuthorized(true);
          }
        } else {
          setIsAuthorized(false);
        }
      } else {
        setIsAuthorized(false);
      }
    } catch (e) {
      setIsAuthorized(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Listen to storage events to update validation status in real-time
    const handleStorage = () => checkAuth();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [requireAdmin]);

  const handleClick = (e: React.MouseEvent) => {
    if ((requireAuth || requireAdmin) && !isAuthorized) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("open-access-control-login"));
    }
  };

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
