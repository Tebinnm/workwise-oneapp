import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Ensure profile exists after login
        await ensureUserProfile();

        toast.success("Welcome back!");
        navigate("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) throw error;

        // Create profile manually after signup
        await createUserProfile(fullName);

        toast.success("Account created! Please check your email to verify.");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const ensureUserProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Direct insert without any RLS or functions
        await supabase.from("profiles").upsert({
          id: user.id,
          full_name: user.user_metadata?.full_name || "",
          role: "worker",
        });
      }
    } catch (error) {
      console.error("Error ensuring user profile:", error);
    }
  };

  const createUserProfile = async (fullName: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Direct insert without any RLS or functions
        await supabase.from("profiles").upsert({
          id: user.id,
          full_name: fullName,
          role: "worker",
        });
      }
    } catch (error) {
      console.error("Error creating user profile:", error);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-background">
        <div className="w-full max-w-md space-y-6 md:space-y-8">
          <div className="space-y-2">
            <Logo />
            <h1 className="text-2xl sm:text-3xl font-bold">Welcome back!</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Please enter {isLogin ? "log in" : "sign up"} details below
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Log in" : "Sign up"}
            </Button>

            <div className="text-center text-xs sm:text-sm">
              {isLogin
                ? "Don't have an account? "
                : "Already have an account? "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-medium"
              >
                {isLogin ? "Sign up" : "Log in"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right side - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-sidebar p-8 xl:p-12">
        <div className="text-center space-y-6 max-w-lg">
          <div className="relative mx-auto w-48 h-48 xl:w-64 xl:h-64">
            <div className="absolute inset-0 bg-gradient-primary opacity-20 blur-3xl rounded-full" />
            <div className="relative bg-card/10 backdrop-blur-sm rounded-3xl p-6 xl:p-8 border border-primary/20">
              <div className="space-y-4">
                <div className="h-3 xl:h-4 bg-primary/30 rounded" />
                <div className="h-3 xl:h-4 bg-primary/20 rounded w-3/4" />
                <div className="h-3 xl:h-4 bg-primary/10 rounded w-1/2" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl xl:text-2xl font-bold text-sidebar-foreground">
              Stay organized. Stay productive!
            </h2>
            <p className="text-sm xl:text-base text-sidebar-foreground/70">
              Simplify task management, boost efficiency, and keep your workflow
              seamless.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
