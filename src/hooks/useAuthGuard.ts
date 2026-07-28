import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IUserProfile } from "@/lib/db/models";

export function useAuthGuard() {
  const router = useRouter();
  const [profile, setProfile] = useState<IUserProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      const storedEmail = localStorage.getItem("healthos_email");
      const storedUserId = localStorage.getItem("healthos_userId");
      const cachedProfile = localStorage.getItem("healthos_profile");

      if (!storedEmail) {
        router.push("/login");
        setLoading(false);
        return;
      }

      setEmail(storedEmail);
      if (storedUserId) {
        setUserId(storedUserId);
      }

      // INSTANT RENDER (0ms latency): Populate profile from localStorage immediately if available
      if (cachedProfile) {
        try {
          const parsed = JSON.parse(cachedProfile);
          setProfile(parsed);
          setLoading(false); // Page renders INSTANTLY!
        } catch {
          // Ignore parse errors and continue to fetch
        }
      }

      // Background Revalidation: Fetch fresh profile silently without blocking UI
      try {
        const res = await fetch(
          `/api/profile?email=${encodeURIComponent(storedEmail)}&t=${Date.now()}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          if (!cachedProfile) router.push("/onboarding");
          return;
        }

        const data = await res.json();

        if (data.notInitialized) {
          router.push(`/onboarding?email=${encodeURIComponent(storedEmail)}`);
          return;
        }

        if (data.profile) {
          setProfile(data.profile);
          localStorage.setItem("healthos_profile", JSON.stringify(data.profile));
          if (data.profile._id) {
            setUserId(data.profile._id);
            localStorage.setItem("healthos_userId", data.profile._id);
          }
          if (data.profile.name) {
            localStorage.setItem("healthos_name", data.profile.name.split(" ")[0]);
          }
        }
      } catch (err) {
        console.error("Auth guard check error:", err);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  return {
    profile,
    setProfile,
    email,
    userId,
    loading,
  };
}
