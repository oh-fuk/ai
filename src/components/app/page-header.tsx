import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  badge?: string;
};

export default function PageHeader({
  title,
  description,
  align = "left",
  className,
  badge,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1", align === "center" && "items-center text-center", className)}>
      {badge && (
        <span className="badge-pill w-fit">{badge}</span>
      )}
      <h1 className={cn(
        "font-headline font-bold tracking-tight text-foreground",
        "text-2xl sm:text-3xl"
      )}>
        {title}
      </h1>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
          {description}
        </p>
      )}
    </div>
  );
}
