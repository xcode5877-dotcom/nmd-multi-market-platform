// src/ThemeProvider.tsx
import { createContext, useContext, useEffect, useMemo } from "react";
import { tenantBrandingToCssVars } from "@nmd/core";
import { jsx } from "react/jsx-runtime";
var ThemeContext = createContext(null);
function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("ThemeProvider required");
  return ctx;
}
function ThemeProvider({ branding, dir = "rtl", children }) {
  const vars = useMemo(() => tenantBrandingToCssVars(branding), [branding]);
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = dir === "rtl" ? "ar" : "en";
  }, [dir]);
  useEffect(() => {
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value2]) => {
      root.style.setProperty(key, value2);
    });
  }, [vars]);
  const value = useMemo(() => ({ branding, layoutStyle: branding.layoutStyle }), [branding]);
  return /* @__PURE__ */ jsx(ThemeContext.Provider, { value, children });
}

// src/PageHeader.tsx
import { forwardRef } from "react";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var PageHeader = forwardRef(
  ({ title, subtitle, actions, className = "" }, ref) => /* @__PURE__ */ jsxs("div", { ref, className: `flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 ${className}`, children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx2("h1", { className: "text-2xl font-bold text-gray-900", children: title }),
      subtitle && /* @__PURE__ */ jsx2("p", { className: "text-sm text-gray-500 mt-1", children: subtitle })
    ] }),
    actions && /* @__PURE__ */ jsx2("div", { className: "flex items-center gap-2 flex-shrink-0", children: actions })
  ] })
);
PageHeader.displayName = "PageHeader";

// src/FiltersBar.tsx
import { forwardRef as forwardRef2 } from "react";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var FiltersBar = forwardRef2(
  ({ search, chips, selects, className = "" }, ref) => /* @__PURE__ */ jsxs2("div", { ref, className: `flex flex-wrap items-center gap-3 mb-4 ${className}`, children: [
    search && /* @__PURE__ */ jsx3("div", { className: "flex-1 min-w-[120px]", children: search }),
    chips && /* @__PURE__ */ jsx3("div", { className: "flex flex-wrap gap-2", children: chips }),
    selects && /* @__PURE__ */ jsx3("div", { className: "flex flex-wrap gap-2", children: selects })
  ] })
);
FiltersBar.displayName = "FiltersBar";

// src/DataTable.tsx
import { forwardRef as forwardRef3 } from "react";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var DataTable = forwardRef3(
  ({ columns, rows, emptyMessage = "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A", onRowClick, className = "", ...props }, ref) => /* @__PURE__ */ jsx4("div", { ref, className: `overflow-x-auto rounded-[var(--radius)] border border-gray-200 ${className}`, ...props, children: /* @__PURE__ */ jsxs3("table", { className: "w-full text-sm", children: [
    /* @__PURE__ */ jsx4("thead", { className: "bg-gray-50 sticky top-0 z-10", children: /* @__PURE__ */ jsx4("tr", { children: columns.map((col) => /* @__PURE__ */ jsx4(
      "th",
      {
        className: `px-4 py-3 text-start font-medium text-gray-700 ${col.className ?? ""}`,
        children: col.label
      },
      col.key
    )) }) }),
    /* @__PURE__ */ jsx4("tbody", { children: rows.length === 0 ? /* @__PURE__ */ jsx4("tr", { children: /* @__PURE__ */ jsx4("td", { colSpan: columns.length, className: "px-4 py-12 text-center text-gray-500", children: emptyMessage }) }) : rows.map((row, i) => /* @__PURE__ */ jsx4(
      "tr",
      {
        onClick: () => onRowClick?.(row, i),
        className: `border-t border-gray-100 ${onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}`,
        children: columns.map((col) => /* @__PURE__ */ jsx4("td", { className: `px-4 py-3 ${col.className ?? ""}`, children: row[col.key] }, col.key))
      },
      i
    )) })
  ] }) })
);
DataTable.displayName = "DataTable";

