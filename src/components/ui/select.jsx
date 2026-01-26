import * as React from "react";

import { cn } from "@/lib/utils";

const Select = React.forwardRef(
  ({ className, children, placeholder, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "appearance-none bg-no-repeat bg-right",
          "md:text-sm",
          // Custom dropdown arrow using CSS
          "pr-10",
          className,
        )}
        ref={ref}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: "right 0.5rem center",
          backgroundSize: "1.5em 1.5em",
          ...props.style,
        }}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
    );
  },
);
Select.displayName = "Select";

const SelectOption = React.forwardRef(({ className, ...props }, ref) => {
  return <option className={cn(className)} ref={ref} {...props} />;
});
SelectOption.displayName = "SelectOption";

export { Select, SelectOption };
