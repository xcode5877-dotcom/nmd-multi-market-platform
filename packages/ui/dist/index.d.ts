import * as react_jsx_runtime from 'react/jsx-runtime';
import { TenantBranding } from '@nmd/core';
import * as react from 'react';
import { ReactNode } from 'react';

interface ThemeContextValue {
    branding: TenantBranding;
    layoutStyle: TenantBranding['layoutStyle'];
}
declare function useTheme(): ThemeContextValue;
interface ThemeProviderProps {
    branding: TenantBranding;
    dir?: 'ltr' | 'rtl';
    children: React.ReactNode;
}
declare function ThemeProvider({ branding, dir, children }: ThemeProviderProps): react_jsx_runtime.JSX.Element;

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
    className?: string;
}
declare const PageHeader: react.ForwardRefExoticComponent<PageHeaderProps & react.RefAttributes<HTMLDivElement>>;

interface FiltersBarProps {
    search?: React.ReactNode;
    chips?: React.ReactNode;
    selects?: React.ReactNode;
    className?: string;
}
declare const FiltersBar: react.ForwardRefExoticComponent<FiltersBarProps & react.RefAttributes<HTMLDivElement>>;

interface DataTableProps extends React.HTMLAttributes<HTMLDivElement> {
    columns: {
        key: string;
        label: string;
        className?: string;
    }[];
    rows: Record<string, React.ReactNode>[];
    emptyMessage?: string;
    onRowClick?: (row: Record<string, React.ReactNode>, index: number) => void;
}
declare const DataTable: react.ForwardRefExoticComponent<DataTableProps & react.RefAttributes<HTMLDivElement>>;

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
interface InlineBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    status: OrderStatus | string;
}
declare const InlineBadge: react.ForwardRefExoticComponent<InlineBadgeProps & react.RefAttributes<HTMLSpanElement>>;

type EmptyStateVariant = 'no-data' | 'no-results' | 'error';
interface EmptyStateProps {
    variant?: EmptyStateVariant;
    title?: string;
    description?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}
declare const EmptyState: react.ForwardRefExoticComponent<EmptyStateProps & react.RefAttributes<HTMLDivElement>>;

type LayoutStyle = TenantBranding['layoutStyle'];
declare function useLayoutStyle(): LayoutStyle;
interface LayoutShellProps {
    layoutStyle?: LayoutStyle;
    children: React.ReactNode;
}
declare function LayoutShell({ layoutStyle, children }: LayoutShellProps): react_jsx_runtime.JSX.Element;
declare function layoutHeaderClass(layoutStyle: LayoutStyle): string;
declare function layoutCardClass(layoutStyle: LayoutStyle): string;
declare function layoutSectionClass(layoutStyle: LayoutStyle): string;
declare function layoutButtonClass(layoutStyle: LayoutStyle): string;
declare function layoutBadgeClass(layoutStyle: LayoutStyle): string;

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'success';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}
declare const Button: react.ForwardRefExoticComponent<ButtonProps & react.RefAttributes<HTMLButtonElement>>;

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'elevated' | 'outlined';
}
declare const Card: react.ForwardRefExoticComponent<CardProps & react.RefAttributes<HTMLDivElement>>;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'default' | 'primary' | 'warning' | 'error';
}
declare const Badge: react.ForwardRefExoticComponent<BadgeProps & react.RefAttributes<HTMLSpanElement>>;

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}
declare const Input: react.ForwardRefExoticComponent<InputProps & react.RefAttributes<HTMLInputElement>>;

interface SelectOption {
    value: string;
    label: string;
}
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
    label?: string;
    options: SelectOption[];
    error?: string;
}
declare const Select: react.ForwardRefExoticComponent<SelectProps & react.RefAttributes<HTMLSelectElement>>;