// src/InlineBadge.tsx
import { forwardRef as forwardRef4 } from "react";
import { jsx as jsx5 } from "react/jsx-runtime";
var STATUS_STYLES = {
  PENDING: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-amber-100 text-amber-800",
  PREPARING: "bg-purple-100 text-purple-800",
  READY: "bg-green-100 text-green-800",
  COMPLETED: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-700"
};
var STATUS_LABELS = {
  PENDING: "\u062C\u062F\u064A\u062F",
  CONFIRMED: "\u062A\u0645 \u0627\u0644\u062A\u0648\u0627\u0635\u0644",
  PREPARING: "\u0642\u064A\u062F \u0627\u0644\u062A\u062D\u0636\u064A\u0631",
  READY: "\u062C\u0627\u0647\u0632",
  COMPLETED: "\u062A\u0645 \u0627\u0644\u062A\u0633\u0644\u064A\u0645",
  CANCELLED: "\u0645\u0644\u063A\u064A"
};
var InlineBadge = forwardRef4(
  ({ status, className = "", ...props }, ref) => {
    const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-700";
    const label = STATUS_LABELS[status] ?? status;
    return /* @__PURE__ */ jsx5(
      "span",
      {
        ref,
        className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style} ${className}`,
        ...props,
        children: label
      }
    );
  }
);
InlineBadge.displayName = "InlineBadge";

// src/EmptyState.tsx
import { forwardRef as forwardRef5 } from "react";
import { jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
var defaultContent = {
  "no-data": {
    title: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A",
    description: "\u0627\u0628\u062F\u0623 \u0628\u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0623\u0648\u0644\u0649"
  },
  "no-results": {
    title: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u062A\u0627\u0626\u062C",
    description: "\u062C\u0631\u0651\u0628 \u062A\u063A\u064A\u064A\u0631 \u0645\u0639\u0627\u064A\u064A\u0631 \u0627\u0644\u0628\u062D\u062B"
  },
  error: {
    title: "\u062D\u062F\u062B \u062E\u0637\u0623",
    description: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649"
  }
};
var EmptyState = forwardRef5(
  ({ variant = "no-data", title, description, icon, action, className = "" }, ref) => {
    const content = defaultContent[variant];
    return /* @__PURE__ */ jsxs4(
      "div",
      {
        ref,
        className: `flex flex-col items-center justify-center py-12 px-4 text-center ${className}`,
        children: [
          icon && /* @__PURE__ */ jsx6("div", { className: "mb-4 text-gray-400", children: icon }),
          /* @__PURE__ */ jsx6("h3", { className: "text-lg font-semibold text-gray-900 mb-1", children: title ?? content.title }),
          /* @__PURE__ */ jsx6("p", { className: "text-sm text-gray-500 mb-4", children: description ?? content.description }),
          action
        ]
      }
    );
  }
);
EmptyState.displayName = "EmptyState";

// src/LayoutShell.tsx
import { createContext as createContext2, useContext as useContext2 } from "react";
import { jsx as jsx7 } from "react/jsx-runtime";
var LAYOUT_CLASSES = {
  minimal: {
    header: "border-b border-gray-200 bg-white",
    card: "shadow-sm border border-gray-100 rounded-[var(--radius)]",
    section: "space-y-4",
    button: "rounded-sm",
    badge: "rounded-sm bg-gray-100"
  },
  cozy: {
    header: "shadow-sm bg-white rounded-b-2xl",
    card: "shadow-md rounded-2xl shadow-gray-200/50",
    section: "space-y-5",
    button: "rounded-xl",
    badge: "rounded-xl"
  },
  bold: {
    header: "shadow-md bg-primary text-white",
    card: "shadow-lg rounded-2xl border-2 border-primary/20",
    section: "space-y-6",
    button: "rounded-full font-bold",
    badge: "rounded-full font-bold"
  },
  modern: {
    header: "border-b-2 border-gray-900 bg-white",
    card: "border border-gray-200 rounded-lg",
    section: "space-y-4",
    button: "rounded-md",
    badge: "rounded-md"
  },
  default: {
    header: "shadow-sm bg-white",
    card: "shadow-md rounded-[var(--radius)]",
    section: "space-y-4",
    button: "rounded-[var(--radius)]",
    badge: "rounded-full"
  },
  compact: {
    header: "border-b border-gray-200 bg-white",
    card: "shadow-sm border border-gray-100",
    section: "space-y-2",
    button: "rounded",
    badge: "rounded"
  },
  spacious: {
    header: "shadow-md bg-white",
    card: "shadow-lg rounded-2xl",
    section: "space-y-6",
    button: "rounded-xl",
    badge: "rounded-xl"
  }
};
var LayoutContext = createContext2("default");
function useLayoutStyle() {
  try {
    const ctx = useContext2(LayoutContext);
    return ctx ?? "default";
  } catch {
    return "default";
  }
}
function LayoutShell({ layoutStyle = "default", children }) {
  return /* @__PURE__ */ jsx7(LayoutContext.Provider, { value: layoutStyle, children: /* @__PURE__ */ jsx7("div", { "data-layout-style": layoutStyle, className: "layout-shell", children }) });
}
function layoutHeaderClass(layoutStyle) {
  return LAYOUT_CLASSES[layoutStyle]?.header ?? LAYOUT_CLASSES.default.header;
}
function layoutCardClass(layoutStyle) {
  return LAYOUT_CLASSES[layoutStyle]?.card ?? LAYOUT_CLASSES.default.card;
}
function layoutSectionClass(layoutStyle) {
  return LAYOUT_CLASSES[layoutStyle]?.section ?? LAYOUT_CLASSES.default.section;
}
function layoutButtonClass(layoutStyle) {
  return LAYOUT_CLASSES[layoutStyle]?.button ?? LAYOUT_CLASSES.default.button;
}
function layoutBadgeClass(layoutStyle) {
  return LAYOUT_CLASSES[layoutStyle]?.badge ?? LAYOUT_CLASSES.default.badge;
}

// src/Button.tsx
import { forwardRef as forwardRef6 } from "react";
import { jsx as jsx8, jsxs as jsxs5 } from "react/jsx-runtime";
var Button = forwardRef6(
  ({
    variant = "primary",
    size = "md",
    loading = false,
    leftIcon,
    rightIcon,
    disabled,
    children,
    className = "",
    ...props
  }, ref) => {
    const base = "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";
    const variants = {
      primary: "bg-primary text-white hover:opacity-90",
      secondary: "bg-secondary text-gray-900 hover:opacity-90",
      outline: "border-2 border-primary text-primary hover:bg-primary/10",
      ghost: "text-primary hover:bg-primary/10",
      success: "bg-[var(--color-success,#14B8A6)] text-white hover:opacity-90"
    };
    const sizes = {
      sm: "h-8 px-3 text-sm",
      md: "h-10 px-4 text-base",
      lg: "h-12 px-6 text-lg"
    };
    return /* @__PURE__ */ jsxs5(
      "button",
      {
        ref,
        className: `${base} ${variants[variant]} ${sizes[size]} ${className}`,
        disabled: disabled || loading,
        "aria-busy": loading,
        ...props,
        children: [
          loading && /* @__PURE__ */ jsxs5(
            "svg",
            {
              className: "animate-spin h-4 w-4",
              xmlns: "http://www.w3.org/2000/svg",
              fill: "none",
              viewBox: "0 0 24 24",
              "aria-hidden": true,
              children: [
                /* @__PURE__ */ jsx8(
                  "circle",
                  {
                    className: "opacity-25",
                    cx: "12",
                    cy: "12",
                    r: "10",
                    stroke: "currentColor",
                    strokeWidth: "4"
                  }
                ),
                /* @__PURE__ */ jsx8(
                  "path",
                  {
                    className: "opacity-75",
                    fill: "currentColor",
                    d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  }
                )
              ]
            }
          ),
          !loading && leftIcon,
          children,
          !loading && rightIcon
        ]
      }
    );
  }
);
Button.displayName = "Button";

// src/Card.tsx
import { forwardRef as forwardRef7 } from "react";
import { jsx as jsx9 } from "react/jsx-runtime";
var Card = forwardRef7(
  ({ variant = "elevated", className = "", children, ...props }, ref) => {
    const variantStyles = {
      elevated: "bg-white shadow-md",
      outlined: "bg-white border border-gray-200"
    };
    return /* @__PURE__ */ jsx9(
      "div",
      {
        ref,
        className: `rounded-[var(--radius)] ${variantStyles[variant]} ${className}`,
        ...props,
        children
      }
    );
  }
);
Card.displayName = "Card";

// src/Badge.tsx
import { forwardRef as forwardRef8 } from "react";
import { jsx as jsx10 } from "react/jsx-runtime";
var Badge = forwardRef8(
  ({ variant = "default", className = "", children, ...props }, ref) => {
    const variants = {
      default: "bg-gray-100 text-gray-700",
      primary: "bg-primary/20 text-primary",
      warning: "bg-amber-100 text-amber-800",
      error: "bg-red-100 text-red-700"
    };
    return /* @__PURE__ */ jsx10(
      "span",
      {
        ref,
        className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`,
        ...props,
        children
      }
    );
  }
);
Badge.displayName = "Badge";

