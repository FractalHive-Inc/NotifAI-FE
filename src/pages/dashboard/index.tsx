import { useNavigate } from 'react-router-dom'
import { Mail, FileText, Receipt, Clock3, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/shared/hooks/useAuth'
import { useDashboardStats } from '@/shared/hooks/useDashboard'
import { Card, CardContent } from '@/shared/components/ui/card/card'
import { Button } from '@/shared/components/ui/button/button'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: stats, isLoading } = useDashboardStats()

  const statCards = [
    {
      label: 'Emails',
      value: stats?.total_emails ?? 0,
      icon: <Mail className="h-5 w-5 text-blue-600" />,
      iconWrapClass: 'bg-blue-50',
      href: '/emails',
    },
    {
      label: 'Documents',
      value: stats?.total_documents ?? 0,
      icon: <FileText className="h-5 w-5 text-violet-600" />,
      iconWrapClass: 'bg-violet-50',
      href: '/documents',
    },
    {
      label: 'Invoices',
      value: stats?.total_invoices ?? 0,
      icon: <Receipt className="h-5 w-5 text-emerald-600" />,
      iconWrapClass: 'bg-emerald-50',
      href: '/documents',
    },
    {
      label: 'Pending Reviews',
      value: stats?.pending_reviews ?? 0,
      icon: <Clock3 className="h-5 w-5 text-amber-600" />,
      iconWrapClass: 'bg-amber-50',
      href: '/documents',
    },
  ]

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-[#043463] sm:text-3xl lg:text-4xl">
        Welcome, {user?.name || 'User'}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        Here&apos;s an overview of your NotifAI system
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            role="button"
            tabIndex={0}
            onClick={() => navigate(stat.href)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate(stat.href)
              }
            }}
            className="cursor-pointer rounded-xl border-[#e4e7ec] py-5 shadow-none transition-colors hover:border-[#c8d0db]"
          >
            <CardContent className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${stat.iconWrapClass}`}>{stat.icon}</div>
              <div>
                <p className="text-2xl font-bold text-[#0f172a]">
                  {isLoading ? '...' : stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold text-[#0f172a] sm:text-xl">Quick Actions</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => toast.info('Email upload coming soon')}
            className="bg-[#101f45] text-white hover:bg-[#142958]"
          >
            <Upload className="h-4 w-4" />
            Upload New Email
          </Button>
          <Button variant="outline" onClick={() => navigate('/documents')}>
            <Receipt className="h-4 w-4" />
            Review Invoices
          </Button>
          <Button variant="outline" onClick={() => navigate('/documents')}>
            <FileText className="h-4 w-4" />
            View Documents
          </Button>
        </div>
      </div>
    </div>
  )
}
