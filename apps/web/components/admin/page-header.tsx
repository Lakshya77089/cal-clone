import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  descriptionClassName,
  action,
  className,
}: {
  title: string;
  description?: string;
  descriptionClassName?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-start justify-between gap-4", className)}>
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className={cn("mt-1 text-sm text-muted-foreground", descriptionClassName)}>
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