// src/Input.tsx
import { forwardRef as forwardRef9 } from "react";
import { jsx as jsx11, jsxs as jsxs6 } from "react/jsx-runtime";
var Input = forwardRef9(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id ?? `input-${Math.random().toString(36).slice(2)}`;
    return /* @__PURE__ */ jsxs6("div", { className: "w-full", children: [
      label && /* @__PURE__ */ jsx11("label", { htmlFor: inputId, className: "block text-sm font-medium text-gray-700 mb-1 ms-1", children: label }),
      /* @__PURE__ */ jsx11(
        "input",
        {
          ref,
          id: inputId,
          className: `w-full h-10 ps-3 pe-3 rounded-[var(--radius)] border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${className}`,
          "aria-invalid": !!error,
          "aria-describedby": error ? `${inputId}-error` : void 0,
          ...props
        }
      ),
      error && /* @__PURE__ */ jsx11("p", { id: `${inputId}-error`, className: "mt-1 text-sm text-red-600 ms-1", role: "alert", children: error })
    ] });
  }
);
Input.displayName = "Input";

// src/Select.tsx
import { forwardRef as forwardRef10 } from "react";
import { jsx as jsx12, jsxs as jsxs7 } from "react/jsx-runtime";
var Select = forwardRef10(
  ({ label, options, error, id, className = "", ...props }, ref) => {
    const selectId = id ?? `select-${Math.random().toString(36).slice(2)}`;
    return /* @__PURE__ */ jsxs7("div", { className: "w-full", children: [
      label && /* @__PURE__ */ jsx12("label", { htmlFor: selectId, className: "block text-sm font-medium text-gray-700 mb-1 ms-1", children: label }),
      /* @__PURE__ */ jsx12(
        "select",
        {
          ref,
          id: selectId,
          className: `w-full h-10 px-3 rounded-[var(--radius)] border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${className}`,
          "aria-invalid": !!error,
          "aria-describedby": error ? `${selectId}-error` : void 0,
          ...props,
          children: options.map((opt) => /* @__PURE__ */ jsx12("option", { value: opt.value, children: opt.label }, opt.value))
        }
      ),
      error && /* @__PURE__ */ jsx12("p", { id: `${selectId}-error`, className: "mt-1 text-sm text-red-600 ms-1", role: "alert", children: error })
    ] });
  }
);
Select.displayName = "Select";