interface TabsProps {
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
    className?: string;
}
declare function Tabs({ value, onChange, children, className }: TabsProps): react_jsx_runtime.JSX.Element;
interface TabsListProps {
    children: React.ReactNode;
    className?: string;
}
declare function TabsList({ children, className }: TabsListProps): react_jsx_runtime.JSX.Element;
interface TabsTriggerProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}
declare function TabsTrigger({ value, children, className }: TabsTriggerProps): react_jsx_runtime.JSX.Element;
interface TabsContentProps {
    value: string;
    children: React.ReactNode;
    className?: string;
}
declare function TabsContent({ value, children, className }: TabsContentProps): react_jsx_runtime.JSX.Element | null;

interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg';
    /** Use for stacking above other modals (e.g. 100000 above contest popup at 99999). */
    zIndex?: number;
}
declare function Modal({ open, onClose, title, children, size, zIndex }: ModalProps): react_jsx_runtime.JSX.Element;

interface ConfirmDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
    loading?: boolean;
    /** When false, dialog does not close after onConfirm (caller closes via onClose when done). Default true. */
    closeOnConfirm?: boolean;
}
declare function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel, cancelLabel, variant, loading, closeOnConfirm, }: ConfirmDialogProps): react_jsx_runtime.JSX.Element;

interface DrawerProps {
    open: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    side?: 'start' | 'end';
    /** Applied to the drawer panel (e.g. w-full max-w-full md:max-w-sm for full width on mobile) */
    contentClassName?: string;
}
declare function Drawer({ open, onClose, title, children, side, contentClassName }: DrawerProps): react_jsx_runtime.JSX.Element;

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'text' | 'circular' | 'rectangular';
}
declare const Skeleton: react.ForwardRefExoticComponent<SkeletonProps & react.RefAttributes<HTMLDivElement>>;

type ToastVariant = 'success' | 'error' | 'info';
interface ToastItem {
    id: string;
    message: string;
    variant?: ToastVariant;
}
interface ToastContextValue {
    toasts: ToastItem[];
    addToast: (message: string, variant?: ToastVariant) => void;
    removeToast: (id: string) => void;
}
declare function useToast(): ToastContextValue;
declare function ToastProvider({ children }: {
    children: ReactNode;
}): react_jsx_runtime.JSX.Element;

interface TenantOption {
    id: string;
    slug: string;
    name: string;
}
interface TenantSwitcherProps {
    tenants: TenantOption[];
    currentTenant: string;
    onSelect: (slugOrId: string) => void;
    className?: string;
    /** Set to false in production to hide. Pass import.meta.env.DEV from Vite apps. */
    visible?: boolean;
}
/**
 * Dev-only tenant switcher. Pass visible={import.meta.env.DEV} to hide in production.
 */
declare function TenantSwitcher({ tenants, currentTenant, onSelect, className, visible }: TenantSwitcherProps): react_jsx_runtime.JSX.Element | null;

/** Whole: 100% filled circle */
declare function WholeCircleIcon({ className }: {
    className?: string;
}): react_jsx_runtime.JSX.Element;
/** Left half: circle with only the LEFT 50% filled (النصف الأيسر) */
declare function LeftHalfCircleIcon({ className }: {
    className?: string;
}): react_jsx_runtime.JSX.Element;
/** Right half: circle with only the RIGHT 50% filled (النصف الأيمن) */
declare function RightHalfCircleIcon({ className }: {
    className?: string;
}): react_jsx_runtime.JSX.Element;
type Placement = 'WHOLE' | 'LEFT' | 'RIGHT';
declare function PlacementIcon({ placement, className }: {
    placement: Placement;
    className?: string;
}): ReactNode;

export { Badge, Button, Card, ConfirmDialog, DataTable, Drawer, EmptyState, FiltersBar, InlineBadge, Input, LayoutShell, LeftHalfCircleIcon, Modal, PageHeader, type Placement, PlacementIcon, RightHalfCircleIcon, Select, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger, TenantSwitcher, ThemeProvider, ToastProvider, WholeCircleIcon, layoutBadgeClass, layoutButtonClass, layoutCardClass, layoutHeaderClass, layoutSectionClass, useLayoutStyle, useTheme, useToast };
