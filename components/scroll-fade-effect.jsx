import { cn } from "@/js/utils/cn"

export function ScrollFadeEffect({
  className,
  orientation = "vertical",
  ...props
}) {
  return (
    <div
      data-orientation={orientation}
      className={cn(
        "data-[orientation=horizontal]:overflow-x-auto data-[orientation=vertical]:overflow-y-auto",
        "data-[orientation=horizontal]:scroll-fade-effect-x data-[orientation=vertical]:scroll-fade-effect-y",
        className
      )}
      {...props} />
  );
}