// src/Tabs.tsx
import { createContext as createContext3, useContext as useContext3 } from "react";
import { jsx as jsx13 } from "react/jsx-runtime";
var TabsContext = createContext3(null);
function useTabs() {
  const ctx = useContext3(TabsContext);
  if (!ctx) throw new Error("Tabs components must be used within Tabs");
  return ctx;
}
function Tabs({ value, onChange, children, className = "" }) {
  return /* @__PURE__ */ jsx13(TabsContext.Provider, { value: { value, onChange }, children: /* @__PURE__ */ jsx13("div", { className, role: "tablist", children }) });
}
function TabsList({ children, className = "" }) {
  return /* @__PURE__ */ jsx13("div", { className: `flex gap-1 border-b border-gray-200 mb-2 ${className}`, children });
}
function TabsTrigger({ value, children, className = "" }) {
  const { value: active, onChange } = useTabs();
  const isActive = active === value;
  return /* @__PURE__ */ jsx13(
    "button",
    {
      type: "button",
      role: "tab",
      "aria-selected": isActive,
      tabIndex: isActive ? 0 : -1,
      onClick: () => onChange(value),
      className: `px-4 py-2 text-sm font-medium transition-colors rounded-t-[var(--radius)] ${isActive ? "bg-primary text-white" : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"} ${className}`,
      children
    }
  );
}
function TabsContent({ value, children, className = "" }) {
  const { value: active } = useTabs();
  if (active !== value) return null;
  return /* @__PURE__ */ jsx13("div", { role: "tabpanel", className, children });
}

