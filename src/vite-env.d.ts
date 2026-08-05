/// <reference types="vite/client" />

declare module 'lucide-react' {
  import * as React from 'react';
  
  export interface LucideProps extends React.SVGProps<SVGSVGElement> {
    size?: number | string;
    color?: string;
    stroke?: string;
    fill?: string;
    strokeWidth?: number;
  }
  
  export type LucideIcon = React.ForwardRefExoticComponent<LucideProps & React.RefAttributes<SVGSVGElement>>;
  
  export const Home: LucideIcon;
  export const MapPin: LucideIcon;
  export const Plane: LucideIcon;
  export const Map: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const Calendar: LucideIcon;
  export const ArrowLeftRight: LucideIcon;
  export const BarChart3: LucideIcon;
  export const Building2: LucideIcon;
  export const Mic: LucideIcon;
  export const Route: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Sparkles: LucideIcon;
  export const Square: LucideIcon;
  export const Navigation: LucideIcon;
  export const LogOut: LucideIcon;
  export const Bot: LucideIcon;
  export const Clock: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const Coffee: LucideIcon;
  export const ShoppingBag: LucideIcon;
  export const DoorOpen: LucideIcon;
  export const Star: LucideIcon;
  export const Volume2: LucideIcon;
  export const Info: LucideIcon;
  export const Send: LucideIcon;
  export const X: LucideIcon;
  export const MessageSquare: LucideIcon;
  export const Minimize2: LucideIcon;
  export const Maximize2: LucideIcon;
  export const Search: LucideIcon;
  export const BookOpen: LucideIcon;
  export const Music: LucideIcon;
  export const Film: LucideIcon;
  // Add more as needed
}
