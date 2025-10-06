import { Hexagon } from "lucide-react";

export const Logo = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        <Hexagon className="h-8 w-8 text-primary fill-primary/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-primary" />
        </div>
      </div>
      <span className="text-xl font-bold">OneApp</span>
    </div>
  );
};