// src/Modal.tsx
import { useEffect as useEffect2 } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { jsx as jsx14, jsxs as jsxs8 } from "react/jsx-runtime";
function Modal({ open, onClose, title, children, size = "md" }) {
  useEffect2(() => {
    const handleEscape = (e) => e.key === "Escape" && onClose();
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  const sizes = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };
  return /* @__PURE__ */ jsx14(AnimatePresence, { children: open && /* @__PURE__ */ jsxs8(
    "div",
    {
      className: "fixed inset-0 z-50 flex items-center justify-center p-4",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": title ? "modal-title" : void 0,
      children: [
        /* @__PURE__ */ jsx14(
          motion.div,
          {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            onClick: onClose,
            className: "absolute inset-0 bg-black/50"
          }
        ),
        /* @__PURE__ */ jsxs8(
          motion.div,
          {
            initial: { opacity: 0, scale: 0.95 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 0.95 },
            transition: { duration: 0.2 },
            className: `relative w-full ${sizes[size]} bg-white rounded-[var(--radius)] shadow-xl`,
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxs8("div", { className: "flex items-center justify-between p-4 border-b border-gray-200", children: [
                title && /* @__PURE__ */ jsx14("h2", { id: "modal-title", className: "text-lg font-semibold", children: title }),
                /* @__PURE__ */ jsx14(Button, { variant: "ghost", size: "sm", onClick: onClose, "aria-label": "Close", children: /* @__PURE__ */ jsx14(X, { className: "w-5 h-5" }) })
              ] }),
              /* @__PURE__ */ jsx14("div", { className: "p-4", children })
            ]
          }
        )
      ]
    }
  ) });
}

// src/ConfirmDialog.tsx
import { jsx as jsx15, jsxs as jsxs9 } from "react/jsx-runtime";
function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "\u062A\u0623\u0643\u064A\u062F",
  message,
  confirmLabel = "\u062A\u0623\u0643\u064A\u062F",
  cancelLabel = "\u0625\u0644\u063A\u0627\u0621",
  variant = "danger",
  loading = false
}) {
  const handleConfirm = () => {
    onConfirm();
    if (!loading) onClose();
  };
  const confirmClass = variant === "danger" ? "bg-red-600 hover:bg-red-700 text-white" : variant === "warning" ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-primary hover:bg-primary/90 text-white";
  return /* @__PURE__ */ jsx15(Modal, { open, onClose, title, size: "sm", children: /* @__PURE__ */ jsxs9("div", { className: "space-y-4", children: [
    /* @__PURE__ */ jsx15("p", { className: "text-gray-600", children: message }),
    /* @__PURE__ */ jsxs9("div", { className: "flex gap-2 justify-end", children: [
      /* @__PURE__ */ jsx15(Button, { variant: "ghost", onClick: onClose, disabled: loading, children: cancelLabel }),
      /* @__PURE__ */ jsx15(Button, { onClick: handleConfirm, disabled: loading, className: confirmClass, children: loading ? /* @__PURE__ */ jsxs9("span", { className: "inline-flex items-center gap-2", children: [
        /* @__PURE__ */ jsx15("span", { className: "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" }),
        "\u062C\u0627\u0631\u064A..."
      ] }) : confirmLabel })
    ] })
  ] }) });
}

