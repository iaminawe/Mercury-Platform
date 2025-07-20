import type { Metadata } from "next"
import Link from "next/link"
import { 
  LayoutDashboard, 
  BarChart3, 
  ShoppingCart, 
  Package, 
  Users,
  Settings
} from "lucide-react"

export const metadata: Metadata = {
  title: "Dashboard - Mercury",
  description: "Analytics and management dashboard",
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  {
    name: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Sales Analytics",
    href: "/analytics/sales",
    icon: BarChart3,
  },
  {
    name: "Product Analytics",
    href: "/analytics/products",
    icon: Package,
  },
  {
    name: "Customer Analytics",
    href: "/analytics/customers",
    icon: Users,
  },
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <nav className="flex w-64 flex-col bg-gray-50 dark:bg-gray-900">
        <div className="flex h-16 items-center px-6 border-b">
          <h2 className="text-xl font-semibold">Mercury</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}