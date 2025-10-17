import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bell,
  User,
  LogOut,
  Settings,
  BarChart3,
  Palette,
  Image,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { useTheme } from "@/hooks/useTheme";
import { backgroundOptions } from "@/contexts/ThemeContext";

export function AppLayout() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();
  const { themeColor, setThemeColor, background, setBackground } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase();
    }
    return user?.email?.[0].toUpperCase() || "U";
  };

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 border-b bg-background">
            <div className="flex h-10 md:h-12 items-center gap-1 md:gap-2 px-2 md:px-3">
              <SidebarTrigger />
              <div className="flex-1" />
              {/* <Button variant="ghost" size="icon" className="relative h-9 w-9">
                <Bell className="h-4 w-4 md:h-5 md:w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-destructive" />
              </Button> */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">
                        {profile?.full_name || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {profile?.role || "worker"}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <DropdownMenuSeparator />

                  <div className="px-2 py-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Palette className="h-4 w-4" />
                      <span className="text-sm">Theme Color</span>
                      <input
                        type="color"
                        value={themeColor}
                        onChange={(e) => setThemeColor(e.target.value)}
                        className="ml-auto h-8 w-16 cursor-pointer rounded border border-border"
                      />
                    </label>
                  </div>

                  <DropdownMenuSeparator />

                  <div className="px-2 py-1.5">
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="h-4 w-4" />
                      <span className="text-sm font-medium">Background</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {backgroundOptions.map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => setBackground(bg.id)}
                          className={`relative h-16 rounded border-2 overflow-hidden transition-all ${
                            background === bg.id
                              ? "border-primary ring-2 ring-primary/20"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          {bg.url ? (
                            <img
                              src={bg.url}
                              alt={bg.label}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">
                                None
                              </span>
                            </div>
                          )}
                          {background === bg.id && (
                            <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                              <Check className="h-6 w-6 text-primary-foreground drop-shadow-md" />
                            </div>
                          )}
                          {/* <div className="absolute bottom-0 left-0 right-0 bg-background/90 backdrop-blur-sm px-1 py-0.5">
                            <span className="text-xs truncate block">
                              {bg.label}
                            </span>
                          </div> */}
                        </button>
                      ))}
                    </div>
                  </div>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1 p-2 md:p-3 lg:p-2 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