// src/Drawer.tsx
import { useEffect as useEffect3 } from "react";
import { motion as motion2, AnimatePresence as AnimatePresence2 } from "framer-motion";
import { X as X2 } from "lucide-react";
import { jsx as jsx16, jsxs as jsxs10 } from "react/jsx-runtime";
function Drawer({ open, onClose, title, children, side = "end" }) {
  useEffect3(() => {
    const handleEscape = (e) => e.key === "Escape" && onClose();
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  const isRtl = document.documentElement.dir === "rtl";
  const fromStart = side === "start";
  const fromEnd = side === "end";
  const xOffset = fromStart ? isRtl ? "100%" : "-100%" : fromEnd ? isRtl ? "-100%" : "100%" : "100%";
  return /* @__PURE__ */ jsx16(AnimatePresence2, { children: open && /* @__PURE__ */ jsxs10(
    "div",
    {
      className: "fixed inset-0 z-50 flex",
      style: { justifyContent: fromStart ? "flex-start" : "flex-end" },
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": title ? "drawer-title" : void 0,
      children: [
        /* @__PURE__ */ jsx16(
          motion2.div,
          {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            onClick: onClose,
            className: "absolute inset-0 bg-black/50"
          }
        ),
        /* @__PURE__ */ jsxs10(
          motion2.div,
          {
            initial: { x: xOffset },
            animate: { x: 0 },
            exit: { x: xOffset },
            transition: { type: "spring", stiffness: 300, damping: 30 },
            className: "relative w-full max-w-sm bg-white shadow-2xl h-full overflow-auto",
            onClick: (e) => e.stopPropagation(),
            children: [
              /* @__PURE__ */ jsxs10("div", { className: "flex items-center justify-between p-4 border-b border-gray-200", children: [
                title && /* @__PURE__ */ jsx16("h2", { id: "drawer-title", className: "text-lg font-semibold", children: title }),
                /* @__PURE__ */ jsx16(Button, { variant: "ghost", size: "sm", onClick: onClose, "aria-label": "Close", children: /* @__PURE__ */ jsx16(X2, { className: "w-5 h-5" }) })
              ] }),
              /* @__PURE__ */ jsx16("div", { className: "p-4", children })
            ]
          }
        )
      ]
    }
  ) });
}

// src/Skeleton.tsx
import { forwardRef as forwardRef11 } from "react";
import { jsx as jsx17 } from "react/jsx-runtime";
var Skeleton = forwardRef11(
  ({ variant = "rectangular", className = "", ...props }, ref) => {
    const variants = {
      text: "rounded h-4",
      circular: "rounded-full",
      rectangular: "rounded-[var(--radius)]"
    };
    return /* @__PURE__ */ jsx17(
      "div",
      {
        ref,
        className: `animate-pulse bg-gray-200 ${variants[variant]} ${className}`,
        "aria-busy": "true",
        "aria-hidden": "true",
        ...props
      }
    );
  }
);
Skeleton.displayName = "Skeleton";

// src/Toast.tsx
import { createContext as createContext4, useContext as useContext4, useState, useCallback } from "react";
import { motion as motion3, AnimatePresence as AnimatePresence3 } from "framer-motion";
import { jsx as jsx18, jsxs as jsxs11 } from "react/jsx-runtime";
var ToastContext = createContext4(null);
function useToast() {
  const ctx = useContext4(ToastContext);
  if (!ctx) throw new Error("ToastProvider required");
  return ctx;
}
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const addToast = useCallback((message, variant = "info") => {
    const id = crypto.randomUUID?.() ?? `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4e3);
  }, []);
  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  return /* @__PURE__ */ jsxs11(ToastContext.Provider, { value: { toasts, addToast, removeToast }, children: [
    children,
    /* @__PURE__ */ jsx18(ToastContainer, { toasts, onRemove: removeToast })
  ] });
}
var VARIANT_STYLES = {
  success: "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20",
  error: "bg-red-600 text-white shadow-lg shadow-red-900/20",
  info: "bg-gray-800 text-white shadow-lg"
};
function ToastContainer({
  toasts,
  onRemove
}) {
  return /* @__PURE__ */ jsx18(
    "div",
    {
      className: "fixed bottom-4 start-4 z-[100] flex flex-col gap-2",
      style: { direction: "ltr" },
      role: "region",
      "aria-label": "Notifications",
      children: /* @__PURE__ */ jsx18(AnimatePresence3, { children: toasts.map((t) => /* @__PURE__ */ jsxs11(
        motion3.div,
        {
          initial: { opacity: 0, y: 20, x: 20 },
          animate: { opacity: 1, y: 0, x: 0 },
          exit: { opacity: 0, x: 20 },
          transition: { type: "tween", duration: 0.25 },
          className: `px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 min-w-[200px] ${VARIANT_STYLES[t.variant ?? "info"]}`,
          children: [
            t.variant === "success" && /* @__PURE__ */ jsx18("span", { className: "w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0", children: "\u2713" }),
            t.variant === "error" && /* @__PURE__ */ jsx18("span", { className: "w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0", children: "!" }),
            /* @__PURE__ */ jsx18("span", { className: "flex-1", children: t.message }),
            /* @__PURE__ */ jsx18(
              "button",
              {
                type: "button",
                onClick: () => onRemove(t.id),
                className: "opacity-70 hover:opacity-100 transition-opacity shrink-0",
                "aria-label": "\u0625\u063A\u0644\u0627\u0642",
                children: "\xD7"
              }
            )
          ]
        },
        t.id
      )) })
    }
  );
}

// src/TenantSwitcher.tsx
import { useState as useState2 } from "react";
import { Store } from "lucide-react";
import { Fragment, jsx as jsx19, jsxs as jsxs12 } from "react/jsx-runtime";
function TenantSwitcher({ tenants, currentTenant, onSelect, className = "", visible = true }) {
  const [open, setOpen] = useState2(false);
  if (!visible) return null;
  const current = tenants.find((t) => t.slug === currentTenant || t.id === currentTenant);
  return /* @__PURE__ */ jsxs12("div", { className: `relative ${className}`, children: [
    /* @__PURE__ */ jsxs12(
      "button",
      {
        type: "button",
        onClick: () => setOpen((o) => !o),
        className: "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 bg-white hover:bg-gray-50",
        "aria-expanded": open,
        "aria-haspopup": "listbox",
        children: [
          /* @__PURE__ */ jsx19(Store, { className: "w-4 h-4 text-gray-500" }),
          /* @__PURE__ */ jsx19("span", { children: current?.name ?? "Select tenant" })
        ]
      }
    ),
    open && /* @__PURE__ */ jsxs12(Fragment, { children: [
      /* @__PURE__ */ jsx19("div", { className: "fixed inset-0 z-40", onClick: () => setOpen(false), "aria-hidden": true }),
      /* @__PURE__ */ jsx19(
        "ul",
        {
          role: "listbox",
          className: "absolute top-full mt-1 end-0 z-50 min-w-[180px] py-1 bg-white border border-gray-200 rounded-lg shadow-lg",
          children: tenants.map((t) => /* @__PURE__ */ jsx19("li", { role: "option", children: /* @__PURE__ */ jsx19(
            "button",
            {
              type: "button",
              onClick: () => {
                onSelect(t.slug);
                setOpen(false);
              },
              className: `w-full text-start px-3 py-2 text-sm hover:bg-gray-100 ${t.slug === currentTenant || t.id === currentTenant ? "bg-primary/10 text-primary" : ""}`,
              children: t.name
            }
          ) }, t.id))
        }
      )
    ] })
  ] });
}
export {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  FiltersBar,
  InlineBadge,
  Input,
  LayoutShell,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TenantSwitcher,
  ThemeProvider,
  ToastProvider,
  layoutBadgeClass,
  layoutButtonClass,
  layoutCardClass,
  layoutHeaderClass,
  layoutSectionClass,
  useLayoutStyle,
  useTheme,
  useToast
};
