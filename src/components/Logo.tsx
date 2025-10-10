import oneappLogo from "/oneapp.png";
import oneappLogo1 from "/oneapp1.png";

export const Logo = ({
  className = "",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "sidebar";
}) => {
  const logoSrc = variant === "sidebar" ? oneappLogo1 : oneappLogo;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logoSrc}
        alt="OneApp Logo"
        className="h-8 w-auto object-contain"
      />
    </div>
  );
};
